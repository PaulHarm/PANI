// Prüft interne Dateiverweise und Anker aller HTML-Seiten im Website-Ordner,
// dazu die Ziele der Weiterleitungsseiten (meta refresh), die buchstabengenaue
// Schreibweise der Dateinamen und lange Gedankenstriche.
// Aufruf: node _tools/linkcheck.cjs [--root <ordner>]
// Vorgabe ist der Ordner über _tools. Der Ordner darf auch ohne --root als
// erstes Argument stehen.
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const rootAt = args.indexOf("--root");
const root = (rootAt >= 0 ? args[rootAt + 1] : args[0]) || path.join(__dirname, "..");
const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
const idCache = {};
const idsOf = (f) => {
  if (!idCache[f]) {
    const s = fs.readFileSync(path.join(root, f), "utf8");
    idCache[f] = new Set([...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  }
  return idCache[f];
};
// GitHub Pages unterscheidet Groß- und Kleinschreibung, Windows nicht.
const dirCache = {};
const existsExact = (target) => {
  let dir = root;
  for (const part of target.split("/")) {
    if (part === "" || part === ".") continue;
    if (!dirCache[dir]) dirCache[dir] = fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? new Set(fs.readdirSync(dir)) : new Set();
    if (!dirCache[dir].has(part)) return false;
    dir = path.join(dir, part);
  }
  return true;
};
let problems = 0;
const check = (f, raw) => {
  if (!raw || /^(https?:|mailto:|tel:|data:|javascript:|#$)/.test(raw)) return;
  let [p, hash] = raw.split("#");
  p = p.split("?")[0];
  if (p.startsWith("/")) p = p.slice(1);
  const target = p || f;
  if (!fs.existsSync(path.join(root, target))) {
    console.log(`MISSING  ${f} -> ${raw}`);
    problems++;
    return;
  }
  if (!existsExact(target)) {
    console.log(`CASE     ${f} -> ${raw}`);
    problems++;
    return;
  }
  if (hash && target.endsWith(".html") && !idsOf(target).has(hash)) {
    console.log(`ANCHOR   ${f} -> ${raw}`);
    problems++;
  }
  if (hash && target.endsWith(".svg")) {
    const s = fs.readFileSync(path.join(root, target), "utf8");
    if (!s.includes(`id="${hash}"`)) {
      console.log(`SYMBOL   ${f} -> ${raw}`);
      problems++;
    }
  }
};
for (const f of files) {
  const s = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of s.matchAll(/\b(?:href|src)="([^"]+)"/g)) check(f, m[1]);
  for (const m of s.matchAll(/<meta\b[^>]*http-equiv="refresh"[^>]*content="\d+;\s*url=([^"]+)"/gi)) check(f, m[1]);
  for (const m of s.matchAll(/\bsrcset="([^"]+)"/g))
    for (const part of m[1].split(",")) check(f, part.trim().split(/\s+/)[0]);
  for (const m of s.matchAll(/[\u2013\u2014]/g)) {
    problems++;
    const i = m.index;
    console.log(`DASH     ${f}: ...${s.slice(Math.max(0, i - 30), i + 30).replace(/\s+/g, " ")}...`);
  }
}
console.log(`files ${files.length}, problems ${problems}`);
process.exit(problems ? 1 : 0);
