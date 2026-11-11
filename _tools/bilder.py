#!/usr/bin/env python3
"""Erzeugt fehlende Bildvarianten in assets/.

Rezept (damit sind die vorhandenen baubetreuung-baustelle-*.webp bytegenau
entstanden): Pillow, LANCZOS, WEBP mit quality=80 und method=6.
Das IHK-Siegel wird auf ein Fünftel verkleinert und als Paletten-PNG mit
128 Farben gespeichert.

Vorhandene Dateien werden nie überschrieben. Ein zweiter Lauf legt nichts an.

Aufruf:
  python _tools/bilder.py                 fehlende Dateien anlegen
  python _tools/bilder.py --check         nur melden, nichts schreiben
  python _tools/bilder.py --root <ordner> anderer Website-Ordner

Rückgabewert: 0, wenn alles vorhanden ist oder angelegt wurde. 1, wenn bei
--check noch Dateien fehlen. 2 bei einem Fehler (Quelle fehlt, falsche Maße).
"""
import argparse
import io
import sys
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Quelle, Zielbreiten. Der Zielname ist <stamm>-<breite>.webp.
WEBP = [
    ("sanierung-baustelle.jpg", (480, 800, 1066)),
    ("baubetreuung-baustelle.jpg", (1280,)),
]
WEBP_QUALITAET = 80
WEBP_METHODE = 6

# Quelle, Ziel, Maße, Farben. 388x191 ist genau ein Fünftel von 1940x955.
SIEGEL = ("ihk-26a-weg-siegel.png", "ihk-26a-weg-siegel-388.png", (388, 191), 128)


def webp_bytes(bild, breite):
    """Kodiert eine Variante mit der Zielbreite, Höhe im Seitenverhältnis."""
    if breite == bild.width:
        variante = bild
    else:
        hoehe = round(breite * bild.height / bild.width)
        variante = bild.resize((breite, hoehe), Image.LANCZOS)
    puffer = io.BytesIO()
    variante.save(puffer, "WEBP", quality=WEBP_QUALITAET, method=WEBP_METHODE)
    return puffer.getvalue(), variante.size


def siegel_bytes(bild, masse, farben):
    """Verkleinert das Siegel und speichert es als Paletten-PNG."""
    if bild.width * masse[1] != bild.height * masse[0]:
        raise ValueError(
            f"Seitenverhältnis passt nicht: Quelle {bild.width}x{bild.height}, "
            f"Ziel {masse[0]}x{masse[1]}"
        )
    klein = bild.convert("RGB").resize(masse, Image.LANCZOS).quantize(farben)
    puffer = io.BytesIO()
    klein.save(puffer, "PNG", optimize=True)
    return puffer.getvalue(), klein.size


def auftraege(assets):
    """Liefert je Zieldatei: (Zielpfad, Quellpfad, Funktion ohne Argumente)."""
    liste = []
    for quelle, breiten in WEBP:
        qpfad = assets / quelle
        for breite in breiten:
            ziel = assets / f"{Path(quelle).stem}-{breite}.webp"
            liste.append(
                (
                    ziel,
                    qpfad,
                    lambda q=qpfad, b=breite: webp_bytes(
                        Image.open(q).convert("RGB"), b
                    ),
                )
            )
    quelle, zielname, masse, farben = SIEGEL
    qpfad = assets / quelle
    if not qpfad.exists():
        # Das Original zieht in der Mechanik-Stufe nach _illus/quellen/ um.
        qpfad = assets.parent / "_illus" / "quellen" / quelle
    liste.append(
        (
            assets / zielname,
            qpfad,
            lambda q=qpfad: siegel_bytes(Image.open(q), masse, farben),
        )
    )
    return liste


def main():
    parser = argparse.ArgumentParser(description="Fehlende Bildvarianten erzeugen.")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Website-Ordner (Vorgabe: der Ordner über _tools)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="nichts schreiben, nur melden, was fehlt",
    )
    args = parser.parse_args()
    assets = args.root / "assets"
    if not assets.is_dir():
        print(f"FEHLER  kein assets-Ordner unter {args.root}")
        return 2

    fehlend = 0
    fehler = 0
    for ziel, quelle, erzeugen in auftraege(assets):
        name = ziel.relative_to(args.root).as_posix()
        if ziel.exists():
            with Image.open(ziel) as vorhanden:
                masse = vorhanden.size
            print(
                f"vorhanden  {name}  {masse[0]}x{masse[1]}  "
                f"{ziel.stat().st_size} Bytes (nicht überschrieben)"
            )
            continue
        if not quelle.exists():
            print(f"FEHLER     {name}: Quelle fehlt ({quelle.name})")
            fehler += 1
            continue
        try:
            daten, masse = erzeugen()
        except (OSError, ValueError) as grund:
            print(f"FEHLER     {name}: {grund}")
            fehler += 1
            continue
        groesse = f"{masse[0]}x{masse[1]}  {len(daten)} Bytes ({len(daten) / 1024:.1f} KB)"
        if args.check:
            print(f"fehlt      {name}  würde {groesse}")
            fehlend += 1
            continue
        # "xb" schlägt fehl, falls die Datei inzwischen doch existiert.
        with open(ziel, "xb") as datei:
            datei.write(daten)
        print(f"angelegt   {name}  {groesse}")

    if fehler:
        return 2
    return 1 if fehlend else 0


if __name__ == "__main__":
    sys.exit(main())
