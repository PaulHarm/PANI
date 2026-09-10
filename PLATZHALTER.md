# 📋 Platzhalter-Liste (intern)

Diese Datei sammelt **alle Stellen mit Platzhaltern / Demo-Inhalten**, die vor dem echten Launch
durch reale Daten, Texte oder Bilder ersetzt werden müssen. Bewusst bewahrt, damit nichts vergessen wird.

> Zeilennummern sind ein Anhaltspunkt (verschieben sich beim Bearbeiten leicht). Stand: erste Erfassung.

---

## A. Kontaktdaten  ⚠️ auf ALLEN Seiten
Der Kontakt-/Footer-Block ist auf jeder Seite gleich. Vorkommen u. a.:
`index.html`, `en.html` und alle Unterseiten (`investoren`, `bestandshalter`, `zinshaus`,
`nachfolge`, `sondervermoegen`, `en-*`).

- [x] **Adresse:** `Westfälische Straße 62, 10709 Berlin` eingetragen (2026-09-10, Footer `index.html` + `en.html`). Noch offen: dieselbe Adresse ins Impressum (`impressum.html`/`en-imprint.html`) und in die Datenschutzerklärung übernehmen, sobald auch Rechtsform/Vertretung bekannt sind.
- [ ] **Telefon:** `(030) 00 00 00 00` (Link `tel:+4930000000`) → echte Nummer
- [ ] **Telefax:** `(030) 00 00 00 01` → echte Nummer (oder entfernen)
- [ ] **E-Mail:** `info@pani-pm.de` → echte Adresse
      ⚠️ **Domain-Widerspruch:** Website läuft auf **pani-hv.de** (CNAME), E-Mail nutzt **pani-pm.de** — klären, welche stimmt.

## B. Rechtstexte  ⚠️ Pflicht vor Launch
**`impressum.html`**
- [ ] `[Rechtsform eintragen, z. B. GmbH]`
- [ ] `[Straße Hausnummer]`, Vertretung/Funktion
- [ ] `Registergericht: [Amtsgericht]`, `Registernummer: [HRB …]`, USt-IdNr.
- [ ] `§ 34c GewO: [zuständiges Bezirksamt]`, Berufshaftpflicht `[Versicherer, Geltungsraum]`
- [ ] Verantwortlich n. § 18 MStV: `[Name, Anschrift]`

**`datenschutz.html`**
- [ ] Verantwortlicher: `PANI Hausverwaltung [Rechtsform], [Anschrift]`
- [ ] `[Hosting-Anbieter eintragen]`

## C. Bilder / echte Identität  🖼️  („echte Identität klar mit Bildern")
- [x] **Paul Harm:** echtes Porträtfoto eingebaut (`assets/paul-harm.jpg`, 2026-09-10)
- [ ] **Niclas Paprocki:** noch Initiale „**NP**" → echtes Porträtfoto
- [x] **Hero-Gebäudebild:** ersetzt durch eigenes Foto (`assets/berlin-cityscape.jpg`, Breitscheidplatz/City West, 2026-09-10) — kein Fremdfoto mehr, keine Attribution nötig. Gilt für `index.html` + `en.html`.
- [ ] **Sanierungs-Bild:** Unsplash-Stockfoto (`images.unsplash.com/...`) → **eigenes** Foto
- [ ] gilt jeweils auch in `en.html`

## D. Beispiel-/Demo-Werte  📊  (bewusst illustrativ — später prüfen)
- [ ] **Energie-Rechner:** „Beispielwerte" (87 kWh/m²a, −52 %, ≈ 1.210 €/Jahr; `PRICE_PER_KWH = 0.13`)
- [ ] **Reporting-Grafik:** Demo-Zahlen (Portfolio € 124.500 / +4,2 %, Leerstand 1,2 %, Rücklagen € 82k)
- [ ] **Bildunterschriften:** „Berliner Bestand · Beispielobjekt", „Beispielreport anfordern"

---

## Notizen / Entscheidungen
- Investmentbanking-Bezug: **nur** im Gründer-/Über-uns-Teil (bei Niclas) — nicht in Hero/Prinzipien.
- Kontaktdaten & Rechtstexte: **erstmal Platzhalter belassen**, später gesammelt ersetzen.
