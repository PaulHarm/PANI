// Dauerhafter Website-Test. Er prueft den ganzen Ordner statisch, ohne
// Browser und ohne Server, und braucht nur Node.
// Aufruf: node --test tests/site.test.cjs
//
// Seitenarten:
//   content   Inhaltsseite
//   legal     die vier Rechtsseiten; ihr <main> ist per Pruefsumme eingefroren
//   error     404.html
//   redirect  Weiterleitungsseite, erkannt an <meta http-equiv="refresh">
//
// Jede Pruefung laeuft bis zum Ende, sammelt alle Verstoesse und meldet sie
// gemeinsam mit Datei und Zeile. Gleiche Meldungen einer Datei stehen in einer
// Zeile mit ihren Fundstellen.
//
// Wird eine Pruefung rot, ist die Website zu berichtigen, nicht die Regel.
// Erzeugte Teile (Menue, Kopf-Block, ?v=-Werte, Brotkrumen-Daten, Sitemap)
// stellt "python _tools/build.py" wieder her.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://www.pani-hv.de";
const ERROR_PAGE = "404.html";
const HOME = new Set(["index.html", "en.html"]);
const LEGAL = new Set([
  "impressum.html",
  "datenschutz.html",
  "en-imprint.html",
  "en-privacy.html",
]);

// Eingefrorener Text der Rechtsseiten: SHA-256 ueber den Ausschnitt vom ersten
// "<main" bis einschliesslich des ersten "</main>", Zeilenenden vorher auf \n
// gebracht. Berechnet am 2026-11-11 aus dem Stand 9a7f5d6 (gleich main).
// Menue, Kopf-Block und ?v=-Werte liegen ausserhalb von <main> und duerfen
// sich mechanisch aendern. Nach einer bewussten Textaenderung den neuen Wert
// aus der Fehlermeldung dieser Pruefung uebernehmen oder so berechnen
// (in einer Zeile, Dateiname am Ende):
//   node -e "const s=require('fs').readFileSync(process.argv[1],'utf8')
//     .replace(/\r\n/g,'\n');console.log(require('crypto')
//     .createHash('sha256').update(s.slice(s.indexOf('<main'),
//     s.indexOf('</main>')+7)).digest('hex'))" impressum.html
const LEGAL_MAIN_SHA256 = {
  "impressum.html":
    "5aef639affa305ce16f4241c78db452261aebc8d348d5f82bc97fc6e5ef02bac",
  "datenschutz.html":
    "78f57d692a13aa3515289935fbadadbf4cf8404688bfe5e6cd2e629f9d59dc99",
  "en-imprint.html":
    "ecebf055e1a4a1303c4bb97a60496ad81e8ffa78434b46bd066a0e3f15c29678",
  "en-privacy.html":
    "694eae79929123ee1a20244ecb9d91b384c39eed7f5d95b5d0a3fec987eb7ff7",
};

// Versionsschema: Der Wert hinter ?v= sind die ersten 10 Hex-Zeichen von sha1
// ueber den Dateiinhalt. Bei diesen Textarten wird vorher \r\n zu \n, alle
// anderen Dateien zaehlen mit ihren rohen Bytes (wie in _tools/nav.py).
const HASH_TEXT = new Set([".css", ".js", ".svg", ".webmanifest", ".json"]);
// Diese Dateiarten tragen immer ein ?v=, dazu die Icons im Wurzelordner.
const VERSION_REQUIRED = new Set([
  ".css",
  ".js",
  ".svg",
  ".webmanifest",
  ".ico",
]);
// Die Schrift wird ohne ?v= vorgeladen. Die Adresse muss genau zu url(...) in
// assets/site.css passen, sonst laedt der Browser die Schrift doppelt.
const FONT_PRELOAD = "assets/fonts/fraunces-latin.woff2";

// Skripte nach Ausloeser im <body>. Mehr als diese Tabelle laedt keine Seite.
const attribute = (name) => (page) =>
  bodyTokens(page).some((token) => token.attrs.has(name));
const className = (name) => (page) =>
  bodyTokens(page).some((token) => classes(token).includes(name));
const SCRIPTS = [
  [
    "assets/draft.js",
    [attribute("data-email-form"), attribute("data-enquiry")],
  ],
  ["assets/site.js", [() => true]],
  ["assets/energy-model.js", [attribute("data-energy")]],
  [
    "assets/experience.js",
    [attribute("data-animate"), attribute("data-energy")],
  ],
  ["assets/map.js", [attribute("data-map")]],
  ["assets/services.js", [className("services-page")]],
  ["assets/enquiry.js", [attribute("data-enquiry")]],
];
// Diese Paare muessen in dieser Reihenfolge stehen (alle Skripte laufen mit
// defer): site.js und enquiry.js benutzen window.PaniDraft, experience.js
// benutzt das Rechenmodell.
const SCRIPT_ORDER = [
  ["assets/draft.js", "assets/site.js"],
  ["assets/energy-model.js", "assets/experience.js"],
];

// Anfragewege: ein Fragebogen je Sprache und eine kleine Menge Knopftexte.
const ENQUIRY = { de: "anfrage.html", en: "en-enquiry.html" };
const BUTTON = { de: "Betreuung anfragen", en: "Request management" };
// Nur in der Menuekarte der Hauptnavigation.
const MENU_BUTTON = { de: "Zum Fragebogen", en: "Get started" };
// Nur in der Auswahl der Startseiten (a.property-cta): "<Verwaltungsart>
// anfragen" und "Request <...> management".
const HOME_BUTTON = { de: /^\S.* anfragen$/, en: /^Request \S.* management$/ };
// Die Leistungsuebersicht nennt die drei Verwaltungsarten im Inhalt.
const OVERVIEW = {
  "leistungen.html": ["weg.html", "miethaus.html", "sondereigentum.html"],
  "en-services.html": [
    "en-weg.html",
    "en-miethaus.html",
    "en-sondereigentum.html",
  ],
};

// Dateien im Wurzelordner, die neben den Seiten und assets/ ausgeliefert
// werden. Alles andere muss mit Punkt oder Unterstrich beginnen oder in
// _config.yml unter exclude stehen.
const DELIVERY = new Set([
  "CNAME",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "favicon.ico",
  "favicon.svg",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
]);

const LD_FORBIDDEN = ["telephone", "openingHours", "openingHoursSpecification"];
// Als \u-Folge geschrieben, damit diese Datei die Zeichen selbst nicht
// enthaelt.
const LONG_DASH = /[\u2013\u2014]/g;
const MIDDLE_DOT = "\u00b7";
// Die Namen entstehen erst hier durch Verkettung, damit auch diese Datei sie
// nicht nennt.
const FOUNDER_STEMS = [
  ["paul", "harm"],
  ["niclas", "paprocki"],
].map((parts) => parts.join("-"));
const FOUNDER_PHOTO = new RegExp(
  `(?:${FOUNDER_STEMS.join("|")})[\\w-]*\\.(?:jpe?g|png|webp|avif|gif|svg)`,
  "gi",
);

// ---------------------------------------------------------------------------
// Sammelnde Pruefung
// ---------------------------------------------------------------------------

function check(name, run) {
  test(name, () => {
    const problems = [];
    run((message) => problems.push(message));
    if (problems.length === 0) return;
    const count =
      problems.length === 1 ? "1 Verstoss" : `${problems.length} Verstoesse`;
    // Ohne Aufrufstapel: Er zeigt immer nur auf diese Hilfsfunktion und
    // wuerde die Liste der Verstoesse unnoetig verlaengern.
    const limit = Error.stackTraceLimit;
    Error.stackTraceLimit = 0;
    try {
      assert.fail(`${count}:\n  ${problems.join("\n  ")}`);
    } finally {
      Error.stackTraceLimit = limit;
    }
  });
}

// Fasst gleiche Meldungen je Datei zusammen: "datei:12,48 (+3 weitere): Text".
function grouped(report) {
  const groups = new Map();
  return {
    add(file, line, message) {
      const key = `${file}\n${message}`;
      if (!groups.has(key)) groups.set(key, { file, message, lines: [] });
      groups.get(key).lines.push(line);
    },
    flush() {
      for (const { file, message, lines } of groups.values()) {
        const more = lines.length > 6 ? ` (+${lines.length - 6} weitere)` : "";
        report(`${file}:${lines.slice(0, 6).join(",")}${more}: ${message}`);
      }
    },
  };
}

const once = (build) => {
  let done = false;
  let value;
  return () => {
    if (!done) {
      value = build();
      done = true;
    }
    return value;
  };
};

// ---------------------------------------------------------------------------
// Dateien
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([".git", "node_modules"]);

// Einfaches Namensmuster mit * als Platzhalter (exclude in _config.yml und
// .gitignore).
const matchesPattern = (pattern, name) => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`).test(name);
};

// Was .gitignore nennt, sind lokale Arbeitsreste (Thumbs.db, Pruefberichte,
// __pycache__): Sie werden weder eingecheckt noch veroeffentlicht und zaehlen
// hier nicht zur Website. Verstanden werden die einfachen Formen name, name/,
// /name und *.endung.
const ignoreRules = once(() => {
  let lines = [];
  try {
    lines = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8").split("\n");
  } catch {
    lines = [];
  }
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
    .map((line) => {
      const body = line.replace(/^\//, "").replace(/\/$/, "");
      return {
        body,
        directory: line.endsWith("/"),
        whole: line.startsWith("/") || body.includes("/"),
      };
    });
});
const isIgnored = (rel, directory) =>
  ignoreRules().some((rule) => {
    if (rule.directory && !directory) return false;
    const name = rule.whole ? rel : path.posix.basename(rel);
    return matchesPattern(rule.body, name);
  });

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true });
  for (const entry of entries) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (isIgnored(rel, entry.isDirectory())) continue;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(rel));
    } else out.push(rel);
  }
  return out.sort();
}

const siteFiles = once(() => walk(""));
const texts = new Map();
function read(file) {
  if (!texts.has(file))
    texts.set(file, fs.readFileSync(path.join(ROOT, file), "utf8"));
  return texts.get(file);
}

// Prueft jeden Pfadteil buchstabengenau gegen den Verzeichnisinhalt. GitHub
// Pages unterscheidet Gross- und Kleinschreibung, Windows nicht: fs.existsSync
// wuerde hier "Assets/Site.css" durchwinken.
const listings = new Map();
function lookup(file) {
  let dir = "";
  for (const part of file.split("/")) {
    if (!listings.has(dir)) {
      let names = null;
      try {
        names = fs.readdirSync(path.join(ROOT, dir));
      } catch {
        names = null;
      }
      listings.set(dir, names);
    }
    const names = listings.get(dir);
    if (!names) return { found: false };
    if (!names.includes(part)) {
      const near = names.find(
        (name) => name.toLowerCase() === part.toLowerCase(),
      );
      return { found: false, near: near && (dir ? `${dir}/${near}` : near) };
    }
    dir = dir ? `${dir}/${part}` : part;
  }
  const stat = fs.statSync(path.join(ROOT, file), { throwIfNoEntry: false });
  return { found: Boolean(stat && stat.isFile()) };
}

const missing = (file, found) =>
  found.near
    ? `die Datei heisst ${found.near} (Gross- und Kleinschreibung)`
    : `${file} fehlt`;

function lineOf(text, pos) {
  let line = 1;
  for (let i = text.indexOf("\n"); i !== -1 && i < pos; ) {
    line += 1;
    i = text.indexOf("\n", i + 1);
  }
  return line;
}
const at = (file, text, pos) => `${file}:${lineOf(text, pos)}`;

function contentHash(file) {
  let data = fs.readFileSync(path.join(ROOT, file));
  if (HASH_TEXT.has(path.posix.extname(file).toLowerCase()))
    data = Buffer.from(
      data.toString("latin1").replace(/\r\n/g, "\n"),
      "latin1",
    );
  return crypto.createHash("sha1").update(data).digest("hex").slice(0, 10);
}

// ---------------------------------------------------------------------------
// HTML lesen
// ---------------------------------------------------------------------------

const VOID = new Set(
  "area base br col embed hr img input link meta source track wbr".split(" "),
);
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const ATTRIBUTE =
  /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

const decodeEntities = (value) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#") {
      const hex = name[1].toLowerCase() === "x";
      const code = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : whole;
  });

// Zerlegt eine Seite in oeffnende Tags, schliessende Tags, Text und
// Kommentare, jeweils mit Position. Das genuegt fuer handgepflegtes HTML und
// kommt ohne fremdes Paket aus.
function tokenize(html) {
  const tokens = [];
  const text = (from, to) => {
    if (to <= from) return;
    tokens.push({
      type: "text",
      pos: from,
      end: to,
      text: html.slice(from, to),
    });
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      text(i, html.length);
      break;
    }
    if (html.startsWith("<!--", lt)) {
      text(i, lt);
      const close = html.indexOf("-->", lt + 4);
      const end = close === -1 ? html.length : close + 3;
      tokens.push({
        type: "comment",
        pos: lt,
        end,
        text: html.slice(lt + 4, close === -1 ? html.length : close),
      });
      i = end;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      text(i, lt);
      const close = html.indexOf(">", lt);
      i = close === -1 ? html.length : close + 1;
      continue;
    }
    TAG.lastIndex = lt;
    const match = TAG.exec(html);
    if (!match) {
      text(i, lt + 1);
      i = lt + 1;
      continue;
    }
    text(i, lt);
    const tag = match[2].toLowerCase();
    const end = lt + match[0].length;
    i = end;
    if (match[1]) {
      tokens.push({ type: "close", tag, pos: lt, end });
      continue;
    }
    const selfClosing = /\/\s*$/.test(match[3]);
    const attrs = new Map();
    for (const part of match[3].replace(/\/\s*$/, "").matchAll(ATTRIBUTE)) {
      const name = part[1].toLowerCase();
      const value = part[2] ?? part[3] ?? part[4] ?? "";
      if (!attrs.has(name)) attrs.set(name, decodeEntities(value));
    }
    const leaf = selfClosing || VOID.has(tag);
    tokens.push({ type: "open", tag, attrs, pos: lt, end, leaf });
    if (RAW_TEXT.has(tag) && !leaf) {
      const closing = new RegExp(`</${tag}\\s*>`, "ig");
      closing.lastIndex = end;
      const found = closing.exec(html);
      const stop = found ? found.index : html.length;
      text(end, stop);
      i = stop;
    }
  }
  tokens.forEach((token, index) => {
    token.index = index;
  });
  return tokens;
}

const classes = (token) =>
  (token.attrs.get("class") || "").split(/\s+/).filter(Boolean);
const rels = (token) =>
  (token.attrs.get("rel") || "").toLowerCase().split(/\s+/).filter(Boolean);
const show = (token) => {
  const parts = [...token.attrs].map(([name, value]) => ` ${name}="${value}"`);
  const whole = `<${token.tag}${parts.join("")}>`;
  return whole.length > 110 ? `${whole.slice(0, 107)}...` : whole;
};

// Bereich eines Elements: Zeichenpositionen vom oeffnenden bis hinter das
// schliessende Tag, dazu die Nummern des ersten und letzten Tokens.
function rangeOf(page, open) {
  if (!open) return null;
  const range = { start: open.pos, end: open.end, first: open.index };
  if (open.leaf) return { ...range, last: open.index };
  let depth = 0;
  for (let i = open.index + 1; i < page.tokens.length; i += 1) {
    const token = page.tokens[i];
    if (token.tag !== open.tag) continue;
    if (token.type === "open" && !token.leaf) depth += 1;
    else if (token.type === "close") {
      if (depth === 0) return { ...range, end: token.end, last: i };
      depth -= 1;
    }
  }
  return { ...range, end: page.source.length, last: page.tokens.length };
}
const inside = (range, token) =>
  Boolean(range) && token.pos >= range.start && token.pos < range.end;

function rawTextOf(page, open) {
  const range = rangeOf(page, open);
  let out = "";
  for (let i = range.first + 1; i < range.last; i += 1)
    if (page.tokens[i].type === "text") out += page.tokens[i].text;
  return out;
}
const textOf = (page, open) =>
  decodeEntities(rawTextOf(page, open)).replace(/\s+/g, " ").trim();

function refreshOf(opens) {
  const token = opens.find(
    (open) =>
      open.tag === "meta" &&
      (open.attrs.get("http-equiv") || "").toLowerCase() === "refresh",
  );
  if (!token) return null;
  const match = /^\s*\d+\s*;\s*url\s*=\s*(.*?)\s*$/i.exec(
    token.attrs.get("content") || "",
  );
  return { token, url: match ? match[1].replace(/^(["'])(.*)\1$/, "$2") : "" };
}

function loadPage(file) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  texts.set(file, source);
  const tokens = tokenize(source);
  const opens = tokens.filter((token) => token.type === "open");
  const page = { file, source, tokens, opens };
  const first = (tag, wanted = () => true) =>
    rangeOf(
      page,
      opens.find((open) => open.tag === tag && wanted(open)),
    );
  const html = opens.find((open) => open.tag === "html");
  page.lang = ((html && html.attrs.get("lang")) || "").trim().toLowerCase();
  page.head = first("head");
  page.body = first("body");
  page.main = first("main");
  page.desktopNav = first("nav", (open) =>
    classes(open).includes("desktop-nav"),
  );
  page.refresh = refreshOf(opens);
  if (file === ERROR_PAGE) page.kind = "error";
  else if (page.refresh) page.kind = "redirect";
  else page.kind = LEGAL.has(file) ? "legal" : "content";
  page.ids = new Map();
  for (const open of opens) {
    if (!open.attrs.has("id")) continue;
    const id = open.attrs.get("id");
    page.ids.set(id, [...(page.ids.get(id) || []), open]);
  }
  return page;
}

const pageFiles = fs
  .readdirSync(ROOT)
  .filter((name) => name.endsWith(".html"))
  .sort();
const pages = new Map(pageFiles.map((file) => [file, loadPage(file)]));
const ofKind = (...kinds) =>
  [...pages.values()].filter((page) => kinds.includes(page.kind));
const where = (page, token) => at(page.file, page.source, token.pos);
const bodyTokens = (page) =>
  page.opens.filter((token) => !inside(page.head, token));

const headTokens = (page, tag) =>
  page.opens.filter((open) => open.tag === tag && inside(page.head, open));
const metaTokens = (page, key) =>
  headTokens(page, "meta").filter(
    (meta) =>
      meta.attrs.get("name") === key || meta.attrs.get("property") === key,
  );
const metaValues = (page, key) =>
  metaTokens(page, key).map((meta) => meta.attrs.get("content") ?? "");
const linkTokens = (page, rel) =>
  page.opens.filter((open) => open.tag === "link" && rels(open).includes(rel));
const titlesOf = (page) =>
  headTokens(page, "title").map((title) => textOf(page, title));
const robotsOf = (page) => metaValues(page, "robots").join(",").toLowerCase();
const urlOf = (file) => `${ORIGIN}/${file === "index.html" ? "" : file}`;
const length = (value) => [...value].length;

// ---------------------------------------------------------------------------
// Verweise
// ---------------------------------------------------------------------------

const plain = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Zerlegt einen Verweis in Zieldatei, Abfrage und Sprungmarke. Fremde
// Adressen, mailto:, tel: und leere Verweise ergeben null. Adressen der
// eigenen Domain zaehlen als interne Verweise. own heisst: Der Verweis nennt
// keine Datei, er bleibt im eigenen Dokument ("#top", "?x=1").
function parseTarget(raw, self, base) {
  let rest = String(raw).trim();
  if (rest === "" || rest === "#") return null;
  if (rest === ORIGIN) rest = "/";
  else if (rest.startsWith(`${ORIGIN}/`)) rest = rest.slice(ORIGIN.length);
  else if (/^[a-z][a-z0-9+.-]*:/i.test(rest) || rest.startsWith("//"))
    return null;
  let hash = "";
  const hashAt = rest.indexOf("#");
  if (hashAt !== -1) {
    hash = plain(rest.slice(hashAt + 1));
    rest = rest.slice(0, hashAt);
  }
  let query = "";
  const queryAt = rest.indexOf("?");
  if (queryAt !== -1) {
    query = rest.slice(queryAt + 1);
    rest = rest.slice(0, queryAt);
  }
  const own = rest === "";
  let file = self;
  if (!own) {
    const joined = rest.startsWith("/")
      ? rest.slice(1)
      : path.posix.join(base, rest);
    file = path.posix.normalize(plain(joined));
    if (file === "." || file === "") file = "index.html";
    else if (file.endsWith("/")) file += "index.html";
  }
  const outside = file === ".." || file.startsWith("../");
  return { file, query, hash, outside, own };
}

const fileOfUrl = (url) =>
  url === ORIGIN || url.startsWith(`${ORIGIN}/`)
    ? parseTarget(url, "", "").file
    : null;
const targetOf = (page, token, name = "href") =>
  token.attrs.has(name)
    ? parseTarget(token.attrs.get(name), page.file, "")
    : null;

const URL_ATTRIBUTES = ["href", "xlink:href", "src", "poster", "action"];
const SRCSET_ATTRIBUTES = ["srcset", "imagesrcset"];
const URL_META = /^(?:og:url|og:image(?::secure_url)?|twitter:image)$/;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/g;
// Zeichenketten in Skripten, die ganz aus einem Dateipfad bestehen.
const JS_PATH =
  /(["'`])([^"'`\s\\$]+?\.(?:html|css|js|svg|png|jpe?g|webp|avif|gif|ico|woff2?|webmanifest)(?:[?#][^"'`\s\\]*)?)\1/g;

function pageRefs(page) {
  const refs = [];
  const add = (token, via, raw) => {
    const target = parseTarget(raw, page.file, "");
    if (!target) return;
    refs.push({ source: page.file, pos: token.pos, via, raw, target, token });
  };
  for (const token of page.opens) {
    for (const name of URL_ATTRIBUTES)
      if (token.attrs.has(name)) add(token, name, token.attrs.get(name));
    for (const name of SRCSET_ATTRIBUTES) {
      if (!token.attrs.has(name)) continue;
      for (const candidate of token.attrs.get(name).split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) add(token, name, url);
      }
    }
    const key = token.attrs.get("property") || token.attrs.get("name") || "";
    if (token.tag === "meta" && URL_META.test(key))
      add(token, "content", token.attrs.get("content") || "");
    for (const match of (token.attrs.get("style") || "").matchAll(CSS_URL))
      add(token, "style", match[1] ?? match[2] ?? match[3]);
    if (token.tag === "style")
      for (const match of rawTextOf(page, token).matchAll(CSS_URL))
        add(token, "style", match[1] ?? match[2] ?? match[3]);
  }
  if (page.refresh) add(page.refresh.token, "refresh", page.refresh.url);
  return refs;
}

// Dateien ausser den Seiten, die selbst auf andere Dateien verweisen.
const resourceFiles = once(() =>
  siteFiles().filter((file) => {
    if (file === "sitemap.xml" || file === "robots.txt") return true;
    if (file.includes("/") && !file.startsWith("assets/")) return false;
    return /\.(?:css|js|svg|webmanifest)$/i.test(file);
  }),
);
const resourceErrors = [];

function resourceRefs(file) {
  const text = read(file);
  const refs = [];
  const dirname = path.posix.dirname(file);
  const folder = dirname === "." ? "" : dirname;
  const add = (pos, via, raw, base = folder) => {
    const target = parseTarget(raw, file, base);
    if (target) refs.push({ source: file, pos, via, raw, target });
  };
  const extension = path.posix.extname(file).toLowerCase();
  if (extension === ".css") {
    const bare = text.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\n]/g, " "),
    );
    for (const match of bare.matchAll(CSS_URL))
      add(match.index, "url()", match[1] ?? match[2] ?? match[3]);
    for (const match of bare.matchAll(/@import\s+["']([^"']+)["']/g))
      add(match.index, "@import", match[1]);
  } else if (extension === ".js") {
    // Skripte laufen im Zusammenhang der Seite, also vom Wurzelordner aus.
    for (const match of text.matchAll(JS_PATH)) {
      const base = /^\.\.?\//.test(match[2]) ? folder : "";
      add(match.index, "Zeichenkette", match[2], base);
    }
  } else if (extension === ".svg") {
    for (const match of text.matchAll(/\b(?:xlink:)?href\s*=\s*"([^"]*)"/g))
      add(match.index, "href", decodeEntities(match[1]));
  } else if (extension === ".webmanifest") {
    const visit = (node) => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === "object")
        for (const [key, value] of Object.entries(node)) {
          if (key === "src" && typeof value === "string")
            add(Math.max(0, text.indexOf(value)), "src", value);
          else visit(value);
        }
    };
    try {
      visit(JSON.parse(text));
    } catch (error) {
      resourceErrors.push(`${file}: kein gueltiges JSON (${error.message})`);
    }
  } else if (file === "sitemap.xml") {
    for (const match of text.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g))
      add(match.index, "loc", decodeEntities(match[1]));
  } else if (file === "robots.txt") {
    for (const match of text.matchAll(/^sitemap:\s*(\S+)/gim))
      add(match.index, "Sitemap", match[1]);
  }
  return refs;
}

const pageRefList = once(() => [...pages.values()].flatMap(pageRefs));
const resourceRefList = once(() => resourceFiles().flatMap(resourceRefs));
const allRefs = once(() => [...pageRefList(), ...resourceRefList()]);
const refLine = (ref) => lineOf(read(ref.source), ref.pos);

const svgIds = new Map();
function idsOf(file) {
  if (pages.has(file)) return pages.get(file).ids;
  if (!file.toLowerCase().endsWith(".svg")) return null;
  if (!svgIds.has(file)) {
    const found = read(file).matchAll(/\bid\s*=\s*"([^"]+)"/g);
    svgIds.set(file, new Set([...found].map((match) => match[1])));
  }
  return svgIds.get(file);
}

// Alles, was von den Seiten aus geladen wird, auch ueber CSS, Skripte, SVG
// und das Manifest.
const reachable = once(() => {
  const edges = new Map();
  for (const ref of allRefs()) {
    if (!edges.has(ref.source)) edges.set(ref.source, new Set());
    edges.get(ref.source).add(ref.target.file);
  }
  const seen = new Set(pageFiles);
  const queue = [...pageFiles];
  while (queue.length > 0)
    for (const next of edges.get(queue.pop()) || [])
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  return seen;
});

const isLicence = (file) => /(?:licen[cs]e|ofl)\.txt$/i.test(file);
const TEXT_FILE =
  /\.(?:html|css|js|cjs|mjs|md|xml|webmanifest|ya?ml|json|py|svg|txt)$|(?:^|\/)\.(?:gitignore|gitattributes|editorconfig)$/i;
// Eigene Textdateien des Ordners: Seiten, assets/, _illus/, _tools/, tests/
// und die Notizen im Wurzelordner. Fremde Lizenztexte bleiben aussen vor.
const textFiles = once(() =>
  siteFiles().filter((file) => TEXT_FILE.test(file) && !isLicence(file)),
);

// ---------------------------------------------------------------------------
// Seitenbestand
// ---------------------------------------------------------------------------

check(
  "Seitenbestand: Rechtsseiten, Fehlerseite, Startseiten und Frageboegen sind da",
  (report) => {
    const needed = [...LEGAL, ERROR_PAGE, ...HOME, ENQUIRY.de, ENQUIRY.en];
    for (const file of needed) if (!pages.has(file)) report(`${file} fehlt`);
    for (const file of LEGAL) {
      const page = pages.get(file);
      if (page && page.kind !== "legal")
        report(`${file}: Rechtsseite ist zur Seitenart ${page.kind} geworden`);
    }
    for (const file of [...HOME, ENQUIRY.de, ENQUIRY.en]) {
      const page = pages.get(file);
      if (page && page.kind !== "content")
        report(`${file}: Seitenart ${page.kind}, erwartet content`);
    }
    for (const page of pages.values())
      if (page.lang !== "de" && page.lang !== "en")
        report(`${page.file}: <html lang="${page.lang}">, erwartet de oder en`);
    const error = pages.get(ERROR_PAGE);
    if (error && !robotsOf(error).includes("noindex"))
      report(`${ERROR_PAGE}: <meta name="robots" content="noindex"> fehlt`);
  },
);

// ---------------------------------------------------------------------------
// Links, Anker, Dateien
// ---------------------------------------------------------------------------

function reportMissingTargets(refs, report) {
  const out = grouped(report);
  for (const ref of refs) {
    const { file, outside } = ref.target;
    const label = `${ref.via} "${ref.raw}"`;
    if (outside) {
      out.add(
        ref.source,
        refLine(ref),
        `${label} zeigt aus dem Website-Ordner hinaus`,
      );
      continue;
    }
    const found = lookup(file);
    if (!found.found)
      out.add(ref.source, refLine(ref), `${label}: ${missing(file, found)}`);
  }
  out.flush();
}

check(
  "Interne Links: jedes Ziel aus dem HTML existiert buchstabengenau",
  (report) => {
    reportMissingTargets(pageRefList(), report);
  },
);

check(
  "Verweise aus CSS, Skripten, SVG, Manifest, Sitemap und robots.txt: jede Datei existiert buchstabengenau",
  (report) => {
    reportMissingTargets(resourceRefList(), report);
    resourceErrors.forEach(report);
  },
);

check(
  "Interne Anker: jede Sprungmarke und jedes SVG-Symbol existiert",
  (report) => {
    const out = grouped(report);
    for (const ref of allRefs()) {
      const { file, hash, outside } = ref.target;
      if (hash === "" || outside || !lookup(file).found) continue;
      const ids = idsOf(file);
      if (ids && !ids.has(hash))
        out.add(
          ref.source,
          refLine(ref),
          `${ref.via} "${ref.raw}": in ${file} gibt es keine id="${hash}"`,
        );
    }
    out.flush();
  },
);

check("IDs sind je Seite eindeutig", (report) => {
  for (const page of pages.values())
    for (const [id, tokens] of page.ids) {
      if (tokens.length < 2) continue;
      const lines = tokens.map((token) => lineOf(page.source, token.pos));
      report(
        `${page.file}:${lines.join(",")}: id="${id}" steht ${tokens.length} mal auf der Seite`,
      );
    }
});

check(
  "Keine verwaisten Dateien in assets/ (Lizenztexte ausgenommen)",
  (report) => {
    const used = reachable();
    for (const file of siteFiles())
      if (file.startsWith("assets/") && !isLicence(file) && !used.has(file))
        report(
          `${file}: wird von keiner Seite geladen, auch nicht ueber CSS, Skript, SVG oder Manifest`,
        );
  },
);

// ---------------------------------------------------------------------------
// Sitemap, Canonical, hreflang
// ---------------------------------------------------------------------------

const sitemap = once(() => {
  if (!lookup("sitemap.xml").found) return null;
  const text = read("sitemap.xml");
  const entries = [];
  for (const match of text.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const field = (name) => {
      const pattern = new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`, "g");
      return [...match[1].matchAll(pattern)].map((found) =>
        decodeEntities(found[1]),
      );
    };
    entries.push({
      place: at("sitemap.xml", text, match.index),
      loc: field("loc"),
      lastmod: field("lastmod"),
    });
  }
  return entries;
});

check("Sitemap: genau die Inhalts- und Rechtsseiten, jede einmal", (report) => {
  const entries = sitemap();
  if (!entries) return report("sitemap.xml fehlt");
  const expected = new Map(
    ofKind("content", "legal").map((page) => [urlOf(page.file), page.file]),
  );
  const seen = new Set();
  for (const entry of entries) {
    if (entry.loc.length !== 1) {
      report(
        `${entry.place}: ${entry.loc.length} <loc> in einem Eintrag, erwartet genau eines`,
      );
      continue;
    }
    const [loc] = entry.loc;
    if (seen.has(loc))
      report(`${entry.place}: ${loc} steht mehrfach in der Sitemap`);
    seen.add(loc);
    if (expected.has(loc)) continue;
    const page = pages.get(fileOfUrl(loc));
    const reason = page
      ? `Seitenart ${page.kind}`
      : "keine Seite dieser Website";
    report(`${entry.place}: ${loc} gehoert nicht in die Sitemap (${reason})`);
  }
  for (const [url, file] of expected)
    if (!seen.has(url)) report(`sitemap.xml: ${file} fehlt (erwartet ${url})`);
});

const isDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

check(
  "Sitemap: jeder Eintrag traegt genau ein lastmod im Format JJJJ-MM-TT",
  (report) => {
    const entries = sitemap();
    if (!entries) return report("sitemap.xml fehlt");
    for (const entry of entries) {
      const name = entry.loc[0] || "Eintrag ohne <loc>";
      if (entry.lastmod.length !== 1)
        report(
          `${entry.place}: ${name}: ${entry.lastmod.length} <lastmod>, erwartet genau eines`,
        );
      else if (!isDate(entry.lastmod[0]))
        report(
          `${entry.place}: ${name}: lastmod "${entry.lastmod[0]}" ist kein Datum im Format JJJJ-MM-TT`,
        );
    }
  },
);

check(
  "Canonical: jede Inhalts- und Rechtsseite nennt genau ihre eigene Adresse, og:url ist gleich",
  (report) => {
    for (const page of ofKind("content", "legal")) {
      const own = urlOf(page.file);
      const links = linkTokens(page, "canonical");
      if (links.length !== 1)
        report(
          `${page.file}: ${links.length} canonical-Angaben, erwartet genau eine`,
        );
      for (const link of links)
        if (link.attrs.get("href") !== own)
          report(
            `${where(page, link)}: canonical ist "${link.attrs.get("href")}", erwartet ${own}`,
          );
      for (const meta of metaTokens(page, "og:url"))
        if (meta.attrs.get("content") !== own)
          report(
            `${where(page, meta)}: og:url ist "${meta.attrs.get("content")}", erwartet ${own}`,
          );
    }
  },
);

const HREFLANGS = ["de", "en", "x-default"];
function alternatesOf(page) {
  const map = new Map();
  for (const link of linkTokens(page, "alternate")) {
    const lang = (link.attrs.get("hreflang") || "").toLowerCase();
    map.set(lang, [...(map.get(lang) || []), link]);
  }
  return map;
}
const alternate = (map, lang) =>
  (map.get(lang) || []).length === 1
    ? map.get(lang)[0].attrs.get("href")
    : undefined;

check(
  "hreflang: de, en und x-default sind vorhanden und verweisen gegenseitig",
  (report) => {
    for (const page of ofKind("content", "legal")) {
      const own = alternatesOf(page);
      for (const lang of HREFLANGS) {
        const count = (own.get(lang) || []).length;
        if (count !== 1)
          report(
            `${page.file}: hreflang="${lang}" steht ${count} mal, erwartet genau einmal`,
          );
      }
      for (const [lang, links] of own)
        if (!HREFLANGS.includes(lang))
          report(`${where(page, links[0])}: unbekanntes hreflang="${lang}"`);
      const self = alternate(own, page.lang);
      if (self !== undefined && self !== urlOf(page.file))
        report(
          `${page.file}: hreflang="${page.lang}" nennt ${self}, erwartet die eigene Adresse ${urlOf(page.file)}`,
        );
      const fallback = alternate(own, "x-default");
      const german = alternate(own, "de");
      if (fallback !== undefined && german !== undefined && fallback !== german)
        report(
          `${page.file}: x-default nennt ${fallback}, erwartet die deutsche Fassung ${german}`,
        );
      const otherLang = page.lang === "de" ? "en" : "de";
      const partnerUrl = alternate(own, otherLang);
      if (partnerUrl === undefined) continue;
      const partner = pages.get(fileOfUrl(partnerUrl));
      if (!partner) {
        report(
          `${page.file}: hreflang="${otherLang}" nennt ${partnerUrl}, das ist keine Seite dieser Website`,
        );
        continue;
      }
      if (partner.kind !== page.kind)
        report(
          `${page.file}: Sprachpartner ${partner.file} hat die Seitenart ${partner.kind}, erwartet ${page.kind}`,
        );
      if (partner.lang !== otherLang)
        report(
          `${page.file}: Sprachpartner ${partner.file} traegt lang="${partner.lang}", erwartet ${otherLang}`,
        );
      const theirs = alternatesOf(partner);
      for (const lang of HREFLANGS)
        if (alternate(theirs, lang) !== alternate(own, lang))
          report(
            `${page.file}: Sprachpartner ${partner.file} nennt fuer hreflang="${lang}" ${alternate(theirs, lang)}, hier steht ${alternate(own, lang)}`,
          );
    }
  },
);

// ---------------------------------------------------------------------------
// Versionen
// ---------------------------------------------------------------------------

// Verweise auf Dateien, die eine Version tragen koennen, je Zieldatei. Nicht
// dazu gehoeren Seiten, die Textdateien fuer Suchmaschinen und Verweise, die
// im eigenen Dokument bleiben (<use href="#form"> in einer SVG-Datei).
const versioned = once(() => {
  const byFile = new Map();
  for (const ref of allRefs()) {
    const { file, query, outside, own } = ref.target;
    if (own || outside || /\.(?:html|xml|txt)$/i.test(file)) continue;
    const version = new URLSearchParams(query).get("v");
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push({ ref, version });
  }
  return byFile;
});
const needsVersion = (file) =>
  VERSION_REQUIRED.has(path.posix.extname(file).toLowerCase()) ||
  (!file.includes("/") && /\.png$/i.test(file));
const isFont = (file) => /\.woff2?$/i.test(file);
const places = (uses) => {
  const files = [...new Set(uses.map((use) => use.ref.source))];
  const names = files.slice(0, 6).join(", ");
  const more = files.length > 6 ? ` und ${files.length - 6} weitere` : "";
  return `${uses.length} Stellen in ${files.length} Dateien: ${names}${more}`;
};

check(
  "Versionen: je Datei genau ein ?v=-Wert; Pflicht fuer CSS, JS, SVG, Icons und Manifest; Schriften ohne",
  (report) => {
    const out = grouped(report);
    for (const [file, uses] of versioned()) {
      const values = new Map();
      for (const use of uses) {
        const key = use.version === null ? "ohne ?v=" : `?v=${use.version}`;
        values.set(key, [...(values.get(key) || []), use]);
      }
      if (values.size > 1) {
        const parts = [...values].map(
          ([key, group]) => `${key} (${places(group)})`,
        );
        report(
          `${file}: ${values.size} verschiedene Angaben: ${parts.join("; ")}`,
        );
      }
      for (const { ref, version } of uses) {
        const label = `${ref.via} "${ref.raw}"`;
        if (version === null && needsVersion(file))
          out.add(ref.source, refLine(ref), `${label} steht ohne ?v=`);
        if (version !== null && isFont(file))
          out.add(
            ref.source,
            refLine(ref),
            `${label}: Schriften stehen ohne ?v=, sonst passen Preload und url() in site.css nicht zusammen`,
          );
      }
    }
    out.flush();
  },
);

check(
  "Versionen: jeder ?v=-Wert ist der Inhalts-Hash der Datei (sha1, 10 Zeichen)",
  (report) => {
    for (const [file, uses] of versioned()) {
      if (!lookup(file).found) continue;
      const expected = contentHash(file);
      const wrong = new Map();
      for (const use of uses)
        if (use.version !== null && use.version !== expected)
          wrong.set(use.version, [...(wrong.get(use.version) || []), use]);
      for (const [version, group] of wrong)
        report(
          `${file}: ?v=${version}, der Inhalt ergibt ${expected} (${places(group)})`,
        );
    }
  },
);

// ---------------------------------------------------------------------------
// Schreibregeln und entfernte Fotos
// ---------------------------------------------------------------------------

check(
  "Keine langen Gedankenstriche (U+2013, U+2014) in Seiten, Stilen, Skripten, Notizen, _tools und tests",
  (report) => {
    for (const file of textFiles()) {
      const text = read(file);
      for (const match of text.matchAll(LONG_DASH)) {
        const code = match[0].codePointAt(0).toString(16).toUpperCase();
        const before = text.slice(Math.max(0, match.index - 30), match.index);
        const after = text.slice(match.index + 1, match.index + 31);
        const around = `${before}[U+${code}]${after}`.replace(/\s+/g, " ");
        report(`${at(file, text, match.index)}: ${around.trim()}`);
      }
    }
  },
);

check("Gruenderfotos: die Bilddateien gibt es nicht mehr", (report) => {
  for (const file of siteFiles()) {
    FOUNDER_PHOTO.lastIndex = 0;
    if (FOUNDER_PHOTO.test(path.posix.basename(file)))
      report(`${file}: Datei ist noch vorhanden`);
  }
});

check(
  "Gruenderfotos: ihre Dateinamen kommen in keiner Textdatei vor",
  (report) => {
    for (const file of textFiles()) {
      const text = read(file);
      for (const match of text.matchAll(FOUNDER_PHOTO))
        report(`${at(file, text, match.index)}: nennt ${match[0]}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Bilder und Ueberschriften
// ---------------------------------------------------------------------------

const images = (page) => page.opens.filter((open) => open.tag === "img");
const isSize = (value) => /^[1-9]\d*$/.test(value || "");

check("Bilder: jedes <img> traegt width, height und alt", (report) => {
  for (const page of pages.values())
    for (const image of images(page)) {
      const place = where(page, image);
      const gaps = ["width", "height", "alt"].filter(
        (name) => !image.attrs.has(name),
      );
      if (gaps.length > 0)
        report(`${place}: ${show(image)} ohne ${gaps.join(", ")}`);
      for (const name of ["width", "height"])
        if (image.attrs.has(name) && !isSize(image.attrs.get(name)))
          report(
            `${place}: ${name}="${image.attrs.get(name)}" ist keine ganze Zahl groesser 0`,
          );
    }
});

// Breite und Hoehe aus dem Dateikopf. Unbekannte Formate ergeben null.
function imageSize(file) {
  const data = fs.readFileSync(path.join(ROOT, file));
  const extension = path.posix.extname(file).toLowerCase();
  const ascii = (from, to) => data.toString("latin1", from, to);
  if (extension === ".png" && data.length > 24 && ascii(12, 16) === "IHDR")
    return [data.readUInt32BE(16), data.readUInt32BE(20)];
  if (extension === ".jpg" || extension === ".jpeg") {
    for (let i = 2; i + 9 < data.length; ) {
      if (data[i] !== 0xff || data[i + 1] === 0xff) {
        i += 1;
        continue;
      }
      const marker = data[i + 1];
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const frame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker);
      if (frame) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)];
      i += 2 + data.readUInt16BE(i + 2);
    }
    return null;
  }
  const webp =
    extension === ".webp" &&
    data.length > 30 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 12) === "WEBP";
  if (webp) {
    const chunk = ascii(12, 16);
    if (chunk === "VP8 ")
      return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
    if (chunk === "VP8L") {
      const bits = data.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (chunk === "VP8X")
      return [data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1];
    return null;
  }
  if (extension === ".svg") {
    const tag = /<svg\b[^>]*>/i.exec(data.toString("utf8"));
    if (!tag) return null;
    const number = (name) =>
      (new RegExp(`\\s${name}="([\\d.]+)(?:px)?"`).exec(tag[0]) || [])[1];
    if (number("width") && number("height"))
      return [Number(number("width")), Number(number("height"))];
    const box =
      /\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(
        tag[0],
      );
    return box ? [Number(box[1]), Number(box[2])] : null;
  }
  return null;
}

check(
  "Bilder: das Seitenverhaeltnis aus width und height passt zur Datei",
  (report) => {
    const sizes = new Map();
    for (const page of pages.values())
      for (const image of images(page)) {
        const target = targetOf(page, image, "src");
        const width = image.attrs.get("width");
        const height = image.attrs.get("height");
        if (!target || target.outside || !isSize(width) || !isSize(height))
          continue;
        if (!lookup(target.file).found) continue;
        if (!sizes.has(target.file)) {
          let size = null;
          try {
            size = imageSize(target.file);
          } catch {
            size = null;
          }
          sizes.set(target.file, size);
        }
        const real = sizes.get(target.file);
        if (!real || !(real[0] > 0) || !(real[1] > 0)) continue;
        const drift = Math.abs(width / height / (real[0] / real[1]) - 1);
        if (drift > 0.01)
          report(
            `${where(page, image)}: ${target.file} ist ${real[0]}x${real[1]}, angegeben ist ${width}x${height} (anderes Seitenverhaeltnis)`,
          );
      }
  },
);

check(
  "Ueberschriften: genau eine h1 je Seite (Weiterleitungsseiten hoechstens eine)",
  (report) => {
    for (const page of pages.values()) {
      const count = page.opens.filter((open) => open.tag === "h1").length;
      const fine = page.kind === "redirect" ? count <= 1 : count === 1;
      if (!fine)
        report(`${page.file}: ${count} mal <h1> (Seitenart ${page.kind})`);
    }
  },
);

// ---------------------------------------------------------------------------
// Kopf-Block
// ---------------------------------------------------------------------------

const HEAD_RELS = ["stylesheet", "icon", "apple-touch-icon", "manifest"];
// Zeilen, die der Kopf-Block verwaltet (wie STREU in _tools/kopf.py): lokale
// Icons, Manifest, Schrift-Preload, Stile und Skripte. Verweise auf fremde
// Adressen und andere Preloads gehoeren nicht dazu.
const managed = (page) =>
  page.opens.filter((open) => {
    if (open.tag === "script") return targetOf(page, open, "src") !== null;
    if (open.tag !== "link" || !targetOf(page, open)) return false;
    if (rels(open).includes("preload")) return open.attrs.get("as") === "font";
    return rels(open).some((rel) => HEAD_RELS.includes(rel));
  });
const themeColors = (page) =>
  page.opens.filter(
    (open) => open.tag === "meta" && open.attrs.get("name") === "theme-color",
  );
const stylesheets = (page) =>
  managed(page).filter((open) => rels(open).includes("stylesheet"));
const scripts = (page) => managed(page).filter((open) => open.tag === "script");
const fileOf = (page, open) =>
  targetOf(page, open, open.tag === "script" ? "src" : "href").file;

function kopfBlock(page) {
  const marks = (name) =>
    page.tokens.filter(
      (token) => token.type === "comment" && token.text.trim() === name,
    );
  const starts = marks("kopf:start");
  const ends = marks("kopf:ende");
  const complete =
    starts.length === 1 && ends.length === 1 && starts[0].pos < ends[0].pos;
  return {
    starts,
    ends,
    range: complete ? { start: starts[0].end, end: ends[0].pos } : null,
  };
}

check(
  "Kopf-Block: vorhanden, mit Icons, Manifest und Schrift-Preload, keine verstreuten Zeilen",
  (report) => {
    for (const page of ofKind("content", "legal", "error")) {
      const block = kopfBlock(page);
      if (!block.range) {
        report(
          `${page.file}: Kopf-Block fehlt oder ist unvollstaendig (${block.starts.length} mal kopf:start, ${block.ends.length} mal kopf:ende, erwartet je einmal in dieser Reihenfolge)`,
        );
        continue;
      }
      const [start] = block.starts;
      const [end] = block.ends;
      if (!inside(page.head, start) || !inside(page.head, end))
        report(`${where(page, start)}: Kopf-Block steht nicht im <head>`);
      const lines = managed(page);
      for (const line of [...themeColors(page), ...lines])
        if (!inside(block.range, line))
          report(
            `${where(page, line)}: ${show(line)} steht ausserhalb des Kopf-Blocks`,
          );
      const within = lines.filter((line) => inside(block.range, line));
      const link = (rel, file) =>
        within.some(
          (line) =>
            line.tag === "link" &&
            rels(line).includes(rel) &&
            fileOf(page, line) === file,
        );
      for (const [rel, file] of [
        ["icon", "favicon.svg"],
        ["apple-touch-icon", "apple-touch-icon.png"],
        ["manifest", "site.webmanifest"],
        ["preload", FONT_PRELOAD],
      ])
        if (!link(rel, file))
          report(
            `${page.file}: im Kopf-Block fehlt <link rel="${rel}"> auf ${file}`,
          );
      for (const line of within) {
        const font =
          rels(line).includes("preload") && fileOf(page, line) === FONT_PRELOAD;
        if (!font) continue;
        if (line.attrs.get("href").includes("?"))
          report(
            `${where(page, line)}: Schrift-Preload traegt eine Abfrage, erwartet die Adresse ohne ?v=`,
          );
        if (!line.attrs.has("crossorigin"))
          report(
            `${where(page, line)}: Schrift-Preload braucht crossorigin, sonst laedt die Schrift doppelt`,
          );
      }
    }
    const css = "assets/site.css";
    const declared =
      lookup(css).found &&
      resourceRefs(css).some(
        (ref) => ref.target.file === FONT_PRELOAD && ref.target.query === "",
      );
    if (!declared)
      report(
        `${css}: nennt ${FONT_PRELOAD} nicht als url(...) ohne Abfrage, der Preload liefe ins Leere`,
      );
  },
);

check(
  "Kopf-Block: Icons, Manifest, Preload und Themenfarbe sind auf allen Seiten gleich",
  (report) => {
    const signatures = new Map();
    for (const page of ofKind("content", "legal", "error")) {
      const lines = managed(page)
        .filter(
          (open) => open.tag === "link" && !rels(open).includes("stylesheet"),
        )
        .map((open) => {
          const extra = ["sizes", "type", "as"]
            .filter((name) => open.attrs.has(name))
            .map((name) => ` ${name}="${open.attrs.get(name)}"`);
          const rel = rels(open).join(" ");
          return `<link rel="${rel}"${extra.join("")}> auf ${fileOf(page, open)}`;
        });
      for (const meta of themeColors(page)) {
        const color = meta.attrs.get("content");
        lines.push(`<meta name="theme-color" content="${color}">`);
      }
      signatures.set(page.file, lines.sort());
    }
    const counts = new Map();
    for (const lines of signatures.values()) {
      const key = lines.join("\n");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const [usual] = [...counts].sort((a, b) => b[1] - a[1])[0] || [""];
    const expected = usual.split("\n").filter(Boolean);
    for (const [file, lines] of signatures) {
      for (const line of expected)
        if (!lines.includes(line))
          report(`${file}: es fehlt ${line} (steht auf den meisten Seiten)`);
      for (const line of lines)
        if (!expected.includes(line))
          report(`${file}: zusaetzlich ${line} (fehlt auf den meisten Seiten)`);
    }
  },
);

check(
  "Kopf-Block: CSS in bindender Reihenfolge (site, pages, refined-pages oder home, enquiry)",
  (report) => {
    for (const page of ofKind("content", "legal", "error")) {
      const expected = [
        "assets/site.css",
        "assets/pages.css",
        HOME.has(page.file) ? "assets/home.css" : "assets/refined-pages.css",
      ];
      if (attribute("data-enquiry")(page)) expected.push("assets/enquiry.css");
      const actual = stylesheets(page).map((open) => fileOf(page, open));
      if (actual.join(" ") !== expected.join(" "))
        report(
          `${page.file}: Stile sind [${actual.join(", ")}], erwartet [${expected.join(", ")}]`,
        );
    }
  },
);

check(
  "Kopf-Block: Skripte genau nach Ausloeser-Tabelle, mit defer, draft.js vor site.js",
  (report) => {
    for (const page of ofKind("content", "legal", "error")) {
      const expected = SCRIPTS.filter(([, triggers]) =>
        triggers.some((trigger) => trigger(page)),
      ).map(([file]) => file);
      const tags = scripts(page);
      const actual = tags.map((open) => fileOf(page, open));
      for (const file of expected)
        if (!actual.includes(file))
          report(`${page.file}: ${file} fehlt, der Seiteninhalt braucht es`);
      for (const tag of tags) {
        const place = where(page, tag);
        const file = fileOf(page, tag);
        if (!expected.includes(file))
          report(
            `${place}: ${file} wird geladen, aber kein Ausloeser auf der Seite verlangt es`,
          );
        if (actual.indexOf(file) !== actual.lastIndexOf(file))
          report(`${place}: ${file} wird mehrfach geladen`);
        if (!tag.attrs.has("defer") || tag.attrs.has("async"))
          report(
            `${place}: ${file} muss mit defer und ohne async geladen werden`,
          );
      }
      for (const [before, after] of SCRIPT_ORDER) {
        const both = actual.includes(before) && actual.includes(after);
        if (both && actual.indexOf(before) > actual.indexOf(after))
          report(`${page.file}: ${before} muss vor ${after} stehen`);
      }
    }
  },
);

check(
  "404.html: alle internen Pfade beginnen mit / (die Seite erscheint unter jeder Adresse)",
  (report) => {
    const page = pages.get(ERROR_PAGE);
    if (!page) return report(`${ERROR_PAGE} fehlt`);
    const out = grouped(report);
    for (const ref of pageRefs(page)) {
      const raw = ref.raw.trim();
      if (raw.startsWith("/") || raw.startsWith("#") || raw.startsWith(ORIGIN))
        continue;
      out.add(
        page.file,
        refLine(ref),
        `${ref.via} "${ref.raw}" ist ein relativer Pfad`,
      );
    }
    out.flush();
  },
);

// ---------------------------------------------------------------------------
// Titel, Description, og-Angaben
// ---------------------------------------------------------------------------

check("Titel: genau ein <title> mit 30 bis 60 Zeichen", (report) => {
  for (const page of pages.values()) {
    const titles = titlesOf(page);
    if (titles.length !== 1) {
      report(
        `${page.file}: ${titles.length} mal <title> im <head>, erwartet genau einmal`,
      );
      continue;
    }
    const size = length(titles[0]);
    if (size < 30 || size > 60)
      report(
        `${page.file}: Titel hat ${size} Zeichen, erlaubt sind 30 bis 60: "${titles[0]}"`,
      );
  }
});

function reportDuplicates(entries, what, report) {
  const byValue = new Map();
  for (const [file, value] of entries)
    byValue.set(value, [...(byValue.get(value) || []), file]);
  for (const [value, files] of byValue)
    if (files.length > 1)
      report(`${files.join(", ")}: gleiche ${what} "${value}"`);
}

check("Titel: jeder Titel kommt nur einmal vor", (report) => {
  const entries = [...pages.values()]
    .filter((page) => titlesOf(page).length > 0)
    .map((page) => [page.file, titlesOf(page)[0]]);
  reportDuplicates(entries, "Titel", report);
});

check(
  'Titel: der Trenner ist " | ", kein Mittelpunkt (Rechtsseiten ausgenommen)',
  (report) => {
    for (const page of ofKind("content", "error", "redirect"))
      for (const title of titlesOf(page))
        if (title.includes(MIDDLE_DOT))
          report(
            `${page.file}: Titel trennt mit Mittelpunkt (U+00B7): "${title}"`,
          );
  },
);

check(
  "Description: auf Inhaltsseiten genau eine mit 120 bis 160 Zeichen, jede nur einmal",
  (report) => {
    const entries = [];
    for (const page of ofKind("content")) {
      const values = metaValues(page, "description");
      if (values.length !== 1) {
        report(
          `${page.file}: ${values.length} Descriptions, erwartet genau eine`,
        );
        continue;
      }
      entries.push([page.file, values[0]]);
      const size = length(values[0]);
      if (size < 120 || size > 160)
        report(
          `${page.file}: Description hat ${size} Zeichen, erlaubt sind 120 bis 160`,
        );
    }
    reportDuplicates(entries, "Description", report);
  },
);

check(
  "og:title und og:description stimmen mit Titel und Description ueberein",
  (report) => {
    for (const page of pages.values()) {
      const required = page.kind === "content" || page.kind === "legal";
      for (const [key, own] of [
        ["og:title", titlesOf(page)],
        ["og:description", metaValues(page, "description")],
      ]) {
        const metas = metaTokens(page, key);
        if (metas.length > 1 || (required && metas.length !== 1))
          report(
            `${page.file}: ${metas.length} mal ${key}, erwartet genau einmal`,
          );
        for (const meta of metas) {
          const value = (meta.attrs.get("content") ?? "")
            .replace(/\s+/g, " ")
            .trim();
          const wanted = (own[0] ?? "").replace(/\s+/g, " ").trim();
          if (own.length === 1 && value !== wanted)
            report(
              `${where(page, meta)}: ${key} ist "${value}", auf der Seite steht "${wanted}"`,
            );
        }
      }
    }
  },
);

// ---------------------------------------------------------------------------
// Strukturierte Daten
// ---------------------------------------------------------------------------

const ldBlocks = once(() => {
  const blocks = [];
  for (const page of pages.values())
    for (const open of page.opens) {
      const type = (open.attrs.get("type") || "").trim().toLowerCase();
      if (open.tag !== "script" || type !== "application/ld+json") continue;
      const block = { page, open, data: undefined, error: null };
      try {
        block.data = JSON.parse(rawTextOf(page, open));
      } catch (error) {
        block.error = error.message;
      }
      blocks.push(block);
    }
  return blocks;
});

function forbiddenKeys(node, trail, found) {
  if (Array.isArray(node))
    node.forEach((item, index) =>
      forbiddenKeys(item, `${trail}[${index}]`, found),
    );
  else if (node && typeof node === "object")
    for (const [key, value] of Object.entries(node)) {
      const here = trail ? `${trail}.${key}` : key;
      const lower = key.toLowerCase();
      if (LD_FORBIDDEN.some((name) => name.toLowerCase() === lower))
        found.push(here);
      forbiddenKeys(value, here, found);
    }
  return found;
}

check(
  "JSON-LD: jeder Block ist parsebar und nennt weder Telefon noch Oeffnungszeiten",
  (report) => {
    for (const block of ldBlocks()) {
      const place = where(block.page, block.open);
      if (block.error) {
        report(`${place}: kein gueltiges JSON (${block.error})`);
        continue;
      }
      for (const key of forbiddenKeys(block.data, "", []))
        report(
          `${place}: enthaelt ${key} (Musternummern und Oeffnungszeiten gehoeren nicht in strukturierte Daten)`,
        );
    }
  },
);

// Ein Wert, eine Liste oder nichts: immer als Liste.
const listOf = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};
function breadcrumbLists(page) {
  const lists = [];
  for (const block of ldBlocks()) {
    if (block.page !== page || block.error) continue;
    const nodes = listOf(block.data).flatMap((node) => [
      node,
      ...listOf(node && node["@graph"]),
    ]);
    for (const node of nodes)
      if (node && listOf(node["@type"]).includes("BreadcrumbList"))
        lists.push({ block, node });
  }
  return lists;
}
const breadcrumbNavs = (page) =>
  page.opens.filter(
    (open) => open.tag === "nav" && classes(open).includes("breadcrumbs"),
  );

check(
  "Brotkrumen: BreadcrumbList steht genau auf den Seiten mit nav.breadcrumbs",
  (report) => {
    for (const page of pages.values()) {
      const navs = breadcrumbNavs(page).length;
      const lists = breadcrumbLists(page).length;
      if (page.kind === "redirect") {
        if (lists > 0)
          report(
            `${page.file}: Weiterleitungsseite traegt eine BreadcrumbList`,
          );
        continue;
      }
      if (navs > 1)
        report(
          `${page.file}: ${navs} mal nav.breadcrumbs, erwartet hoechstens einmal`,
        );
      if (navs > 0 && lists !== 1)
        report(
          `${page.file}: zeigt Brotkrumen, hat aber ${lists} BreadcrumbList-Bloecke (erwartet 1)`,
        );
      if (navs === 0 && lists > 0)
        report(
          `${page.file}: hat eine BreadcrumbList, zeigt aber keine Brotkrumen`,
        );
    }
  },
);

check(
  "Brotkrumen: BreadcrumbList stimmt mit den sichtbaren Brotkrumen ueberein",
  (report) => {
    for (const page of pages.values()) {
      const [nav] = breadcrumbNavs(page);
      const [found] = breadcrumbLists(page);
      if (!nav || !found) continue;
      const place = where(page, found.block.open);
      const range = rangeOf(page, nav);
      const within = page.opens.filter((open) => inside(range, open));
      const links = within.filter(
        (open) => open.tag === "a" && targetOf(page, open),
      );
      const current = within.find(
        (open) => open.attrs.get("aria-current") === "page",
      );
      const items = listOf(found.node.itemListElement);
      if (items.length !== links.length + 1) {
        report(
          `${place}: ${items.length} Glieder, erwartet ${links.length + 1} (${links.length} Links und die Seite selbst)`,
        );
        continue;
      }
      items.forEach((raw, index) => {
        const item = raw && typeof raw === "object" ? raw : {};
        const inner =
          item.item && typeof item.item === "object" ? item.item : {};
        const name = String(item.name ?? inner.name ?? "");
        const url =
          typeof item.item === "string"
            ? item.item
            : (inner["@id"] ?? inner.url);
        const link = links[index];
        const label = `Glied ${index + 1}`;
        if (Number(item.position) !== index + 1)
          report(`${place}: ${label} traegt position ${item.position}`);
        let visible = null;
        if (link) visible = textOf(page, link);
        else if (current) visible = textOf(page, current);
        if (visible !== null && name !== visible)
          report(
            `${place}: ${label} heisst "${name}", sichtbar ist "${visible}"`,
          );
        if (visible === null && name.trim() === "")
          report(`${place}: ${label} hat keinen Namen`);
        const wanted = urlOf(link ? targetOf(page, link).file : page.file);
        // Beim letzten Glied (der Seite selbst) darf die Adresse fehlen.
        if (url === undefined ? Boolean(link) : url !== wanted)
          report(`${place}: ${label} nennt ${url}, erwartet ${wanted}`);
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Sprachfassungen und Rechtsseiten
// ---------------------------------------------------------------------------

// Geruest einer Seite: jedes Element im <main> als tag.klasse#id.
function skeleton(page) {
  return page.opens
    .filter((open) => inside(page.main, open))
    .map((open) => {
      const names = classes(open).map((name) => `.${name}`);
      const id = open.attrs.has("id") ? `#${open.attrs.get("id")}` : "";
      return {
        key: `${open.tag}${names.join("")}${id}`,
        line: lineOf(page.source, open.pos),
      };
    });
}

// Elemente, die nur in einer der beiden Folgen stehen (laengste gemeinsame
// Teilfolge). Bei sehr grossen Abweichungen nur die erste Stelle.
function difference(left, right) {
  const same = (i, j) => left[i].key === right[j].key;
  let start = 0;
  while (start < left.length && start < right.length && same(start, start))
    start += 1;
  let endLeft = left.length;
  let endRight = right.length;
  while (
    endLeft > start &&
    endRight > start &&
    same(endLeft - 1, endRight - 1)
  ) {
    endLeft -= 1;
    endRight -= 1;
  }
  const a = left.slice(start, endLeft);
  const b = right.slice(start, endRight);
  if (a.length * b.length > 4_000_000)
    return { onlyLeft: a.slice(0, 1), onlyRight: b.slice(0, 1), cut: true };
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      table[i * width + j] =
        a[i].key === b[j].key
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  const onlyLeft = [];
  const onlyRight = [];
  for (let i = 0, j = 0; i < a.length || j < b.length; ) {
    const down = i < a.length ? table[(i + 1) * width + j] : -1;
    const across = j < b.length ? table[i * width + j + 1] : -1;
    if (i < a.length && j < b.length && a[i].key === b[j].key) {
      i += 1;
      j += 1;
    } else if (down >= across) {
      onlyLeft.push(a[i]);
      i += 1;
    } else {
      onlyRight.push(b[j]);
      j += 1;
    }
  }
  return { onlyLeft, onlyRight, cut: false };
}

check(
  "DE/EN: das Geruest im <main> (Tag, Klasse, id) ist je Seitenpaar gleich (Rechtsseiten ausgenommen)",
  (report) => {
    for (const page of ofKind("content")) {
      if (page.lang !== "de") continue;
      const partnerUrl = alternate(alternatesOf(page), "en");
      const partner = partnerUrl && pages.get(fileOfUrl(partnerUrl));
      if (!partner || partner.kind !== "content") continue;
      const pair = `${page.file} / ${partner.file}`;
      if (!page.main || !partner.main) {
        report(`${pair}: <main> fehlt auf mindestens einer Seite`);
        continue;
      }
      const diff = difference(skeleton(page), skeleton(partner));
      for (const item of diff.onlyLeft)
        report(
          `${page.file}:${item.line}: ${item.key} steht nur in der deutschen Fassung (Partner ${partner.file})`,
        );
      for (const item of diff.onlyRight)
        report(
          `${partner.file}:${item.line}: ${item.key} steht nur in der englischen Fassung (Partner ${page.file})`,
        );
      if (diff.cut)
        report(
          `${pair}: die Fassungen weichen stark ab, gemeldet ist nur die erste Stelle`,
        );
    }
  },
);

check(
  "Rechtsseiten: <main> ist unveraendert (SHA-256 eingefroren)",
  (report) => {
    for (const [file, expected] of Object.entries(LEGAL_MAIN_SHA256)) {
      if (!pages.has(file)) {
        report(`${file} fehlt`);
        continue;
      }
      const source = read(file).replace(/\r\n/g, "\n");
      const start = source.indexOf("<main");
      const end = source.indexOf("</main>");
      if (start === -1 || end < start) {
        report(`${file}: <main> nicht gefunden`);
        continue;
      }
      const actual = crypto
        .createHash("sha256")
        .update(source.slice(start, end + "</main>".length), "utf8")
        .digest("hex");
      if (actual !== expected)
        report(
          `${file}: <main> hat sich geaendert (jetzt ${actual}, eingefroren ${expected}). Rechtstexte aendern sich nur bewusst; dann die Konstante LEGAL_MAIN_SHA256 in diesem Test anpassen.`,
        );
    }
    for (const file of LEGAL)
      if (!Object.hasOwn(LEGAL_MAIN_SHA256, file))
        report(`${file}: fuer diese Rechtsseite fehlt die Pruefsumme`);
  },
);

// ---------------------------------------------------------------------------
// Weiterleitungsseiten
// ---------------------------------------------------------------------------

check(
  "Weiterleitungsseiten: noindex, Canonical gleich Ziel, Ziel vorhanden, sichtbarer Link",
  (report) => {
    for (const page of ofKind("redirect")) {
      const place = where(page, page.refresh.token);
      if (!robotsOf(page).includes("noindex"))
        report(`${page.file}: <meta name="robots" content="noindex"> fehlt`);
      const target = parseTarget(page.refresh.url, page.file, "");
      if (!target || target.outside || target.file === page.file) {
        report(
          `${place}: refresh "${page.refresh.token.attrs.get("content")}" nennt kein anderes internes Ziel`,
        );
        continue;
      }
      const found = lookup(target.file);
      const goal = pages.get(target.file);
      if (!found.found) report(`${place}: Ziel ${missing(target.file, found)}`);
      else if (!goal) report(`${place}: Ziel ${target.file} ist keine Seite`);
      else if (goal.kind !== "content" && goal.kind !== "legal")
        report(
          `${place}: Ziel ${target.file} hat die Seitenart ${goal.kind}, erwartet eine Inhaltsseite`,
        );
      if (goal && target.hash !== "" && !goal.ids.has(target.hash))
        report(`${place}: in ${target.file} gibt es keine id="${target.hash}"`);
      const canonicals = linkTokens(page, "canonical");
      if (canonicals.length !== 1)
        report(
          `${page.file}: ${canonicals.length} canonical-Angaben, erwartet genau eine`,
        );
      for (const link of canonicals)
        if (link.attrs.get("href") !== urlOf(target.file))
          report(
            `${where(page, link)}: canonical ist "${link.attrs.get("href")}", erwartet das Ziel ${urlOf(target.file)}`,
          );
      const visible = page.opens.some((open) => {
        if (open.tag !== "a" || !inside(page.body, open)) return false;
        if (
          open.attrs.has("hidden") ||
          open.attrs.get("aria-hidden") === "true"
        )
          return false;
        const link = targetOf(page, open);
        const same =
          link && link.file === target.file && link.hash === target.hash;
        return same && textOf(page, open) !== "";
      });
      if (!visible)
        report(
          `${page.file}: im <body> fehlt ein sichtbarer Link auf ${page.refresh.url}`,
        );
    }
  },
);

check(
  "Weiterleitungsseiten: nicht in der Sitemap, kein hreflang-Ziel, nirgends intern verlinkt",
  (report) => {
    const redirects = new Set(ofKind("redirect").map((page) => page.file));
    for (const entry of sitemap() || [])
      for (const loc of entry.loc)
        if (redirects.has(fileOfUrl(loc)))
          report(
            `${entry.place}: ${loc} ist eine Weiterleitungsseite und steht in der Sitemap`,
          );
    const out = grouped(report);
    for (const ref of allRefs()) {
      const { file } = ref.target;
      const skip =
        !redirects.has(file) ||
        ref.source === file ||
        ref.source === "sitemap.xml";
      if (skip) continue;
      const hreflang =
        ref.token &&
        ref.token.tag === "link" &&
        rels(ref.token).includes("alternate");
      out.add(
        ref.source,
        refLine(ref),
        `${hreflang ? "hreflang" : ref.via} "${ref.raw}" zeigt auf die Weiterleitungsseite ${file}, gemeint ist ihr Ziel`,
      );
    }
    out.flush();
  },
);

// ---------------------------------------------------------------------------
// Veroeffentlichung
// ---------------------------------------------------------------------------

// Liest die Liste unter exclude aus _config.yml (Blockliste oder [a, b]).
function excludeList(yaml) {
  const clean = (value) =>
    value
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2")
      .replace(/\/+$/, "");
  const out = [];
  let open = false;
  for (const raw of yaml.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/(^|\s)#.*$/, "");
    if (/^exclude\s*:/.test(line)) {
      const inline = /^exclude\s*:\s*\[(.*)\]\s*$/.exec(line);
      if (inline) out.push(...inline[1].split(",").map(clean).filter(Boolean));
      open = !inline;
    } else if (open) {
      const item = /^\s*-\s+(.+)$/.exec(line);
      if (item) out.push(clean(item[1]));
      else if (/^\S/.test(line)) open = false;
    }
  }
  return out;
}

check(
  "Veroeffentlichung: _config.yml ist vorhanden, .nojekyll fehlt",
  (report) => {
    if (!lookup("_config.yml").found)
      report(
        "_config.yml fehlt: ohne exclude liefert GitHub Pages Notizen und Tests aus",
      );
    if (fs.readdirSync(ROOT).includes(".nojekyll"))
      report(
        ".nojekyll ist vorhanden: damit wuerden auch _illus/ und _tools/ ausgeliefert",
      );
  },
);

check(
  "Veroeffentlichung: jede interne Datei im Wurzelordner steht in exclude, keine ausgelieferte",
  (report) => {
    const excluded = lookup("_config.yml").found
      ? excludeList(read("_config.yml"))
      : [];
    const isExcluded = (name) =>
      excluded.some((pattern) => matchesPattern(pattern, name));
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      const { name } = entry;
      const delivered = entry.isDirectory()
        ? name === "assets"
        : name.endsWith(".html") || DELIVERY.has(name);
      if (delivered) {
        if (isExcluded(name))
          report(
            `_config.yml: exclude nennt ${name}, das wird aber ausgeliefert`,
          );
        continue;
      }
      if (name.startsWith(".") || name.startsWith("_") || isExcluded(name))
        continue;
      if (isIgnored(name, entry.isDirectory())) continue;
      report(
        `${name}${entry.isDirectory() ? "/" : ""}: steht nicht unter exclude in _config.yml und wuerde veroeffentlicht`,
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Anfragewege
// ---------------------------------------------------------------------------

function presetKeys(report) {
  try {
    const draft = require("../assets/draft.js");
    if (draft && draft.PRESETS && typeof draft.PRESETS === "object")
      return Object.keys(draft.PRESETS);
    report("assets/draft.js: exportiert kein Objekt PRESETS");
  } catch (error) {
    const reason = String(error && error.message).split("\n")[0];
    report(`assets/draft.js: nicht ladbar (${reason})`);
  }
  return null;
}

check(
  "?type= steht nur an Links zum Fragebogen und nur mit Schluesseln aus PRESETS",
  (report) => {
    const keys = presetKeys(report);
    const forms = new Set(Object.values(ENQUIRY));
    const out = grouped(report);
    for (const ref of pageRefList()) {
      const params = new URLSearchParams(ref.target.query);
      if (!params.has("type")) continue;
      const type = params.get("type");
      const label = `${ref.via} "${ref.raw}"`;
      if (!forms.has(ref.target.file))
        out.add(
          ref.source,
          refLine(ref),
          `${label}: ?type= ist nur an ${ENQUIRY.de} und ${ENQUIRY.en} erlaubt`,
        );
      else if (keys && !keys.includes(type))
        out.add(
          ref.source,
          refLine(ref),
          `${label}: "${type}" ist kein Schluessel aus PRESETS (${keys.join(", ")})`,
        );
    }
    out.flush();
  },
);

check(
  "Fragebogen-Links: Ziel passt zur Sprache, Knopftext stammt aus der erlaubten Menge",
  (report) => {
    const forms = new Set(Object.values(ENQUIRY));
    for (const page of pages.values()) {
      const lang = page.lang === "en" ? "en" : "de";
      for (const link of page.opens) {
        // Der Sprachumschalter fuehrt absichtlich zur anderen Fassung, und
        // Sprungmarken innerhalb des Fragebogens sind keine Anfrage-Knoepfe.
        if (link.tag !== "a" || classes(link).includes("language")) continue;
        const target = targetOf(page, link);
        if (!target || target.own || !forms.has(target.file)) continue;
        const place = where(page, link);
        const text = textOf(page, link);
        if (target.file !== ENQUIRY[lang])
          report(
            `${place}: Seite mit lang="${lang}" verlinkt ${target.file}, erwartet ${ENQUIRY[lang]}`,
          );
        const allowed = [BUTTON[lang]];
        if (inside(page.desktopNav, link)) allowed.push(MENU_BUTTON[lang]);
        const selection =
          HOME.has(page.file) && classes(link).includes("property-cta");
        if (allowed.includes(text)) continue;
        if (selection && HOME_BUTTON[lang].test(text)) continue;
        const wanted = allowed.map((item) => `"${item}"`).join(" oder ");
        report(`${place}: Knopftext "${text}", erlaubt ist hier ${wanted}`);
      }
    }
  },
);

const mainLinks = (page) =>
  page.opens
    .filter((open) => open.tag === "a" && inside(page.main, open))
    .map((open) => ({ open, target: targetOf(page, open) }))
    .filter((link) => link.target);

check(
  "Anfrageweg: im <main> der Inhaltsseiten fuehrt kein Link zum Kontaktabschnitt der Startseite",
  (report) => {
    // Header und Mobilmenue behalten "Kontakt" nach #kontakt, sie liegen
    // ausserhalb von <main>. 404.html ist keine Inhaltsseite und ausgenommen.
    for (const page of ofKind("content")) {
      const lang = page.lang === "en" ? "en" : "de";
      for (const { open, target } of mainLinks(page)) {
        const contact =
          !target.own && HOME.has(target.file) && target.hash === "kontakt";
        if (!contact) continue;
        report(
          `${where(page, open)}: "${textOf(page, open)}" fuehrt nach ${target.file}#kontakt, vereinbart ist "${BUTTON[lang]}" nach ${ENQUIRY[lang]}`,
        );
      }
    }
  },
);

check(
  "Leistungsuebersicht: verlinkt WEG, Miethaus und Sondereigentum im <main>",
  (report) => {
    for (const [file, details] of Object.entries(OVERVIEW)) {
      const page = pages.get(file);
      if (!page) {
        report(`${file} fehlt`);
        continue;
      }
      const linked = new Set(mainLinks(page).map((link) => link.target.file));
      for (const detail of details)
        if (!linked.has(detail))
          report(`${file}: im <main> fehlt ein Link auf ${detail}`);
    }
  },
);

check(
  "Leistungsuebersicht: endet im <main> mit einem Anfrage-Knopf zum Fragebogen",
  (report) => {
    for (const file of Object.keys(OVERVIEW)) {
      const page = pages.get(file);
      if (!page) {
        report(`${file} fehlt`);
        continue;
      }
      const lang = page.lang === "en" ? "en" : "de";
      const button = mainLinks(page).some(
        (link) =>
          link.target.file === ENQUIRY[lang] &&
          textOf(page, link.open) === BUTTON[lang],
      );
      if (!button)
        report(
          `${file}: im <main> fehlt der Knopf "${BUTTON[lang]}" nach ${ENQUIRY[lang]}`,
        );
    }
  },
);
