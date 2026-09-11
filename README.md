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
- `mieter.html` und `en-tenants.html`: Mieterservice mit eigenem Anliegen und Objektadresse.
- `assets/site.css` und `assets/site.js`: gemeinsame Gestaltung und Interaktionen der neuen Seiten.
- `assets/legacy.css`: gemeinsame Schriftdateien und gestalterische Angleichung der bestehenden Unterseiten.
- `assets/architecture.svg`: vereinfachte Architekturillustrationen aus dem bestehenden Motivsystem.
- `assets/icons.svg`: ausgewählte Lucide-Icons und die bestehende PANI-Bildmarke; Lizenz in `assets/Lucide-LICENSE.txt`.
- `assets/fonts/`: lokal bereitgestellte Fraunces- und IBM-Plex-Schriften mit Lizenzdateien.

## Kontakt

Die bestätigte Adresse lautet `info@pani-hv.de`. Die Eingabefelder bereiten einen `mailto:`-Entwurf vor. Erst der Nutzer sendet die E-Mail in seinem E-Mail-Programm. Es gibt weder einen Formspree-Endpunkt noch einen automatischen Versand, eine Zustellbestätigung oder serverseitige Speicherung der Eingaben. Direkte E-Mail-Links funktionieren auch ohne JavaScript.

Ein direkter Formularversand benötigt später einen bestätigten Empfangsdienst. Dafür müssen Versand, Fehlermeldungen, Datenschutzbeschreibung und Tests gemeinsam angepasst werden. Zugangsdaten gehören niemals in die statischen HTML- oder JavaScript-Dateien.

## Prüfen

Die Kontaktlogik lässt sich ohne zusätzliche Pakete mit Node.js testen:

```sh
node --test tests/contact.test.cjs
```

Zusätzlich vor Veröffentlichung: Seiten auf Desktop und Mobil prüfen, Sprachwechsel und Kontaktentwürfe ausprobieren. Offene Unternehmensangaben stehen in `PLATZHALTER.md`.

## Bilder

Das neue Hauptbild ist eine Stadtansicht der Oderberger Straße, kein behauptetes Referenzobjekt. Quelle: [Franz Richter / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Oderberger_Stra%C3%9Fe_1941.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), vorhandener Ausschnitt als WebP konvertiert. Quellen und Lizenzen der weiteren Bilder bleiben auf den jeweiligen Unterseiten dokumentiert.
