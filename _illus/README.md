# Illustrationen des Anfrage-Fragebogens

Quelle der kleinen Karten-Illustrationen auf `anfrage.html` und `en-enquiry.html`.
Der Ordner beginnt mit einem Unterstrich und wird von GitHub Pages (Jekyll) nicht
veröffentlicht; er dient nur als Werkstatt.

- `kit.html`: SVG-Baukasten mit dem Haus der Startseite (Symbole `#hk-scene`,
  `#hk-building`, `#hk-shadow`, `#hk-trees`, `#hk-window`, `#hk-attic`),
  Farben über CSS-Variablen (`--hk-common`, `--hk-roof`, `--hk-single` usw.).
- `<schritt>.json`: je Schritt ein Objekt `{wert: "<inneres SVG-Markup>"}`,
  gezeichnet im Koordinatensystem des Hauses (760x590) und mit `scale(.135)`
  in die Karte (viewBox 0 0 120 80) gesetzt.
- `preview.html`: Vorschau aller Karten, z. B. `_illus/preview.html?step=lage&checked=mehrere`
  (lokaler Server im Website-Ordner nötig, z. B. `python -m http.server 8765`).
- `assemble.py`: setzt Baukasten und Motive in beide HTML-Dateien ein
  (`python _illus/assemble.py` im Website-Ordner, idempotent).

Nach Änderungen: `assemble.py` laufen lassen, `?v=` von `assets/enquiry.css`
nur anheben, wenn auch das CSS geändert wurde.
