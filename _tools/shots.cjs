// Die eine Screenshot-Runde: nimmt alle Seiten (ohne Weiterleitungsseiten) gegen
// zwei Server und in zwei Breiten auf. Ruft dafür shot.cjs aus demselben Ordner
// in vier Stapeln auf: Basis und Arbeitsstand, je 1440 und 390 Pixel.
//
// Vorher beide Server starten, zum Beispiel:
//   python -m http.server 8765 --bind 127.0.0.1 --directory "<Arbeitsstand>"
//   python -m http.server 8766 --bind 127.0.0.1 --directory "<Basis-Export>"
//
// Aufruf:
//   node _tools/shots.cjs --out <ordner>
//     [--neu http://127.0.0.1:8765] [--basis http://127.0.0.1:8766]
//     [--breiten 1440,390] [--root <website-ordner>]
//     [--nur index.html,weg.html] [--nur-neu] [--ohne-vorabtest]
//
// Ergebnis: <ordner>/basis/<seite>-<breite>.png und <ordner>/neu/<seite>-<breite>.png.
// Danach vergleichen mit: python _tools/shotdiff.py <ordner>
//
// --nur       nimmt nur die genannten Seiten auf (nach einer Korrektur).
// --nur-neu   lässt die Basis aus (sie ändert sich nach einer Korrektur nicht).
// Rückgabewert: 0, wenn jede Aufnahme vorliegt. 1, wenn Aufnahmen fehlen.
// 2 bei einem Aufruf- oder Verbindungsfehler.
const { spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const WEITERLEITUNG = /<meta\b[^>]*http-equiv="refresh"/i;
const STAPEL_ZEIT = 20 * 60 * 1000; // je Stapel
const EINZEL_ZEIT = 3 * 60 * 1000; // je einzelner Aufnahme im Nachlauf
const MAX_ZEICHEN = 20000; // Länge einer Befehlszeile, Windows erlaubt rund 32000

function optionen(argv) {
  const opt = {
    out: null,
    neu: "http://127.0.0.1:8765",
    basis: "http://127.0.0.1:8766",
    breiten: [1440, 390],
    root: path.resolve(__dirname, ".."),
    nur: null,
    nurNeu: false,
    vorabtest: true,
  };
  const wert = (i) => {
    if (i + 1 >= argv.length) throw new Error(`Wert fehlt hinter ${argv[i]}`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opt.out = path.resolve(wert(i++));
    else if (a === "--neu") opt.neu = wert(i++);
    else if (a === "--basis") opt.basis = wert(i++);
    else if (a === "--root") opt.root = path.resolve(wert(i++));
    else if (a === "--breiten")
      opt.breiten = wert(i++)
        .split(",")
        .map((b) => parseInt(b, 10));
    else if (a === "--nur")
      opt.nur = wert(i++)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a === "--nur-neu") opt.nurNeu = true;
    else if (a === "--ohne-vorabtest") opt.vorabtest = false;
    else throw new Error(`unbekannte Angabe: ${a}`);
  }
  if (!opt.out) throw new Error("--out <ordner> fehlt");
  if (!opt.breiten.length || opt.breiten.some((b) => !(b > 0)))
    throw new Error("--breiten erwartet Zahlen, zum Beispiel 1440,390");
  return opt;
}

function seiten(root, nur) {
  const alle = fs
    .readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .sort();
  const ohne = [];
  const liste = alle.filter((f) => {
    if (WEITERLEITUNG.test(fs.readFileSync(path.join(root, f), "utf8"))) {
      ohne.push(f);
      return false;
    }
    return true;
  });
  if (!nur) return { liste, ohne };
  for (const f of nur) {
    if (!alle.includes(f)) throw new Error(`--nur: ${f} gibt es nicht in ${root}`);
    if (ohne.includes(f)) throw new Error(`--nur: ${f} ist eine Weiterleitungsseite`);
  }
  return { liste: liste.filter((f) => nur.includes(f)), ohne };
}

function erreichbar(url) {
  return new Promise((resolve) => {
    let fertig = false;
    const ende = (ok, grund) => {
      if (!fertig) {
        fertig = true;
        resolve({ ok, grund });
      }
    };
    try {
      const anfrage = (url.startsWith("https:") ? https : http).get(url, (antwort) => {
        antwort.resume();
        ende(antwort.statusCode === 200, `Status ${antwort.statusCode}`);
      });
      anfrage.setTimeout(8000, () => {
        anfrage.destroy();
        ende(false, "keine Antwort nach 8 Sekunden");
      });
      anfrage.on("error", (e) => ende(false, e.code || e.message));
    } catch (e) {
      ende(false, e.message);
    }
  });
}

// Teilt die Aufträge so, dass keine Befehlszeile zu lang wird.
function pakete(auftraege) {
  const liste = [[]];
  let laenge = 0;
  for (const a of auftraege) {
    const n = a.url.length + a.datei.length + 12;
    if (laenge + n > MAX_ZEICHEN && liste[liste.length - 1].length) {
      liste.push([]);
      laenge = 0;
    }
    liste[liste.length - 1].push(a);
    laenge += n;
  }
  return liste;
}

function shot(shotPfad, auftraege, zeit) {
  const args = [shotPfad];
  for (const a of auftraege) args.push(a.url, String(a.breite), a.datei);
  const lauf = spawnSync(process.execPath, args, { stdio: "inherit", timeout: zeit });
  if (lauf.error) console.log(`  shot.cjs: ${lauf.error.message}`);
  return lauf.status === 0;
}

const liegtVor = (a) => fs.existsSync(a.datei) && fs.statSync(a.datei).size > 0;

async function main() {
  const opt = optionen(process.argv.slice(2));
  const shotPfad = path.join(__dirname, "shot.cjs");
  if (!fs.existsSync(shotPfad)) throw new Error(`shot.cjs fehlt in ${__dirname}`);
  const { liste, ohne } = seiten(opt.root, opt.nur);
  if (!liste.length) throw new Error(`keine Seiten in ${opt.root}`);
  const ziele = [];
  if (!opt.nurNeu) ziele.push({ name: "basis", url: opt.basis.replace(/\/+$/, "") });
  ziele.push({ name: "neu", url: opt.neu.replace(/\/+$/, "") });

  console.log(
    `${liste.length} Seiten, Breiten ${opt.breiten.join(" und ")}, ` +
      `${ziele.map((z) => `${z.name} = ${z.url}`).join(", ")}`,
  );
  if (ohne.length) console.log(`Weiterleitungsseiten ausgelassen: ${ohne.join(", ")}`);

  if (opt.vorabtest) {
    for (const z of ziele) {
      const probe = await erreichbar(`${z.url}/${liste[0]}`);
      if (!probe.ok) {
        throw new Error(
          `Server für "${z.name}" antwortet nicht (${z.url}/${liste[0]}: ${probe.grund}). ` +
            "Erst beide Server starten, siehe Kopf dieser Datei.",
        );
      }
    }
  }

  const fehlend = [];
  let stapel = 0;
  for (const z of ziele) {
    const ordner = path.join(opt.out, z.name);
    fs.mkdirSync(ordner, { recursive: true });
    for (const breite of opt.breiten) {
      stapel++;
      const auftraege = liste.map((seite) => ({
        seite,
        breite,
        url: `${z.url}/${seite}`,
        datei: path.join(ordner, `${seite.replace(/\.html$/, "")}-${breite}.png`),
      }));
      // Alte Aufnahmen entfernen, damit eine fehlgeschlagene nicht als frisch gilt.
      for (const a of auftraege) fs.rmSync(a.datei, { force: true });
      const stapelZahl = ziele.length * opt.breiten.length;
      console.log(`\nStapel ${stapel} von ${stapelZahl}: ${z.name}, ${breite} px`);
      for (const paket of pakete(auftraege)) shot(shotPfad, paket, STAPEL_ZEIT);
      // Nachlauf: Was fehlt, einzeln wiederholen. Das fängt auch den Fall ab,
      // dass shot.cjs nur einen Auftrag je Aufruf annimmt.
      const offen = auftraege.filter((a) => !liegtVor(a));
      if (offen.length) console.log(`  ${offen.length} Aufnahmen fehlen, einzelner Nachlauf`);
      for (const a of offen) {
        shot(shotPfad, [a], EINZEL_ZEIT);
        if (!liegtVor(a)) fehlend.push(`${z.name}/${path.basename(a.datei)}`);
      }
    }
  }

  const gesamt = ziele.length * opt.breiten.length * liste.length;
  console.log(`\n${gesamt - fehlend.length} von ${gesamt} Aufnahmen liegen in ${opt.out}`);
  if (fehlend.length) {
    console.log(`Es fehlen: ${fehlend.join(", ")}`);
    process.exit(1);
  }
  console.log(`Weiter mit: python _tools/shotdiff.py "${opt.out}"`);
}

main().catch((e) => {
  console.error(`FEHLER  ${e.message}`);
  process.exit(2);
});
