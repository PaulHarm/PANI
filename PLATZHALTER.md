# Offene Angaben und Veröffentlichungsstand

Stand: Verbesserungsrunde vom 11. November 2026 (Team, Anfragewege, Technik). Davor: Website-Überarbeitung vom 14. und 15. September 2026.

## Noch vom Inhaber zu ergänzen

- **Musternummern.** Alle Telefonnummern auf der Website sind Platzhalter und vor einer echten Bewerbung durch die richtigen Nummern zu ersetzen:
  - `030 23125 100` (Telefon, Abschnitt „Vor Ort"): `ueber-uns.html`, `en-about.html`.
  - `030 23125 199` (Notfallnummer): `ueber-uns.html`, `en-about.html`, `mieter.html`, `en-tenants.html`.
  - `030 23125 150` (Anfragen): `index.html`, `en.html`, `wechsel.html`, `en-switch.html`, `anfrage.html`, `en-enquiry.html`, `hausverwaltung-verkaufen.html`, `en-sell-your-company.html`.
- **Öffnungszeiten** im Abschnitt „Vor Ort" (Mo bis Fr 09:00 bis 18:00 Uhr, Sa 10:00 bis 14:00 Uhr nach Absprache, So geschlossen) sind Musterzeiten und zu bestätigen.
- **Team:** Die Angaben zu Stefan Krüger (Immobilienökonom, Baubetreuung und energetische Sanierung) und Beate Frisow (Betreuung der Hausverwaltung) sind bewusst knapp gehalten. Weitere Angaben nur auf ausdrücklichen Wunsch ergänzen.
- Rechtsform und tatsächliche Vertretungsangaben.
- Zutreffende Register-, Steuer-, Erlaubnis- und Versicherungsangaben für Impressum und englische Fassung.
- Endgültige Prüfung und Vervollständigung der Rechtstexte. Die verbleibenden Platzhalter sind ausdrücklich sichtbar.
- **Datenschutzerklärung:** Sie nennt bisher nur die Formulare auf der Startseite und im Mieterservice, nicht den Fragebogen und nicht den Kopier-Weg für den E-Mail-Entwurf. Beim nächsten Durchgang der Rechtstexte ergänzen.
- **Bildnachweis Oderberger Straße** (Vorschaubild für geteilte Links): steht sichtbar nur im Footer der Zinshaus-Seiten. Der dauerhafte Ort wäre das Impressum.
- Gründungsjahr, sofern es auf der Über-uns-Seite erscheinen soll. Weitere, unbestätigte Zahlen und Versicherungsangaben bleiben bewusst weg.

## Optionale nächste Schritte

- Paket „Vertrauen und Belege": „über 500 Einheiten" und das IHK-Siegel auf den Leistungsseiten, Kontaktdaten im Footer, Fragen und Antworten auf WEG, Miethaus und Sondereigentum. Im November 2026 bewusst zurückgestellt.
- Empfangsdienst für einen Versand direkt von der Website einrichten, falls der E-Mail-Entwurf ersetzt werden soll.
- Tatsächliche Portal-, Archiv- und Serviceangebote auf allen Detailseiten mit dem Betriebsmodell abgleichen.
- Stadtansichten durch eigene, für diese Nutzung freigegebene Wohnimmobilienfotos ersetzen.
- `refined-pages.css` und `pages.css` zusammenführen; automatische Tests bei jedem Push.
- Die entfernten Gründerfotos stehen weiterhin in der Git-Historie des öffentlichen Repositorys. Vollständiges Entfernen bräuchte ein Umschreiben der Historie.

## Erledigt im November 2026

- Gründerfotos von der Über-uns-Seite entfernt, Bilddateien gelöscht. Der Block zeigt jetzt vier Personen ohne Bild: zwei Gründer, zwei Teammitglieder. Ein Test verhindert, dass die Fotos zurückkommen.
- Stefan Krüger steht auf Baubetreuung und Energetischer Sanierung als Verantwortlicher, mit Verweis auf das Team.
- Vom Inhaber am 11.11.2026 bestätigt: die Schreibweise „Stefan Krüger" und die Reihenfolge im Notfallhinweis für Mieter (zuerst die Notfallkontakte des Hauses, außerhalb der Öffnungszeiten zusätzlich die Notfallnummer).
- HTTPS wird seit dem 11.11.2026 erzwungen (GitHub Pages, „Enforce HTTPS").
- Zinshaus, Investoren und Bestandshalter zu einer Seite gebündelt. Die vier alten Adressen leiten auf den passenden Abschnitt weiter und stehen nicht mehr in der Sitemap.
- Menü: „Hausverwaltung verkaufen" statt „Unternehmensnachfolge", „Energetische Sanierung" statt „Sanierungsbegleitung". Die Eigentümerseite heißt weiter „Nachfolge".
- Ein Anfrageweg: Alle Knöpfe im Inhalt heißen „Betreuung anfragen" und führen zum Fragebogen, wo sinnvoll mit Vorauswahl. Das Kurzformular der Startseite bleibt.
- E-Mail-Entwurf ehrlich beschrieben, mit angezeigtem Text und „Text kopieren". Zwei Fehler bei kaputten Adressparametern behoben.
- Leistungsübersicht zeigt wieder die drei Verwaltungsarten und endet mit einem Anfrage-Knopf.
- Texte: der achtfach gleiche Gründer-Absatz und der siebenfach gleiche Schlussabsatz sind seitenbezogen ersetzt; einheitliche Begriffe (siehe README, Abschnitt „Begriffe"); ein Störungshinweis statt zwei widersprüchlicher im Mieterservice; Musterreport mit „Mieteinnahmen p. a." statt „Portfolio Rendite"; Wechsel-Fragen wiederholen die Schritte nicht mehr.
- Technik: Menü, Kopfzeilen und Versionen werden erzeugt (`python _tools/build.py`); die Helfer liegen in `_tools/`. Ungenutzte Bilder und rund 12 KB toter CSS-Code entfernt, Fotos der Leistungsübersicht als WebP, kleines IHK-Siegel. `_config.yml` hält interne Dateien von der Website fern. Brotkrumen-Daten und `lastmod` für Suchmaschinen. Titel und Descriptions in sinnvoller Länge.
- Neue Tests für Entwurf, Fragebogen und den gesamten Seitenbestand (`tests/site.test.cjs`).

## Erledigt im September 2026

- Kontaktadresse vom Inhaber bestätigt: `info@pani-hv.de`, in allen HTML-Seiten aktualisiert.
- Vorhandene Anschrift übernommen: Westfälische Straße 62, 10709 Berlin.
- Formspree-Platzhalter entfernt. Kontakt und Mieterservice bereiten transparent einen E-Mail-Entwurf vor; kein automatischer Versand.
- Deutsche und englische Startseite gestrafft; drei Verwaltungsarten als Haupteinstieg.
- Eigentümerbericht deutlich als Muster gekennzeichnet. Sanierungsrechner, wechselnde Kennzahlen und App-Mockup von den Startseiten entfernt.
- Bilder, Icons und Schriftdateien werden lokal ausgeliefert. Quellen und Lizenzen bleiben dokumentiert.
- IHK-Siegel dezent im Footer der Startseiten und der Über-uns-Seiten, auf Wunsch ohne Personenname. Neutraler Hinweis „IHK-Zertifizierung nach § 26a WEG"; die bestätigte Zertifizierung lautet auf Niclas Paprocki, nicht auf beide Gründer.
- Energetische Sanierung, Reporting und der Portal-Ausblick auf eigene Seiten verlagert. Das Mieterportal ist ausdrücklich als noch nicht verfügbar gekennzeichnet.
- Grüner Kontakt-Button in der Kopfzeile auf allen Seiten. Mieterservice-Zugang mobil als feste Leiste, ab 801 px als schwebende Pille rechts unten.
- Eigene Über-uns-Seite und eigene Wechselseite in beiden Sprachen. Die Fragen zu Einstieg und Übernahme stehen auf der Wechselseite, ohne feste Preis- oder Zeitversprechen.
- Bestandsangaben „Häuser in ganz Berlin" und „über 500 Einheiten" vom Inhaber am 15.09.2026 bestätigt.
- Fragebogen mit Illustrationen, Seite Baubetreuung, Seite zum Verkauf einer Hausverwaltung, Leistungen-Menü (24.09.2026).
