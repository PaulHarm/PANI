#!/usr/bin/env python3
"""Vergleicht die Aufnahmen aus shots.cjs: je Seite und Breite Basis gegen neu.

Erwartet <ordner>/basis/<seite>-<breite>.png und <ordner>/neu/<seite>-<breite>.png.
Je Paar steht eines von drei Ergebnissen:
  identisch        kein Pixel weicht ab
  Abweichung       Rechteck, in dem alle Abweichungen liegen, und Pixelanteil
  Höhenänderung    die Seite ist länger oder kürzer geworden; dazu die erste
                   abweichende Zeile und der Anteil im gemeinsamen Bereich

Differenzbilder entstehen nur bei Abweichung, in <ordner>/diff/: die neue
Aufnahme aufgehellt, abweichende Pixel rot, das Rechteck umrandet. Die
Zusammenfassung steht zusätzlich in <ordner>/zusammenfassung.txt.

Aufruf:
  python _tools/shotdiff.py <ordner>
  python _tools/shotdiff.py <ordner> --toleranz 2    kleine Farbabweichungen dulden
  python _tools/shotdiff.py <ordner> --root <ordner> anderer Website-Ordner

--root dient nur der Gegenprobe, ob für jede Seite (ohne Weiterleitungsseiten)
Aufnahmen vorliegen.

Rückgabewert: 0, wenn alles identisch ist. 1 bei Abweichungen oder fehlenden
Gegenstücken. 2 bei einem Fehler.
"""
import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

NAME_RE = re.compile(r"^(?P<seite>.+)-(?P<breite>\d+)\.png$")
WEITERLEITUNG_RE = re.compile(r'<meta\b[^>]*http-equiv="refresh"', re.I)
ROT = (214, 0, 64)
RAND = (0, 90, 200)
ZUSATZ = (255, 214, 102)


def aufnahmen(ordner):
    """Liefert {(Seite, Breite): Pfad} für alle passend benannten PNG."""
    gefunden = {}
    if ordner.is_dir():
        for pfad in sorted(ordner.glob("*.png")):
            treffer = NAME_RE.match(pfad.name)
            if treffer:
                gefunden[(treffer.group("seite"), int(treffer.group("breite")))] = pfad
    return gefunden


def maske(a, b, toleranz):
    """Schwarzweißbild: weiß, wo sich a und b um mehr als die Toleranz unterscheiden."""
    rot, gruen, blau = ImageChops.difference(a, b).split()
    staerkste = ImageChops.lighter(ImageChops.lighter(rot, gruen), blau)
    return staerkste.point(lambda wert: 255 if wert > toleranz else 0)


def differenzbild(neu, abweichung, rechteck, basis_hoehe):
    """Neue Aufnahme aufgehellt, Abweichungen rot, Rechteck umrandet."""
    bild = Image.blend(neu, Image.new("RGB", neu.size, (255, 255, 255)), 0.65)
    volle = Image.new("L", neu.size, 0)
    volle.paste(abweichung, (0, 0))
    bild.paste(Image.new("RGB", neu.size, ROT), (0, 0), volle)
    stift = ImageDraw.Draw(bild)
    if basis_hoehe < neu.height:
        # Bereich, den es in der Basis nicht gab
        stift.rectangle(
            [0, basis_hoehe, neu.width - 1, neu.height - 1], outline=ZUSATZ, width=6
        )
    if rechteck:
        x0, y0, x1, y1 = rechteck
        stift.rectangle([x0, y0, x1 - 1, y1 - 1], outline=RAND, width=2)
    return bild


def prozent(anteil):
    text = f"{anteil * 100:.3f}".replace(".", ",")
    return text + " %"


def vergleiche(pfad_basis, pfad_neu, pfad_diff, toleranz):
    """Liefert (Art, Beschreibung). Schreibt das Differenzbild nur bei Abweichung."""
    with Image.open(pfad_basis) as roh_a, Image.open(pfad_neu) as roh_b:
        a, b = roh_a.convert("RGB"), roh_b.convert("RGB")
    if a.width != b.width:
        pfad_diff.unlink(missing_ok=True)
        return "breite", f"Breite verschieden: {a.width} gegen {b.width} Pixel, nicht verglichen"
    hoehe = min(a.height, b.height)
    gleich_hoch = a.height == b.height
    if not gleich_hoch:
        a_teil, b_teil = a.crop((0, 0, a.width, hoehe)), b.crop((0, 0, b.width, hoehe))
    else:
        a_teil, b_teil = a, b
    abweichung = maske(a_teil, b_teil, toleranz)
    rechteck = abweichung.getbbox()
    if rechteck is None and gleich_hoch:
        pfad_diff.unlink(missing_ok=True)
        return "identisch", "identisch"
    anzahl = abweichung.histogram()[255]
    anteil = anzahl / (a.width * hoehe)
    pfad_diff.parent.mkdir(parents=True, exist_ok=True)
    differenzbild(b, abweichung, rechteck, a.height).save(pfad_diff, "PNG", optimize=True)
    if gleich_hoch:
        x0, y0, x1, y1 = rechteck
        return "abweichung", (
            f"Abweichung im Rechteck x {x0} bis {x1 - 1}, y {y0} bis {y1 - 1} "
            f"({x1 - x0} x {y1 - y0} Pixel), {prozent(anteil)} der Pixel ({anzahl})"
        )
    unterschied = b.height - a.height
    text = f"Höhenänderung {a.height} -> {b.height} Pixel ({unterschied:+d})"
    if rechteck is None:
        return "hoehe", text + ", gemeinsamer Bereich identisch"
    return "hoehe", text + (
        f", erste Abweichung bei y {rechteck[1]}, "
        f"im gemeinsamen Bereich {prozent(anteil)} der Pixel"
    )


def erwartete_seiten(root):
    """Seitennamen ohne .html, ohne Weiterleitungsseiten. Leer, wenn root nicht passt."""
    namen = set()
    for pfad in root.glob("*.html"):
        try:
            text = pfad.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if not WEITERLEITUNG_RE.search(text):
            namen.add(pfad.stem)
    return namen


def main():
    parser = argparse.ArgumentParser(
        description="Aufnahmen von Basis und Arbeitsstand vergleichen."
    )
    parser.add_argument("ordner", type=Path, help="Ausgabeordner von shots.cjs")
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parent.parent,
        help="Website-Ordner für die Gegenprobe der Seitenliste (Vorgabe: der Ordner über _tools)",
    )
    parser.add_argument(
        "--basis", type=Path, help="Ordner der Basis-Aufnahmen (Vorgabe: <ordner>/basis)"
    )
    parser.add_argument(
        "--neu", type=Path, help="Ordner der neuen Aufnahmen (Vorgabe: <ordner>/neu)"
    )
    parser.add_argument(
        "--toleranz", type=int, default=0,
        help="Farbabstand je Kanal (0 bis 255), bis zu dem Pixel als gleich gelten (Vorgabe 0)",
    )
    args = parser.parse_args()
    ordner_basis = args.basis or args.ordner / "basis"
    ordner_neu = args.neu or args.ordner / "neu"
    ordner_diff = args.ordner / "diff"
    for ordner in (ordner_basis, ordner_neu):
        if not ordner.is_dir():
            print(f"FEHLER  Ordner fehlt: {ordner}")
            return 2
    basis, neu = aufnahmen(ordner_basis), aufnahmen(ordner_neu)
    if not basis and not neu:
        print(f"FEHLER  keine Aufnahmen in {ordner_basis} und {ordner_neu}")
        return 2

    ergebnisse = {"identisch": [], "abweichung": [], "hoehe": [], "breite": [], "fehlt": []}
    for schluessel in sorted(set(basis) | set(neu)):
        seite, breite = schluessel
        name = f"{seite}-{breite}"
        if schluessel not in basis or schluessel not in neu:
            wo = "basis" if schluessel not in basis else "neu"
            ergebnisse["fehlt"].append((name, f"Aufnahme fehlt in {wo}"))
            continue
        try:
            art, text = vergleiche(
                basis[schluessel], neu[schluessel], ordner_diff / f"{name}.png", args.toleranz
            )
        except OSError as grund:
            print(f"FEHLER  {name}: {grund}")
            return 2
        ergebnisse[art].append((name, text))

    breiten = sorted({b for _, b in set(basis) | set(neu)})
    vorhanden = {s for s, _ in set(basis) | set(neu)}
    ohne_aufnahme = sorted(erwartete_seiten(args.root) - vorhanden)

    zeilen = [
        f"Pixelvergleich: {ordner_basis} gegen {ordner_neu}",
        f"Breiten {', '.join(str(b) for b in breiten)}, Toleranz {args.toleranz}",
        (
            f"{len(ergebnisse['identisch'])} identisch, "
            f"{len(ergebnisse['abweichung'])} Abweichungen, "
            f"{len(ergebnisse['hoehe'])} Höhenänderungen, "
            f"{len(ergebnisse['breite'])} mit verschiedener Breite, "
            f"{len(ergebnisse['fehlt'])} ohne Gegenstück"
        ),
        "",
    ]
    titel = {
        "hoehe": "Höhenänderungen",
        "abweichung": "Abweichungen bei gleicher Höhe",
        "breite": "Verschiedene Breite",
        "fehlt": "Ohne Gegenstück",
        "identisch": "Identisch",
    }
    for art in ("hoehe", "abweichung", "breite", "fehlt", "identisch"):
        if not ergebnisse[art]:
            continue
        zeilen.append(titel[art] + ":")
        if art == "identisch":
            zeilen.append("  " + ", ".join(name for name, _ in ergebnisse[art]))
        else:
            for name, text in ergebnisse[art]:
                zeilen.append(f"  {name:36} {text}")
        zeilen.append("")
    if ohne_aufnahme:
        zeilen.append("Seiten ganz ohne Aufnahme: " + ", ".join(ohne_aufnahme))
        zeilen.append("")
    if ergebnisse["abweichung"] or ergebnisse["hoehe"]:
        zeilen.append(f"Differenzbilder: {ordner_diff}")
    bericht = args.ordner / "zusammenfassung.txt"
    with open(bericht, "w", encoding="utf-8", newline="\n") as datei:
        datei.write("\n".join(zeilen).rstrip("\n") + "\n")
    print("\n".join(zeilen).rstrip("\n"))
    print(f"Zusammenfassung: {bericht}")

    auffaellig = sum(len(ergebnisse[art]) for art in ("abweichung", "hoehe", "breite", "fehlt"))
    return 1 if auffaellig else 0


if __name__ == "__main__":
    sys.exit(main())
