const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const draft = require("../assets/draft.js");
const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const draftSource = read("../assets/draft.js");
const siteSource = read("../assets/site.js");
const source = read("../assets/enquiry.js");
const pages = {
  de: read("../anfrage.html"),
  en: read("../en-enquiry.html"),
};

// name und value der Karten sind ein Vertrag: _illus/assemble.py findet die
// Karten darueber, die Vorauswahl in draft.js nennt sie.
const CARDS = {
  objekt: ["weg", "miethaus", "wohnung", "zinshaus", "offen"],
  groesse: ["bis-10", "11-30", "31-80", "ueber-80", "unbekannt"],
  rolle: ["eigentuemer", "beirat", "vertreter", "andere"],
  situation: ["wechsel", "selbst", "neu", "gekuendigt", "sonstiges"],
  themen: ["sanierung", "abrechnung", "vermietung", "reporting", "keine"],
  lage: ["berlin-ring", "berlin-aussen", "mehrere", "ausserhalb"],
};

// ---------------------------------------------------------------------------
// Kleines Ersatz-DOM. Es wird aus dem echten Formular der Seite aufgebaut und
// kann nur, was enquiry.js und draft.js benutzen. Selektoren: Tag, .klasse,
// [attribut], [attribut="wert"], :checked und Kommalisten.
// ---------------------------------------------------------------------------
const decode = (text) =>
  text.replace(
    /&(amp|lt|gt|quot|nbsp);/g,
    (match, name) =>
      ({ amp: "&", lt: "<", gt: ">", quot: '"', nbsp: "\u00a0" })[name],
  );

function compile(selector) {
  return selector.split(",").map((part) => {
    const text = part.trim();
    const tokens =
      text.match(
        /^[a-z][a-z0-9]*|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]|:checked/gi,
      ) || [];
    assert.equal(tokens.join(""), text, `unsupported selector: ${selector}`);
    return tokens.map((token) => {
      if (token === ":checked") return (node) => node.checked === true;
      if (token.startsWith(".")) {
        const name = token.slice(1);
        return (node) => node.classList.contains(name);
      }
      if (token.startsWith("[")) {
        const [, name, , value] = /^\[([\w-]+)(="([^"]*)")?\]$/.exec(token);
        return (node) =>
          name in node.attrs &&
          (value === undefined || node.attrs[name] === value);
      }
      return (node) => node.tagName === token.toLowerCase();
    });
  });
}

class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = String(text);
    this.parent = null;
  }
}

class FakeElement {
  constructor(tag, attrs, page) {
    this.nodeType = 1;
    this.tagName = tag;
    this.attrs = { ...attrs };
    this.page = page;
    this.parent = null;
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.disabled = false;
    this.name = this.attrs.name ?? "";
    this.value = this.attrs.value ?? "";
    this.type = this.attrs.type ?? (tag === "input" ? "text" : "");
    this.dataset = {};
    for (const [name, value] of Object.entries(this.attrs)) {
      if (!name.startsWith("data-")) continue;
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
      this.dataset[key] = value;
    }
    const names = new Set(
      (this.attrs.class || "").split(/\s+/).filter(Boolean),
    );
    this.classList = {
      add: (name) => names.add(name),
      remove: (name) => names.delete(name),
      contains: (name) => names.has(name),
      toggle: (name, force) => (force ? names.add(name) : names.delete(name)),
      set: (value) => {
        names.clear();
        for (const name of String(value).split(/\s+/).filter(Boolean))
          names.add(name);
      },
      list: () => [...names],
    };
  }
  get className() {
    return this.classList.list().join(" ");
  }
  set className(value) {
    this.classList.set(value);
  }
  get hidden() {
    return "hidden" in this.attrs;
  }
  set hidden(value) {
    if (value) this.attrs.hidden = "";
    else delete this.attrs.hidden;
  }
  get textContent() {
    return this.children.map((child) => child.textContent).join("");
  }
  set textContent(value) {
    this.replaceChildren(new FakeText(value));
  }
  get firstChild() {
    return this.children[0] || null;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  after(node) {
    const siblings = this.parent.children;
    siblings.splice(siblings.indexOf(this) + 1, 0, node);
    node.parent = this.parent;
  }
  remove() {
    const siblings = this.parent.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parent = null;
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }
  getAttribute(name) {
    return name in this.attrs ? this.attrs[name] : null;
  }
  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }
  dispatchEvent(event) {
    event.target = this;
    for (let node = this; node; node = node.parent)
      for (const handler of node.listeners[event.type] || []) handler(event);
    return true;
  }
  matches(selector) {
    return compile(selector).some((tests) =>
      tests.every((check) => check(this)),
    );
  }
  closest(selector) {
    for (let node = this; node; node = node.parent)
      if (node.nodeType === 1 && node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.nodeType !== 1) continue;
        if (child.matches(selector)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  focus() {
    this.page.activeElement = this;
  }
  select() {}
  scrollIntoView() {}
  getBoundingClientRect() {
    return { top: 0 };
  }
  checkValidity() {
    const value = String(this.value).trim();
    if ("required" in this.attrs && !value) return false;
    if (this.type === "email" && value && !/^[^@\s]+@[^@\s]+$/.test(value))
      return false;
    return true;
  }
  reportValidity() {
    const valid = this.checkValidity();
    if (!valid) this.page.reported.push(this.attrs.name);
    return valid;
  }
}

class FakeInput extends FakeElement {
  get checked() {
    return this.isChecked === true;
  }
  set checked(value) {
    if (value && this.type === "radio") {
      let root = this;
      while (root.parent) root = root.parent;
      for (const other of root.querySelectorAll(
        `input[name="${this.attrs.name}"]`,
      ))
        other.isChecked = false;
    }
    this.isChecked = Boolean(value);
  }
}

function parse(html, page) {
  const make = (tag, attrs) =>
    tag === "input"
      ? new FakeInput(tag, attrs, page)
      : new FakeElement(tag, attrs, page);
  const root = make("main", {});
  const stack = [root];
  const cleaned = html
    .replace(/<svg[\s\S]*?<\/svg>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const token = /<\/([a-z0-9]+)\s*>|<([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  for (const [, close, open, rawAttrs, text] of cleaned.matchAll(token)) {
    const top = stack[stack.length - 1];
    if (close) {
      assert.equal(top.tagName, close.toLowerCase(), "unbalanced markup");
      stack.pop();
    } else if (open) {
      const attrs = {};
      for (const [, name, , value] of rawAttrs.matchAll(
        /([^\s=\/"]+)(="([^"]*)")?/g,
      ))
        attrs[name.toLowerCase()] = decode(value ?? "");
      const node = make(open.toLowerCase(), attrs);
      top.append(node);
      if (node.tagName !== "input" && !rawAttrs.trim().endsWith("/"))
        stack.push(node);
    } else if (text.trim()) {
      top.append(new FakeText(decode(text)));
    }
  }
  assert.equal(stack.length, 1, "unclosed markup");
  return { root, make };
}

function open(lang, options = {}) {
  const {
    search = "",
    reduced = true,
    withDraft = true,
    clipboard,
    sabotage,
  } = options;
  const html = pages[lang];
  const formHtml = /<form class="enquiry"[\s\S]*?<\/form>/.exec(html)[0];
  const page = { activeElement: null, reported: [], scrolled: [] };
  const { root, make } = parse(formHtml, page);
  const form = root.querySelector("form");
  if (sabotage) sabotage(form);
  const timers = new Map();
  let timerId = 0;
  const document = {
    documentElement: { lang: /<html lang="([a-z]+)"/.exec(html)[1] },
    body: { classList: { contains: () => false } },
    createElement: (tag) => make(tag, {}),
    createTextNode: (text) => new FakeText(text),
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
    addEventListener: () => {},
    execCommand: () => false,
  };
  class FormData {
    constructor(target) {
      this.target = target;
    }
    get(key) {
      for (const field of this.target.querySelectorAll(`[name="${key}"]`)) {
        const fieldset = field.closest("fieldset");
        if (fieldset && fieldset.disabled) continue;
        if (["radio", "checkbox"].includes(field.type) && !field.checked)
          continue;
        return field.value;
      }
      return null;
    }
  }
  class Event {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  }
  const window = {
    document,
    FormData,
    Event,
    HTMLInputElement: FakeInput,
    URLSearchParams,
    location: { href: "", search },
    navigator: { clipboard },
    scrollY: 0,
    scrollTo: (target) => page.scrolled.push(target),
    matchMedia: () => ({ matches: reduced, addEventListener: () => {} }),
    setTimeout: (handler) => {
      timers.set(++timerId, handler);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  window.window = window;
  const context = vm.createContext(window);
  // Reihenfolge wie im Kopf der Seite: draft.js, site.js, enquiry.js.
  if (withDraft) vm.runInContext(draftSource, context);
  vm.runInContext(siteSource, context);
  vm.runInContext(source, context);

  const one = (selector) => form.querySelector(selector);
  const input = (name, value) =>
    one(`input[name="${name}"][value="${value}"]`);
  const runTimers = () => {
    for (const [id, handler] of [...timers]) {
      timers.delete(id);
      handler();
    }
  };
  const activeSteps = () =>
    form
      .querySelectorAll("[data-step]")
      .filter((step) => step.classList.contains("is-active"));
  const app = {
    form,
    page,
    window,
    input,
    steps: () => activeSteps().map((step) => step.dataset.step),
    step: () => activeSteps()[0].dataset.step,
    progress: () => one("[data-progress-text]").textContent,
    preset: () =>
      one("[data-preset]").hidden ? null : one("[data-preset]").textContent,
    nextLabel: () => one("[data-next]").textContent,
    error: () => {
      const node = activeSteps()[0].querySelector("[data-error]");
      return node.hidden ? null : node.textContent;
    },
    checked: (name) =>
      form
        .querySelectorAll(`input[name="${name}"]:checked`)
        .map((node) => node.value),
    // Mausklick oder Tipp auf eine Karte; bei Einfachauswahl geht es danach
    // von selbst weiter.
    pick(name, value) {
      const target = input(name, value);
      target.dispatchEvent(new Event("pointerdown"));
      target.checked = target.type === "radio" ? true : !target.checked;
      target.dispatchEvent(new Event("change"));
      runTimers();
    },
    // Auswahl per Tastatur: kein Zeigerereignis, also kein Weiterspringen.
    choose(name, value) {
      const target = input(name, value);
      target.checked = target.type === "radio" ? true : !target.checked;
      target.dispatchEvent(new Event("change"));
      runTimers();
    },
    enter(name, value) {
      const event = new Event("keydown", { key: "Enter" });
      input(name, value).dispatchEvent(event);
      runTimers();
      return event;
    },
    next: () => one("[data-next]").dispatchEvent(new Event("click")),
    back: () => one("[data-back]").dispatchEvent(new Event("click")),
    click: (node) => node.dispatchEvent(new Event("click")),
    presetButton: () => one("[data-preset]").querySelector("button"),
    summary() {
      const rows = one("[data-summary]").querySelector("dl").children;
      const result = [];
      for (let i = 0; i < rows.length; i += 2) {
        const [answer, change] = rows[i + 1].children;
        result.push({
          label: rows[i].textContent,
          answer: answer.textContent,
          change,
        });
      }
      return result;
    },
    fill(values) {
      for (const [name, value] of Object.entries(values))
        one(`[name="${name}"]`).value = value;
    },
    submit() {
      const event = new Event("submit");
      form.dispatchEvent(event);
      return event;
    },
    status: () =>
      one('[role="status"]').children.map((node) => node.textContent),
    panel() {
      const panel = one(".draft-panel");
      if (!panel) return null;
      return {
        panel,
        open: panel.querySelector("a"),
        copy: panel.querySelector("button"),
        subject: panel.querySelector(".draft-subject"),
        area: panel.querySelector("textarea"),
      };
    },
    mail() {
      const uri = new URL(window.location.href);
      return {
        to: uri.pathname,
        subject: uri.searchParams.get("subject"),
        body: uri.searchParams.get("body"),
      };
    },
  };
  return app;
}

// Klickt einen vollstaendigen Weg bis zum Kontaktschritt durch.
function walk(app, answers) {
  for (const [name, value] of answers) {
    if (name === "themen") {
      for (const topic of value) app.pick("themen", topic);
      app.next();
    } else {
      app.pick(name, value);
    }
  }
}

// ---------------------------------------------------------------------------
// Seiten
// ---------------------------------------------------------------------------
test("both questionnaires keep the card names and values the scripts rely on", () => {
  for (const lang of ["de", "en"]) {
    const found = {};
    for (const [, name, value] of pages[lang].matchAll(
      /<input type="(?:radio|checkbox)" name="([a-z]+)" value="([a-z0-9-]+)"/g,
    ))
      (found[name] ||= []).push(value);
    assert.deepEqual(found, CARDS, lang);
  }
});

test("every preset names a card that exists in both questionnaires", () => {
  for (const [key, preset] of Object.entries(draft.PRESETS)) {
    if (preset.objekt) assert.ok(CARDS.objekt.includes(preset.objekt), key);
    if (preset.situation)
      assert.ok(CARDS.situation.includes(preset.situation), key);
    for (const topic of preset.themen || [])
      assert.ok(CARDS.themen.includes(topic), key);
    assert.ok(preset.objekt || preset.situation || preset.themen, key);
  }
});

test("the form is hidden in the markup and the page loads draft.js first", () => {
  for (const lang of ["de", "en"]) {
    const html = pages[lang];
    const tag = /<form class="enquiry"[^>]*>/.exec(html)[0];
    assert.match(tag, /\shidden>$/, lang);
    assert.match(tag, /action="mailto:info@pani-hv\.de\?subject=[^"&]+"/, lang);
    assert.match(tag, /method="post"/, lang);
    const head = html.slice(0, html.indexOf("</head>"));
    const at = (file) => head.indexOf(`src="assets/${file}`);
    assert.ok(at("draft.js") > 0, lang);
    assert.ok(at("draft.js") < at("site.js"), lang);
    assert.ok(at("site.js") < at("enquiry.js"), lang);
  }
});

test("without JavaScript a hint and a prefilled direct email remain", () => {
  const expected = {
    de: {
      hint: /Der Fragebogen benötigt JavaScript\. Bitte nutzen Sie den direkten Weg unten/,
      subject: "Anfrage zur Hausverwaltung",
      first: "Objektart (WEG, Miethaus, einzelne Wohnung, mehrere Häuser):",
      last: "Telefon (optional):",
    },
    en: {
      hint: /The questionnaire needs JavaScript\. Please use the direct route below/,
      subject: "Property management enquiry",
      first:
        "Type of property (WEG, rental building, individual apartment, several buildings):",
      last: "Phone (optional):",
    },
  };
  for (const lang of ["de", "en"]) {
    const html = pages[lang];
    const hint = /<noscript>([\s\S]*?)<\/noscript>/.exec(
      html.slice(html.indexOf("<main")),
    )[1];
    assert.match(hint, expected[lang].hint, lang);
    assert.doesNotMatch(hint, /öffnet|opens/, lang);
    const direct = /<p class="enquiry-direct">[\s\S]*?<\/p>/.exec(html)[0];
    // Der direkte Weg steht hinter dem Formular, also "unten".
    assert.ok(html.indexOf("</form>") < html.indexOf(direct), lang);
    const href = decode(/<a href="(mailto:[^"]+)"/.exec(direct)[1]);
    const uri = new URL(href);
    assert.equal(uri.pathname, "info@pani-hv.de", lang);
    assert.deepEqual([...uri.searchParams.keys()], ["subject", "body"], lang);
    assert.equal(uri.searchParams.get("subject"), expected[lang].subject);
    const lines = uri.searchParams.get("body").split("\r\n");
    assert.equal(lines.length, 7, lang);
    assert.equal(lines[0], expected[lang].first);
    assert.equal(lines[6], expected[lang].last);
    for (const line of lines) assert.match(line, /:$/, lang);
    // Die Musternummer bleibt unveraendert.
    assert.match(direct, /<a href="tel:\+493023125150">030 23125 150<\/a>/);
  }
});

test("the page texts promise a draft, not an opening email app", () => {
  for (const lang of ["de", "en"]) {
    const html = pages[lang];
    const meta = (attribute) =>
      new RegExp(
        `<meta\\b(?=[^>]*\\b${attribute})[^>]*\\bcontent="([^"]*)"`,
      ).exec(html)[1];
    const description = meta('name="description"');
    const og = meta('property="og:description"');
    assert.equal(og, description, lang);
    assert.ok(description.length >= 120 && description.length <= 160, lang);
    const main = html
      .slice(html.indexOf("<main"), html.indexOf("</main>"))
      .replace(/<svg[\s\S]*?<\/svg>/g, "");
    for (const text of [description, main]) {
      assert.doesNotMatch(text, /öffnet sich|öffnen nur|öffnet Ihr/, lang);
      assert.doesNotMatch(text, /\bopens\b|only open an email/, lang);
      assert.doesNotMatch(text, /Mietshaus/, lang);
      assert.doesNotMatch(text, /[\u2013\u2014]/, lang);
    }
  }
  assert.match(pages.de, /Am Ende erhalten Sie einen E-Mail-Entwurf/);
  assert.match(pages.en, /At the end you get an email draft/);
  assert.match(pages.de, /<strong>Miethaus<\/strong>/);
  assert.match(
    pages.de,
    /Mit „E-Mail vorbereiten“ entsteht aus Ihren Angaben ein Entwurf\. Wir versuchen, ihn in Ihrem E-Mail-Programm zu öffnen\. Sie können den Text auch kopieren\./,
  );
  assert.match(
    pages.en,
    /With "Prepare email", your details become an email draft\. We try to open it in your email app\. You can also copy the text\./,
  );
});

test("enquiry.js leaves the address and the draft to the shared module", () => {
  assert.doesNotMatch(source, /decodeURIComponent/);
  assert.doesNotMatch(source, /mailto:/);
  assert.doesNotMatch(source, /location\.href/);
  assert.match(source, /if \(!form \|\| !draft\) return;/);
  assert.doesNotMatch(source, /[\u2013\u2014]/);
});

// ---------------------------------------------------------------------------
// Start und Vorauswahl
// ---------------------------------------------------------------------------
test("without a parameter the questionnaire starts at step 1 of 6", () => {
  const app = open("de");
  assert.equal(app.form.hidden, false);
  assert.ok(app.form.classList.contains("is-enhanced"));
  assert.equal(app.form.querySelector("[data-progress]").hidden, false);
  assert.deepEqual(app.steps(), ["objekt"]);
  assert.equal(app.progress(), "Schritt 1 von 6");
  assert.equal(app.form.querySelector("[data-back]").hidden, true);
  assert.equal(app.form.querySelector("[data-next]").hidden, false);
  assert.equal(app.form.querySelector("[data-submit]").hidden, true);
  assert.equal(app.preset(), null);
  for (const name of Object.keys(CARDS))
    assert.deepEqual(app.checked(name), []);
  for (const node of app.form.querySelectorAll("[data-js-only]"))
    assert.equal(node.hidden, false);
});

test("weg, miethaus and wohnung set the property type and start at step 2", () => {
  const weg = open("de", { search: "?type=weg" });
  assert.deepEqual(weg.checked("objekt"), ["weg"]);
  assert.deepEqual(weg.steps(), ["groesse"]);
  assert.equal(weg.progress(), "Schritt 2 von 7");
  assert.equal(weg.preset(), "Objekt: Eigentümergemeinschaft (WEG) Ändern");
  assert.equal(weg.form.querySelector("[data-back]").hidden, false);

  const miethaus = open("de", { search: "?type=miethaus" });
  assert.deepEqual(miethaus.steps(), ["groesse"]);
  assert.equal(miethaus.progress(), "Schritt 2 von 6");
  assert.equal(miethaus.preset(), "Objekt: Miethaus Ändern");

  // Bei einer einzelnen Wohnung entfaellt die Einheitenfrage.
  const wohnung = open("de", { search: "?type=wohnung" });
  assert.deepEqual(wohnung.checked("objekt"), ["wohnung"]);
  assert.deepEqual(wohnung.steps(), ["situation"]);
  assert.equal(wohnung.progress(), "Schritt 2 von 5");
  assert.equal(wohnung.preset(), "Objekt: Einzelne Wohnung Ändern");
});

test("the preset line leads back to step 1, where the type can be changed", () => {
  const app = open("de", { search: "?type=weg" });
  app.click(app.presetButton());
  assert.deepEqual(app.steps(), ["objekt"]);
  assert.equal(app.preset(), null);
  // Der Fokus liegt auf der Frage des ersten Schritts.
  assert.equal(
    app.page.activeElement,
    app.form.querySelector("[data-step]").querySelector(".enquiry-question"),
  );
  app.pick("objekt", "wohnung");
  assert.deepEqual(app.steps(), ["situation"]);
  assert.equal(app.progress(), "Schritt 2 von 5");
  assert.equal(app.preset(), "Objekt: Einzelne Wohnung Ändern");
});

test("zinshaus marks the card but keeps step 1 visible for confirmation", () => {
  const app = open("de", { search: "?type=zinshaus" });
  assert.deepEqual(app.checked("objekt"), ["zinshaus"]);
  assert.deepEqual(app.steps(), ["objekt"]);
  assert.equal(app.progress(), "Schritt 1 von 6");
  assert.equal(app.preset(), null);
  app.next();
  assert.deepEqual(app.steps(), ["groesse"]);
  assert.equal(app.error(), null);
  assert.equal(app.preset(), null);
});

test("sanierung, baubetreuung and reporting tick a topic and show it as noted", () => {
  const cases = {
    sanierung: ["sanierung", "Vorgemerkt: Sanierung oder Bau"],
    baubetreuung: ["sanierung", "Vorgemerkt: Sanierung oder Bau"],
    reporting: ["reporting", "Vorgemerkt: Regelmäßiges Reporting"],
  };
  for (const [type, [topic, line]] of Object.entries(cases)) {
    const app = open("de", { search: `?type=${type}` });
    assert.deepEqual(app.steps(), ["objekt"], type);
    assert.equal(app.progress(), "Schritt 1 von 6", type);
    assert.deepEqual(app.checked("themen"), [topic], type);
    assert.deepEqual(app.checked("objekt"), [], type);
    assert.equal(app.preset(), line, type);
  }
});

test("a noted topic stays visible until its step and follows later changes", () => {
  const app = open("de", { search: "?type=sanierung" });
  const line = "Vorgemerkt: Sanierung oder Bau";
  app.pick("objekt", "miethaus");
  assert.equal(app.step(), "groesse");
  assert.equal(app.preset(), line);
  app.pick("groesse", "11-30");
  assert.equal(app.step(), "situation");
  assert.equal(app.preset(), line);
  app.pick("situation", "selbst");
  assert.equal(app.step(), "themen");
  assert.equal(app.preset(), null);
  assert.equal(app.nextLabel(), "Weiter");
  app.back();
  assert.equal(app.preset(), line);
  app.next();
  app.pick("themen", "sanierung");
  assert.deepEqual(app.checked("themen"), []);
  app.back();
  assert.equal(app.preset(), null);
});

test("wechsel marks the current situation and notes it until that step", () => {
  const app = open("de", { search: "?type=wechsel" });
  assert.deepEqual(app.steps(), ["objekt"]);
  assert.deepEqual(app.checked("situation"), ["wechsel"]);
  assert.equal(app.preset(), "Vorgemerkt: Verwaltung wechseln");
  app.pick("objekt", "wohnung");
  assert.equal(app.step(), "situation");
  assert.equal(app.preset(), null);
  app.next();
  assert.equal(app.step(), "themen");
  assert.equal(app.error(), null);
});

test("broken or foreign type values start a normal questionnaire", () => {
  for (const search of [
    "?type=%",
    "?type=%E0%A4%A",
    "?type=constructor",
    "?type=__proto__",
    "?type=toString",
    "?type=nachfolge",
    '?type=weg"]',
    "?type=",
    "?",
  ]) {
    for (const lang of ["de", "en"]) {
      let app;
      assert.doesNotThrow(() => {
        app = open(lang, { search });
      }, search);
      assert.equal(app.form.hidden, false, search);
      assert.deepEqual(app.steps(), ["objekt"], search);
      assert.equal(app.form.querySelector("[data-next]").hidden, false, search);
      assert.equal(app.preset(), null, search);
      for (const name of Object.keys(CARDS))
        assert.deepEqual(app.checked(name), [], search);
    }
  }
});

test("the form stays hidden when the draft module is missing or the start fails", () => {
  const missing = open("de", { withDraft: false, search: "?type=weg" });
  assert.equal(missing.form.hidden, true);
  assert.equal(missing.form.classList.contains("is-enhanced"), false);
  assert.deepEqual(missing.steps(), []);

  let broken;
  assert.doesNotThrow(() => {
    broken = open("de", {
      sabotage: (form) => form.querySelector("[data-progress-text]").remove(),
    });
  });
  assert.equal(broken.form.hidden, true);
  assert.equal(broken.form.classList.contains("is-enhanced"), false);
});

// ---------------------------------------------------------------------------
// Schritte
// ---------------------------------------------------------------------------
test("the property type decides whether role and units are asked", () => {
  const app = open("de");
  const disabled = () =>
    app.form
      .querySelectorAll("[data-step]")
      .filter((step) => step.disabled)
      .map((step) => step.dataset.step);
  assert.deepEqual(disabled(), ["rolle"]);
  app.choose("objekt", "weg");
  assert.equal(app.progress(), "Schritt 1 von 7");
  assert.deepEqual(disabled(), []);
  app.choose("objekt", "wohnung");
  assert.equal(app.progress(), "Schritt 1 von 5");
  assert.deepEqual(disabled(), ["groesse", "rolle"]);
  app.choose("objekt", "zinshaus");
  assert.equal(app.progress(), "Schritt 1 von 6");
  assert.deepEqual(disabled(), ["rolle"]);
  // Tastaturauswahl springt nicht von selbst weiter.
  assert.deepEqual(app.steps(), ["objekt"]);
});

test("an unanswered required step shows the error and stays", () => {
  const app = open("de");
  app.next();
  assert.deepEqual(app.steps(), ["objekt"]);
  assert.equal(
    app.error(),
    "Bitte wählen Sie eine der Karten, um fortzufahren.",
  );
  assert.equal(app.page.activeElement, app.input("objekt", "weg"));
  app.pick("objekt", "weg");
  assert.equal(app.step(), "groesse");
  const english = open("en");
  english.next();
  assert.equal(
    english.error(),
    "Please choose one of the cards to continue.",
  );
});

test("the topics step can be skipped, and Nothing in particular excludes the rest", () => {
  const app = open("de", { search: "?type=wohnung" });
  app.pick("situation", "neu");
  assert.equal(app.step(), "themen");
  assert.equal(app.nextLabel(), "Überspringen");
  app.pick("themen", "abrechnung");
  app.pick("themen", "vermietung");
  assert.equal(app.nextLabel(), "Weiter");
  assert.equal(app.step(), "themen");
  app.pick("themen", "keine");
  assert.deepEqual(app.checked("themen"), ["keine"]);
  app.pick("themen", "reporting");
  assert.deepEqual(app.checked("themen"), ["reporting"]);
  app.pick("themen", "reporting");
  assert.equal(app.nextLabel(), "Überspringen");
  app.next();
  assert.equal(app.step(), "lage");
});

test("Enter confirms a card and only toggles a topic", () => {
  const app = open("de");
  const event = app.enter("objekt", "miethaus");
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(app.checked("objekt"), ["miethaus"]);
  assert.equal(app.step(), "groesse");
  app.pick("groesse", "unbekannt");
  app.pick("situation", "gekuendigt");
  assert.equal(app.step(), "themen");
  app.enter("themen", "vermietung");
  assert.deepEqual(app.checked("themen"), ["vermietung"]);
  assert.equal(app.step(), "themen");
  app.enter("themen", "vermietung");
  assert.deepEqual(app.checked("themen"), []);
});

test("the summary lists the answers and Change leads back and returns", () => {
  const app = open("de");
  walk(app, [
    ["objekt", "weg"],
    ["groesse", "bis-10"],
    ["rolle", "beirat"],
    ["situation", "selbst"],
    ["themen", []],
    ["lage", "berlin-ring"],
  ]);
  assert.equal(app.step(), "kontakt");
  assert.equal(app.progress(), "Schritt 7 von 7");
  assert.equal(app.form.querySelector("[data-next]").hidden, true);
  assert.equal(app.form.querySelector("[data-submit]").hidden, false);
  assert.equal(app.form.querySelector("[data-summary]").hidden, false);
  assert.deepEqual(
    app.summary().map(({ label, answer }) => [label, answer]),
    [
      ["Objekt", "Eigentümergemeinschaft (WEG)"],
      ["Einheiten", "Bis 10 Einheiten"],
      ["Ihre Rolle", "Verwaltungsbeirat"],
      ["Verwaltung heute", "Bisher selbst verwaltet"],
      ["Themen", "Keine Angabe"],
      ["Lage", "Innerhalb des S-Bahn-Rings"],
    ],
  );
  app.click(app.summary()[3].change);
  assert.equal(app.step(), "situation");
  assert.equal(app.nextLabel(), "Zur Zusammenfassung");
  app.pick("situation", "wechsel");
  assert.equal(app.step(), "kontakt");
  assert.equal(app.summary()[3].answer, "Verwaltung wechseln");
});

// ---------------------------------------------------------------------------
// Entwurf
// ---------------------------------------------------------------------------
test("incomplete contact details stop before any draft is made", () => {
  const app = open("de", { search: "?type=wohnung" });
  walk(app, [
    ["situation", "neu"],
    ["themen", []],
    ["lage", "mehrere"],
  ]);
  const event = app.submit();
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(app.page.reported, ["name"]);
  app.fill({ name: "Erika Beispiel", email: "keine-adresse" });
  app.submit();
  assert.deepEqual(app.page.reported, ["name", "email"]);
  assert.equal(app.window.location.href, "");
  assert.deepEqual(app.status(), []);
  assert.equal(app.panel(), null);
});

test("the draft uses the card labels, never the raw values", () => {
  const app = open("de");
  walk(app, [
    ["objekt", "weg"],
    ["groesse", "bis-10"],
    ["rolle", "beirat"],
    ["situation", "selbst"],
    ["themen", ["abrechnung", "reporting"]],
    ["lage", "berlin-ring"],
  ]);
  app.fill({
    name: "Erika Beispiel",
    email: "erika@example.com",
    message: "Bitte um Rückruf.\nGern vormittags & nachmittags.",
  });
  const event = app.submit();
  assert.equal(event.defaultPrevented, true);
  const body = [
    "Name: Erika Beispiel",
    "E-Mail: erika@example.com",
    "Telefon: -",
    "Objektadresse / Bezirk: -",
    "",
    "Objekt: Eigentümergemeinschaft (WEG)",
    "Einheiten: Bis 10 Einheiten",
    "Ihre Rolle: Verwaltungsbeirat",
    "Verwaltung heute: Bisher selbst verwaltet",
    "Themen: Abrechnung aufholen, Regelmäßiges Reporting",
    "Lage: Innerhalb des S-Bahn-Rings",
    "",
    "Nachricht:",
    "Bitte um Rückruf.",
    "Gern vormittags & nachmittags.",
  ];
  const mail = app.mail();
  assert.equal(mail.to, "info@pani-hv.de");
  assert.equal(
    mail.subject,
    "Anfrage zur Hausverwaltung - Eigentümergemeinschaft (WEG)",
  );
  assert.equal(mail.body, body.join("\r\n"));
  assert.doesNotMatch(mail.body, /bis-10|berlin-ring|: (weg|selbst|beirat)\b/);

  assert.deepEqual(app.status(), [
    draft.TEXT.de.ready,
    draft.TEXT.de.tried,
    draft.TEXT.de.alt,
  ]);
  const { panel, open: link, copy, subject, area } = app.panel();
  const siblings = panel.parent.children;
  assert.equal(
    siblings[siblings.indexOf(panel) - 1],
    app.form.querySelector('[role="status"]'),
  );
  assert.equal(link.href, app.window.location.href);
  assert.equal(copy.type, "button");
  assert.equal(subject.textContent, `Betreff: ${mail.subject}`);
  assert.equal(area.value, body.join("\n"));
  assert.equal(area.readOnly, true);
});

test("skipped steps and empty optional fields do not appear in the draft", () => {
  const app = open("de", { search: "?type=wohnung" });
  walk(app, [
    ["situation", "neu"],
    ["themen", []],
    ["lage", "ausserhalb"],
  ]);
  app.fill({
    name: "Erika Beispiel",
    email: "erika@example.com",
    phone: "030 000000",
    address: "Musterstraße 1",
  });
  app.submit();
  assert.equal(
    app.mail().body,
    [
      "Name: Erika Beispiel",
      "E-Mail: erika@example.com",
      "Telefon: 030 000000",
      "Objektadresse / Bezirk: Musterstraße 1",
      "",
      "Objekt: Einzelne Wohnung",
      "Verwaltung heute: Neu gekauft oder geerbt",
      "Themen: Keine Angabe",
      "Lage: Außerhalb Berlins",
    ].join("\r\n"),
  );
  assert.equal(
    app.mail().subject,
    "Anfrage zur Hausverwaltung - Einzelne Wohnung",
  );
});

test("a preselected topic reaches the draft, and the copy button reports its result", async () => {
  const written = [];
  const app = open("de", {
    search: "?type=reporting",
    clipboard: {
      writeText: async (value) => {
        written.push(value);
      },
    },
  });
  walk(app, [
    ["objekt", "zinshaus"],
    ["groesse", "ueber-80"],
    ["situation", "wechsel"],
  ]);
  assert.equal(app.step(), "themen");
  app.next();
  app.pick("lage", "mehrere");
  app.fill({ name: "Erika Beispiel", email: "erika@example.com" });
  app.submit();
  assert.match(app.mail().body, /\r\nThemen: Regelmäßiges Reporting\r\n/);
  assert.match(app.mail().body, /\r\nObjekt: Mehrere Häuser\r\n/);
  app.click(app.panel().copy);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(written, [app.panel().area.value]);
  assert.deepEqual(app.status(), [draft.TEXT.de.copied]);
});

test("a very long message becomes a placeholder email with the full text to copy", () => {
  const app = open("de", { search: "?type=miethaus" });
  walk(app, [
    ["groesse", "31-80"],
    ["situation", "sonstiges"],
    ["themen", []],
    ["lage", "berlin-aussen"],
  ]);
  assert.equal(app.form.querySelector("[data-detail-hint]").hidden, false);
  const message = "Wort ".repeat(600).trim();
  app.fill({ name: "Erika Beispiel", email: "erika@example.com", message });
  app.submit();
  assert.equal(app.mail().to, "info@pani-hv.de");
  assert.equal(app.mail().body, draft.TEXT.de.placeholder);
  assert.ok(app.window.location.href.length <= draft.MAX_HREF);
  assert.deepEqual(app.status(), [
    draft.TEXT.de.ready,
    draft.TEXT.de.tooLong,
    draft.TEXT.de.alt,
  ]);
  assert.ok(app.panel().area.value.endsWith(`Nachricht:\n${message}`));
});

test("the English questionnaire uses English labels throughout", () => {
  const app = open("en", { search: "?type=baubetreuung" });
  assert.equal(app.progress(), "Step 1 of 6");
  assert.equal(app.preset(), "Noted: Renovation or building works");
  assert.equal(
    open("en", { search: "?type=wechsel" }).preset(),
    "Noted: Change of manager",
  );
  assert.equal(
    open("en", { search: "?type=weg" }).preset(),
    "Property: Owners’ association (WEG) Change",
  );
  walk(app, [
    ["objekt", "miethaus"],
    ["groesse", "11-30"],
    ["situation", "selbst"],
  ]);
  assert.equal(app.step(), "themen");
  assert.equal(app.nextLabel(), "Continue");
  app.next();
  app.pick("lage", "berlin-ring");
  assert.equal(app.progress(), "Step 6 of 6");
  assert.deepEqual(
    app.summary().map(({ label, answer }) => [label, answer]),
    [
      ["Property", "Rental building"],
      ["Units", "11 to 30 units"],
      ["Management today", "Self-managed so far"],
      ["Topics", "Renovation or building works"],
      ["Location", "Inside the S-Bahn ring"],
    ],
  );
  app.fill({ name: "Erika Example", email: "erika@example.com" });
  app.submit();
  assert.equal(
    app.mail().subject,
    "Property management enquiry - Rental building",
  );
  assert.equal(
    app.mail().body,
    [
      "Name: Erika Example",
      "Email: erika@example.com",
      "Phone: -",
      "Property address / district: -",
      "",
      "Property: Rental building",
      "Units: 11 to 30 units",
      "Management today: Self-managed so far",
      "Topics: Renovation or building works",
      "Location: Inside the S-Bahn ring",
    ].join("\r\n"),
  );
  assert.deepEqual(app.status(), [
    "Your draft is ready. Nothing has been sent yet.",
    draft.TEXT.en.tried,
    draft.TEXT.en.alt,
  ]);
  assert.equal(app.panel().open.textContent, "Open email app");
  assert.equal(app.panel().copy.textContent, "Copy text");
  assert.match(app.panel().subject.textContent, /^Subject: /);
});
