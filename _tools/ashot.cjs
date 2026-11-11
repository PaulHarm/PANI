// Viewport screenshot (real window height, so vh-based sizes stay correct),
// scrolled so that the given selector sits at the top.
// Usage: node _tools/ashot.cjs <url> <width> <height> "<css selector>" <out.png> ["<js action>"]
// Führt vor dem Screenshot optional JS aus, z. B. das Menü öffnen:
//   "document.querySelector('[data-nav-menu]').classList.add('is-open')"
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const [url, w, h, selector, out, action] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 500);
// Wegwerf-Profil im Temp-Ordner, damit im Repo nichts liegen bleibt und
// mehrere Läufe sich nicht gegenseitig sperren.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pani-ashot-"));
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
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
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

(async () => {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      target = (await getJson("/json/list")).find((t) => t.type === "page");
    } catch {}
    if (!target) await sleep(250);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res) => {
      pending.set(++id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 800 });
  await send("Page.navigate", { url });
  await sleep(2500);
  await send("Runtime.evaluate", {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 90); } return 1; })()`,
  });
  await sleep(1200);
  if (action) {
    await send("Runtime.evaluate", { expression: action });
    await sleep(600);
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(out, `${w}x${h}`);
  try {
    await send("Browser.close");
  } catch {}
  quit(0);
})().catch((e) => {
  console.error(e);
  quit(1);
});
