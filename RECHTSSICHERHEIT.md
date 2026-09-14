# ⚖️ Rechtssicherheit (Deutschland) — Anforderungen & To-dos

> **Kein Ersatz für Rechtsberatung.** Diese Liste ist eine fachliche Orientierung/Checkliste.
> Für Verbindlichkeit einen **Anwalt / Datenschutzbeauftragten** hinzuziehen — besonders bei
> Impressum-Pflichtangaben (§ 34c GewO) und Datenschutzerklärung.

Stand der Website: statisch (HTML), gehostet auf **GitHub Pages**, Domain **www.pani-hv.de**.
**Kein Tracking/Analytics/Cookies gefunden** → voraussichtlich **kein Cookie-Consent-Banner nötig** (vor Launch bestätigen).

---

## 1. Impressumspflicht  (§ 5 DDG, § 18 Abs. 2 MStV)  — 🔴 Blocker
Pflichtangaben, aktuell alle **Platzhalter** in `impressum.html`:
- [ ] Firmenname + **Rechtsform** (z. B. GmbH) + **Vertretungsberechtigte** (Geschäftsführung)
- [ ] **Ladungsfähige Anschrift** (echte Adresse, kein Postfach)
- [ ] **Schnelle Kontaktaufnahme**: Telefon **und** E-Mail
- [ ] **Registergericht + Registernummer** (HRB) — bei GmbH/UG
- [ ] **USt-IdNr.** (§ 27a UStG), falls vorhanden
- [ ] **Erlaubnis nach § 34c GewO + Aufsichtsbehörde** (zuständiges Bezirks-/Gewerbeamt)
      ⚠️ **Pflicht für Haus-/WEG-Verwalter** (§ 34c Abs. 1 GewO)
- [ ] **Berufshaftpflichtversicherung** (Versicherer + räumlicher Geltungsbereich)
      ⚠️ für WEG-Verwalter Pflicht (§ 19 WEG i. V. m. MaBV)
- [ ] **Verantwortlicher n. § 18 Abs. 2 MStV** (Name + Anschrift)

## 2. Datenschutzerklärung  (DSGVO Art. 13, § 25 TDDDG)  — 🔴 Blocker
Aktuell **Platzhalter** in `datenschutz.html`:
- [ ] **Verantwortlicher** (Name, Anschrift, Kontakt)
- [ ] **Datenschutzbeauftragter** — nur falls Pflicht (i. d. R. ab 20 Personen o. bestimmte Verarbeitung); sonst weglassen. Prüfen.
- [ ] **Hosting / Server-Logfiles**: Hosting-Anbieter nennen; Verarbeitung von IP-Adressen, Rechtsgrundlage (Art. 6 Abs. 1 lit. f), Speicherdauer
- [ ] **Kontaktaufnahme** (E-Mail/Formular): Zweck, Rechtsgrundlage, Löschfristen
- [ ] **Betroffenenrechte** (Auskunft, Berichtigung, Löschung, Beschwerde bei Aufsichtsbehörde …)
- [ ] Ggf. **eingebundene Dienste** aufführen (siehe Punkt 3)

## 3. Technischer Datenschutz (DSGVO)  — 🟡
- [x] **Schriften lokal eingebunden** (`assets/fonts/`, Fraunces und IBM Plex mit OFL-Lizenzdateien). Erledigt September 2026.
- [x] **Bilder lokal eingebunden** (`assets/`, Quellen und Lizenzen auf den Unterseiten dokumentiert). Erledigt September 2026.
- [ ] 🟡 **HTTPS erzwingen**: In GitHub → Settings → Pages → „Enforce HTTPS" aktivieren. Stand 14.09.2026 noch nicht aktiv, http:// liefert die Seite unverschlüsselt aus.
- [ ] 🟡 **Hosting GitHub Pages (USA)**: IP-Logging + US-Datentransfer. Kein klassischer AV-Vertrag verfügbar.
      Erwägen: **EU-Hosting** für maximale Rechtssicherheit — mind. in Datenschutzerklärung transparent machen.

## 4. Urheber- & Bildrechte  — 🟡
- [ ] **Wikimedia-Fotos = CC BY-SA 4.0**: erfordern **korrekte Namensnennung + Lizenzlink + Share-Alike**. Heikel → besser **eigene Fotos**.
- [ ] **Unsplash-Bild**: Unsplash-Lizenz (kommerziell meist ok, keine Attribution nötig) — trotzdem besser eigenes Foto.
- [ ] **Schriftarten** (Fraunces, IBM Plex): Open Font License, kommerziell ok — beim Selbst-Hosten Lizenzdatei beilegen.

## 5. Weitere Punkte  — 🟡/🟢
- [x] **E-Mail-Domain**: einheitlich `info@pani-hv.de` auf allen Seiten. Erledigt September 2026.
- [x] **Kontaktformular**: Formspree entfernt. Das Formular bereitet nur einen `mailto:`-Entwurf vor, kein Drittanbieter-Versand, keine serverseitige Speicherung. Falls später ein Versanddienst eingebaut wird: AV-Vertrag und Drittlandtransfer prüfen, Datenschutzerklärung anpassen.
- [ ] 🟢 **Barrierefreiheit (BFSG, seit 28.06.2025)**: greift für bestimmte B2C-Dienste im E-Commerce.
      Reine Marketing-Seite evtl. ausgenommen (v. a. Kleinstunternehmen), **sobald Verbraucher-Portal/Online-Abschluss → prüfen lassen**.
      Best Practice ohnehin: Alt-Texte, Kontraste, Tastaturbedienbarkeit.
- [ ] 🟢 **Cookie-Banner**: nur nötig bei nicht-essenziellen Cookies/Tracking — aktuell keins → voraussichtlich **nicht erforderlich**.

---

## Reihenfolge-Empfehlung (Stand 14.09.2026, Seite ist bereits live)
1. 🔴 Impressum + Datenschutz mit **echten Daten** füllen (braucht Firmenangaben; idealerweise anwaltlich/DSB geprüft). Die Platzhalter sind aktuell öffentlich sichtbar.
2. 🟡 „Enforce HTTPS" in den GitHub-Pages-Einstellungen aktivieren.
3. 🟡 Wikimedia-Bilder (CC BY-SA) mittelfristig durch eigene, freigegebene Fotos ersetzen.
4. 🟢 BFSG-Relevanz prüfen, sobald ein Mieterportal mit Login kommt.
