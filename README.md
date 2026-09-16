# PANI Hausverwaltung Berlin

Statische Website für GitHub Pages. Deutsche und englische Startseite, Leistungsseiten und separater Mieterservice.

## Lokal ansehen

Im Repository-Verzeichnis starten:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Vorschau: http://127.0.0.1:8765. HTTP verwenden, damit externe SVG-Symbole zuverlässig geladen werden. Die Website benötigt keinen Build-Schritt und keine Laufzeitabhängigkeiten.

## Aufbau

- `index.html` und `en.html`: reduzierte Startseiten mit interaktivem Haus, drei Verwaltungsformen, kurzem Wechselhinweis und aufklappbarer Kontaktanfrage. Bestehende Abschnittsanker bleiben erreichbar.
- `assets/home.css`: ausschließlich für die beiden Startseiten. Native Radiofelder steuern über CSS `:has()` die Gebäudehervorhebung und den zugehörigen Kurztext auch ohne JavaScript. Mobil steht die Auswahl oberhalb des Hauses. Ohne `:has()` bleiben alle Leistungstexte und Links sichtbar.
- `leistungen.html` und `en-services.html`: Leistungsübersicht mit interaktivem Haus-Explorer für WEG, Miethaus und Sondereigentum, einem vierstufigen Ablauf, besonderen Anforderungen sowie den Weiterentwicklungsangeboten energetische Sanierung und Baubetreuung. Architekturillustrationen und Links führen zu den Detailseiten. Hauptnavigation, mobiles Menü, Footer und Brotkrumennavigation führen zur Übersicht.
- `ueber-uns.html` und `en-about.html`: Einleitung, Gründerblock mit großen Porträts und neutralem IHK-Hinweis, fünf aufklappbare Fragen zum Verwaltungswechsel und Kontaktabschluss. Die Startseite verlinkt hierhin, statt diese Inhalte zu wiederholen.
- `assets/map.js`: Zwei-Klick-Karte im Abschnitt „Vor Ort“ der Über-uns-Seiten. Google Maps wird erst nach Klick auf „Karte laden“ angefragt und lässt sich wieder ausblenden; ohne JavaScript bleiben Adresse und die Links zu Google Maps.
- `mieter.html` und `en-tenants.html`: Mieterservice mit eigenem Anliegen und Objektadresse.
- `assets/site.css` und `assets/site.js`: gemeinsame Gestaltung und Interaktionen der neuen Seiten.
- `assets/refined-pages.css`: gemeinsame visuelle Verfeinerung der Unterseiten. Helle Split-Heroes, kompaktere Inhaltsrhythmen, einheitlicher Footer und responsive Detailseiten führen die Leistungs-, Zielgruppen-, Service- und Rechtsseiten näher an die reduzierte Startseite heran.
- Stylesheet-Links tragen eine Inhaltsversion (`?v=…`), damit Browser nach einer Veröffentlichung keine ältere Gestaltung weiterverwenden. Bei CSS-Änderungen diese Version in allen HTML-Seiten aktualisieren.
- `assets/pages.css`: gemeinsames Layout der Unterseiten, Sanierungsbeispiel und dauerhafter Mieterservice-Zugang (mobil als Leiste am unteren Rand, ab 801 px als schwebende Pille rechts unten).
- `assets/legacy.css`: Altbestand, wird von keiner Seite geladen.
- `reporting.html` und `en-reporting.html`: Eigentümer-Update und animierte Reporting-Illustration, ausschließlich Beispieldaten.
- `mieterportal.html` und `en-portal.html`: ausdrücklich gekennzeichneter Ausblick auf das geplante Portal mit der bisherigen Handy-Illustration. Vom Mieterservice aus erreichbar, ohne Login oder Datenerfassung.
- `sanierung.html` und `en-renovation.html`: energetische Sanierung mit dem interaktiven Rechenbeispiel. Erreichbar über die Leistungsübersicht; der alte Startseiten-Anker `#sanierung` führt nur noch zur Leistungssektion.
- `assets/energy-model.js` und `assets/experience.js`: transparentes Sanierungs-Rechenbeispiel und Animationen mit Unterstützung für reduzierte Bewegung.
- `assets/architecture.svg`: vereinfachte Architekturillustrationen aus dem bestehenden Motivsystem.
- `assets/service-illustrations.svg`: gemeinsame, homepage-nahe Hausillustrationen für die interaktive Leistungsübersicht und die beiden Weiterentwicklungsangebote.
- `assets/icons.svg`: ausgewählte Lucide-Icons und die bestehende PANI-Bildmarke; Lizenz in `assets/Lucide-LICENSE.txt`.
- `assets/fonts/`: lokal bereitgestellte Fraunces- und IBM-Plex-Schriften mit Lizenzdateien.

## Kontakt

Alle Seiten haben einen grünen Kontakt-Button in der Kopfzeile. Der Mieterservice-Zugang führt direkt zu `mieter.html` beziehungsweise `en-tenants.html`: mobil als feste Leiste am unteren Bildschirmrand, ab 801 px als schwebende Pille rechts unten. Auf der Startseite bleibt er auch beim geöffneten Kontaktformular sichtbar; zusätzlicher Abstand hält die Formularaktionen frei. Auf den übrigen Seiten tritt die Pille zurück, solange ein Kontaktformular im Bild ist. Auf den Service- und Portal-Seiten entfällt dieser Zugang, damit kein redundanter Eigenverweis entsteht. Alle Links funktionieren ohne JavaScript.

Die bestätigte Adresse lautet `info@pani-hv.de`. Die Eingabefelder bereiten einen `mailto:`-Entwurf vor. Erst der Nutzer sendet die E-Mail in seinem E-Mail-Programm. Es gibt weder einen Formspree-Endpunkt noch einen automatischen Versand, eine Zustellbestätigung oder serverseitige Speicherung der Eingaben. Direkte E-Mail-Links funktionieren auch ohne JavaScript.

Ein direkter Formularversand benötigt später einen bestätigten Empfangsdienst. Dafür müssen Versand, Fehlermeldungen, Datenschutzbeschreibung und Tests gemeinsam angepasst werden. Zugangsdaten gehören niemals in die statischen HTML- oder JavaScript-Dateien.

## Prüfen

Die Kontaktlogik lässt sich ohne zusätzliche Pakete mit Node.js testen:

```sh
node --test tests/*.test.cjs
```

Zusätzlich vor Veröffentlichung: Seiten auf Desktop und Mobil prüfen, Sprachwechsel und Kontaktentwürfe ausprobieren. Offene Unternehmensangaben stehen in `PLATZHALTER.md`.

Startseite: alle drei Verwaltungsformen per Klick und Pfeiltasten prüfen. WEG hebt Gemeinschaftseigentum hervor, Miethaus beleuchtet alle Fenster, Sondereigentum markiert eine Wohnung. Bildunterschrift, Leistungstext und Detail-Link müssen zur Auswahl passen. Bei 320, 390, 768, 1280 und 1600 Pixeln auf Überläufe, vollständige Hausdarstellung und unveränderte Höhe beim Wechsel achten. Kontaktbereich über die Kopfzeile erreichen, Anfrage aufklappen und Mieterservice auch nach dem Scrollen prüfen. Die Illustration respektiert die Systemeinstellung für reduzierte Bewegung.

Für die Leistungsübersicht außerdem alle acht Detailziele je Sprache und den Rückweg über die Brotkrumennavigation prüfen. Die Übersicht und ihre Links funktionieren ohne JavaScript; nur das mobile Klappmenü wird durch `assets/site.js` erweitert.

Für die Über-uns-Seiten zusätzlich Hauptnavigation, Sprachwechsel und Footer prüfen, für die Wechselseiten (wechsel.html, en-switch.html) die FAQ per Maus und Tastatur. Der Weg zum geplanten Portal führt vom festen Mieterservice-Link über „Was geplant ist“ zum gekennzeichneten Ausblick und von dort zurück zum Mieterservice.

## Sanierungsbeispiel

Das Modell verwendet frei gewählte Kennwerte innerhalb der [offiziellen Effizienzklassengrenzen in Anlage 10](https://www.gesetze-im-internet.de/geg/anlage_10.html), keine typischen oder garantierten Sanierungsergebnisse. Ausgangspunkt: F mit 180 kWh/(m²a), 100 m² Gebäudenutzfläche (nicht Wohnfläche), angenommene 0,13 €/kWh. Kosten werden auf zehn Euro gerundet. C ergibt 87 kWh/(m²a), rund 52 Prozent und 1.210 Euro rechnerische Ersparnis. H und G sind keine auswählbaren Sanierungsziele; F stellt den unveränderten Bestand dar. A+ ist enthalten.

Keine Energieberatung, Wirtschaftlichkeitsrechnung oder Einspargarantie. Investitionen, Förderungen, Nutzungsverhalten und Wetter fehlen im Modell. Eine proportionale CO₂-Abnahme setzt denselben Energieträger und Emissionsfaktor voraus. Deshalb wird die Prozentanzeige nur als Energie-Einsparung bezeichnet. Fachlicher Hintergrund: [Verbraucherzentrale zum Energieausweis](https://www.verbraucherzentrale.de/wissen/energie/energetische-sanierung/energieausweis-was-sagt-dieser-steckbrief-fuer-wohngebaeude-aus-24074).

## Bilder

Die Startseite zeigt eine eigens erstellte, schematische Hausillustration als Inline-SVG, kein behauptetes Referenzobjekt. Die bisherige Stadtansicht der Oderberger Straße bleibt als Social-Media-Vorschaubild erhalten. Quelle: [Franz Richter / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Oderberger_Stra%C3%9Fe_1941.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), vorhandener Ausschnitt. Quellen und Lizenzen der weiteren Bilder bleiben auf den jeweiligen Unterseiten dokumentiert. Das transparente Browser-Favicon verwendet das vorhandene Bärenmotiv mit zusätzlichem Innenabstand; App- und Touch-Icons bleiben unverändert.

Sieben vorhandene Titelbilder besitzen je drei WebP-Varianten mit Breitenangabe im Dateinamen. Die originalen JPEGs bleiben als Fallback erhalten. `sizes` berücksichtigt die Vergrößerung durch `object-fit: cover` auf hohen mobilen Titelbereichen; eine Querformatquelle darf nicht allein nach der sichtbaren Bildschirmbreite ausgewählt werden. Die größten WebP-Varianten sind insgesamt rund 46 Prozent kleiner als die entsprechenden JPEGs. Bildqualität hat Vorrang vor einer starren Dateigrößengrenze.

Unter `assets/social/` liegen sieben 1200 × 630 Pixel große Ableitungen der vorhandenen Stadtansichten für geteilte Links. Die 28 Inhaltsseiten tragen passende Open-Graph-Metadaten; Rechtstexte und Fehlerseite bleiben davon ausgenommen. Originale und Quellenangaben wurden nicht entfernt.
