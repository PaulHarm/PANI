# PANI Hausverwaltung Berlin

Statische Website für GitHub Pages. Deutsche und englische Startseite, Leistungsseiten und separater Mieterservice.

## Lokal ansehen

Im Repository-Verzeichnis starten:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Vorschau: http://127.0.0.1:8765. HTTP verwenden, damit externe SVG-Symbole zuverlässig geladen werden. Die Website benötigt keinen Build-Schritt und keine Laufzeitabhängigkeiten.

## Aufbau

- `index.html` und `en.html`: Startseiten; bestehende Abschnittsanker bleiben erreichbar.
- `leistungen.html` und `en-services.html`: Leistungsübersicht mit acht Angeboten, Architekturillustrationen und Links zu den Detailseiten. Hauptnavigation, mobiles Menü, Footer und Brotkrumennavigation führen zur Übersicht. Die Startseiten behalten drei kompakte Angebote und ergänzen „Alle Leistungen ansehen“.
- `mieter.html` und `en-tenants.html`: Mieterservice mit eigenem Anliegen und Objektadresse.
- `assets/site.css` und `assets/site.js`: gemeinsame Gestaltung und Interaktionen der neuen Seiten.
- Stylesheet-Links tragen eine Inhaltsversion (`?v=…`), damit Browser nach einer Veröffentlichung keine ältere Gestaltung weiterverwenden. Bei CSS-Änderungen diese Version in allen HTML-Seiten aktualisieren.
- `assets/pages.css`: gemeinsames Layout der Unterseiten, Sanierungsbeispiel und dauerhafter Mieterportal-Link.
- `reporting.html` und `en-reporting.html`: Eigentümer-Update und animierte Reporting-Illustration, ausschließlich Beispieldaten.
- `mieterportal.html` und `en-portal.html`: ausdrücklich gekennzeichnete Portal-Platzhalter mit der bisherigen Handy-Illustration. Kein Login und keine Datenerfassung.
- `sanierung.html` und `en-renovation.html`: energetische Sanierung mit dem interaktiven Rechenbeispiel. Auf der Startseite unter „Besondere Anforderungen“ verlinkt; der alte Anker `#sanierung` führt dort zum Link.
- `assets/energy-model.js` und `assets/experience.js`: transparentes Sanierungs-Rechenbeispiel und Animationen mit Unterstützung für reduzierte Bewegung.
- `assets/architecture.svg`: vereinfachte Architekturillustrationen aus dem bestehenden Motivsystem.
- `assets/icons.svg`: ausgewählte Lucide-Icons und die bestehende PANI-Bildmarke; Lizenz in `assets/Lucide-LICENSE.txt`.
- `assets/fonts/`: lokal bereitgestellte Fraunces- und IBM-Plex-Schriften mit Lizenzdateien.

## Kontakt

Alle Seiten haben einen grünen Kontakt-Button in der Kopfzeile und einen separaten, dauerhaft sichtbaren Mieterportal-Zugang am unteren Bildschirmrand. Der Portal-Link ist ohne JavaScript erreichbar und führt vorerst zum gekennzeichneten Platzhalter.

Die bestätigte Adresse lautet `info@pani-hv.de`. Die Eingabefelder bereiten einen `mailto:`-Entwurf vor. Erst der Nutzer sendet die E-Mail in seinem E-Mail-Programm. Es gibt weder einen Formspree-Endpunkt noch einen automatischen Versand, eine Zustellbestätigung oder serverseitige Speicherung der Eingaben. Direkte E-Mail-Links funktionieren auch ohne JavaScript.

Ein direkter Formularversand benötigt später einen bestätigten Empfangsdienst. Dafür müssen Versand, Fehlermeldungen, Datenschutzbeschreibung und Tests gemeinsam angepasst werden. Zugangsdaten gehören niemals in die statischen HTML- oder JavaScript-Dateien.

## Prüfen

Die Kontaktlogik lässt sich ohne zusätzliche Pakete mit Node.js testen:

```sh
node --test tests/*.test.cjs
```

Zusätzlich vor Veröffentlichung: Seiten auf Desktop und Mobil prüfen, Sprachwechsel und Kontaktentwürfe ausprobieren. Offene Unternehmensangaben stehen in `PLATZHALTER.md`.

Für die Leistungsübersicht außerdem alle acht Detailziele je Sprache und den Rückweg über die Brotkrumennavigation prüfen. Die Übersicht und ihre Links funktionieren ohne JavaScript; nur das mobile Klappmenü wird durch `assets/site.js` erweitert.

## Sanierungsbeispiel

Das Modell verwendet frei gewählte Kennwerte innerhalb der [offiziellen Effizienzklassengrenzen in Anlage 10](https://www.gesetze-im-internet.de/geg/anlage_10.html), keine typischen oder garantierten Sanierungsergebnisse. Ausgangspunkt: F mit 180 kWh/(m²a), 100 m² Gebäudenutzfläche (nicht Wohnfläche), angenommene 0,13 €/kWh. Kosten werden auf zehn Euro gerundet. C ergibt 87 kWh/(m²a), rund 52 Prozent und 1.210 Euro rechnerische Ersparnis. H und G sind keine auswählbaren Sanierungsziele; F stellt den unveränderten Bestand dar. A+ ist enthalten.

Keine Energieberatung, Wirtschaftlichkeitsrechnung oder Einspargarantie. Investitionen, Förderungen, Nutzungsverhalten und Wetter fehlen im Modell. Eine proportionale CO₂-Abnahme setzt denselben Energieträger und Emissionsfaktor voraus. Deshalb wird die Prozentanzeige nur als Energie-Einsparung bezeichnet. Fachlicher Hintergrund: [Verbraucherzentrale zum Energieausweis](https://www.verbraucherzentrale.de/wissen/energie/energetische-sanierung/energieausweis-was-sagt-dieser-steckbrief-fuer-wohngebaeude-aus-24074).

## Bilder

Das neue Hauptbild ist eine Stadtansicht der Oderberger Straße, kein behauptetes Referenzobjekt. Quelle: [Franz Richter / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Oderberger_Stra%C3%9Fe_1941.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), vorhandener Ausschnitt als WebP konvertiert. Quellen und Lizenzen der weiteren Bilder bleiben auf den jeweiligen Unterseiten dokumentiert.
