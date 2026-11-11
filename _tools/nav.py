"""Menü für alle Seiten, dazu die gemeinsamen Helfer der Generatoren.

Baut Desktop- und Mobil-Navigation (mit Leistungen-Dropdown) in alle Seiten ein
und schreibt die Hausgrafik des Menüs als eigene Datei assets/nav-house.svg.
Idempotent: ersetzt jeweils den kompletten <nav class="desktop-nav">- und
<nav class="mobile-nav">-Block. Weiterleitungsseiten (meta refresh) werden
übersprungen. Fehlt auf einer anderen Seite eines der beiden Menüs, bricht der
Lauf mit einer Meldung ab.

Aufruf:     python _tools/nav.py [--root ORDNER] [--check] [--diff] [seiten ...]
Normalfall: python _tools/build.py (Menü, Kopf-Block, SEO-Daten in einem Lauf)
"""
import argparse
import difflib
import hashlib
import os
import posixpath
import re
import sys

DE = {
    "top": [("leistungen.html", "Leistungen"), ("ueber-uns.html", "Über uns"), ("reporting.html", "Reporting")],
    "mobile_extra": [("mieter.html", "Mieterservice")],
    "contact": ("index.html", "Kontakt"),
    "nav_label": "Hauptnavigation",
    "mobile_label": "Mobile Navigation",
    "toggle_label": "Leistungen aufklappen",
    "group_label": "Verwaltung",
    "more_label": "Weitere Leistungen",
    "all": "Alle Leistungen im Überblick",
    "all_mobile": "Alle Leistungen",
    "manage": [
        ("weg.html", "WEG-Verwaltung"),
        ("miethaus.html", "Miethausverwaltung"),
        ("sondereigentum.html", "Sondereigentum (SEV)"),
        ("zinshaus.html", "Zinshäuser &amp; Investoren"),
    ],
    "more": [
        ("sanierung.html", "Energetische Sanierung"),
        ("baubetreuung.html", "Baubetreuung"),
        ("hausverwaltung-verkaufen.html", "Hausverwaltung verkaufen"),
    ],
    "service_pages": ["weg.html", "miethaus.html", "sondereigentum.html", "zinshaus.html", "nachfolge.html", "sanierung.html", "baubetreuung.html", "hausverwaltung-verkaufen.html"],
    # Seiten ohne eigenen Menüpunkt: Name für die Brotkrumen-Daten (seo.py).
    "extra_labels": {"nachfolge.html": "Nachfolge"},
}
EN = {
    "top": [("en-services.html", "Services"), ("en-about.html", "About us"), ("en-reporting.html", "Reporting")],
    "mobile_extra": [("en-tenants.html", "Tenant services")],
    "contact": ("en.html", "Contact"),
    "nav_label": "Main navigation",
    "mobile_label": "Mobile navigation",
    "toggle_label": "Show services",
    "group_label": "Management",
    "more_label": "More services",
    "all": "All services at a glance",
    "all_mobile": "All services",
    "manage": [
        ("en-weg.html", "WEG management"),
        ("en-miethaus.html", "Rental buildings"),
        ("en-sondereigentum.html", "Individual apartments (SEV)"),
        ("en-zinshaus.html", "Zinshaus &amp; investors"),
    ],
    "more": [
        ("en-renovation.html", "Energy renovation"),
        ("en-construction-support.html", "Construction support"),
        ("en-sell-your-company.html", "Sell your property management firm"),
    ],
    "service_pages": ["en-weg.html", "en-miethaus.html", "en-sondereigentum.html", "en-zinshaus.html", "en-succession.html", "en-renovation.html", "en-construction-support.html", "en-sell-your-company.html"],
    "extra_labels": {"en-succession.html": "Succession"},
}


CTA = {
    "de": ("anfrage.html", "Betreuung anfragen", "Ein paar kurze Fragen zu Ihrem Objekt, dann Ihre Kontaktdaten.", "Zum Fragebogen"),
    "en": ("en-enquiry.html", "Request management", "A few short questions about your property, then your contact details.", "Get started"),
}

HAUS = "assets/nav-house.svg"
ICONS = "assets/icons.svg"


# ---------------------------------------------------------------------------
# Gemeinsame Helfer (auch von kopf.py, seo.py und build.py benutzt)
# ---------------------------------------------------------------------------

# Vorgabe für --root: der Ordner über _tools, unabhängig vom Arbeitsverzeichnis.
WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECHTSSEITEN = ("impressum.html", "datenschutz.html", "en-imprint.html", "en-privacy.html")
# Versionen dieser Dateiarten entstehen aus dem Inhalt mit einheitlichen
# Zeilenenden, alle anderen aus den rohen Bytes.
TEXTARTEN = (".css", ".js", ".svg", ".webmanifest", ".json")
WEITERLEITUNG = re.compile(r'<meta\b[^>]*\bhttp-equiv="refresh"', re.I)


class Fehler(Exception):
    """Abbruch mit lesbarer Meldung. Geschrieben wird dann nichts."""


class Stand:
    """Arbeitsstand im Speicher.

    Liest Dateien bei Bedarf, sammelt alle Änderungen und schreibt erst am
    Ende. So rechnet build.py die drei Schritte nacheinander durch und kann mit
    --check prüfen, ohne eine Datei anzufassen. Texte laufen intern mit \\n;
    beim Schreiben behält jede vorhandene Datei ihre Zeilenenden, neue Dateien
    bekommen LF.
    """

    def __init__(self, root):
        self.root = os.path.abspath(root)
        self._platte = {}
        self._neu = {}
        self._ordner = {}
        self.hinweise = []

    def _pfad(self, rel):
        return os.path.join(self.root, *rel.split("/"))

    def _von_platte(self, rel):
        if rel not in self._platte:
            try:
                with open(self._pfad(rel), "rb") as f:
                    self._platte[rel] = f.read()
            except OSError:
                self._platte[rel] = None
        return self._platte[rel]

    def roh(self, rel):
        return self._neu[rel] if rel in self._neu else self._von_platte(rel)

    def namen(self, ordner=""):
        """Dateinamen eines Ordners in genauer Schreibweise, samt neuer Dateien."""
        if ordner not in self._ordner:
            pfad = self._pfad(ordner) if ordner else self.root
            try:
                self._ordner[ordner] = {n for n in os.listdir(pfad) if os.path.isfile(os.path.join(pfad, n))}
            except OSError:
                self._ordner[ordner] = set()
        neu = {posixpath.basename(r) for r in self._neu if posixpath.dirname(r) == ordner}
        return self._ordner[ordner] | neu

    def gibt(self, rel):
        """True nur bei buchstabengenauer Schreibweise: GitHub Pages unterscheidet
        Groß- und Kleinschreibung, Windows nicht."""
        return posixpath.basename(rel) in self.namen(posixpath.dirname(rel)) and self.roh(rel) is not None

    def text(self, rel):
        daten = self.roh(rel)
        if daten is None:
            raise Fehler(f"{rel}: Datei fehlt")
        try:
            return daten.decode("utf-8").replace("\r\n", "\n")
        except UnicodeDecodeError as e:
            raise Fehler(f"{rel}: kein gültiges UTF-8 ({e})")

    def setze(self, rel, text):
        alt = self._von_platte(rel)
        if alt is not None and b"\r\n" in alt:
            text = text.replace("\n", "\r\n")
        daten = text.encode("utf-8")
        if daten == alt:
            self._neu.pop(rel, None)
        else:
            self._neu[rel] = daten

    def version(self, rel):
        """Wert hinter ?v=: die ersten 10 Hex-Zeichen von sha1 über den Inhalt."""
        if not self.gibt(rel):
            raise Fehler(f"{rel}: Datei fehlt (Schreibweise buchstabengenau?)")
        daten = self.roh(rel)
        if os.path.splitext(rel)[1].lower() in TEXTARTEN:
            daten = daten.replace(b"\r\n", b"\n")
        return hashlib.sha1(daten).hexdigest()[:10]

    def seiten(self):
        return sorted(n for n in self.namen("") if n.endswith(".html"))

    def hinweis(self, text):
        if text not in self.hinweise:
            self.hinweise.append(text)

    def geaendert(self):
        return sorted(self._neu)

    def diff(self, rel):
        alt = (self._von_platte(rel) or b"").decode("utf-8", "replace").splitlines(keepends=True)
        neu = self._neu[rel].decode("utf-8", "replace").splitlines(keepends=True)
        return "".join(difflib.unified_diff(alt, neu, "a/" + rel, "b/" + rel, n=1))

    def schreibe(self):
        for rel in self.geaendert():
            pfad = self._pfad(rel)
            os.makedirs(os.path.dirname(pfad), exist_ok=True)
            with open(pfad, "wb") as f:
                f.write(self._neu[rel])
            self._platte[rel] = self._neu.pop(rel)
        self._ordner.clear()


def ist_weiterleitung(text):
    return bool(WEITERLEITUNG.search(text))


def lauf(schritte, beschreibung, argv=None, sammelname=None):
    """Gemeinsamer Aufruf: Optionen lesen, Schritte im Speicher rechnen, dann
    schreiben oder (mit --check) nur melden. Rückgabe ist der Fehlercode:
    0 in Ordnung, 1 bei --check mit offenen Änderungen, 2 bei einem Fehler.
    Ohne Änderung bleibt die Ausgabe leer; nur der Sammelaufruf (sammelname)
    schließt immer mit einer Zeile."""
    for strom in (sys.stdout, sys.stderr):
        if hasattr(strom, "reconfigure"):
            strom.reconfigure(encoding="utf-8", errors="backslashreplace")
    p = argparse.ArgumentParser(description=beschreibung, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--root", default=WURZEL, metavar="ORDNER", help="Website-Ordner (Vorgabe: der Ordner über _tools)")
    p.add_argument("--check", action="store_true", help="nichts schreiben; Fehlercode 1, wenn sich etwas ändern würde")
    p.add_argument("--diff", action="store_true", help="die Änderungen zusätzlich als Diff zeigen")
    p.add_argument("seiten", nargs="*", help="nur diese Seiten bearbeiten, zum Ausprobieren (Vorgabe: alle *.html)")
    a = p.parse_args(argv)
    if not os.path.isfile(os.path.join(a.root, "index.html")):
        print(f"FEHLER: {a.root} ist kein Website-Ordner (index.html fehlt)", file=sys.stderr)
        return 2
    stand = Stand(a.root)
    seiten = [os.path.basename(s) for s in a.seiten] or None
    name = sammelname or schritte[0][0]
    try:
        for fn in seiten or []:
            if not stand.gibt(fn):
                raise Fehler(f"{fn}: Seite fehlt")
        for schritt_name, schritt in schritte:
            vorher = dict(stand._neu)
            schritt(stand, seiten)
            for rel in stand.geaendert():
                if vorher.get(rel) != stand._neu[rel]:
                    print(f"{schritt_name:5}{rel}")
    except Fehler as e:
        print(f"FEHLER: {e}", file=sys.stderr)
        print("Es wurde nichts geschrieben.", file=sys.stderr)
        return 2
    for text in stand.hinweise:
        print(f"Hinweis: {text}", file=sys.stderr)
    geaendert = stand.geaendert()
    if a.diff:
        for rel in geaendert:
            sys.stdout.write(stand.diff(rel))
    if a.check:
        if geaendert:
            print(f"{name} --check: {len(geaendert)} Datei(en) würden sich ändern, nichts geschrieben")
            return 1
        if sammelname:
            print(f"{name} --check: alles aktuell")
        return 0
    stand.schreibe()
    if sammelname:
        print(f"{name}: {len(geaendert)} Datei(en) geschrieben" if geaendert else f"{name}: alles aktuell")
    return 0


# ---------------------------------------------------------------------------
# Hausgrafik
# ---------------------------------------------------------------------------

VAR = re.compile(r"var\(\s*--hk-[\w-]+\s*,\s*([^()]*)\)")


def ersatzwerte(svg):
    """Ersetzt jedes var(--hk-..., Ersatz) durch den Ersatzwert, von innen nach
    außen, damit auch verschachtelte Angaben aufgehen. Als <img> eingebunden
    erreicht kein Seiten-CSS die Grafik, es gelten also immer die Ersatzwerte."""
    while True:
        neu = VAR.sub(lambda m: m.group(1).strip(), svg)
        if neu == svg:
            break
        svg = neu
    if "var(" in svg:
        raise Fehler(f"{HAUS}: var() ohne auflösbaren Ersatzwert im Baukasten _illus/kit.html")

    def stil(m):
        # Die --hk-Zuweisungen in der Grafik haben nach dem Einsetzen keinen Leser mehr.
        teile = [t.strip() for t in m.group(1).split(";") if t.strip() and not t.strip().startswith("--")]
        return f' style="{";".join(teile)}"' if teile else ""

    return re.sub(r'\s+style="([^"]*)"', stil, svg)


def house_svg(stand):
    """Kleines Haus aus dem Illustrations-Baukasten (_illus/kit.html) als
    eigenständige SVG-Datei mit eigenen IDs. Das Menü bindet sie als <img> ein."""
    kit = stand.text("_illus/kit.html")
    m = re.search(r"<defs>.*?</defs>", kit, re.S)
    if not m:
        raise Fehler("_illus/kit.html: <defs> nicht gefunden")
    defs = m.group(0).replace('id="hk-', 'id="nv-').replace('href="#hk-', 'href="#nv-')
    defs = re.sub(r"\s*\n\s*", "\n", ersatzwerte(defs))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 82" width="108" height="82">\n'
        + defs
        + '\n<use href="#nv-scene" transform="translate(4 2) scale(.135)"/>\n</svg>\n'
    )


# ---------------------------------------------------------------------------
# Menü
# ---------------------------------------------------------------------------

def cur(fn, href):
    return ' aria-current="page"' if fn == href else ""


def sprache(s):
    m = re.search(r'<html[^>]*lang="(\w+)"', s)
    return "en" if m and m.group(1) == "en" else "de"


def labels(lang):
    """Dateiname zu Menübezeichnung (mit HTML-Entitäten), für seo.py."""
    L = EN if lang == "en" else DE
    out = dict(L["extra_labels"])
    out.update(L["top"] + L["mobile_extra"] + L["manage"] + L["more"])
    return out


def build(fn, s, stand):
    lang = sprache(s)
    L = EN if lang == "en" else DE
    p = "/" if fn == "404.html" else ""
    iv = stand.version(ICONS)
    icon = lambda name: f'<svg class="icon" aria-hidden="true"><use href="{p}{ICONS}?v={iv}#{name}" /></svg>'
    house = (
        f'<img class="nav-menu-house" src="{p}{HAUS}?v={stand.version(HAUS)}" '
        f'width="108" height="82" alt="" loading="lazy" decoding="async">'
    )
    services_href, services_text = L["top"][0]
    in_services = fn in L["service_pages"] or fn == services_href

    cta_href, cta_title, cta_text, cta_button = CTA[lang]
    entry = lambda h, t: f'<a href="{p}{h}"{cur(fn, h)}><span>{t}</span>{icon("arrow-right")}</a>'
    manage = "".join(entry(h, t) for h, t in L["manage"])
    more = "".join(entry(h, t) for h, t in L["more"])
    desktop = (
        f'<nav class="desktop-nav" aria-label="{L["nav_label"]}">\n'
        f'          <div class="nav-item" data-nav-menu="">\n'
        f'            <a href="{p}{services_href}"{cur(fn, services_href)}>{services_text}</a>'
        f'<button class="nav-menu-toggle" type="button" aria-expanded="false" aria-controls="nav-services" '
        f'aria-label="{L["toggle_label"]}">{icon("chevron-down")}</button>\n'
        f'            <div class="nav-menu" id="nav-services">\n'
        f'              <div class="nav-menu-grid">\n'
        f'                <div class="nav-menu-group"><span class="nav-menu-label">{L["group_label"]}</span>{manage}</div>\n'
        f'                <div class="nav-menu-group"><span class="nav-menu-label">{L["more_label"]}</span>{more}</div>\n'
        f'                <div class="nav-menu-cta">{house}<strong>{cta_title}</strong><p>{cta_text}</p>'
        f'<a class="button" href="{p}{cta_href}">{cta_button}{icon("arrow-up-right")}</a></div>\n'
        f'              </div>\n'
        f'              <a class="nav-menu-all" href="{p}{services_href}">{L["all"]}{icon("arrow-right")}</a>\n'
        f'            </div>\n'
        f'          </div>'
        + "".join(f'<a href="{p}{h}"{cur(fn, h)}>{t}</a>' for h, t in L["top"][1:])
        + "\n        </nav>"
    )

    contact_href = "#kontakt" if fn == L["contact"][0] else f'{p}{L["contact"][0]}#kontakt'
    m_manage = "".join(f'<a href="{p}{h}"{cur(fn, h)}>{t}</a>' for h, t in L["manage"])
    m_more = "".join(f'<a href="{p}{h}"{cur(fn, h)}>{t}</a>' for h, t in L["more"])
    mobile = (
        f'<nav class="mobile-nav" id="mobile-nav" data-mobile-menu="" aria-label="{L["mobile_label"]}" hidden>\n'
        f'        <details class="mobile-sub"{" open" if in_services else ""}>\n'
        f'          <summary>{services_text}{icon("chevron-down")}</summary>\n'
        f'          <div class="mobile-sub-links">'
        f'<a href="{p}{services_href}"{cur(fn, services_href)}>{L["all_mobile"]}</a>'
        f'<span class="mobile-sub-label">{L["group_label"]}</span>{m_manage}'
        f'<span class="mobile-sub-label">{L["more_label"]}</span>{m_more}'
        f'<a class="mobile-sub-cta" href="{p}{cta_href}">{cta_title}{icon("arrow-right")}</a></div>\n'
        f'        </details>\n'
        f'        '
        + "".join(f'<a href="{p}{h}"{cur(fn, h)}>{t}</a>' for h, t in L["top"][1:] + L["mobile_extra"])
        + f'<a href="{contact_href}">{L["contact"][1]}</a>\n'
        f'      </nav>'
    )
    s2, n1 = re.subn(r'<nav class="desktop-nav".*?</nav>', lambda m: desktop, s, count=1, flags=re.S)
    s2, n2 = re.subn(r'<nav class="mobile-nav".*?</nav>', lambda m: mobile, s2, count=1, flags=re.S)
    if n1 != 1 or n2 != 1:
        raise Fehler(f"{fn}: desktop-nav oder mobile-nav nicht gefunden")
    return s2


def anwenden(stand, seiten=None):
    stand.setze(HAUS, house_svg(stand))
    for fn in seiten or stand.seiten():
        s = stand.text(fn)
        if ist_weiterleitung(s):
            continue
        stand.setze(fn, build(fn, s, stand))


if __name__ == "__main__":
    sys.exit(lauf([("nav", anwenden)], __doc__))
