#!/usr/bin/env python3
"""Einmal-Skript: Titel, Descriptions und og-Angaben nach Plan, Anhang J.

1. Seiten aus der Tabelle TITEL bekommen den neuen Titel in <title> und
   og:title.
2. Seiten aus der Tabelle BESCHREIBUNG bekommen den neuen Text in
   meta description und og:description.
3. Auf allen übrigen Seiten wird nur der Titeltrenner in <title> und og:title
   auf " | " vereinheitlicht. Sonst bleibt dort alles, wie es ist.

Unberührt bleiben die vier Rechtsseiten und die Weiterleitungsseiten.
Am Ende steht je Seite die Länge von Titel und Description, mit Warnung bei
einem Titel über 60 Zeichen oder einer Description außerhalb von 120 bis 160.

Das Skript ist idempotent: Ein zweiter Lauf ändert nichts.

Aufruf:
  python _tools/einmal/titel.py --check          Probelauf, schreibt nichts
  python _tools/einmal/titel.py                  setzen
  python _tools/einmal/titel.py --root <ordner>  anderer Website-Ordner

Rückgabewert: 0, wenn alles stimmt (bei --check: nichts mehr zu tun).
1, wenn --check noch Änderungen fände. 2 bei einem Fehler (Seite oder Angabe
fehlt). Längenwarnungen ändern den Rückgabewert nicht.
"""
import argparse
import html
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TRENNER = " | "
TITEL_MAX = 60
BESCHREIBUNG_MIN, BESCHREIBUNG_MAX = 120, 160

RECHTSSEITEN = ("impressum.html", "datenschutz.html", "en-imprint.html", "en-privacy.html")

TITEL = {
    "reporting.html": "Eigentümer-Reporting für Ihre Immobilie | PANI Berlin",
    "en-reporting.html": "Owner Reporting for Your Property | PANI Berlin",
    "mieterportal.html": "Mieterportal in Vorbereitung | PANI Hausverwaltung Berlin",
    "en-portal.html": "Tenant portal in preparation | PANI Property Management",
    "en-construction-support.html":
        "Construction Support for Residential Buildings | PANI Berlin",
    "en-zinshaus.html": "Zinshaus Management for Investors and Owners | PANI Berlin",
    "en-weg.html": "WEG Management for Owners' Associations | PANI Berlin",
    "en-sondereigentum.html": "Individual Apartment Management (SEV) | PANI Berlin",
}

BESCHREIBUNG = {
    "index.html":
        "Persönlich geführte Hausverwaltung in Berlin für WEGs, Miethäuser und "
        "Wohnungen: klare Abrechnungen, feste Ansprechpartner, vorausschauende "
        "Instandhaltung.",
    "en.html":
        "Personally led property management in Berlin for owners' associations, "
        "rental buildings and apartments: clear accounts, fixed contacts, "
        "proactive maintenance.",
    "leistungen.html":
        "Leistungen von PANI in Berlin: WEG, Miethaus und Sondereigentum, "
        "Zinshäuser und Investoren, Nachfolge, energetische Sanierung und "
        "Baubetreuung im Überblick.",
    "en-services.html":
        "Explore PANI services: WEG, rental building and apartment management, "
        "Zinshaus and investor support, succession, energy renovation and "
        "construction support.",
    "en-zinshaus.html":
        "Zinshaus management in Berlin for investors and long-term owners: "
        "reliable day-to-day support for tenants, clear reporting and forward "
        "maintenance planning.",
    "nachfolge.html":
        "Hausverwaltung bei Erbschaft, familiärer Übergabe oder neuer "
        "Eigentümerstruktur: Wir ordnen Unterlagen, klären Zuständigkeiten und "
        "führen die Verwaltung fort.",
    "en-succession.html":
        "Property management in Berlin after an inheritance, family handover or "
        "change in ownership: we organise documents, agree responsibilities and "
        "ensure continuity.",
    "miethaus.html":
        "Miethausverwaltung in Berlin: rechtssichere Verträge, fristgerechte "
        "Abrechnungen, zuverlässige Instandhaltung und feste Ansprechpartner für "
        "Sie und Ihre Mieter.",
    "en-miethaus.html":
        "Rental building management in Berlin: legally sound leases, accurate "
        "service-charge statements, reliable maintenance and one contact for you "
        "and your tenants.",
    "sondereigentum.html":
        "Sondereigentumsverwaltung (SEV) in Berlin für private Vermieter: "
        "Mieterbetreuung, Abrechnungen und Reparaturen, abgestimmt mit der "
        "WEG-Verwaltung Ihres Hauses.",
    "en-sondereigentum.html":
        "Apartment management (SEV) in Berlin for private landlords: tenant "
        "support, service-charge statements and repairs, coordinated with your "
        "building's WEG manager.",
    "en-weg.html":
        "PANI property management Berlin: WEG management for owners' "
        "associations. Structured meetings, legally sound resolutions and "
        "transparent accounting.",
    "reporting.html":
        "Eigentümer-Reporting der PANI Hausverwaltung Berlin: offene Vorgänge, "
        "Maßnahmen und Kosten im Zusammenhang, damit Sie den Stand kennen und "
        "entscheiden können.",
    "en-reporting.html":
        "Owner reporting from PANI property management in Berlin: open issues, "
        "works and costs in one clear context, so you know where things stand "
        "and can decide.",
    "mieterportal.html":
        "Das PANI Mieterportal ist in Vorbereitung: Anliegen melden, "
        "Bearbeitungsstand sehen, Dokumente finden. Bis dahin erreichen Sie uns "
        "über den Mieterservice.",
    "en-portal.html":
        "The PANI tenant portal is being prepared: report issues, follow their "
        "progress and find documents. Until then, our tenant service is here to "
        "help.",
    "en-tenants.html":
        "Tenant services at PANI property management Berlin: report a repair, "
        "request documents or ask about your tenancy. Write to us at "
        "info@pani-hv.de.",
}

# Fremde Trenner zwischen Titelteilen: Mittelpunkt, Aufzählungspunkt, lange Striche.
FREMDER_TRENNER_RE = re.compile(r"\s+[\u00b7\u2022\u2013\u2014]\s+")
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S)
META_RE = re.compile(r"<meta\b[^>]*>")
CONTENT_RE = re.compile(r'\bcontent="([^"]*)"')
REFRESH_RE = re.compile(r'<meta\b[^>]*http-equiv="refresh"', re.I)
NOINDEX_RE = re.compile(r'<meta\b[^>]*name="robots"[^>]*noindex', re.I)


def lies(pfad):
    with open(pfad, encoding="utf-8", newline="") as datei:
        return datei.read()


def schreibe(pfad, text):
    with open(pfad, "w", encoding="utf-8", newline="") as datei:
        datei.write(text)


def fuer_text(wert):
    """Maskiert für den Inhalt von <title>."""
    return wert.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def fuer_attribut(wert):
    """Maskiert für einen Attributwert in doppelten Anführungszeichen."""
    return fuer_text(wert).replace('"', "&quot;")


def stelle_title(kopf):
    """Bereich (a, b) des Titeltexts im Kopf, oder None."""
    treffer = TITLE_RE.search(kopf)
    return (treffer.start(1), treffer.end(1)) if treffer else None


def stelle_meta(kopf, attribut, wert):
    """Bereich (a, b) des content-Werts von <meta attribut="wert" ...>.
    None, wenn es die Angabe nicht gibt. ValueError, wenn sie doppelt ist."""
    stellen = []
    marke = re.compile(r"\b" + attribut + r'="' + re.escape(wert) + r'"')
    for meta in META_RE.finditer(kopf):
        if not marke.search(meta.group(0)):
            continue
        inhalt = CONTENT_RE.search(meta.group(0))
        if inhalt:
            stellen.append((meta.start() + inhalt.start(1), meta.start() + inhalt.end(1)))
    if len(stellen) > 1:
        raise ValueError(f'{attribut}="{wert}" kommt {len(stellen)}-mal vor')
    return stellen[0] if stellen else None


def bearbeite(name, text):
    """Liefert (neuer Text, Liste der Änderungen als Klartext)."""
    ende = text.find("</head>")
    if ende < 0:
        raise ValueError("kein </head> gefunden")
    kopf = text[:ende]
    stellen = {
        "title": stelle_title(kopf),
        "og:title": stelle_meta(kopf, "property", "og:title"),
        "description": stelle_meta(kopf, "name", "description"),
        "og:description": stelle_meta(kopf, "property", "og:description"),
    }
    if stellen["title"] is None:
        raise ValueError("kein <title> gefunden")
    soll = {}
    if name in TITEL:
        for feld in ("title", "og:title"):
            if stellen[feld] is None:
                raise ValueError(f"{feld} fehlt, steht aber in der Tabelle")
        soll["title"] = fuer_text(TITEL[name])
        soll["og:title"] = fuer_attribut(TITEL[name])
    else:
        for feld in ("title", "og:title"):
            if stellen[feld] is not None:
                a, b = stellen[feld]
                soll[feld] = FREMDER_TRENNER_RE.sub(TRENNER, kopf[a:b])
    if name in BESCHREIBUNG:
        for feld in ("description", "og:description"):
            if stellen[feld] is None:
                raise ValueError(f"{feld} fehlt, steht aber in der Tabelle")
            soll[feld] = fuer_attribut(BESCHREIBUNG[name])
    aenderungen = []
    schritte = []
    for feld, neu in soll.items():
        a, b = stellen[feld]
        if kopf[a:b] != neu:
            schritte.append((a, b, neu))
            aenderungen.append(f'{feld}: "{kopf[a:b]}" -> "{neu}"')
    for a, b, neu in sorted(schritte, reverse=True):
        text = text[:a] + neu + text[b:]
    return text, aenderungen


def laengen(text):
    """Liefert (Titel, og:title, Description, og:description) als Klartext oder None."""
    ende = text.find("</head>")
    kopf = text[:ende] if ende >= 0 else text
    werte = []
    for stelle in (
        stelle_title(kopf),
        stelle_meta(kopf, "property", "og:title"),
        stelle_meta(kopf, "name", "description"),
        stelle_meta(kopf, "property", "og:description"),
    ):
        werte.append(None if stelle is None else html.unescape(kopf[stelle[0]:stelle[1]]).strip())
    return werte


def main():
    parser = argparse.ArgumentParser(description="Titel und Descriptions nach Anhang J setzen.")
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parent.parent.parent,
        help="Website-Ordner (Vorgabe: der Ordner über _tools)",
    )
    parser.add_argument("--check", action="store_true", help="Probelauf, schreibt nichts")
    args = parser.parse_args()
    root = args.root

    seiten = sorted(p.name for p in root.glob("*.html"))
    fehler = 0
    geaendert = 0
    stand = {}  # Name: (Text nach der Bearbeitung, Art)
    print("Probelauf, es wird nichts geschrieben." if args.check else "Titel und Descriptions:")

    for name in sorted(set(TITEL) | set(BESCHREIBUNG)):
        if name not in seiten:
            print(f"FEHLER   {name}: steht in der Tabelle, Datei fehlt")
            fehler += 1

    for name in seiten:
        text = lies(root / name)
        if name in RECHTSSEITEN:
            stand[name] = (text, "Rechtsseite")
            continue
        if REFRESH_RE.search(text):
            stand[name] = (text, "Weiterleitung")
            if name in TITEL or name in BESCHREIBUNG:
                print(f"FEHLER   {name}: steht in der Tabelle, ist aber eine Weiterleitungsseite")
                fehler += 1
            continue
        try:
            neu, aenderungen = bearbeite(name, text)
        except ValueError as grund:
            print(f"FEHLER   {name}: {grund}, nicht angefasst")
            fehler += 1
            stand[name] = (text, "Fehler")
            continue
        stand[name] = (neu, "")
        if aenderungen:
            geaendert += 1
            print(f"{'offen   ' if args.check else 'geändert'} {name}")
            for zeile in aenderungen:
                print(f"           {zeile}")
            if not args.check:
                schreibe(root / name, neu)

    print()
    print("Längen" + (" nach der Änderung" if args.check else "") + " (Titel höchstens "
          f"{TITEL_MAX}, Description {BESCHREIBUNG_MIN} bis {BESCHREIBUNG_MAX}):")
    warnungen = 0
    for name in seiten:
        text, art = stand[name]
        try:
            titel, og_titel, beschreibung, og_beschreibung = laengen(text)
        except ValueError as grund:
            print(f"  {name:32} nicht lesbar: {grund}")
            continue
        t = f"T {len(titel):3}" if titel is not None else "T   -"
        d = f"D {len(beschreibung):3}" if beschreibung is not None else "D   -"
        if art in ("Rechtsseite", "Weiterleitung"):
            print(f"  {name:32} {t}  {d}  ({art}, unberührt, nicht bewertet)")
            continue
        hinweise = []
        noindex = bool(NOINDEX_RE.search(text))
        if titel is not None and len(titel) > TITEL_MAX:
            hinweise.append(f"WARNUNG Titel über {TITEL_MAX}")
        if titel is not None and FREMDER_TRENNER_RE.search(titel):
            hinweise.append("WARNUNG fremder Titeltrenner")
        if beschreibung is None:
            hinweise.append("ohne Description" + (" (noindex)" if noindex else ", WARNUNG"))
        elif not BESCHREIBUNG_MIN <= len(beschreibung) <= BESCHREIBUNG_MAX:
            hinweise.append(
                f"WARNUNG Description außerhalb {BESCHREIBUNG_MIN} bis {BESCHREIBUNG_MAX}"
            )
        if og_titel is not None and og_titel != titel:
            hinweise.append("WARNUNG og:title weicht vom Titel ab")
        if og_beschreibung is not None and og_beschreibung != beschreibung:
            hinweise.append("WARNUNG og:description weicht von der Description ab")
        warnungen += sum(1 for h in hinweise if "WARNUNG" in h)
        print(f"  {name:32} {t}  {d}  {'; '.join(hinweise)}".rstrip())

    print()
    print(
        f"Summe: {geaendert} Seiten " + ("zu ändern" if args.check else "geändert")
        + f", {warnungen} Warnungen, {fehler} Fehler."
    )
    if fehler:
        return 2
    if args.check and geaendert:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
