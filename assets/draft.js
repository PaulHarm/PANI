// Gemeinsames Entwurfs-Modul fuer Kurzformular, Mieterformular und
// Fragebogen: sichere Vorauswahl aus ?type=, mailto-Entwurf mit festem
// Empfaenger, Kopier-Weg und Statustexte, die nur sagen, was die Seite wissen
// kann. Es wird nichts automatisch versendet. Beim Laden gibt es keinen
// DOM-Zugriff; show() arbeitet nur mit den uebergebenen Objekten.
(function (root) {
  "use strict";
  const RECIPIENT = "info@pani-hv.de";
  // Vorsichtige Obergrenze fuer die gesamte mailto-Adresse. Laengere Entwuerfe
  // gehen als Platzhalter an das E-Mail-Programm, der volle Text steht im
  // Kopierfeld.
  const MAX_HREF = 1900;

  // Vorauswahl im Fragebogen. Die Schluessel sind die erlaubten Werte von
  // ?type= und bleiben auch auf den englischen Seiten deutsch. Die Werte
  // nennen value-Attribute der Karten in anfrage.html und en-enquiry.html.
  const PRESETS = Object.freeze({
    weg: Object.freeze({ objekt: "weg" }),
    miethaus: Object.freeze({ objekt: "miethaus" }),
    wohnung: Object.freeze({ objekt: "wohnung" }),
    // Die Karte heisst "Mehrere Haeuser": Sie wird markiert, der Besucher
    // bestaetigt sie aber selbst (confirm), Schritt 1 bleibt sichtbar.
    zinshaus: Object.freeze({ objekt: "zinshaus", confirm: true }),
    sanierung: Object.freeze({ themen: Object.freeze(["sanierung"]) }),
    baubetreuung: Object.freeze({ themen: Object.freeze(["sanierung"]) }),
    reporting: Object.freeze({ themen: Object.freeze(["reporting"]) }),
    wechsel: Object.freeze({ situation: "wechsel" }),
  });

  // Keine Meldung behauptet, dass sich ein Programm geoeffnet hat: Das kann
  // die Seite nicht pruefen.
  const TEXT = Object.freeze({
    de: Object.freeze({
      ready: "Ihr Entwurf ist fertig. Es wurde noch nichts versendet.",
      tried:
        "Wir haben versucht, Ihr E-Mail-Programm mit dem Entwurf zu öffnen. Prüfen Sie den Text dort und senden Sie die E-Mail selbst ab.",
      tooLong:
        "Ihr Text ist für die automatische Übergabe an das E-Mail-Programm zu lang. Dort steht deshalb nur ein Platzhalter. Bitte kopieren Sie den Text unten und fügen Sie ihn in die E-Mail ein.",
      alt:
        "Es hat sich nichts geöffnet oder Sie nutzen Webmail? Kopieren Sie den Text und senden Sie ihn an info@pani-hv.de.",
      open: "E-Mail-Programm öffnen",
      copy: "Text kopieren",
      copied:
        "Text kopiert. Fügen Sie ihn in eine E-Mail an info@pani-hv.de ein.",
      copyFailed:
        "Kopieren war hier nicht möglich. Der Text unten ist markiert, bitte kopieren Sie ihn von Hand.",
      placeholder:
        "Bitte fügen Sie hier den kopierten Text von der PANI-Website ein.",
      subjectLabel: "Betreff",
      bodyLabel: "Text Ihrer Nachricht",
    }),
    en: Object.freeze({
      ready: "Your draft is ready. Nothing has been sent yet.",
      tried:
        "We have tried to open your email app with the draft. Check the text there and send the email yourself.",
      tooLong:
        "Your text is too long to hand over to the email app automatically, so the email only contains a placeholder. Please copy the text below and paste it into the email.",
      alt:
        "Nothing opened, or you use webmail? Copy the text and send it to info@pani-hv.de.",
      open: "Open email app",
      copy: "Copy text",
      copied: "Text copied. Paste it into an email to info@pani-hv.de.",
      copyFailed:
        "Copying was not possible here. The text below is selected, please copy it manually.",
      placeholder:
        "Please paste the text you copied from the PANI website here.",
      subjectLabel: "Subject",
      bodyLabel: "Text of your message",
    }),
  });
  const textFor = (lang) => (lang === "en" ? TEXT.en : TEXT.de);

  // Liest ?type= fehlerfest. Kaputte Kodierung ("%"), fremde Werte und Namen
  // aus Object.prototype ("constructor", "__proto__") ergeben null. Aus der
  // Adresse wird nie ein Selektor gebaut, nur ein Tabellenwert nachgeschlagen.
  function presetFor(search) {
    let raw = "";
    try {
      raw = new URLSearchParams(String(search || "")).get("type") || "";
    } catch (error) {
      raw = "";
    }
    const key = raw.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PRESETS, key)
      ? Object.freeze({ key, ...PRESETS[key] })
      : null;
  }

  // Eine einzelne Surrogat-Haelfte (etwa ein abgeschnittenes Emoji) wuerde
  // encodeURIComponent zum Abbruch bringen. Sie wird zum Ersatzzeichen U+FFFD.
  const wellFormed = (value) =>
    String(value == null ? "" : value).replace(/[\uD800-\uDFFF]/gu, "\uFFFD");
  const oneLine = (value) =>
    wellFormed(value)
      .replace(/\s*[\r\n]+\s*/g, " ")
      .trim();
  const lineFeeds = (value) => wellFormed(value).replace(/\r\n?/g, "\n");
  // Der Empfaenger ist fest. Betreff und Text werden vollstaendig kodiert,
  // Eingaben koennen deshalb weder Empfaenger noch Kopie hinzufuegen.
  // Zeilenumbrueche gehen als CRLF in die Adresse.
  const mailto = (subject, body) =>
    `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;

  // Baut den Entwurf. Passt er nicht in eine mailto-Adresse, enthaelt die
  // Adresse nur einen Platzhalter (complete: false); der volle Text bleibt in
  // body und steht im Kopierfeld.
  function compose({ subject, body, lang } = {}) {
    const cleanSubject = oneLine(subject);
    const cleanBody = lineFeeds(body);
    const href = mailto(cleanSubject, cleanBody);
    const complete = href.length <= MAX_HREF;
    return Object.freeze({
      href: complete ? href : mailto(cleanSubject, textFor(lang).placeholder),
      subject: cleanSubject,
      body: cleanBody,
      complete,
    });
  }

  // Kopiert ueber die Clipboard API. Lehnt sie ab oder fehlt sie (etwa ohne
  // HTTPS), greift der uebergebene Rueckfall. Liefert true oder false und
  // wirft nie.
  async function copyText(text, options) {
    const { clipboard, fallback } = options || {};
    try {
      if (clipboard && typeof clipboard.writeText === "function") {
        await clipboard.writeText(String(text));
        return true;
      }
    } catch (error) {
      // Zwischenablage abgelehnt: weiter mit dem Rueckfall.
    }
    try {
      return Boolean(typeof fallback === "function" && fallback());
    } catch (error) {
      return false;
    }
  }

  // Je Statusfeld genau ein Entwurfsfeld, auch nach mehrfachem Absenden.
  const panels = new WeakMap();

  // Entwurfsfeld nach Vertrag mit dem Stylesheet: div.draft-panel >
  // div.draft-actions (a.button, button.button.button-light) +
  // p.draft-subject + textarea.draft-text.
  function build({ doc, win, text, say }) {
    const create = (tag, className) => {
      const node = doc.createElement(tag);
      node.className = className;
      return node;
    };
    const view = {
      panel: create("div", "draft-panel"),
      open: create("a", "button"),
      copy: create("button", "button button-light"),
      subject: create("p", "draft-subject"),
      area: create("textarea", "draft-text"),
      draft: null,
    };
    view.open.textContent = text.open;
    view.copy.type = "button";
    view.copy.textContent = text.copy;
    view.area.readOnly = true;
    view.area.rows = 8;
    view.area.setAttribute("aria-label", text.bodyLabel);
    const select = () => {
      view.area.focus();
      view.area.select();
      try {
        view.area.setSelectionRange(0, view.area.value.length);
      } catch (error) {
        // select() genuegt, wo setSelectionRange fehlt.
      }
    };
    view.copy.addEventListener("click", () => {
      let clipboard = null;
      try {
        clipboard = win.navigator.clipboard;
      } catch (error) {
        clipboard = null;
      }
      copyText(view.draft.body, {
        clipboard,
        fallback: () => {
          select();
          const done = doc.execCommand("copy");
          if (done) view.copy.focus();
          return done;
        },
      }).then((copied) => {
        if (!copied) {
          // Der Text bleibt markiert, damit Strg+C oder das Kontextmenue
          // genuegt.
          try {
            select();
          } catch (error) {
            // Die Meldung nennt den Handweg auch ohne Markierung.
          }
        }
        say(copied ? text.copied : text.copyFailed);
      });
    });
    const actions = create("div", "draft-actions");
    actions.append(view.open, view.copy);
    view.panel.append(actions, view.subject, view.area);
    return view;
  }

  // Schreibt die Meldung in das vorhandene role="status", legt direkt
  // dahinter einmalig das Entwurfsfeld an und uebergibt den Entwurf erst
  // danach an das E-Mail-Programm. Ob sich dort etwas oeffnet, erfaehrt die
  // Seite nicht; deshalb bleiben Knopf und Kopier-Weg stehen.
  function show({ doc, win, status, draft, lang }) {
    const text = textFor(lang);
    const say = (...messages) =>
      status.replaceChildren(
        ...messages.map((message) => {
          const line = doc.createElement("p");
          line.textContent = message;
          return line;
        }),
      );
    let view = panels.get(status);
    if (!view) {
      view = build({ doc, win, text, say });
      status.after(view.panel);
      panels.set(status, view);
    }
    view.draft = draft;
    view.open.href = draft.href;
    view.subject.textContent = `${text.subjectLabel}: ${draft.subject}`;
    view.area.value = draft.body;
    say(text.ready, draft.complete ? text.tried : text.tooLong, text.alt);
    try {
      const reduced = win.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      view.panel.scrollIntoView({
        block: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
    } catch (error) {
      // Ohne Scrollen bleibt das Feld direkt unter dem Formular erreichbar.
    }
    try {
      win.location.href = draft.href;
    } catch (error) {
      // Der Knopf im Entwurfsfeld und der Kopier-Weg bleiben.
    }
    return view.panel;
  }

  const api = Object.freeze({
    PRESETS,
    TEXT,
    MAX_HREF,
    RECIPIENT,
    presetFor,
    compose,
    copyText,
    show,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PaniDraft = api;
})(globalThis);
