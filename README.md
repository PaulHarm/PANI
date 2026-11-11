# PANI Hausverwaltung Berlin

Statische Website für GitHub Pages (www.pani-hv.de). 41 HTML-Dateien: 36 Seiten in Deutsch und Englisch, vier Weiterleitungsseiten und die Fehlerseite. Kein Build-Schritt für die Auslieferung, keine Laufzeitabhängigkeiten.

## Lokal ansehen

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Vorschau: http://127.0.0.1:8765. HTTP verwenden, damit externe SVG-Symbole zuverlässig geladen werden.

## Werkzeuge

Menü, Kopfzeilen und Versionen werden erzeugt, nicht von Hand gepflegt:

```sh
python _tools/build.py            # Menü, Kopf-Block, Versionen, Brotkrumen-Daten, Sitemap
python _tools/build.py --check    # schreibt nichts, meldet Veraltetes
node --test tests/*.test.cjs
node _tools/linkcheck.cjs
```

Nach jeder Änderung an HTML, CSS, JS, SVG, Icons oder Manifest `build.py` laufen lassen, und zwar vor dem Commit. Einzelheiten stehen in `_tools/LIESMICH.md`. Der Ordner `_tools/` beginnt mit einem Unterstrich und wird deshalb nicht veröffentlicht; dasselbe gilt für `_illus/`. Die Datei `_config.yml` hält außerdem `README.md`, `PLATZHALTER.md`, `RECHTSSICHERHEIT.md` und `tests/` von der Website fern. Es gibt bewusst kein `.nojekyll`.

Weitere Helfer in `_tools/`: `bilder.py` (WebP-Varianten und kleines Siegel), `css_tot.py` (findet ungenutzte CSS-Regeln), `shot.cjs`, `shots.cjs` und `shotdiff.py` (Aufnahmen und Bildvergleich), `mobile-audit.cjs`, `measure.cjs`, `eval.cjs`, `ashot.cjs`. Unter `_tools/einmal/` liegen die Umstellungsskripte der Runde vom November 2026 (`cta.py`, `titel.py`); sie sind wiederholbar, werden aber im Alltag nicht gebraucht.

## Aufbau

- `index.html` und `en.html`: reduzierte Startseiten mit interaktivem Haus, drei Verwaltungsformen, kurzem Wechselhinweis und Kontaktbereich. Der Anfrage-Knopf wechselt mit der Auswahl und führt zum Fragebogen. Das kurze Kontaktformular im Kontaktbereich ist fest sichtbar. Bestehende Abschnittsanker bleiben erreichbar.
- `assets/home.css`: ausschließlich für die beiden Startseiten. Native Radiofelder steuern über CSS `:has()` die Gebäudehervorhebung und den zugehörigen Kurztext auch ohne JavaScript. Bei reduzierter Bewegung wechseln die Farben unmittelbar. Ohne `:has()` bleiben alle Leistungstexte und Links sichtbar.
- `anfrage.html` und `en-enquiry.html`: Fragebogen in bis zu sieben Schritten (`assets/enquiry.js`, `assets/enquiry.css`). Eine Vorauswahl kommt über `?type=` (weg, miethaus, wohnung, zinshaus, sanierung, baubetreuung, reporting, wechsel). Die Kartenmotive stammen aus `_illus/`. Ohne JavaScript zeigt die Seite einen Hinweis und den direkten Weg per E-Mail.
- `leistungen.html` und `en-services.html`: Leistungsübersicht. Oben die drei Verwaltungsarten (Abschnitt `#verwaltung`), dann fünf Wegmarken der Zusammenarbeit, eine Slideshow mit vier besonderen Anforderungen (zwei Folien führen zu Abschnitten der Zinshaus-Seite), Sanierung und Baubetreuung mit Fotos, am Ende ein Anfrage-Knopf.
- `weg.html`, `miethaus.html`, `sondereigentum.html` und Spiegel: die drei Verwaltungsarten.
- `zinshaus.html` und `en-zinshaus.html`: gebündelte Seite für Zinshäuser, Investoren und Bestandshalter mit den Ankern `#zinshaus`, `#investoren`, `#bestandshalter`.
- `investoren.html`, `bestandshalter.html`, `en-investors.html`, `en-portfolio-holders.html`: Weiterleitungsseiten auf die Zinshaus-Seite (`meta refresh`, `noindex`, ohne CSS und Menü, nicht in der Sitemap).
- `nachfolge.html` und `en-succession.html`: Verwaltung nach Erbschaft oder Eigentümerwechsel.
- `hausverwaltung-verkaufen.html` und `en-sell-your-company.html`: für Verwalter, die ihr Unternehmen abgeben wollen. Eigener Kontaktblock.
- `ueber-uns.html` und `en-about.html`: Einleitung, Team-Block ohne Fotos (zwei Gründer, zwei Teammitglieder, Anker `#team`), Kennzahlen, Hinweis zum Wechsel, Abschnitt „Vor Ort" mit Zwei-Klick-Karte (`assets/map.js`) und Kontaktabschluss.
- `wechsel.html` und `en-switch.html`: fünf Schritte des Verwaltungswechsels und fünf Fragen mit Antworten. Die Antworten stehen wortgleich im `FAQPage`-Block im Kopf.
- `mieter.html` und `en-tenants.html`: Mieterservice mit eigenem Anliegen und Objektadresse.
- `mieterportal.html` und `en-portal.html`: ausdrücklich gekennzeichneter Ausblick auf das geplante Portal, ohne Login oder Datenerfassung.
- `reporting.html` und `en-reporting.html`: Eigentümer-Update und animierte Reporting-Illustration, ausschließlich Beispieldaten.
- `sanierung.html` und `en-renovation.html`: energetische Sanierung mit dem interaktiven Rechenbeispiel (`assets/energy-model.js`, `assets/experience.js`).
- `baubetreuung.html` und `en-construction-support.html`: Baubetreuung.
- `assets/site.css` und `assets/site.js`: gemeinsame Gestaltung und Interaktionen. `assets/pages.css`: Layout der Unterseiten. `assets/refined-pages.css`: visuelle Verfeinerung der Unterseiten, wird nach `pages.css` geladen.
- `assets/draft.js`: gemeinsames Modul für alle E-Mail-Entwürfe (Fragebogen, Kurzformular, Mieterformular) und für die Vorauswahl über `?type=`.
- `assets/services.js`: Slideshow der Leistungsseiten mit Pfeiltasten, Touch-Gesten und inaktiven Folien außerhalb der Tab-Reihenfolge. Kein automatisches Weiterblättern.
- `assets/service-illustrations.svg`: Architekturbausteine der Leistungsseiten. `assets/icons.svg`: ausgewählte Lucide-Icons und die PANI-Bildmarke; Lizenz in `assets/Lucide-LICENSE.txt`. `assets/nav-house.svg`: Hausgrafik des Menüs, erzeugt aus `_illus/kit.html`.
- `assets/fonts/`: lokal bereitgestellte Fraunces- und IBM-Plex-Schriften mit Lizenzdateien.

Stylesheets, Skripte und Symbol-Dateien tragen eine Version (`?v=`), die `build.py` aus dem Dateiinhalt bildet. Sie wird nie von Hand gesetzt.

## Begriffe

| Deutsch | Englisch |
|---|---|
| WEG-Verwaltung, Eigentümergemeinschaft (WEG) | WEG management, owners' association (WEG) |
| Miethausverwaltung, Miethaus (nie mit Fugen-s) | Rental building management, rental buildings |
| Sondereigentumsverwaltung (SEV), einzelne Wohnung | Individual apartment management (SEV); „unit" nur als Zähleinheit |
| Zinshausverwaltung, Zinshäuser & Investoren | Zinshaus management, Zinshaus & investors |
| Bestandshalter, Bestand, mehrere Häuser | long-term holders, portfolio, several buildings |
| Energetische Sanierung | Energy renovation |
| Baubetreuung | Construction support |
| Nachfolge (nur die Eigentümerseite) | Succession |
| Hausverwaltung verkaufen | Sell your property management firm |

## Kontakt

Alle Seiten haben einen grünen Kontakt-Button in der Kopfzeile, der zum Kontaktbereich der Startseite führt. Alle Anfrage-Knöpfe im Inhalt heißen „Betreuung anfragen" beziehungsweise „Request management" und führen zum Fragebogen, wo sinnvoll mit Vorauswahl. Der Mieterservice-Zugang führt direkt zu `mieter.html` beziehungsweise `en-tenants.html`: mobil als feste Leiste am unteren Bildschirmrand, ab 801 px als schwebende Pille rechts unten. Solange ein Formular im Bild ist, tritt die Pille zurück.

Die bestätigte Adresse lautet `info@pani-hv.de`. Fragebogen und Formulare bereiten nur einen E-Mail-Entwurf vor: Die Seite versucht, ihn im E-Mail-Programm zu öffnen, zeigt den Text zusätzlich an und bietet „Text kopieren" für Webmail. Sehr lange Texte werden nicht in die Adresse gepackt, sondern nur zum Kopieren angeboten. Erst der Nutzer sendet die E-Mail. Es gibt weder einen Versanddienst noch eine serverseitige Speicherung. Direkte E-Mail-Links funktionieren auch ohne JavaScript.

Ein direkter Formularversand benötigt später einen bestätigten Empfangsdienst. Dafür müssen Versand, Fehlermeldungen, Datenschutzbeschreibung und Tests gemeinsam angepasst werden. Zugangsdaten gehören niemals in die statischen HTML- oder JavaScript-Dateien.

## Prüfen

```sh
node --test tests/*.test.cjs
node _tools/linkcheck.cjs
python _tools/build.py --check
```

- `tests/draft.test.cjs`, `tests/contact.test.cjs`, `tests/enquiry.test.cjs`: Entwurf, Formulare und Fragebogen, auch mit kaputten Parametern.
- `tests/energy.test.cjs`: Rechenmodell der Sanierung.
- `tests/site.test.cjs`: der ganze Bestand. Links und Anker, vorhandene und verwaiste Dateien, Sitemap, Sprachverweise, Versionen, Kopf-Block, Titel und Descriptions, strukturierte Daten, gleiche Struktur in Deutsch und Englisch, Weiterleitungsseiten, keine langen Gedankenstriche, keine Personenfotos der Gründer. Der Inhalt der vier Rechtsseiten ist per Prüfsumme eingefroren: Nach einer bewussten Änderung an Impressum oder Datenschutz die Konstante `LEGAL_MAIN_SHA256` im Test anpassen, der neue Wert steht in der Fehlermeldung.

Zusätzlich vor Veröffentlichung: Seiten auf Desktop und Mobil ansehen (`node _tools/mobile-audit.cjs`), Sprachwechsel und Entwürfe ausprobieren. Offene Unternehmensangaben stehen in `PLATZHALTER.md`.

Startseite: alle drei Verwaltungsformen per Klick und Pfeiltasten prüfen. WEG hebt Gemeinschaftseigentum hervor, Miethaus beleuchtet alle Fenster, Sondereigentum markiert eine Wohnung. Bildunterschrift, Leistungstext und Anfrage-Knopf müssen zur Auswahl passen. Bei 320, 390, 768, 1280 und 1600 Pixeln auf Überläufe, vollständige Hausdarstellung und unveränderte Höhe beim Wechsel achten.

Für die Leistungsübersicht außerdem alle Detailziele je Sprache und den Rückweg über die Brotkrumennavigation prüfen. Die Slideshow per Pfeilen, Punkten, Tastatur und Wischgeste bedienen; auch schnelle Wechsel sowie reduzierte Bewegung prüfen. Ohne JavaScript stehen alle vier Anforderungen untereinander mit erreichbaren Links.

## Sanierungsbeispiel

Das Modell verwendet frei gewählte Kennwerte innerhalb der [offiziellen Effizienzklassengrenzen in Anlage 10](https://www.gesetze-im-internet.de/geg/anlage_10.html), keine typischen oder garantierten Sanierungsergebnisse. Ausgangspunkt: F mit 180 kWh/(m²a), 100 m² Gebäudenutzfläche (nicht Wohnfläche), angenommene 0,13 €/kWh. Kosten werden auf zehn Euro gerundet. C ergibt 87 kWh/(m²a), rund 52 Prozent und 1.210 Euro rechnerische Ersparnis. H und G sind keine auswählbaren Sanierungsziele; F stellt den unveränderten Bestand dar. A+ ist enthalten.

Keine Energieberatung, Wirtschaftlichkeitsrechnung oder Einspargarantie. Investitionen, Förderungen, Nutzungsverhalten und Wetter fehlen im Modell. Eine proportionale CO₂-Abnahme setzt denselben Energieträger und Emissionsfaktor voraus. Deshalb wird die Prozentanzeige nur als Energie-Einsparung bezeichnet. Fachlicher Hintergrund: [Verbraucherzentrale zum Energieausweis](https://www.verbraucherzentrale.de/wissen/energie/energetische-sanierung/energieausweis-was-sagt-dieser-steckbrief-fuer-wohngebaeude-aus-24074).

## Bilder

Die Startseite zeigt eine eigens erstellte, schematische Hausillustration als Inline-SVG, kein behauptetes Referenzobjekt. Personenfotos gibt es auf der Website nicht.

Die Stadtansicht der Oderberger Straße dient nur noch als Vorschaubild für geteilte Links. Quelle: [Franz Richter / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Oderberger_Stra%C3%9Fe_1941.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), vorhandener Ausschnitt. Der sichtbare Nachweis steht im Footer der Zinshaus-Seiten. Quellen und Lizenzen der weiteren Bilder sind auf den jeweiligen Unterseiten dokumentiert.

Fünf Titelbilder (WEG, Miethaus, Sondereigentum, Zinshaus, Nachfolge) besitzen je drei WebP-Varianten mit Breitenangabe im Dateinamen, das Baubetreuungsfoto vier und das Sanierungsfoto drei. Die originalen JPEGs bleiben als Rückfall erhalten. Neue Varianten erzeugt `python _tools/bilder.py` (Pillow, Qualität 80). Bildqualität hat Vorrang vor einer starren Dateigrößengrenze. Dateien in `assets/`, auf die nichts mehr verweist, meldet der Test als verwaist; sie werden gelöscht, nicht aufgehoben.

Unter `assets/social/` liegen sieben 1200 × 630 Pixel große Ableitungen der Stadtansichten für geteilte Links. Alle Seiten außer den Weiterleitungsseiten und der Fehlerseite tragen Open-Graph-Angaben.

Das IHK-Siegel wird als `assets/ihk-26a-weg-siegel-388.png` ausgeliefert; das große Original liegt in `_illus/quellen/`.

Für Sanierung und Baubetreuung liegen zwei Baustellenfotos im Repository: `sanierung-baustelle.jpg` stammt von Andrew Dunn und ist auf [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:BuildingSite.jpg) unter [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) veröffentlicht; `baubetreuung-baustelle.jpg` zeigt eine Backsteinreparatur von David E. Lucas, bereitgestellt über die Columbus Metropolitan Library / DPLA und auf [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Brickwork_renovation_-_DPLA_-_9e450b5aad67bc2b358d0b20ea59f8fc.jpg) als Public Domain (US) ausgewiesen.
