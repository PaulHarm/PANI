// Führt einen JS-Ausdruck auf einer Seite aus und gibt das Ergebnis (JSON) aus.
// Usage: node _tools/eval.cjs <url> <width> <height> "<js expression>"
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const [url, w, h, expression] = process.argv.slice(2);
const port = 9700 + Math.floor(Math.random() * 90);
// Wegwerf-Profil im Temp-Ordner, damit im Repo nichts liegen bleibt und
// mehrere Läufe sich nicht gegenseitig sperren.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pani-eval-"));
// Chrome-Pfad: Vorgabe ist die übliche Windows-Installation, überschreibbar
// mit der Umgebungsvariable CHROME_PATH.
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
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
const getJson = (p) => new Promise((resolve, reject) => {
  http.get({ host: "127.0.0.1", port, path: p }, (res) => {
    let s = ""; res.on("data", (d) => (s += d)); res.on("end", () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
  }).on("error", reject);
});
(async () => {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await getJson("/json/list")).find((t) => t.type === "page"); } catch {}
    if (!target) await sleep(250);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 800 });
  await send("Page.navigate", { url });
  await sleep(2500);
  const r = await send("Runtime.evaluate", { expression: `JSON.stringify((() => (${expression}))())`, returnByValue: true, awaitPromise: true });
  console.log(r.result?.value ?? JSON.stringify(r));
  try { await send("Browser.close"); } catch {}
  quit(0);
})().catch((e) => { console.error(e); quit(1); });
