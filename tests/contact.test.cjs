const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(
  path.join(__dirname, "../assets/site.js"),
  "utf8",
);

function setup({
  language = "de",
  tenant = false,
  valid = true,
  values = {},
} = {}) {
  const events = {};
  const status = {
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
  };
  const form = {
    dataset: { emailForm: tenant ? "tenant" : "owner" },
    hidden: true,
    reportValidity: () => valid,
    addEventListener: (name, listener) => {
      events[name] = listener;
    },
    querySelector: () => status,
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
    createElement: () => ({}),
  };
  const window = {
    location: { href: "" },
    matchMedia: () => ({ addEventListener: () => {} }),
  };
  class FormData {
    get(key) {
      return fields[key] ?? "";
    }
  }
  vm.runInNewContext(source, { document, window, FormData });
  return {
    form,
    status,
    window,
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

test("the enhanced form becomes available once its handler is installed", () => {
  assert.equal(setup().form.hidden, false);
});

test("invalid input cannot open or transmit an email", () => {
  const app = setup({ valid: false });
  assert.equal(app.submit(), true);
  assert.equal(app.window.location.href, "");
  assert.equal(app.status.children.length, 0);
});

test("the draft uses the confirmed recipient and preserves special characters", () => {
  const app = setup();
  app.submit();
  const uri = new URL(app.window.location.href);
  assert.equal(uri.protocol, "mailto:");
  assert.equal(uri.pathname, "info@pani-hv.de");
  assert.equal(
    uri.searchParams.get("subject"),
    "Anfrage zur Hausverwaltung - Eigentümergemeinschaft (WEG)",
  );
  assert.match(
    uri.searchParams.get("body"),
    /Frage zu Haus & Hof\nZweite Zeile \+ Rückfrage\?/,
  );
  assert.match(uri.searchParams.get("body"), /E-Mail: test@example.com/);
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
  assert.match(app.status.children[0].textContent, /Nothing has been sent yet/);
});

test("the retry link uses the same draft without claiming delivery", () => {
  const app = setup();
  app.submit();
  assert.equal(app.status.children[1].href, app.window.location.href);
  assert.match(app.status.children[0].textContent, /noch nichts versendet/);
});
