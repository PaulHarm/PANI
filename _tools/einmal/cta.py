#!/usr/bin/env python3
"""Einmal-Skript: stellt die Anfrage-Knöpfe im Inhalt auf den Fragebogen um.

Jeder Knopf im <main> der Seiten aus der Tabelle SEITEN bekommt das Ziel
anfrage.html (EN: en-enquiry.html) mit der passenden Vorauswahl ?type=... und
den Text "Betreuung anfragen" (EN: "Request management"). Klassen, Icons und
alles andere am Knopf bleiben, wie sie sind.

Als Knopf zählt ein <a> im <main> mit der Klasse button oder text-link, das
entweder noch auf den alten Kontaktblock zeigt (index.html...#kontakt,
en.html...#kontakt) oder schon auf den Fragebogen. Je Datei muss die Zahl
dieser Knöpfe zur Tabelle passen, sonst bleibt die Datei unberührt.

Nicht angefasst werden: Header-Knopf "Kontakt", Mobilmenü und Menükarte (sie
stehen außerhalb von <main>), die Auswahl-Knöpfe der Startseiten, 404.html,
hausverwaltung-verkaufen.html, mieterportal.html und ihre EN-Spiegel. Die vier
früheren Kurzseiten sind Weiterleitungsseiten ohne Knöpfe.

Das Skript ist idempotent: Ein zweiter Lauf ändert nichts.

Aufruf:
  python _tools/einmal/cta.py --check          Probelauf, schreibt nichts
  python _tools/einmal/cta.py                  umstellen
  python _tools/einmal/cta.py --root <ordner>  anderer Website-Ordner

Rückgabewert: 0, wenn alles stimmt (bei --check: nichts mehr zu tun).
1, wenn --check noch Änderungen fände. 2, wenn eine Datei nicht zur Tabelle
passt; die übrigen Dateien werden trotzdem bearbeitet.
"""
import argparse
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ZIEL = {"de": "anfrage.html", "en": "en-enquiry.html"}
TEXT = {"de": "Betreuung anfragen", "en": "Request management"}
ERLAUBTE_TYPEN = {
    "weg", "miethaus", "wohnung", "zinshaus",
    "sanierung", "baubetreuung", "reporting", "wechsel",
}

# Datei: (Sprache, Vorauswahl oder None, Zahl der Knöpfe im <main>)
SEITEN = {
    "weg.html": ("de", "weg", 2),
    "en-weg.html": ("en", "weg", 2),
    "miethaus.html": ("de", "miethaus", 2),
    "en-miethaus.html": ("en", "miethaus", 2),
    "sondereigentum.html": ("de", "wohnung", 2),
    "en-sondereigentum.html": ("en", "wohnung", 2),
    # Kopf und Abschluss, setzt Agent B bei der Bündelung schon richtig.
    "zinshaus.html": ("de", "zinshaus", 2),
    "en-zinshaus.html": ("en", "zinshaus", 2),
    "nachfolge.html": ("de", None, 2),
    "en-succession.html": ("en", None, 2),
    "baubetreuung.html": ("de", "baubetreuung", 2),
    "en-construction-support.html": ("en", "baubetreuung", 2),
    "sanierung.html": ("de", "sanierung", 2),
    "en-renovation.html": ("en", "sanierung", 2),
    "reporting.html": ("de", "reporting", 2),
    "en-reporting.html": ("en", "reporting", 2),
    "wechsel.html": ("de", "wechsel", 1),
    "en-switch.html": ("en", "wechsel", 1),
    "ueber-uns.html": ("de", None, 1),
    "en-about.html": ("en", None, 1),
    # Neuer Abschluss der Leistungsübersicht, setzt Agent C schon richtig.
    "leistungen.html": ("de", None, 1),
    "en-services.html": ("en", None, 1),
}

# Seit der Zinshaus-Bündelung nur noch Weiterleitungen, ohne Knöpfe.
WEITERLEITUNGEN = (
    "investoren.html",
    "bestandshalter.html",
    "en-investors.html",
    "en-portfolio-holders.html",
)

# Bewusst unverändert, trotz Verweisen auf Kontaktblock oder Fragebogen.
UNVERAENDERT = (
    "index.html",
    "en.html",
    "404.html",
    "hausverwaltung-verkaufen.html",
    "en-sell-your-company.html",
    "mieterportal.html",
    "en-portal.html",
)

# Die Knopftexte vor der Umstellung. Ein anderer Alttext wird trotzdem
# umgestellt, aber in der Ausgabe markiert.
BEKANNTE_ALTTEXTE = {
    "Erstgespräch anfragen", "Kontakt aufnehmen", "Baubetreuung besprechen",
    "Sanierungspotenzial prüfen", "Sanierung besprechen", "Reporting besprechen",
    "Request a consultation", "Get in touch", "Discuss construction support",
    "Discuss renovation potential", "Discuss renovation", "Discuss reporting",
}

MAIN_AUF_RE = re.compile(r"<main\b[^>]*>")
ANKER_RE = re.compile(r"<a\b(?P<attr>[^>]*)>(?P<text>[^<]*)")
HREF_RE = re.compile(r'\bhref="([^"]*)"')
KLASSE_RE = re.compile(r'\bclass="([^"]*)"')
ALT_RE = re.compile(r"^/?(?:index|en)\.html(?:\?[^#]*)?#kontakt$")
NEU_RE = re.compile(r"^/?(?:anfrage|en-enquiry)\.html(?:\?[^#]*)?$")
REFRESH_RE = re.compile(r'<meta\b[^>]*http-equiv="refresh"', re.I)
KNOPF_KLASSEN = {"button", "text-link"}


def lies(pfad):
    with open(pfad, encoding="utf-8", newline="") as datei:
        return datei.read()


def schreibe(pfad, text):
    with open(pfad, "w", encoding="utf-8", newline="") as datei:
        datei.write(text)


def main_bereich(text):
    """Anfang und Ende des Inhalts von <main>, oder None."""
    auf = MAIN_AUF_RE.search(text)
    zu = text.rfind("</main>")
    if not auf or zu < auf.end():
        return None
    return auf.end(), zu


def knoepfe(text):
    """Alle Anfrage-Knöpfe im <main>: Liste von Wörterbüchern."""
    bereich = main_bereich(text)
    if bereich is None:
        return None
    gefunden = []
    for anker in ANKER_RE.finditer(text, bereich[0], bereich[1]):
        attr = anker.group("attr")
        href = HREF_RE.search(attr)
        klasse = KLASSE_RE.search(attr)
        if not href or not klasse:
            continue
        if not KNOPF_KLASSEN & set(klasse.group(1).split()):
            continue
        if not (ALT_RE.match(href.group(1)) or NEU_RE.match(href.group(1))):
            continue
        gefunden.append({
            "zeile": text.count("\n", 0, anker.start()) + 1,
            "href": href.group(1),
            "href_a": anker.start("attr") + href.start(1),
            "href_b": anker.start("attr") + href.end(1),
            "text": anker.group("text"),
            "text_a": anker.start("text"),
            "text_b": anker.end("text"),
        })
    return gefunden


def stelle_um(text, sprache, typ):
    """Liefert (neuer Text, Liste der Änderungen, Liste der Knöpfe)."""
    ziel = ZIEL[sprache] + (f"?type={typ}" if typ else "")
    beschriftung = TEXT[sprache]
    liste = knoepfe(text)
    aenderungen = []
    for knopf in sorted(liste, key=lambda k: k["href_a"], reverse=True):
        alt_text = knopf["text"].strip()
        if not alt_text:
            raise ValueError(
                f"Zeile {knopf['zeile']}: Knopf ohne direkten Text, bitte von Hand prüfen"
            )
        if knopf["href"] == ziel and alt_text == beschriftung:
            continue
        roh = knopf["text"]
        vorn = roh[: len(roh) - len(roh.lstrip())]
        hinten = roh[len(roh.rstrip()):]
        # Der Text steht hinter dem href, also zuerst den Text ersetzen.
        text = text[: knopf["text_a"]] + vorn + beschriftung + hinten + text[knopf["text_b"]:]
        text = text[: knopf["href_a"]] + ziel + text[knopf["href_b"]:]
        aenderungen.append((knopf["zeile"], knopf["href"], alt_text, ziel, beschriftung))
    aenderungen.reverse()
    return text, aenderungen, liste


def main():
    parser = argparse.ArgumentParser(description="Anfrage-Knöpfe auf den Fragebogen umstellen.")
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parent.parent.parent,
        help="Website-Ordner (Vorgabe: der Ordner über _tools)",
    )
    parser.add_argument("--check", action="store_true", help="Probelauf, schreibt nichts")
    args = parser.parse_args()
    root = args.root
    assert all(typ is None or typ in ERLAUBTE_TYPEN for _, typ, _ in SEITEN.values())

    ersetzt = 0
    geaenderte_dateien = 0
    schon_richtig = 0
    probleme = 0
    print("Probelauf, es wird nichts geschrieben." if args.check else "Umstellung:")

    for name, (sprache, typ, soll) in SEITEN.items():
        pfad = root / name
        if not pfad.is_file():
            print(f"FEHLER   {name}: Datei fehlt")
            probleme += 1
            continue
        text = lies(pfad)
        liste = knoepfe(text)
        if liste is None:
            print(f"FEHLER   {name}: kein <main> gefunden, nicht angefasst")
            probleme += 1
            continue
        if len(liste) != soll:
            print(
                f"FEHLER   {name}: {len(liste)} statt {soll} Anfrage-Knöpfe im <main>, "
                "nicht angefasst"
            )
            for knopf in liste:
                gefunden = knopf["text"].strip()
                print(f"           Z. {knopf['zeile']}: {knopf['href']}  \"{gefunden}\"")
            if not liste and name in ("leistungen.html", "en-services.html"):
                print("           (der Abschluss-Knopf der Leistungsübersicht fehlt noch)")
            probleme += 1
            continue
        try:
            neu, aenderungen, _ = stelle_um(text, sprache, typ)
        except ValueError as grund:
            print(f"FEHLER   {name}: {grund}")
            probleme += 1
            continue
        # Gegenprobe am Ergebnis: alle Knöpfe im Zielzustand, Zahl unverändert.
        ziel = ZIEL[sprache] + (f"?type={typ}" if typ else "")
        danach = knoepfe(neu)
        if len(danach) != soll or any(
            k["href"] != ziel or k["text"].strip() != TEXT[sprache] for k in danach
        ):
            print(f"FEHLER   {name}: Gegenprobe gescheitert, nicht angefasst")
            probleme += 1
            continue
        if not aenderungen:
            print(f"richtig  {name}: {soll} von {soll} schon im Zielzustand")
            schon_richtig += soll
            continue
        schon_richtig += soll - len(aenderungen)
        ersetzt += len(aenderungen)
        geaenderte_dateien += 1
        wort = "würde umstellen" if args.check else "umgestellt"
        status = "offen   " if args.check else "geändert"
        print(f"{status} {name}: {len(aenderungen)} von {soll} {wort}")
        for zeile, alt_href, alt_text, neu_href, neu_text in aenderungen:
            vertraut = alt_text in BEKANNTE_ALTTEXTE or alt_text == neu_text
            marke = "" if vertraut else "  (unbekannter Alttext)"
            print(
                f"           Z. {zeile}: {alt_href} \"{alt_text}\" -> "
                f"{neu_href} \"{neu_text}\"{marke}"
            )
        if not args.check:
            schreibe(pfad, neu)

    for name in WEITERLEITUNGEN:
        pfad = root / name
        if not pfad.is_file():
            print(f"FEHLER   {name}: Datei fehlt (erwartet als Weiterleitungsseite)")
            probleme += 1
            continue
        text = lies(pfad)
        liste = knoepfe(text) or []
        if REFRESH_RE.search(text) and not liste:
            print(f"richtig  {name}: Weiterleitungsseite ohne Knöpfe")
        elif REFRESH_RE.search(text):
            print(f"FEHLER   {name}: Weiterleitungsseite mit {len(liste)} Anfrage-Knöpfen")
            probleme += 1
        else:
            print(
                f"HINWEIS  {name}: noch keine Weiterleitungsseite (Zinshaus-Bündelung fehlt), "
                f"{len(liste)} Anfrage-Knöpfe, nicht angefasst"
            )
            probleme += 1

    # Restprüfung: Steht außerhalb der Tabelle noch ein alter Kontakt-Knopf im Inhalt?
    bekannt = set(SEITEN) | set(WEITERLEITUNGEN) | set(UNVERAENDERT)
    for pfad in sorted(root.glob("*.html")):
        if pfad.name in bekannt:
            continue
        liste = knoepfe(lies(pfad)) or []
        alte = [k for k in liste if ALT_RE.match(k["href"])]
        if alte:
            print(
                f"HINWEIS  {pfad.name}: steht nicht in der Tabelle, hat aber {len(alte)} "
                "Knöpfe zum alten Kontaktblock im Inhalt"
            )
            probleme += 1

    gesamt = sum(soll for _, _, soll in SEITEN.values())
    print(
        f"Summe: {ersetzt} Ersetzungen in {geaenderte_dateien} Dateien"
        + (" offen" if args.check else "")
        + f", {schon_richtig} Knöpfe schon richtig, zusammen {ersetzt + schon_richtig} "
        f"von {gesamt} Knöpfen der Tabelle, {probleme} Probleme."
    )
    print(f"Bewusst unverändert: {', '.join(UNVERAENDERT)}.")
    if probleme:
        return 2
    if args.check and ersetzt:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
