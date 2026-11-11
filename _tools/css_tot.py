#!/usr/bin/env python3
"""Findet CSS-Regeln, die auf kein Element der Website passen können.

Als benutzt gilt jede Klasse und jede ID aus
  - allen *.html im Website-Ordner (class- und id-Attribute),
  - allen Dateien in _illus/ (auch die Werte der JSON-Dateien),
  - den Erzeuger-Skripten _tools/*.py (Menü und Kopf entstehen erst dort),
  - ALLEN bezeichnerartigen Wörtern der JS-Dateien in assets/ und der
    eingebetteten Skripte, nachdem die Kommentare entfernt sind. Nur
    Zeichenketten zu lesen würde dynamisch gesetzte Klassen wie is-open
    übersehen, und ohne Kommentar-Entfernung hält ein Wort im Kommentar eine
    tote Klasse am Leben.

Ein Selektor ist tot, wenn er außerhalb von :not() eine Klasse oder ID
verlangt, die nirgends vorkommt. Gemeldet werden
  1. ganz tote Regeln (alle Selektoren tot),
  2. teilweise tote Selektorlisten (nur das tote Mitglied fällt weg),
  3. leere @media- und @supports-Blöcke (leer oder nach dem Löschen leer).
@keyframes, @font-face und alle anderen @-Regeln bleiben unberührt, ebenso
Kommentare außerhalb gelöschter Regeln. Geprüft werden nur CSS-Dateien, die
mindestens eine Seite einbindet.

Aufruf:
  python _tools/css_tot.py                  nur melden (Probelauf)
  python _tools/css_tot.py --liste          jeden Treffer mit Zeile ausgeben
  python _tools/css_tot.py --apply          löschen, von hinten nach vorn
  python _tools/css_tot.py --keep a,b-*     Klassen oder IDs schützen
  python _tools/css_tot.py --root <ordner>  anderer Website-Ordner

Rückgabewert: 0 ohne Treffer (auch nach erfolgreichem --apply), 1 mit
Treffern im Probelauf, 2 bei einem Fehler.
"""
import argparse
import fnmatch
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# @-Regeln, deren Inhalt wieder aus Regeln besteht.
ABSTEIGEN = {"@media", "@supports", "@layer", "@container"}
# Funktions-Pseudoklassen mit Selektorliste: tot nur, wenn alle Mitglieder tot sind.
LISTEN_PSEUDO = {
    "is", "where", "has", "matches", "any", "-webkit-any", "-moz-any",
    "host", "host-context", "slotted",
}
NAME = r"-?[_a-zA-Z][_a-zA-Z0-9-]*"
NAME_RE = re.compile(NAME)
PSEUDO_RE = re.compile(r"::?(" + NAME + r")\(")
ATTRIBUT_RE = re.compile(r"""\b(class|id)\s*=\s*(?:"([^"]*)"|'([^']*)')""", re.I)
SKRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
CSS_LINK_RE = re.compile(r"""<link\b[^>]*\bhref\s*=\s*["']/?([^"'?#]+\.css)""", re.I)

# Nach diesen Zeichen oder Wörtern beginnt mit / ein regulärer Ausdruck.
VOR_REGEX = set("(,=:[!&|?{};+-*%<>~^")
REGEX_WORTE = {
    "return", "typeof", "case", "in", "of", "do", "else", "void", "delete",
    "throw", "new", "yield", "await",
}
WORT_AM_ENDE_RE = re.compile(r"[A-Za-z_$][\w$]*$")


def lies(pfad):
    with open(pfad, encoding="utf-8", newline="") as datei:
        return datei.read()


# ---------------------------------------------------------------- benutzt

def aus_attributen(text, klassen, ids):
    for treffer in ATTRIBUT_RE.finditer(text):
        wert = treffer.group(2) if treffer.group(2) is not None else treffer.group(3)
        if treffer.group(1).lower() == "class":
            klassen.update(wert.split())
        else:
            ids.update(wert.split())


def regex_moeglich(aus):
    """Darf an dieser Stelle ein regulärer Ausdruck stehen (statt einer Division)?"""
    ende = "".join(aus[-40:]).rstrip()
    if not ende:
        return True
    wort = WORT_AM_ENDE_RE.search(ende)
    if wort:
        return wort.group(0) in REGEX_WORTE
    return ende[-1] in VOR_REGEX


def js_ohne_kommentare(quelle):
    """Entfernt // und /* */ aus JavaScript, ohne Zeichenketten, Vorlagen
    oder reguläre Ausdrücke anzutasten."""
    aus = []
    modi = [["code", 0]]  # Stapel: Code (mit Klammertiefe) oder Vorlage
    i, n = 0, len(quelle)
    while i < n:
        z = quelle[i]
        if modi[-1][0] == "vorlage":
            if z == "\\":
                aus.append(quelle[i:i + 2])
                i += 2
            elif z == "`":
                aus.append(z)
                modi.pop()
                i += 1
            elif quelle.startswith("${", i):
                aus.append("${")
                modi.append(["code", 0])
                i += 2
            else:
                aus.append(z)
                i += 1
            continue
        if quelle.startswith("//", i):
            ende = quelle.find("\n", i)
            i = n if ende < 0 else ende
            continue
        if quelle.startswith("/*", i):
            ende = quelle.find("*/", i + 2)
            i = n if ende < 0 else ende + 2
            aus.append(" ")
            continue
        if z in "\"'":
            j = i + 1
            while j < n and quelle[j] != z and quelle[j] != "\n":
                j += 2 if quelle[j] == "\\" else 1
            aus.append(quelle[i:j + 1])
            i = j + 1
            continue
        if z == "`":
            aus.append(z)
            modi.append(["vorlage"])
            i += 1
            continue
        if z == "/" and regex_moeglich(aus):
            j, in_klasse, zu = i + 1, False, False
            while j < n and quelle[j] != "\n":
                c = quelle[j]
                if c == "\\":
                    j += 2
                    continue
                if c == "[":
                    in_klasse = True
                elif c == "]":
                    in_klasse = False
                elif c == "/" and not in_klasse:
                    zu = True
                    break
                j += 1
            if zu:
                aus.append(quelle[i:j + 1])
                i = j + 1
                continue
        if z == "{":
            modi[-1][1] += 1
        elif z == "}":
            if modi[-1][1] == 0 and len(modi) > 1:
                modi.pop()  # Ende von ${ ... }, zurück in die Vorlage
            else:
                modi[-1][1] -= 1
        aus.append(z)
        i += 1
    return "".join(aus)


def js_woerter(quelle):
    worte = set()
    for wort in NAME_RE.findall(js_ohne_kommentare(quelle)):
        worte.add(wort)
        worte.add(wort.strip("-"))
    return worte


def sammle_benutzt(root):
    """Liefert (Klassen, IDs, JS-Wörter, Zahl der Quellen je Art)."""
    klassen, ids, worte = set(), set(), set()
    zahl = {"html": 0, "illus": 0, "erzeuger": 0, "js": 0, "eingebettet": 0}
    seiten = sorted(root.glob("*.html"))
    illus = []
    if (root / "_illus").is_dir():
        illus = sorted(p for p in (root / "_illus").rglob("*") if p.is_file())
    for pfad in seiten + [p for p in illus if p.suffix == ".html"]:
        for kopf, inhalt in SKRIPT_RE.findall(lies(pfad)):
            if "ld+json" in kopf or not inhalt.strip():
                continue
            worte |= js_woerter(inhalt)
            zahl["eingebettet"] += 1
    for pfad in seiten:
        aus_attributen(lies(pfad), klassen, ids)
        zahl["html"] += 1
    for pfad in illus:
        try:
            text = lies(pfad)
        except UnicodeDecodeError:
            continue  # Bilder und andere Binärdateien
        aus_attributen(text, klassen, ids)
        aus_attributen(text.replace('\\"', '"'), klassen, ids)  # JSON-Werte
        zahl["illus"] += 1
    eigene = Path(__file__).name
    for pfad in sorted((root / "_tools").glob("*.py")):
        if pfad.name == eigene:
            continue
        text = lies(pfad)
        aus_attributen(text, klassen, ids)
        aus_attributen(text.replace('\\"', '"'), klassen, ids)
        zahl["erzeuger"] += 1
    for pfad in sorted((root / "assets").rglob("*.js")):
        worte |= js_woerter(lies(pfad))
        zahl["js"] += 1
    return klassen, ids, worte, zahl


# ------------------------------------------------------------------- CSS

def maskiere(text):
    """Blendet Kommentare und Zeichenketten längenneutral aus."""
    aus = list(text)
    i, n = 0, len(text)
    while i < n:
        z = text[i]
        if text.startswith("/*", i):
            ende = text.find("*/", i + 2)
            ende = n if ende < 0 else ende + 2
            for k in range(i, ende):
                if text[k] not in "\r\n":
                    aus[k] = " "
            i = ende
        elif z in "\"'":
            j = i + 1
            while j < n and text[j] != z and text[j] != "\n":
                j += 2 if text[j] == "\\" else 1
            for k in range(i + 1, min(j, n)):
                aus[k] = "_"
            i = j + 1
        else:
            i += 1
    return "".join(aus)


def klammer_zu(text, auf, zu_zeichen, grenze):
    """Index der schließenden Klammer zur öffnenden an Stelle auf, sonst -1."""
    auf_zeichen = text[auf]
    tiefe = 0
    for i in range(auf, grenze):
        if text[i] == auf_zeichen:
            tiefe += 1
        elif text[i] == zu_zeichen:
            tiefe -= 1
            if tiefe == 0:
                return i
    return -1


def teile_liste(text, a, b):
    """Teilt text[a:b] an Kommas außerhalb von Klammern in Abschnitte (a, b)."""
    teile, tiefe, start = [], 0, a
    for i in range(a, b):
        z = text[i]
        if z in "([":
            tiefe += 1
        elif z in ")]":
            tiefe -= 1
        elif z == "," and tiefe == 0:
            teile.append((start, i))
            start = i + 1
    teile.append((start, b))
    return teile


class Pruefer:
    def __init__(self, klassen, ids, worte, schutz):
        self.klassen, self.ids, self.worte = klassen, ids, worte
        self.schutz_fest = {s for s in schutz if not any(c in s for c in "*?[")}
        self.schutz_muster = [s for s in schutz if any(c in s for c in "*?[")]

    def benutzt(self, name, menge):
        if name in menge or name in self.worte or name in self.schutz_fest:
            return True
        return any(fnmatch.fnmatchcase(name, m) for m in self.schutz_muster)

    def tote_namen(self, sel):
        """Namen, an denen der Selektor scheitert. Leere Liste heißt: lebt."""
        if "\\" in sel:
            return []  # maskierte Sonderzeichen beurteilen wir nicht
        tot = []
        i, n = 0, len(sel)
        while i < n:
            z = sel[i]
            if z == "[":
                ende = klammer_zu(sel, i, "]", n)
                i = n if ende < 0 else ende + 1
            elif z == ":":
                m = PSEUDO_RE.match(sel, i)
                if not m:
                    i += 1
                    continue
                auf = m.end() - 1
                ende = klammer_zu(sel, auf, ")", n)
                if ende < 0:
                    return []
                art = m.group(1).lower()
                innen_a = auf + 1
                if art.startswith("nth-") and " of " in sel[innen_a:ende]:
                    innen_a = sel.index(" of ", innen_a) + 4
                    art = "is"
                if art in LISTEN_PSEUDO:
                    gruppen = [
                        self.tote_namen(sel[a:b])
                        for a, b in teile_liste(sel, innen_a, ende)
                        if sel[a:b].strip()
                    ]
                    if gruppen and all(gruppen):
                        tot.extend(gruppen[0])
                # :not(...) und alle übrigen Klammern bleiben unbeurteilt
                i = ende + 1
            elif z in ".#":
                m = NAME_RE.match(sel, i + 1)
                if not m:
                    i += 1
                    continue
                menge = self.klassen if z == "." else self.ids
                if not self.benutzt(m.group(0), menge):
                    tot.append(z + m.group(0))
                i = m.end()
            else:
                i += 1
        return tot


class Regel:
    art = "regel"

    def __init__(self, start, auf, ende, selektoren):
        self.start, self.auf, self.ende = start, auf, ende
        self.selektoren = selektoren  # [(a, b, tote Namen)]

    @property
    def tot(self):
        return all(s[2] for s in self.selektoren)

    @property
    def teilweise(self):
        return not self.tot and any(s[2] for s in self.selektoren)


class Block:
    art = "block"

    def __init__(self, start, auf, ende, kinder):
        self.start, self.auf, self.ende, self.kinder = start, auf, ende, kinder

    @property
    def leer(self):
        return all(
            (k.art == "regel" and k.tot) or (k.art == "block" and k.leer)
            for k in self.kinder
        )


class Fremd:
    art = "fremd"

    def __init__(self, start, ende):
        self.start, self.ende = start, ende


def parse(maske, a, b, pruefer):
    knoten = []
    i = a
    while i < b:
        while i < b and maske[i].isspace():
            i += 1
        if i >= b:
            break
        start = i
        j = i
        while j < b and maske[j] not in "{;}":
            j += 1
        if j >= b:
            raise ValueError(f"Rest ohne Block ab Zeichen {start}")
        if maske[j] == ";":
            knoten.append(Fremd(start, j + 1))
            i = j + 1
            continue
        if maske[j] == "}":
            raise ValueError(f"schließende Klammer ohne Block bei Zeichen {j}")
        zu = klammer_zu(maske, j, "}", b)
        if zu < 0:
            raise ValueError(f"Block ab Zeichen {j} wird nicht geschlossen")
        kopf = maske[start:j].strip()
        if kopf.startswith("@"):
            name = re.match(r"@[\w-]+", kopf).group(0).lower()
            if name in ABSTEIGEN:
                knoten.append(Block(start, j, zu + 1, parse(maske, j + 1, zu, pruefer)))
            else:
                knoten.append(Fremd(start, zu + 1))
        else:
            selektoren = [
                (sa, sb, pruefer.tote_namen(maske[sa:sb]))
                for sa, sb in teile_liste(maske, start, j)
            ]
            knoten.append(Regel(start, j, zu + 1, selektoren))
        i = zu + 1
    return knoten


def neue_liste(text, regel):
    """Selektorliste ohne die toten Mitglieder, Einrückung wie im Bestand."""
    stuecke = []
    for a, b, tot in regel.selektoren:
        roh = text[a:b]
        vorn = roh[: len(roh) - len(roh.lstrip())]
        hinten = roh[len(roh.rstrip()):]
        stuecke.append((vorn, roh.strip(), hinten, bool(tot)))
    lebend = [s for s in stuecke if not s[3]]
    neu = stuecke[0][0] + lebend[0][1]
    for vorn, kern, _, _ in lebend[1:]:
        neu += "," + vorn + kern
    return neu + stuecke[-1][2]


def loesche(text, a, b):
    """Schneidet text[a:b] heraus. Steht der Abschnitt allein auf seinen Zeilen,
    fallen die ganzen Zeilen weg und es bleiben keine doppelten Leerzeilen."""
    zeile_a = text.rfind("\n", 0, a) + 1
    zeile_b = text.find("\n", b)
    zeile_b = len(text) if zeile_b < 0 else zeile_b + 1
    if text[zeile_a:a].strip() or text[b:zeile_b].strip():
        return text[:a] + text[b:]
    a, b = zeile_a, zeile_b
    while True:
        davor = None
        if a > 0:
            anfang = text.rfind("\n", 0, a - 1) + 1
            davor = (anfang, text[anfang:a])
        danach = None
        if b < len(text):
            ende = text.find("\n", b)
            ende = len(text) if ende < 0 else ende + 1
            danach = (ende, text[b:ende])
        davor_leer = davor is not None and not davor[1].strip()
        danach_leer = danach is not None and not danach[1].strip()
        oeffnet = davor is not None and davor[1].rstrip().endswith("{")
        schliesst = danach is not None and danach[1].lstrip().startswith("}")
        if danach_leer and (davor is None or davor_leer or oeffnet):
            b = danach[0]
        elif davor_leer and (danach is None or schliesst):
            a = davor[0]
        else:
            break
    return text[:a] + text[b:]


class Befund:
    def __init__(self):
        self.tot = []       # (Zeile, Selektoren, Namen)
        self.teil = []      # (Zeile, tote Mitglieder, Namen)
        self.leer = []      # (Zeile, Kopf)
        self.schritte = []  # (Start, Ende, Ersatz oder None für Löschen)

    @property
    def treffer(self):
        return len(self.tot) + len(self.teil) + len(self.leer)


def kurz(text, laenge=110):
    text = " ".join(text.split())
    return text if len(text) <= laenge else text[: laenge - 3] + "..."


def untersuche(text, pruefer):
    maske = maskiere(text)
    befund = Befund()

    def zeile(pos):
        while pos < len(maske) and maske[pos].isspace():
            pos += 1
        return text.count("\n", 0, pos) + 1

    def gehe(knoten, im_leeren_block):
        for k in knoten:
            if k.art == "regel" and k.tot:
                namen = sorted({n for s in k.selektoren for n in s[2]})
                befund.tot.append((zeile(k.start), kurz(maske[k.start:k.auf]), namen))
                if not im_leeren_block:
                    befund.schritte.append((k.start, k.ende, None))
            elif k.art == "regel" and k.teilweise:
                tote = [s for s in k.selektoren if s[2]]
                befund.teil.append((
                    zeile(tote[0][0]),
                    kurz(", ".join(maske[a:b].strip() for a, b, _ in tote)),
                    sorted({n for s in tote for n in s[2]}),
                ))
                befund.schritte.append((k.start, k.auf, neue_liste(text, k)))
            elif k.art == "block" and k.leer:
                befund.leer.append((zeile(k.start), kurz(maske[k.start:k.auf])))
                if not im_leeren_block:
                    befund.schritte.append((k.start, k.ende, None))
                gehe(k.kinder, True)
            elif k.art == "block":
                gehe(k.kinder, im_leeren_block)

    gehe(parse(maske, 0, len(maske), pruefer), False)
    return befund


def wende_an(text, befund):
    """Führt die Schritte von hinten nach vorn aus, damit die Stellen davor gültig bleiben."""
    for a, b, ersatz in sorted(befund.schritte, key=lambda s: s[0], reverse=True):
        text = loesche(text, a, b) if ersatz is None else text[:a] + ersatz + text[b:]
    return text


def eingebundene_css(root):
    namen = set()
    for pfad in root.glob("*.html"):
        namen.update(CSS_LINK_RE.findall(lies(pfad)))
    return namen


def main():
    parser = argparse.ArgumentParser(description="Toten CSS-Code finden und entfernen.")
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parent.parent,
        help="Website-Ordner (Vorgabe: der Ordner über _tools)",
    )
    parser.add_argument("--apply", action="store_true", help="Treffer löschen (sonst nur melden)")
    parser.add_argument("--check", action="store_true", help="nur melden (das ist die Vorgabe)")
    parser.add_argument(
        "--keep", action="append", default=[], metavar="NAMEN",
        help="Klassen oder IDs schützen, mit Komma getrennt, * als Platzhalter erlaubt",
    )
    parser.add_argument("--liste", action="store_true", help="jeden Treffer mit Zeile ausgeben")
    parser.add_argument(
        "--css", action="append", default=[], metavar="DATEI",
        help="nur diese CSS-Datei prüfen (relativ zum Website-Ordner, mehrfach möglich)",
    )
    args = parser.parse_args()
    if args.apply and args.check:
        parser.error("--apply und --check schließen sich aus")
    root = args.root
    if not (root / "assets").is_dir():
        print(f"FEHLER  kein assets-Ordner unter {root}")
        return 2

    schutz = {
        name.strip().lstrip(".#")
        for teil in args.keep
        for name in teil.split(",")
        if name.strip()
    }
    klassen, ids, worte, zahl = sammle_benutzt(root)
    pruefer = Pruefer(klassen, ids, worte, schutz)
    print(
        f"Benutzt: {len(klassen)} Klassen und {len(ids)} IDs aus {zahl['html']} Seiten, "
        f"{zahl['illus']} Dateien in _illus/ und {zahl['erzeuger']} Erzeuger-Skripten; "
        f"{len(worte)} Wörter aus {zahl['js']} JS-Dateien und "
        f"{zahl['eingebettet']} eingebetteten Skripten."
    )
    if schutz:
        print("Geschützt (--keep): " + ", ".join(sorted(schutz)))

    if args.css:
        dateien = [root / name for name in args.css]
    else:
        dateien = sorted((root / "assets").glob("*.css"))
    eingebunden = eingebundene_css(root)
    summe = {"tot": 0, "teil": 0, "leer": 0, "bytes": 0}
    fehler = False
    for pfad in dateien:
        if not pfad.is_file():
            print(f"FEHLER  {pfad}: Datei fehlt")
            fehler = True
            continue
        name = pfad.relative_to(root).as_posix()
        if not args.css and name not in eingebunden:
            print(f"{name}: von keiner Seite eingebunden, übersprungen")
            continue
        text = lies(pfad)
        try:
            befund = untersuche(text, pruefer)
        except ValueError as grund:
            print(f"FEHLER  {name}: {grund}")
            fehler = True
            continue
        neu = wende_an(text, befund) if befund.treffer else text
        gespart = len(text.encode("utf-8")) - len(neu.encode("utf-8"))
        print(
            f"{name}: {len(befund.tot)} tote Regeln, {len(befund.teil)} teilweise tote "
            f"Selektorlisten, {len(befund.leer)} leere Blöcke, {gespart} Bytes"
        )
        if args.liste:
            for nr, sel, namen in befund.tot:
                print(f"  tot   {nr:5}  {sel}   [{', '.join(namen)}]")
            for nr, sel, namen in befund.teil:
                print(f"  teil  {nr:5}  {sel}   [{', '.join(namen)}]")
            for nr, kopf in befund.leer:
                print(f"  leer  {nr:5}  {kopf}")
        summe["tot"] += len(befund.tot)
        summe["teil"] += len(befund.teil)
        summe["leer"] += len(befund.leer)
        summe["bytes"] += gespart
        if args.apply and befund.treffer:
            try:
                rest = untersuche(neu, pruefer).treffer
            except ValueError as grund:
                print(f"FEHLER  {name}: Ergebnis nicht lesbar ({grund}), nichts geschrieben")
                fehler = True
                continue
            if rest:
                print(f"FEHLER  {name}: Gegenprobe findet noch {rest} Treffer, nichts geschrieben")
                fehler = True
                continue
            with open(pfad, "w", encoding="utf-8", newline="") as datei:
                datei.write(neu)
            print("  geschrieben, Gegenprobe 0 Treffer")

    gesamt = summe["tot"] + summe["teil"] + summe["leer"]
    print(
        f"Gesamt: {summe['tot']} tote Regeln, {summe['teil']} teilweise tote "
        f"Selektorlisten, {summe['leer']} leere Blöcke, {summe['bytes']} Bytes"
        + (" entfernt" if args.apply else "")
    )
    if fehler:
        return 2
    if args.apply:
        return 0
    return 1 if gesamt else 0


if __name__ == "__main__":
    sys.exit(main())
