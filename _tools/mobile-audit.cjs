// Mobile layout audit for all HTML pages of the site.
// Usage: node _tools/mobile-audit.cjs [<base-url>] [<site-dir>] [<out.json>] [widths=360,390,768] [--root <site-dir>]
// Defaults: base-url http://127.0.0.1:8765/, site-dir is the folder above _tools,
// out.json goes to the temp folder. Redirect pages (meta refresh) are skipped.
// Checks per page and width: horizontal overflow, elements sticking out of the
// viewport, text overflowing its box, font sizes below 12px, small tap targets,
// distorted images and content hidden behind the fixed tenant dock.
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const args = process.argv.slice(2);
const rootAt = args.indexOf("--root");
const rootArg = rootAt >= 0 ? args.splice(rootAt, 2)[1] : null;
const base = (args[0] || "http://127.0.0.1:8765/").replace(/\/*$/, "/");
const siteDir = rootArg || args[1] || path.join(__dirname, "..");
const outFile = args[2] || path.join(os.tmpdir(), "pani-mobile-audit.json");
const widths = (args[3] || "360,390,768").split(",").map(Number);
const isRedirect = (f) => /<meta\b[^>]*http-equiv="refresh"/i.test(fs.readFileSync(path.join(siteDir, f), "utf8"));
const pages = fs
  .readdirSync(siteDir)
  .filter((f) => f.endsWith(".html") && !isRedirect(f))
  .sort();

const port = 9400 + Math.floor(Math.random() * 500);
// Wegwerf-Profil im Temp-Ordner, damit im Repo nichts liegen bleibt und
// mehrere Läufe sich nicht gegenseitig sperren.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pani-audit-"));
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

const probe = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { scrollWidth: document.documentElement.scrollWidth, vw, stickOut: [], textOverflow: [], tinyText: [], smallTargets: [], distorted: [], underDock: [] };
  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    const t = (el.innerText || el.getAttribute('alt') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return t ? s + ' "' + t + '"' : s;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const clippedByAncestor = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflow)) return true;
    }
    return false;
  };
  const all = [...document.body.querySelectorAll('*')].filter((el) => !el.closest('svg') || el.tagName === 'svg');
  for (const el of all) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.position !== 'fixed' && (r.right > vw + 1 || r.left < -1) && !clippedByAncestor(el) && !el.classList.contains('skip-link') && !el.classList.contains('sr-only')) {
      out.stickOut.push(label(el) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    }
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'visible' && el.clientWidth > 0 && !['svg','img','picture','video','iframe','select','input','textarea','table','thead','tbody','tr','html','body'].includes(el.tagName.toLowerCase())) {
      out.textOverflow.push(label(el) + ' [' + el.scrollWidth + '>' + el.clientWidth + ']');
    }
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (ownText && parseFloat(cs.fontSize) < 12 && !el.closest('.sr-only')) {
      out.tinyText.push(label(el) + ' [' + cs.fontSize + ']');
    }
    if (el.matches('a[href], button, summary, input:not([type=hidden]), select, textarea') && !el.closest('.sr-only') && !el.classList.contains('skip-link')) {
      const inline = cs.display === 'inline' && el.closest('p, li, figcaption, address, small, .footer-credit');
      if (!inline && (r.height < 32 || r.width < 32)) out.smallTargets.push(label(el) + ' [' + Math.round(r.width) + 'x' + Math.round(r.height) + ']');
    }
    if (el.tagName === 'IMG' && el.naturalWidth && cs.objectFit !== 'cover' && cs.objectFit !== 'contain') {
      const a1 = el.naturalWidth / el.naturalHeight, a2 = r.width / r.height;
      if (Math.abs(a1 - a2) / a1 > 0.04) out.distorted.push(label(el) + ' [nat ' + a1.toFixed(2) + ' vs ' + a2.toFixed(2) + ']');
    }
  }
  const dock = document.querySelector('.tenant-dock');
  out.bodyPaddingBottom = getComputedStyle(document.body).paddingBottom;
  out.dockHeight = dock && visible(dock) ? Math.round(dock.getBoundingClientRect().height) : 0;
  return JSON.stringify(out);
})()`;

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
  await send("Page.enable");
  const results = {};
  for (const width of widths) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 2, mobile: width < 800 });
    for (const page of pages) {
      await send("Page.navigate", { url: base + page });
      await sleep(900);
      const r = await send("Runtime.evaluate", { expression: probe });
      const data = JSON.parse(r.result.value);
      results[`${page}@${width}`] = data;
      const flags = [
        data.scrollWidth > data.vw ? `UEBERLAUF ${data.scrollWidth}>${data.vw}` : "",
        data.stickOut.length ? `ragt raus ${data.stickOut.length}` : "",
        data.textOverflow.length ? `Text zu breit ${data.textOverflow.length}` : "",
        data.tinyText.length ? `<12px ${data.tinyText.length}` : "",
        data.smallTargets.length ? `kleine Tippflaechen ${data.smallTargets.length}` : "",
        data.distorted.length ? `verzerrt ${data.distorted.length}` : "",
      ].filter(Boolean);
      console.log(`${page}@${width}: ${flags.join(", ") || "ok"}`);
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
  console.log(`Ergebnis: ${outFile}`);
  try {
    await send("Browser.close");
  } catch {}
  quit(0);
})().catch((e) => {
  console.error(e);
  quit(1);
});
