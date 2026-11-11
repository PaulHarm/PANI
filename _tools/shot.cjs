// Full-page screenshot with a real emulated viewport width (Chrome's window
// minimum of 500 px makes --window-size useless below that).
// Usage: node _tools/shot.cjs <url> <width> <out.png> [<url> <width> <out.png> ...]
// Aufgenommen wird mit reduzierter Bewegung (prefers-reduced-motion), damit kein
// Bild mitten in einer Animation entsteht. Weiterleitungsseiten (meta refresh)
// werden übersprungen.
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const jobs = [];
for (let i = 2; i + 2 < process.argv.length; i += 3) {
  jobs.push({ url: process.argv[i], width: +process.argv[i + 1], out: process.argv[i + 2] });
}
if (!jobs.length) {
  console.error("usage: node _tools/shot.cjs <url> <width> <out.png> ...");
  process.exit(2);
}
const port = 9400 + Math.floor(Math.random() * 500);
// Wegwerf-Profil im Temp-Ordner, damit im Repo nichts liegen bleibt und
// mehrere Läufe sich nicht gegenseitig sperren.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pani-shot-"));
// Chrome-Pfad: Vorgabe ist die übliche Windows-Installation, überschreibbar
// mit der Umgebungsvariable CHROME_PATH.
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--force-prefers-reduced-motion",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1200,900",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore"] },
);
// Chrome beenden, Profil entfernen, mit dem Fehlercode enden.
const quit = (code) => {
  try {
    chrome.kill();
  } catch {}
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {}
  process.exit(code);
};
chrome.on("error", () => {
  console.error(`Chrome lässt sich nicht starten: ${CHROME}. Pfad über CHROME_PATH setzen.`);
  quit(2);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) =>
  new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path: p }, (res) => {
        let s = "";
        res.on("data", (d) => (s += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(s));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });

// Eine Weiterleitungsseite springt sofort weiter; die Aufnahme zeigte nur das Ziel.
async function isRedirect(url) {
  try {
    const html = url.startsWith("file:") ? fs.readFileSync(new URL(url), "utf8") : await (await fetch(url)).text();
    return /<meta\b[^>]*http-equiv="refresh"/i.test(html);
  } catch {
    return false;
  }
}

async function waitForTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await getJson("/json/list");
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error("chrome did not start");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((l) => l(msg));
    }
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            const msgId = ++id;
            pending.set(msgId, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id: msgId, method, params }));
          }),
        once: (method) =>
          new Promise((res) => {
            const l = (msg) => {
              if (msg.method === method) {
                listeners.splice(listeners.indexOf(l), 1);
                res(msg.params);
              }
            };
            listeners.push(l);
          }),
        close: () => ws.close(),
      }),
    );
    ws.addEventListener("error", reject);
  });
}

(async () => {
  const target = await waitForTarget();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  for (const job of jobs) {
    if (await isRedirect(job.url)) {
      console.log(job.out, "übersprungen (Weiterleitungsseite)");
      continue;
    }
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: job.width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: job.width < 800,
    });
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: job.url });
    await loaded;
    await cdp.send("Runtime.evaluate", {
      expression: "document.fonts ? document.fonts.ready.then(() => 1) : 1",
      awaitPromise: true,
    });
    const m1 = await cdp.send("Page.getLayoutMetrics");
    const fullHeight = Math.ceil(m1.cssContentSize.height);
    // Grow the viewport to the full page so lazy images load, then capture.
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: job.width,
      height: fullHeight,
      deviceScaleFactor: 1,
      mobile: job.width < 800,
    });
    await sleep(700);
    const m2 = await cdp.send("Page.getLayoutMetrics");
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: job.width,
        height: Math.ceil(m2.cssContentSize.height),
        scale: 1,
      },
    });
    fs.writeFileSync(job.out, Buffer.from(shot.data, "base64"));
    const vw = await cdp.send("Runtime.evaluate", {
      expression: "innerWidth + 'x' + document.documentElement.scrollHeight + ' scrollWidth=' + document.documentElement.scrollWidth",
    });
    console.log(job.out, vw.result.value);
  }
  try {
    await cdp.send("Browser.close");
  } catch {}
  cdp.close();
  quit(0);
})().catch((e) => {
  console.error(e);
  quit(1);
});
