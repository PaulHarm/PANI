# Werkzeuge der PANI-Website

Dieser Ordner beginnt mit einem Unterstrich. GitHub Pages veröffentlicht ihn deshalb nicht; im Repository auf GitHub ist er sichtbar.

Gebraucht werden Python 3 (für `bilder.py` und `shotdiff.py` zusätzlich Pillow), Node ab Version 22, Git und für die Browser-Helfer Google Chrome. Alle Skripte finden den Website-Ordner selbst (der Ordner über `_tools`), das Arbeitsverzeichnis ist egal.

## Der Normalfall

```sh
python _tools/build.py            # Menü, Kopf-Block, Versionen, Brotkrumen-Daten, Sitemap
python _tools/build.py --check    # schreibt nichts; Fehlercode 1, wenn etwas veraltet ist
node --test tests/*.test.cjs
node _tools/linkcheck.cjs
```

Menü, Kopf-Block und `?v=`-Werte nie von Hand ändern. Nach jeder Änderung an HTML, CSS, JS, SVG, Icons oder Manifest `build.py` laufen lassen, und zwar vor dem Commit. Der Lauf rechnet im Speicher und schreibt erst am Ende; meldet ein Schritt einen Fehler, bleibt jede Datei unberührt. Ein zweiter Lauf ändert nichts.

## Was `build.py` macht

Es ruft drei Schritte in fester Reihenfolge. Jeder lässt sich auch einzeln starten, gedacht ist aber der Sammelaufruf.

| Schritt | Aufgabe |
|---|---|
| `nav.py` | Baut Desktop- und Mobilmenü in jede Seite und schreibt die Hausgrafik des Menüs aus `_illus/kit.html` nach `assets/nav-house.svg`. Menütexte, Reihenfolge und die Texte der Menükarte stehen oben in der Datei, getrennt für Deutsch (`DE`) und Englisch (`EN`). |
| `kopf.py` | Setzt den Kopf-Block zwischen `<!-- kopf:start -->` und `<!-- kopf:ende -->`: Themenfarbe, Icons, Manifest, Schrift-Preload, CSS und Skripte. Danach bekommt jeder `?v=`-Wert im ganzen Dokument die Version der Datei, auf die er zeigt (auch `icons.svg` im Seiteninhalt und die Icons im Manifest). |
| `seo.py` | Schreibt die Brotkrumen-Daten (`BreadcrumbList`) vor `</head>`, zieht `og:title` und `og:description` an Titel und Description nach und erzeugt `sitemap.xml` mit `lastmod`. |

Der Kopf-Block lädt CSS immer in dieser Reihenfolge: `site.css`, `pages.css`, dann `refined-pages.css` (auf den Startseiten stattdessen `home.css`), dann `enquiry.css`. Skripte kommen nur dorthin, wo der Seiteninhalt sie braucht:

| Auslöser im HTML | Datei |
|---|---|
| immer | `site.js` |
| `data-email-form` oder `data-enquiry` | `draft.js` (vor `site.js`) |
| `data-energy` | `energy-model.js` (vor `experience.js`) |
| `data-animate` oder `data-energy` | `experience.js` |
| `data-map` | `map.js` |
| `class="services-page"` | `services.js` |
| `data-enquiry` | `enquiry.css`, `enquiry.js` |
| `class="home-page"` am `body` | `home.css` statt `refined-pages.css` |

Ein neues Skript oder Stylesheet wird nicht in den Seiten eingetragen, sondern an zwei Stellen, die zusammen geändert werden: in `kopf.py` in der Funktion `dateien()` und in `tests/site.test.cjs` (ein Skript in der Tabelle `SCRIPTS`, ein Stylesheet in der Prüfung `Kopf-Block: CSS in bindender Reihenfolge`). Der Test führt die Tabelle mit Absicht ein zweites Mal. Fehlt der Eintrag dort, meldet er nach `build.py` auf jeder betroffenen Seite `wird geladen, aber kein Ausloeser auf der Seite verlangt es`.

## Regeln, die die Skripte einhalten

- **Version:** Der Wert hinter `?v=` sind die ersten 10 Hex-Zeichen von sha1 über den Dateiinhalt. Bei Textdateien (css, js, svg, webmanifest, json) zählen die Zeilenenden nicht, bei Bildern die rohen Bytes. Der Schrift-Preload trägt bewusst kein `?v=`, sonst lädt der Browser die Schrift doppelt.
- **`404.html`** verweist überall mit führendem Schrägstrich, weil die Seite unter jeder Adresse ausgeliefert wird.
- **Weiterleitungsseiten** (erkannt an `meta refresh`) bleiben unberührt und stehen nicht in der Sitemap.
- **Rechtsseiten** (Impressum, Datenschutz und die englischen Spiegel): Es ändern sich nur Menü und Kopf-Block, der Inhalt nie.
- **`lastmod`** ist das Datum des jüngsten Commits, in dem sich der Inhalt (`<main>`) einer Seite geändert hat. Menü, Kopf-Block, Versionen und Umbrüche zählen nicht. Ist eine Änderung noch nicht committet, gilt das heutige Datum. Deshalb am selben Tag bauen und committen; liegt der Commit einen Tag später, meldet `--check` danach `sitemap.xml`, und ein weiterer Lauf mit eigenem Commit stellt es richtig.
- **Sitemap:** Reihenfolge, `changefreq` und `priority` vorhandener Einträge bleiben. Eine neue Seite wird hinten angefügt (monatlich, 0.5) und mit einem Hinweis gemeldet; die Werte dann von Hand anpassen.
- **Zeilenenden** jeder vorhandenen Datei bleiben, wie sie sind. Neue Dateien bekommen LF.

Neue Seite anlegen: eine vorhandene Seite kopieren, Titel, Description, Canonical und hreflang von Hand setzen, einen Menüpunkt bei Bedarf in `nav.py` eintragen, dann `build.py`. Bei einem Merge-Konflikt in einem erzeugten Block eine der beiden Fassungen nehmen und `build.py` erneut laufen lassen.

## Optionen der Erzeuger

| Option | Wirkung |
|---|---|
| `--check` | Schreibt nichts. Fehlercode 1, wenn sich etwas ändern würde, 2 bei einem Fehler, sonst 0. |
| `--diff` | Zeigt die Änderungen zusätzlich als Diff. Zusammen mit `--check` ein Probelauf. |
| `--root <ordner>` | Arbeitet auf einer Kopie der Website statt auf dem Ordner über `_tools`. |
| `seite.html ...` | Bearbeitet nur die genannten Seiten. Nur zum Ausprobieren, weil die übrigen Seiten dann ältere Versionen behalten. |

## Prüfen ohne Browser

`node _tools/linkcheck.cjs [--root <ordner>]` prüft alle internen Verweise und Anker, die Ziele der Weiterleitungsseiten, die buchstabengenaue Schreibweise der Dateinamen (GitHub Pages unterscheidet Groß- und Kleinschreibung, Windows nicht) und lange Gedankenstriche. Fehlercode 1 bei Befunden.

## Browser-Helfer

Sie brauchen einen lokalen Server, zum Beispiel `python -m http.server 8765 --bind 127.0.0.1` im Website-Ordner. Chrome wird unter `C:/Program Files/Google/Chrome/Application/chrome.exe` erwartet; ein anderer Pfad kommt in die Umgebungsvariable `CHROME_PATH`. Jeder Lauf nutzt ein Wegwerf-Profil im Temp-Ordner. Aufnahmen und Berichte am besten außerhalb des Website-Ordners ablegen; wer sie hier braucht, nimmt `_shots/` (steht in `.gitignore` und wird nicht veröffentlicht).

| Skript | Zweck | Beispiel |
|---|---|---|
| `shot.cjs` | Aufnahme der ganzen Seite in einer Breite, mit reduzierter Bewegung. Mehrere Aufträge in einem Aufruf möglich. Weiterleitungsseiten werden übersprungen. | `node _tools/shot.cjs http://127.0.0.1:8765/weg.html 1440 weg-1440.png` |
| `ashot.cjs` | Aufnahme des sichtbaren Fensters an einem Element, auf Wunsch nach einem Stück JavaScript (zum Beispiel offenes Menü). | `node _tools/ashot.cjs http://127.0.0.1:8765/weg.html 1440 900 ".site-header" menue.png "document.querySelector('[data-nav-menu]').classList.add('is-open')"` |
| `measure.cjs` | Breite und Höhe von Elementen in einem Fenster. | `node _tools/measure.cjs http://127.0.0.1:8765/index.html 390 844 ".site-header" "h1"` |
| `eval.cjs` | Wertet einen JavaScript-Ausdruck auf einer Seite aus und gibt das Ergebnis als JSON aus. | `node _tools/eval.cjs http://127.0.0.1:8765/index.html 1440 900 "document.title"` |
| `mobile-audit.cjs` | Mobil-Prüfung aller Seiten bei 360, 390 und 768 Pixeln: Überlauf, zu kleine Schrift, kleine Tippflächen, verzerrte Bilder. Der Bericht landet im Temp-Ordner, der Pfad steht am Ende der Ausgabe. | `node _tools/mobile-audit.cjs http://127.0.0.1:8765/` |

## Weitere Werkzeuge

Die Bedienung steht jeweils im Kopf der Datei.

- `bilder.py`: legt fehlende Bildvarianten in `assets/` an und überschreibt nichts.
- `css_tot.py`: findet CSS-Regeln ohne Treffer; mit `--apply` löscht es sie.
- `shots.cjs` und `shotdiff.py`: nehmen alle Seiten gegen zwei Server auf und vergleichen die Bilder Pixel für Pixel.
- `einmal/`: Skripte für einmalige Umstellungen. Sie bleiben zum Nachlesen im Repository.
