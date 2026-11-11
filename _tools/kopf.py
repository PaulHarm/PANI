"""Einheitlicher Kopf-Block und Versionen aus dem Dateiinhalt.

Jede Seite bekommt im <head> zwischen <!-- kopf:start --> und <!-- kopf:ende -->
dieselben Zeilen: Themenfarbe, Icons, Manifest, Schrift-Preload, CSS in fester
Reihenfolge und nur die Skripte, die der Seiteninhalt braucht. Der erste Lauf
entfernt dafür die verstreuten Zeilen aus dem <head>, spätere Läufe ersetzen
nur den Block. Danach trägt jeder ?v=-Wert im ganzen Dokument die Version der
Datei, auf die er zeigt: die ersten 10 Hex-Zeichen von sha1 über den Inhalt.

Weiterleitungsseiten (meta refresh) bleiben unberührt.

Aufruf:     python _tools/kopf.py [--root ORDNER] [--check] [--diff] [seiten ...]
Normalfall: python _tools/build.py
"""
import json
import posixpath
import re
import sys

sys.dont_write_bytecode = True

import nav
from nav import Fehler

START = "<!-- kopf:start -->"
ENDE = "<!-- kopf:ende -->"
MANIFEST = "site.webmanifest"
# Ohne ?v=: Die Adresse muss genau zu url("fonts/fraunces-latin.woff2") in
# assets/site.css passen, sonst lädt der Browser die Schrift doppelt.
SCHRIFT = "assets/fonts/fraunces-latin.woff2"


def _attribut(name):
    return re.compile(r"(?<![\w-])" + re.escape(name) + r"(?![\w-])")


def _klasse(name):
    return re.compile(r'\bclass="(?:[^"]*\s)?' + re.escape(name) + r'(?:\s[^"]*)?"')


# Auslöser im <body>. Gesucht wird nur in Tags, nicht im Fließtext.
AUSLOESER = {
    "email": _attribut("data-email-form"),
    "enquiry": _attribut("data-enquiry"),
    "animate": _attribut("data-animate"),
    "energy": _attribut("data-energy"),
    "map": _attribut("data-map"),
    "services": _klasse("services-page"),
    "start": _klasse("home-page"),
}


def ausloeser(s):
    tags = "\n".join(re.findall(r"<[a-zA-Z][^<>]*>", s[s.find("</head>"):]))
    return {name: bool(rx.search(tags)) for name, rx in AUSLOESER.items()}


def dateien(s):
    """CSS und Skripte einer Seite in bindender Reihenfolge.

    CSS: site, pages, dann refined-pages (Startseiten stattdessen home), dann
    enquiry. Die Reihenfolge trägt die Kaskade und darf sich nicht ändern.
    Skripte laufen mit defer in dieser Reihenfolge: draft vor site (site.js und
    enquiry.js benutzen window.PaniDraft), energy-model vor experience."""
    a = ausloeser(s)
    css = ["assets/site.css", "assets/pages.css", "assets/home.css" if a["start"] else "assets/refined-pages.css"]
    if a["enquiry"]:
        css.append("assets/enquiry.css")
    js = []
    if a["email"] or a["enquiry"]:
        js.append("assets/draft.js")
    js.append("assets/site.js")
    if a["energy"]:
        js.append("assets/energy-model.js")
    if a["animate"] or a["energy"]:
        js.append("assets/experience.js")
    if a["map"]:
        js.append("assets/map.js")
    if a["services"]:
        js.append("assets/services.js")
    if a["enquiry"]:
        js.append("assets/enquiry.js")
    return css, js


def themenfarbe(stand):
    try:
        farbe = json.loads(stand.text(MANIFEST))["theme_color"]
    except (ValueError, KeyError, TypeError):
        farbe = None
    if not isinstance(farbe, str) or not re.fullmatch(r"#[0-9a-fA-F]{3,8}", farbe):
        raise Fehler(f"{MANIFEST}: theme_color fehlt oder ist nicht lesbar")
    return farbe


def zeilen(stand, fn, s, farbe):
    """Die Zeilen des Kopf-Blocks. 404.html wird unter jeder Adresse
    ausgeliefert und verweist deshalb mit führendem Schrägstrich."""
    p = "/" if fn == "404.html" else ""

    def v(rel):
        try:
            return f"{p}{rel}?v={stand.version(rel)}"
        except Fehler:
            raise Fehler(f"{fn}: braucht {rel}, die Datei fehlt")

    css, js = dateien(s)
    return (
        [
            f'<meta name="theme-color" content="{farbe}">',
            f'<link rel="icon" href="{v("favicon.ico")}" sizes="32x32">',
            f'<link rel="icon" href="{v("favicon.svg")}" type="image/svg+xml">',
            f'<link rel="apple-touch-icon" href="{v("apple-touch-icon.png")}">',
            f'<link rel="manifest" href="{v(MANIFEST)}">',
            f'<link rel="preload" href="{p}{SCHRIFT}" as="font" type="font/woff2" crossorigin="">',
        ]
        + [f'<link rel="stylesheet" href="{v(rel)}">' for rel in css]
        + [f'<script src="{v(rel)}" defer></script>' for rel in js]
    )


# Verstreute Kopfzeilen, die der Block ersetzt. Fremde Adressen (https://...)
# gehören nicht dazu und bleiben stehen.
_LOKAL = r'(?![^>]*\b(?:href|src)="(?:[a-z][a-z0-9+.-]*:)?//)'
STREU = (
    re.compile(r"<link\b" + _LOKAL + r'(?=[^>]*\brel="(?:shortcut icon|icon|apple-touch-icon|manifest|stylesheet)")[^>]*>'),
    re.compile(r"<link\b" + _LOKAL + r'(?=[^>]*\brel="preload")(?=[^>]*\bas="font")[^>]*>'),
    re.compile(r'<meta\b(?=[^>]*\bname="theme-color")[^>]*>'),
    re.compile(r"<script\b" + _LOKAL + r'(?=[^>]*\bsrc=")[^>]*>\s*</script>'),
)
# Der Block steht nach den hreflang-Zeilen; fehlen sie (404.html), nach der
# letzten vorhandenen Zeile dieser Liste.
ANKER = tuple(
    re.compile(m)
    for m in (r"\bhreflang=", r'\brel="canonical"', r'\bname="robots"', r'\bname="description"', r"</title>", r'\bname="viewport"', r"\bcharset=")
)


def _streu(zeile):
    return any(rx.fullmatch(zeile.strip()) for rx in STREU)


def _pfade(zeilen_liste):
    out = set()
    for z in zeilen_liste:
        m = re.search(r'\b(?:href|src)="/?([^"?#]+)', z)
        if m:
            out.add(m.group(1))
    return out


def kopf(stand, fn, s, farbe, entfallen):
    a, e = s.find("<head>"), s.find("</head>")
    if a < 0 or e < a:
        raise Fehler(f"{fn}: <head> nicht gefunden")
    a += len("<head>")
    head = s[a:e]
    neu = zeilen(stand, fn, s, farbe)

    if START in head or ENDE in head:
        m = re.search(r"^([ \t]*)" + re.escape(START) + r".*?" + re.escape(ENDE), head, re.S | re.M)
        if not m:
            raise Fehler(f"{fn}: Kopf-Marken unvollständig oder vertauscht")
        rest = head[: m.start()] + head[m.end() :]
        for z in rest.split("\n"):
            if _streu(z):
                stand.hinweis(f"{fn}: Zeile außerhalb des Kopf-Blocks, bitte von Hand prüfen: {z.strip()}")
        block = m.group(1) + ("\n" + m.group(1)).join([START] + neu + [ENDE])
        return s[:a] + head[: m.start()] + block + head[m.end() :] + s[e:]

    # Erster Lauf: verstreute Zeilen heraus, Leerzeilen ordnen, Block einsetzen.
    alle = head.split("\n")  # [0] Rest der <head>-Zeile, [-1] Einzug vor </head>
    if len(alle) < 3:
        raise Fehler(f"{fn}: <head> ist nicht zeilenweise aufgebaut")
    alt = [z for z in alle[1:-1] if _streu(z)]
    for pfad in sorted(_pfade(alt) - _pfade(neu)):
        entfallen.setdefault(pfad, []).append(fn)
    innen = []
    for z in alle[1:-1]:
        if _streu(z) or (not z.strip() and (not innen or not innen[-1].strip())):
            continue
        innen.append(z)
    while innen and not innen[-1].strip():
        innen.pop()
    stelle, einzug = 0, "    "
    for rx in ANKER:
        treffer = [i for i, z in enumerate(innen) if rx.search(z)]
        if treffer:
            stelle = treffer[-1] + 1
            einzug = re.match(r"[ \t]*", innen[treffer[-1]]).group(0)
            break
    block = [einzug + z for z in [START] + neu + [ENDE]]
    if stelle < len(innen) and innen[stelle].strip():
        block.append("")
    innen[stelle:stelle] = block
    return s[:a] + "\n".join([alle[0]] + innen + [alle[-1]]) + s[e:]


# pfad?v=wert. Der Doppelpunkt fehlt in der Zeichenklasse mit Absicht: so
# beginnt ein Treffer in einer fremden Adresse mit // und wird übergangen.
VERWEIS = re.compile(r"(?P<pfad>[A-Za-z0-9_./-]+)\?v=(?P<alt>[0-9A-Za-z]*)")
VERWEIS_STRENG = re.compile(r"(?P<pfad>[A-Za-z0-9_./-]+)\?v=(?P<alt>[0-9A-Za-z]+)")


def versionen(stand, text, ordner, wo, muster=VERWEIS, streng=True, vorab=None):
    """Setzt jeden ?v=-Wert auf die Version der Datei, auf die er zeigt.
    Pfade gelten relativ zum Ordner der verweisenden Datei, mit führendem
    Schrägstrich relativ zum Website-Ordner."""

    def neu(m):
        pfad = m.group("pfad")
        if pfad.startswith("//"):
            return m.group(0)
        rel = posixpath.normpath(pfad[1:] if pfad.startswith("/") else posixpath.join(ordner, pfad))
        if rel.startswith("..") or not stand.gibt(rel):
            if streng:
                raise Fehler(f"{wo}: {m.group(0)} zeigt auf eine Datei, die es nicht gibt (Schreibweise buchstabengenau?)")
            stand.hinweis(f"{wo}: {m.group(0)} zeigt auf keine Datei und bleibt, wie es ist")
            return m.group(0)
        if vorab:
            vorab(rel)
        return f"{pfad}?v={stand.version(rel)}"

    return muster.sub(neu, text)


def abhaengige(stand):
    """Dateien außer den Seiten, die selbst ?v=-Verweise tragen können. Ihr
    Inhalt muss feststehen, bevor ihre eigene Version gebildet wird: heute nur
    das Manifest mit seinen zwei Icons."""
    return [MANIFEST] + sorted("assets/" + n for n in stand.namen("assets") if n.endswith((".css", ".js")))


def verweise_setzen(stand, rel, menge, fertig, unterwegs):
    """Tiefe zuerst: erst die Dateien, auf die rel verweist, dann rel selbst."""
    if rel in fertig or rel not in menge:
        return
    if rel in unterwegs:
        raise Fehler(f"{rel}: ?v=-Verweise bilden einen Kreis ({' > '.join(unterwegs + [rel])})")
    text = stand.text(rel)
    if "?v=" in text:
        unterwegs.append(rel)
        manifest = rel == MANIFEST
        stand.setze(
            rel,
            versionen(
                stand,
                text,
                posixpath.dirname(rel),
                rel,
                muster=VERWEIS if manifest else VERWEIS_STRENG,
                streng=manifest,
                vorab=lambda ziel: verweise_setzen(stand, ziel, menge, fertig, unterwegs),
            ),
        )
        unterwegs.pop()
    fertig.add(rel)


def anwenden(stand, seiten=None):
    farbe = themenfarbe(stand)
    menge, fertig = set(abhaengige(stand)), set()
    for rel in sorted(menge):
        verweise_setzen(stand, rel, menge, fertig, [])
    entfallen = {}
    for fn in seiten or stand.seiten():
        s = stand.text(fn)
        if nav.ist_weiterleitung(s):
            continue
        stand.setze(fn, versionen(stand, kopf(stand, fn, s, farbe, entfallen), "", fn))
    for pfad, wo in sorted(entfallen.items()):
        stand.hinweis(f"{pfad} entfällt im Kopf von {len(wo)} Seite(n): {' '.join(wo)}")


if __name__ == "__main__":
    sys.exit(nav.lauf([("kopf", anwenden)], __doc__))
