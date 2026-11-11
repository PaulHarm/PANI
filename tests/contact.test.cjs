const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const draftSource = read("../assets/draft.js");
const source = read("../assets/site.js");

// draft.js und site.js laufen wie im Browser nacheinander im selben Kontext:
// draft.js legt window.PaniDraft an, site.js nutzt es.
function setup({
  language = "de",
  tenant = false,
  valid = true,
  values = {},
  search = "",
  withDraft = true,
} = {}) {
  const events = {};
  const log = [];
  class Node {
    constructor(tag) {
      this.tagName = tag;
      this.className = "";
      this.textContent = "";
      this.children = [];
      this.attributes = {};
      this.listeners = {};
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
    replaceChildren(...nodes) {
      this.children = nodes;
    }
    after(node) {
      this.next = node;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
    focus() {}
    select() {}
    scrollIntoView() {}
  }
  const status = new Node("div");
  const topic = { options: new Array(6).fill({}), selectedIndex: 0 };
  let hidden = true;
  const form = {
    dataset: { emailForm: tenant ? "tenant" : "owner" },
    get hidden() {
      return hidden;
    },
    set hidden(value) {
      log.push(`hidden:${value}`);
      hidden = value;
    },
    reportValidity: () => valid,
    addEventListener: (name, listener) => {
      log.push(`listener:${name}`);
      events[name] = listener;
    },
    querySelector: (selector) =>
      selector === '[role="status"]'
        ? status
        : selector === '[name="topic"]'
          ? topic
          : null,
  };
  const fields = {
    name: "Test Eigentümer",
    email: "test@example.com",
    topic: "Eigentümergemeinschaft (WEG)",
    message: "Frage zu Haus & Hof\nZweite Zeile + Rückfrage?",
    ...values,
  };
  const document = {
    documentElement: { lang: language },
    querySelector: () => null,
    querySelectorAll: (selector) =>
      selector === "[data-email-form]" ? [form] : [],
    addEventListener: () => {},
    createTextNode: (text) => ({ textContent: text }),
    createElement: (tag) => new Node(tag),
    execCommand: () => false,
  };
  class FormData {
    get(key) {
      return fields[key] ?? "";
    }
  }
  const window = {
    document,
    FormData,
    URLSearchParams,
    location: { href: "", search },
    navigator: {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  };
  window.window = window;
  const context = vm.createContext(window);
  if (withDraft) vm.runInContext(draftSource, context);
  vm.runInContext(source, context);
  return {
    form,
    status,
    topic,
    window,
    log,
    lines: () => status.children.map((node) => node.textContent),
    panel() {
      const [actions, subject, area] = status.next.children;
      const [open, copy] = actions.children;
      return { subject, area, open, copy };
    },
    submit() {
      let prevented = false;
      events.submit({
        preventDefault() {
          prevented = true;
        },
      });
      return prevented;
    },
  };
}

test("the form only becomes visible after its submit handler is installed", () => {
  for (const tenant of [false, true]) {
    const app = setup({ tenant });
    assert.deepEqual(app.log, ["listener:submit", "hidden:false"]);
    assert.equal(app.form.hidden, false);
  }
});

test("without the draft module the form stays hidden and gets no handler", () => {
  for (const tenant of [false, true]) {
    const app = setup({ tenant, withDraft: false });
    assert.equal(app.form.hidden, true);
    assert.deepEqual(app.log, []);
  }
});

test("invalid input cannot open or transmit an email", () => {
  const app = setup({ valid: false });
  assert.equal(app.submit(), true);
  assert.equal(app.window.location.href, "");
  assert.equal(app.status.children.length, 0);
  assert.equal(app.status.next, undefined);
});

test("the draft uses the confirmed recipient and preserves special characters", () => {
  const app = setup();
  assert.equal(app.submit(), true);
  const uri = new URL(app.window.location.href);
  assert.equal(uri.protocol, "mailto:");
  assert.equal(uri.pathname, "info@pani-hv.de");
  assert.equal(
    uri.searchParams.get("subject"),
    "Anfrage zur Hausverwaltung - Eigentümergemeinschaft (WEG)",
  );
  assert.match(
    uri.searchParams.get("body"),
    /Frage zu Haus & Hof\r\nZweite Zeile \+ Rückfrage\?$/,
  );
  assert.match(uri.searchParams.get("body"), /E-Mail: test@example.com/);
  assert.match(uri.searchParams.get("body"), /Telefon: -\r\n/);
  assert.equal(app.form.hidden, false);
});

test("HTML-looking input stays literal and cannot change the recipient", () => {
  const message = "<script>alert(1)</script>&cc=other@example.com#body";
  const app = setup({ values: { message } });
  app.submit();
  const uri = new URL(app.window.location.href);
  assert.equal(uri.pathname, "info@pani-hv.de");
  assert.equal(uri.searchParams.has("cc"), false);
  assert.equal(uri.hash, "");
  assert.ok(uri.searchParams.get("body").endsWith(message));
  // Im Kopierfeld steht derselbe Text als Wert, nicht als HTML.
  assert.ok(app.panel().area.value.endsWith(message));
});

test("tenant drafts include the property address and a separate subject", () => {
  const app = setup({
    tenant: true,
    values: {
      address: "Musterstraße 1, Wohnung 2",
      topic: "Reparatur / Schaden",
    },
  });
  app.submit();
  const uri = new URL(app.window.location.href);
  assert.equal(
    uri.searchParams.get("subject"),
    "Mieteranliegen - Reparatur / Schaden",
  );
  assert.match(
    uri.searchParams.get("body"),
    /Objekt \/ Wohnung: Musterstraße 1, Wohnung 2/,
  );
  assert.equal(
    app.panel().subject.textContent,
    "Betreff: Mieteranliegen - Reparatur / Schaden",
  );
});

test("English drafts and status messages use English", () => {
  const app = setup({
    language: "en",
    tenant: true,
    values: { address: "Example Street 1", topic: "Repair / damage" },
  });
  app.submit();
  const uri = new URL(app.window.location.href);
  assert.equal(
    uri.searchParams.get("subject"),
    "Tenant enquiry - Repair / damage",
  );
  assert.match(
    uri.searchParams.get("body"),
    /Property \/ apartment: Example Street 1/,
  );
  assert.match(app.lines()[0], /Nothing has been sent yet/);
  assert.equal(app.panel().open.textContent, "Open email app");
  assert.equal(app.panel().copy.textContent, "Copy text");
  const owner = setup({
    language: "en",
    values: { topic: "Rental building" },
  });
  owner.submit();
  assert.equal(
    new URL(owner.window.location.href).searchParams.get("subject"),
    "Property management enquiry - Rental building",
  );
});

test("the status never claims that anything opened, and the panel offers the same draft", () => {
  const app = setup();
  app.submit();
  assert.equal(app.lines().length, 3);
  assert.match(app.lines()[0], /noch nichts versendet/);
  assert.match(app.lines()[1], /^Wir haben versucht, /);
  for (const line of app.lines())
    assert.doesNotMatch(line, /öffnet sich|(wird|wurde|ist)[^.?]*geöffnet/);
  const { open, copy, area } = app.panel();
  assert.equal(open.href, app.window.location.href);
  assert.equal(copy.type, "button");
  assert.match(
    area.value,
    /^Name: Test Eigentümer\nE-Mail: test@example.com\n/,
  );
  assert.match(
    area.value,
    /\n\nFrage zu Haus & Hof\nZweite Zeile \+ Rückfrage\?$/,
  );
});

test("a long message is handed over as a placeholder and stays complete for copying", () => {
  const message = "Wort ".repeat(600);
  const app = setup({ values: { message } });
  app.submit();
  const uri = new URL(app.window.location.href);
  assert.equal(uri.pathname, "info@pani-hv.de");
  assert.match(uri.searchParams.get("body"), /^Bitte fügen Sie hier/);
  assert.match(app.lines()[1], /zu lang/);
  assert.ok(app.panel().area.value.endsWith(message));
});

test("?type= preselects the matching topic of the start page form only", () => {
  const expected = {
    weg: 1,
    miethaus: 2,
    wohnung: 3,
    sanierung: 4,
    baubetreuung: 4,
    zinshaus: 0,
    reporting: 0,
    wechsel: 0,
  };
  for (const [type, index] of Object.entries(expected)) {
    const app = setup({ search: `?type=${type}` });
    assert.equal(app.topic.selectedIndex, index, type);
    assert.equal(app.form.hidden, false);
  }
  assert.equal(setup({ search: "?type=WEG&x=1" }).topic.selectedIndex, 1);
  assert.equal(
    setup({ search: "?type=weg", tenant: true }).topic.selectedIndex,
    0,
  );
});

test("broken or foreign ?type= values do not disturb the form", () => {
  for (const search of [
    "?type=%",
    "?type=%E0%A4%A",
    "?type=constructor",
    "?type=__proto__",
    "?type=toString",
    "?type=",
    "?",
  ]) {
    let app;
    assert.doesNotThrow(() => {
      app = setup({ search });
    }, search);
    assert.equal(app.form.hidden, false, search);
    assert.equal(app.topic.selectedIndex, 0, search);
    assert.equal(app.submit(), true);
    assert.equal(
      new URL(app.window.location.href).pathname,
      "info@pani-hv.de",
    );
  }
});

test("site.js reads the address only through the draft module", () => {
  assert.doesNotMatch(source, /decodeURIComponent/);
  assert.doesNotMatch(source, /closest\("details"\)/);
  assert.doesNotMatch(source, /mailto:/);
  assert.match(source, /PaniDraft/);
  assert.doesNotMatch(source, /[\u2013\u2014]/);
});
