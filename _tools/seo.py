"""Brotkrumen-Daten, og-Angaben und Sitemap.

1. BreadcrumbList als JSON-LD aus <nav class="breadcrumbs">, als
   <script type="application/ld+json" data-gen="breadcrumb"> vor </head>.
   Die sichtbaren Brotkrumen bleiben, wie sie sind. Seiten ohne Brotkrumen
   bekommen keine Daten, ein verwaister Block wird entfernt.
2. og:title und og:description folgen <title> und der Description.
3. sitemap.xml: alle Seiten außer 404.html und Weiterleitungsseiten, je mit
   lastmod. Das ist das Datum des jüngsten Commits, in dem sich <main>
   geändert hat (?v=-Werte und Leerraum zählen nicht). Weicht der
   Arbeitsstand vom letzten Commit ab, gilt das heutige Datum. Reihenfolge,
   changefreq und priority vorhandener Einträge bleiben erhalten.

Die vier Rechtsseiten und die Weiterleitungsseiten werden nicht verändert.

Aufruf:     python _tools/seo.py [--root ORDNER] [--check] [--diff] [seiten ...]
Normalfall: python _tools/build.py
"""
import datetime
import html
import json
import re
import subprocess
import sys

sys.dont_write_bytecode = True

import nav
from nav import Fehler

SITEMAP = "sitemap.xml"
FEHLERSEITE = "404.html"
MARKE = '<script type="application/ld+json" data-gen="breadcrumb">'
EINZUG = "    "

KRUMEN = re.compile(r'<nav\b[^>]*\bclass="breadcrumbs"[^>]*>(.*?)</nav>', re.S)
GLIED = re.compile(
    r'<a\b[^>]*\bhref="([^"]*)"[^>]*>(.*?)</a>|<span\b[^>]*\baria-current="page"[^>]*>(.*?)</span>',
    re.S,
)
ERZEUGT = re.compile(r"[ \t]*" + re.escape(MARKE) + r".*?</script>[ \t]*\n", re.S)


def klartext(markup):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", markup)).split())


def kanonisch(s):
    m = re.search(r'<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]+)"', s)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Brotkrumen
# ---------------------------------------------------------------------------

def brotkrumen(stand, fn, s):
    """Liste aus (Name, Adresse) oder None, wenn die Seite keine Brotkrumen zeigt.

    Jeder Link wird ein Glied, die Adresse kommt aus dem Canonical der
    Zielseite. Das letzte Glied ist die Seite selbst. Ihr Name kommt aus
    <span aria-current="page">, sonst aus der Menübezeichnung in nav.py,
    sonst aus der h1 ohne Schlusspunkt."""
    m = KRUMEN.search(s)
    if not m:
        return None
    glieder, eigener = [], None
    for g in GLIED.finditer(m.group(1)):
        if g.group(1) is None:
            eigener = klartext(g.group(3))
            continue
        ziel = g.group(1).split("#")[0].split("?")[0].lstrip("/") or fn
        if not stand.gibt(ziel):
            raise Fehler(f"{fn}: Brotkrumen verweisen auf {ziel}, die Seite fehlt")
        adresse = kanonisch(stand.text(ziel))
        if not adresse:
            raise Fehler(f"{fn}: Brotkrumen-Ziel {ziel} hat kein Canonical")
        glieder.append((klartext(g.group(2)), adresse))
    if not eigener:
        eigener = klartext(nav.labels(nav.sprache(s)).get(fn, ""))
    if not eigener:
        h1 = re.search(r"<h1\b[^>]*>(.*?)</h1>", s, re.S)
        eigener = klartext(h1.group(1)).rstrip(".") if h1 else ""
    adresse = kanonisch(s)
    if not eigener or not adresse:
        raise Fehler(f"{fn}: Name oder Canonical für die Brotkrumen-Daten fehlt")
    return glieder + [(eigener, adresse)]


def brotkrumen_block(glieder):
    daten = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i, "name": name, "item": adresse}
            for i, (name, adresse) in enumerate(glieder, 1)
        ],
    }
    # "</" darf in einem Skriptblock nicht roh stehen.
    roh = json.dumps(daten, ensure_ascii=False, indent=2).replace("</", "<\\/")
    innen = "\n".join(EINZUG + "  " + z for z in roh.split("\n"))
    return f"{EINZUG}{MARKE}\n{innen}\n{EINZUG}</script>\n"


def brotkrumen_setzen(stand, fn, s):
    glieder = brotkrumen(stand, fn, s)
    if glieder is None:
        return ERZEUGT.sub("", s, count=1)
    block = brotkrumen_block(glieder)
    if ERZEUGT.search(s):
        return ERZEUGT.sub(lambda m: block, s, count=1)
    s2, n = re.subn(r"^[ \t]*</head>", lambda m: block + m.group(0), s, count=1, flags=re.M)
    if n != 1:
        raise Fehler(f"{fn}: </head> steht nicht am Zeilenanfang")
    return s2


# ---------------------------------------------------------------------------
# og-Angaben
# ---------------------------------------------------------------------------

def og_setzen(s):
    """og:title und og:description auf den Stand von <title> und Description.
    Fehlt eine og-Zeile (404.html), wird keine angelegt."""
    titel = re.search(r"<title>(.*?)</title>", s, re.S)
    beschreibung = re.search(r'<meta\b(?=[^>]*\bname="description")[^>]*\bcontent="([^"]*)"', s)
    werte = {
        "og:title": " ".join(titel.group(1).split()).replace('"', "&quot;") if titel else None,
        "og:description": beschreibung.group(1) if beschreibung else None,
    }
    for eigenschaft, wert in werte.items():
        if wert is None:
            continue
        s = re.sub(
            r'<meta\b(?=[^>]*\bproperty="' + eigenschaft + r'")[^>]*>',
            lambda m: re.sub(r'\bcontent="[^"]*"', lambda _: f'content="{wert}"', m.group(0), count=1),
            s,
            count=1,
        )
    return s


# ---------------------------------------------------------------------------
# Sitemap
# ---------------------------------------------------------------------------

class Verlauf:
    """Liest den Git-Verlauf, ohne etwas zu verändern: je Seite die Commits,
    die sie berührt haben, und ihren Inhalt in einem Commit."""

    def __init__(self, root, seiten):
        self.root = root
        self.commits = {}
        self.vorsatz = ""
        self._katze = None
        self.vorhanden = False
        try:
            self.vorsatz = self._git("rev-parse", "--show-prefix").strip()
            self._git("rev-parse", "--verify", "--quiet", "HEAD")
            log = self._git("-c", "core.quotepath=off", "log", "--format=>%H %cs", "--name-only", "--", *seiten)
        except (OSError, subprocess.CalledProcessError):
            return
        self.vorhanden = True
        commit = None
        for zeile in log.splitlines():
            if zeile.startswith(">"):
                commit = tuple(zeile[1:].split())
            elif zeile.strip() and commit:
                name = zeile.strip()
                if name.startswith(self.vorsatz):
                    self.commits.setdefault(name[len(self.vorsatz) :], []).append(commit)

    def _git(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.root, check=True, capture_output=True, encoding="utf-8", errors="replace"
        ).stdout

    def inhalt(self, sha, fn):
        """Text der Seite im Commit sha, None wenn sie dort fehlt."""
        if self._katze is None:
            self._katze = subprocess.Popen(
                ["git", "cat-file", "--batch"], cwd=self.root, stdin=subprocess.PIPE, stdout=subprocess.PIPE
            )
        self._katze.stdin.write(f"{sha}:{self.vorsatz}{fn}\n".encode("utf-8"))
        self._katze.stdin.flush()
        kopf = self._katze.stdout.readline().split()
        # Antwort: "<id> <typ> <größe>" und der Inhalt, sonst "<name> missing".
        if len(kopf) != 3 or not kopf[2].isdigit():
            return None
        daten = self._katze.stdout.read(int(kopf[2]))
        self._katze.stdout.read(1)
        return daten.decode("utf-8", "replace") if kopf[1] == b"blob" else None

    def schliessen(self):
        if self._katze is not None:
            self._katze.stdin.close()
            self._katze.wait()
            self._katze = None


def kern(text):
    """<main> ohne ?v=-Werte und ohne Leerraum: der Teil, dessen Änderung als
    Änderung der Seite zählt. Menü, Kopf-Block und Umbrüche zählen nicht."""
    m = re.search(r"<main\b.*?</main>", text, re.S)
    teil = m.group(0) if m else text
    return re.sub(r"\s+", "", re.sub(r"\?v=[0-9A-Za-z]*", "", teil))


def lastmod(stand, verlauf, fn, heute):
    jetzt, datum = kern(stand.text(fn)), None
    for sha, tag in verlauf.commits.get(fn, []):
        alt = verlauf.inhalt(sha, fn)
        if alt is None or kern(alt) != jetzt:
            break
        datum = tag
    return datum or heute


def sitemap(stand):
    seiten = {}
    for fn in stand.seiten():
        s = stand.text(fn)
        if fn == FEHLERSEITE or nav.ist_weiterleitung(s):
            continue
        adresse = kanonisch(s)
        if not adresse:
            raise Fehler(f"{fn}: Canonical fehlt, die Seite kann nicht in die Sitemap")
        if adresse in seiten:
            raise Fehler(f"{fn} und {seiten[adresse]} haben dasselbe Canonical")
        seiten[adresse] = fn

    feld = lambda name, eintrag: (re.search(rf"<{name}>\s*(.*?)\s*</{name}>", eintrag, re.S) or [None, None])[1]
    eintraege, bekannt = [], set()
    alt = stand.text(SITEMAP) if stand.gibt(SITEMAP) else ""
    for m in re.finditer(r"<url>(.*?)</url>", alt, re.S):
        adresse = feld("loc", m.group(1))
        if adresse in seiten and adresse not in bekannt:
            bekannt.add(adresse)
            eintraege.append((adresse, feld("lastmod", m.group(1)), feld("changefreq", m.group(1)), feld("priority", m.group(1))))
    for adresse, fn in seiten.items():
        if adresse not in bekannt:
            eintraege.append((adresse, None, "monthly", "0.5"))
            stand.hinweis(f"{SITEMAP}: {fn} neu aufgenommen mit changefreq monthly und priority 0.5, bei Bedarf von Hand anpassen")

    heute = datetime.date.today().isoformat()
    verlauf = Verlauf(stand.root, sorted(seiten.values()))
    if not verlauf.vorhanden:
        stand.hinweis(f"{SITEMAP}: kein Git-Verlauf lesbar, vorhandene lastmod-Werte bleiben, fehlende bekommen das heutige Datum")
    zeilen = ['<?xml version="1.0" encoding="utf-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    try:
        for adresse, datum, takt, rang in eintraege:
            if verlauf.vorhanden:
                datum = lastmod(stand, verlauf, seiten[adresse], heute)
            elif not datum or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", datum):
                datum = heute
            zeile = f"  <url><loc>{adresse}</loc><lastmod>{datum}</lastmod>"
            if takt:
                zeile += f"<changefreq>{takt}</changefreq>"
            if rang:
                zeile += f"<priority>{rang}</priority>"
            zeilen.append(zeile + "</url>")
    finally:
        verlauf.schliessen()
    zeilen.append("</urlset>")
    stand.setze(SITEMAP, "\n".join(zeilen) + "\n")


def anwenden(stand, seiten=None):
    for fn in seiten or stand.seiten():
        s = stand.text(fn)
        if fn in nav.RECHTSSEITEN or nav.ist_weiterleitung(s):
            continue
        stand.setze(fn, og_setzen(brotkrumen_setzen(stand, fn, s)))
    sitemap(stand)


if __name__ == "__main__":
    sys.exit(nav.lauf([("seo", anwenden)], __doc__))
