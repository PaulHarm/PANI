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

## 3. Technischer Datenschutz (DSGVO)  — 🔴/🟡
- [ ] 🔴 **Google Fonts lokal einbinden** statt von `fonts.googleapis.com`/`fonts.gstatic.com` (14 Dateien betroffen).
      Externe Einbindung überträgt Besucher-**IP an Google (USA)** → in DE abgemahnt (LG München I, 20.01.2022). Lokal = Problem gelöst.
- [ ] 🔴 **Externe Bilder lokal einbinden** (Unsplash + 3× Wikimedia) — sonst IP-Übertragung an Dritte.
- [ ] 🟡 **HTTPS erzwingen**: In GitHub → Settings → Pages → „Enforce HTTPS" aktivieren (GitHub Pages liefert Zertifikat mit).
- [ ] 🟡 **Hosting GitHub Pages (USA)**: IP-Logging + US-Datentransfer. Kein klassischer AV-Vertrag verfügbar.
      Erwägen: **EU-Hosting** für maximale Rechtssicherheit — mind. in Datenschutzerklärung transparent machen.

## 4. Urheber- & Bildrechte  — 🟡
- [ ] **Wikimedia-Fotos = CC BY-SA 4.0**: erfordern **korrekte Namensnennung + Lizenzlink + Share-Alike**. Heikel → besser **eigene Fotos**.
- [ ] **Unsplash-Bild**: Unsplash-Lizenz (kommerziell meist ok, keine Attribution nötig) — trotzdem besser eigenes Foto.
- [ ] **Schriftarten** (Fraunces, IBM Plex): Open Font License, kommerziell ok — beim Selbst-Hosten Lizenzdatei beilegen.

## 5. Weitere Punkte  — 🟡/🟢
- [ ] 🟡 **E-Mail-Domain klären**: Impressum nutzt `info@pani-pm.de`, Website läuft auf `pani-hv.de` — muss zusammenpassen und erreichbar sein.
- [ ] 🟡 **Kontaktformular** (eingebaut auf der Startseite): nutzt **Formspree (USA)**. Einwilligungs-Checkbox + Spam-Schutz (Honeypot) sind vorhanden, Datenschutz-Abschnitt 3 ergänzt. **Vor Livegang:** (1) echte **Formspree-Formular-ID** in `index.html` eintragen (Platzhalter `DEINE_FORMSPREE_ID`), (2) **AV-Vertrag** mit Formspree + **Drittland-Transfer (SCC)** klären — oder EU-Dienst wählen.
- [ ] 🟢 **Barrierefreiheit (BFSG, seit 28.06.2025)**: greift für bestimmte B2C-Dienste im E-Commerce.
      Reine Marketing-Seite evtl. ausgenommen (v. a. Kleinstunternehmen), **sobald Verbraucher-Portal/Online-Abschluss → prüfen lassen**.
      Best Practice ohnehin: Alt-Texte, Kontraste, Tastaturbedienbarkeit.
- [ ] 🟢 **Cookie-Banner**: nur nötig bei nicht-essenziellen Cookies/Tracking — aktuell keins → voraussichtlich **nicht erforderlich**.

---

## Reihenfolge-Empfehlung vor dem Live-Gang
1. 🔴 Impressum + Datenschutz mit **echten Daten** füllen (braucht Firmenangaben; idealerweise anwaltlich/DSB geprüft).
2. 🔴 **Google Fonts + externe Bilder lokal** einbinden (technisch, kann Claude umsetzen).
3. 🟡 „Enforce HTTPS" aktivieren, E-Mail-Domain klären, eigene Fotos.
4. 🟢 BFSG-Relevanz prüfen, ggf. Kontaktformular datenschutzkonform.
