"""Sammelaufruf: Menü, Kopf-Block und SEO-Daten in einem Lauf.

Ruft nacheinander nav, kopf und seo auf (die Reihenfolge ist bindend: nav
schreibt assets/nav-house.svg, kopf bildet daraus und aus allen anderen
Dateien die Versionen, seo liest das Ergebnis). Gerechnet wird im Speicher,
geschrieben erst am Ende und nur, wenn kein Schritt einen Fehler meldet.
Der Lauf ist idempotent: Ein zweiter Lauf ändert nichts.

Aufruf:  python _tools/build.py            alles erzeugen
         python _tools/build.py --check    nichts schreiben; Fehlercode 1,
                                           wenn sich etwas ändern würde
         python _tools/build.py --diff     Änderungen zusätzlich als Diff
         python _tools/build.py --root ORDNER
                                           anderer Website-Ordner (Vorgabe:
                                           der Ordner über _tools)
"""
import sys

sys.dont_write_bytecode = True

import kopf
import nav
import seo

SCHRITTE = [("nav", nav.anwenden), ("kopf", kopf.anwenden), ("seo", seo.anwenden)]

if __name__ == "__main__":
    sys.exit(nav.lauf(SCHRITTE, __doc__, sammelname="build"))
