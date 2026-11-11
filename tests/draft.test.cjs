const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const draft = require("../assets/draft.js");

const source = fs.readFileSync(
  path.join(__dirname, "../assets/draft.js"),
  "utf8",
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));

// Kleines Ersatz-DOM: nur das, was show() anfasst. calls haelt die
// Reihenfolge der sichtbaren Schritte fest.
function fakeDom({ clipboard, execCopy = true, reduced = false } = {}) {
  const calls = [];
  const doc = {
    activeElement: null,
    createElement: (tag) => new Node(tag),
    execCommand(command) {
      calls.push(`exec:${command}`);
      if (execCopy === "throw") throw new Error("blocked");
      return execCopy;
    },
  };
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
      calls.push("after");
      this.next = node;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
    focus() {
      doc.activeElement = this;
    }
    select() {
      this.selected = true;
    }
    setSelectionRange(start, end) {
      this.range = [start, end];
    }
    scrollIntoView(options) {
      calls.push(`scroll:${options.behavior}`);
    }
  }
  let href = "";
  const location = {
    get href() {
      return href;
    },
    set href(value) {
      calls.push("href");
      href = value;
    },
  };
  const win = {
    location,
    navigator: { clipboard },
    matchMedia: () => ({ matches: reduced }),
  };
  const status = new Node("div");
  const lines = () => status.children.map((node) => node.textContent);
  const parts = () => {
    const panel = status.next;
    const [actions, subject, area] = panel.children;
    const [open, copy] = actions.children;
    return { panel, actions, subject, area, open, copy };
  };
  return { doc, win, status, calls, lines, parts };
}

function shown(options = {}, input = {}) {
  const lang = options.lang || "de";
  const dom = fakeDom(options);
  const composed = draft.compose({
    subject: "Anfrage zur Hausverwaltung - Miethaus",
    body: "Name: Test\nE-Mail: test@example.com\n\nGuten Tag",
    lang,
    ...input,
  });
  draft.show({
    doc: dom.doc,
    win: dom.win,
    status: dom.status,
    draft: composed,
    lang,
  });
  return { ...dom, composed, text: draft.TEXT[lang] };
}

test("the module loads without touching the DOM and exposes one frozen API", () => {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(typeof context.PaniDraft.presetFor, "function");
  assert.equal(typeof context.PaniDraft.show, "function");
  assert.ok(Object.isFrozen(draft));
  assert.equal(draft.MAX_HREF, 1900);
  assert.equal(draft.RECIPIENT, "info@pani-hv.de");
});

test("the preset table is frozen and holds exactly the allowed type values", () => {
  assert.deepEqual(Object.keys(draft.PRESETS), [
    "weg",
    "miethaus",
    "wohnung",
    "zinshaus",
    "sanierung",
    "baubetreuung",
    "reporting",
    "wechsel",
  ]);
  assert.ok(Object.isFrozen(draft.PRESETS));
  for (const entry of Object.values(draft.PRESETS)) {
    assert.ok(Object.isFrozen(entry));
    if (entry.themen) assert.ok(Object.isFrozen(entry.themen));
  }
  assert.throws(() => {
    "use strict";
    draft.PRESETS.weg.objekt = "zinshaus";
  }, TypeError);
  assert.throws(() => {
    "use strict";
    draft.PRESETS.neu = {};
  }, TypeError);
});

test("presetFor returns the table entry for known values", () => {
  assert.deepEqual(plain(draft.presetFor("?type=weg")), {
    key: "weg",
    objekt: "weg",
  });
  assert.deepEqual(plain(draft.presetFor("?type=miethaus")), {
    key: "miethaus",
    objekt: "miethaus",
  });
  assert.deepEqual(plain(draft.presetFor("?type=wohnung")), {
    key: "wohnung",
    objekt: "wohnung",
  });
  assert.deepEqual(plain(draft.presetFor("?type=zinshaus")), {
    key: "zinshaus",
    objekt: "zinshaus",
    confirm: true,
  });
  assert.deepEqual(plain(draft.presetFor("?type=sanierung")), {
    key: "sanierung",
    themen: ["sanierung"],
  });
  assert.deepEqual(plain(draft.presetFor("?type=baubetreuung")), {
    key: "baubetreuung",
    themen: ["sanierung"],
  });
  assert.deepEqual(plain(draft.presetFor("?type=reporting")), {
    key: "reporting",
    themen: ["reporting"],
  });
  assert.deepEqual(plain(draft.presetFor("?type=wechsel")), {
    key: "wechsel",
    situation: "wechsel",
  });
});

test("presetFor tolerates case, spaces and other parameters", () => {
  assert.equal(draft.presetFor("?type=WEG").key, "weg");
  assert.equal(draft.presetFor("?type=%20Miethaus%20").key, "miethaus");
  assert.equal(draft.presetFor("?type=+wohnung+").key, "wohnung");
  assert.equal(draft.presetFor("?utm=x&type=zinshaus&y=1").key, "zinshaus");
  assert.equal(draft.presetFor("type=reporting").key, "reporting");
  assert.equal(draft.presetFor("?type=weg&type=wechsel").key, "weg");
});

test("presetFor returns null and never throws for broken or foreign values", () => {
  const hostile = {
    toString() {
      throw new Error("boom");
    },
  };
  const inputs = [
    "?type=%",
    "?type=%E0%A4%A",
    "?type=%ZZ",
    "?type=constructor",
    "?type=__proto__",
    "?type=prototype",
    "?type=toString",
    "?type=hasOwnProperty",
    "?type=valueOf",
    "?type=nachfolge",
    "?type=weg%00",
    "?type=weg,miethaus",
    "?type=",
    "?type",
    "?",
    "",
    undefined,
    null,
    0,
    42,
    {},
    [],
    hostile,
    Symbol("type"),
  ];
  for (const input of inputs) {
    let result;
    assert.doesNotThrow(() => {
      result = draft.presetFor(input);
    });
    assert.equal(result, null);
  }
});

test("compose always addresses the fixed recipient and encodes user input", () => {
  const body = "Haus & Hof\nZweite Zeile + Rest&cc=other@example.com#anker";
  const composed = draft.compose({
    subject: "Anfrage & mehr?bcc=x@example.com",
    body,
    lang: "de",
  });
  const uri = new URL(composed.href);
  assert.equal(uri.protocol, "mailto:");
  assert.equal(uri.pathname, "info@pani-hv.de");
  assert.ok(composed.href.startsWith("mailto:info@pani-hv.de?subject="));
  assert.deepEqual([...uri.searchParams.keys()], ["subject", "body"]);
  assert.equal(uri.searchParams.has("cc"), false);
  assert.equal(uri.searchParams.has("bcc"), false);
  assert.equal(uri.hash, "");
  assert.equal(
    uri.searchParams.get("subject"),
    "Anfrage & mehr?bcc=x@example.com",
  );
  assert.equal(uri.searchParams.get("body"), body.replace(/\n/g, "\r\n"));
  assert.equal(composed.subject, "Anfrage & mehr?bcc=x@example.com");
  assert.equal(composed.body, body);
  assert.equal(composed.complete, true);
  assert.ok(Object.isFrozen(composed));
});

test("compose writes every line break as CRLF and keeps the subject on one line", () => {
  const composed = draft.compose({
    subject: "Betreff\r\nBcc: other@example.com",
    body: "eins\nzwei\r\ndrei\rvier",
    lang: "de",
  });
  assert.equal(composed.body, "eins\nzwei\ndrei\nvier");
  assert.equal(composed.subject, "Betreff Bcc: other@example.com");
  const [subjectPart, bodyPart] = composed.href.split("&body=");
  assert.doesNotMatch(subjectPart, /%0D|%0A/i);
  assert.equal(bodyPart, "eins%0D%0Azwei%0D%0Adrei%0D%0Avier");
});

test("compose survives missing values and broken characters", () => {
  assert.doesNotThrow(() => draft.compose());
  assert.doesNotThrow(() => draft.compose({}));
  const empty = draft.compose({ subject: null, body: undefined });
  assert.equal(empty.href, "mailto:info@pani-hv.de?subject=&body=");
  let broken;
  assert.doesNotThrow(() => {
    broken = draft.compose({
      subject: "Halb \uD83D",
      body: "kaputt \uDE00 ganz \uD83D\uDE00",
      lang: "de",
    });
  });
  assert.equal(broken.subject, "Halb \uFFFD");
  assert.equal(broken.body, "kaputt \uFFFD ganz \uD83D\uDE00");
  assert.equal(
    new URL(broken.href).searchParams.get("body"),
    "kaputt \uFFFD ganz \uD83D\uDE00",
  );
});

test("a 3000 character message becomes a placeholder email with the full text kept", () => {
  const message = "Wort ".repeat(600);
  assert.equal(message.length, 3000);
  for (const lang of ["de", "en"]) {
    const body = `Name: Test\n\n${message}`;
    const composed = draft.compose({ subject: "Anfrage", body, lang });
    assert.equal(composed.complete, false);
    assert.ok(composed.href.length <= draft.MAX_HREF);
    const uri = new URL(composed.href);
    assert.equal(uri.pathname, "info@pani-hv.de");
    assert.equal(uri.searchParams.get("subject"), "Anfrage");
    assert.equal(uri.searchParams.get("body"), draft.TEXT[lang].placeholder);
    assert.equal(composed.body, body);
  }
});

test("the length limit applies to the whole mailto address", () => {
  const base = draft.compose({ subject: "S", body: "" }).href.length;
  const fits = draft.compose({
    subject: "S",
    body: "a".repeat(draft.MAX_HREF - base),
  });
  assert.equal(fits.href.length, draft.MAX_HREF);
  assert.equal(fits.complete, true);
  const over = draft.compose({
    subject: "S",
    body: "a".repeat(draft.MAX_HREF - base + 1),
  });
  assert.equal(over.complete, false);
  // Umlaute zaehlen kodiert, nicht als ein Zeichen.
  const umlauts = draft.compose({ subject: "S", body: "ä".repeat(400) });
  assert.equal(umlauts.complete, false);
  // Ohne Sprachangabe steht der deutsche Platzhalter in der E-Mail.
  assert.equal(
    new URL(over.href).searchParams.get("body"),
    draft.TEXT.de.placeholder,
  );
});

test("copyText uses the Clipboard API when it works", async () => {
  const written = [];
  let fallbackCalls = 0;
  const copied = await draft.copyText("Entwurf", {
    clipboard: {
      writeText: async (value) => {
        written.push(value);
      },
    },
    fallback: () => {
      fallbackCalls += 1;
      return true;
    },
  });
  assert.equal(copied, true);
  assert.deepEqual(written, ["Entwurf"]);
  assert.equal(fallbackCalls, 0);
});

test("copyText falls back when the Clipboard API refuses or is missing", async () => {
  const refuse = {
    writeText: async () => {
      throw new Error("NotAllowedError");
    },
  };
  const throwing = {
    writeText() {
      throw new Error("sync");
    },
  };
  assert.equal(
    await draft.copyText("x", { clipboard: refuse, fallback: () => true }),
    true,
  );
  assert.equal(
    await draft.copyText("x", { clipboard: throwing, fallback: () => true }),
    true,
  );
  assert.equal(await draft.copyText("x", { fallback: () => true }), true);
  assert.equal(
    await draft.copyText("x", { clipboard: {}, fallback: () => true }),
    true,
  );
});

test("copyText reports failure without throwing when nothing works", async () => {
  const refuse = {
    writeText: async () => {
      throw new Error("NotAllowedError");
    },
  };
  assert.equal(
    await draft.copyText("x", { clipboard: refuse, fallback: () => false }),
    false,
  );
  assert.equal(
    await draft.copyText("x", {
      clipboard: refuse,
      fallback: () => {
        throw new Error("blocked");
      },
    }),
    false,
  );
  assert.equal(await draft.copyText("x", { clipboard: refuse }), false);
  assert.equal(await draft.copyText("x", {}), false);
  assert.equal(await draft.copyText("x", null), false);
  assert.equal(await draft.copyText("x"), false);
});

test("status texts exist in both languages and never claim that anything opened or was sent", () => {
  assert.deepEqual(Object.keys(draft.TEXT), ["de", "en"]);
  assert.deepEqual(Object.keys(draft.TEXT.de), Object.keys(draft.TEXT.en));
  assert.ok(Object.isFrozen(draft.TEXT.de));
  assert.ok(Object.isFrozen(draft.TEXT.en));
  assert.equal(
    draft.TEXT.de.ready,
    "Ihr Entwurf ist fertig. Es wurde noch nichts versendet.",
  );
  assert.equal(
    draft.TEXT.en.ready,
    "Your draft is ready. Nothing has been sent yet.",
  );
  assert.match(draft.TEXT.de.tried, /^Wir haben versucht, /);
  assert.match(draft.TEXT.en.tried, /^We have tried to open /);
  // Behauptungen, die die Seite nicht pruefen kann: etwas habe sich
  // geoeffnet oder sei versendet worden.
  const claims = [
    /öffnet sich/i,
    /(wird|wurde|ist|haben)[^.?]*geöffnet/i,
    /geöffnet worden/i,
    /(wird|wurde|ist)[^.?]*(gesendet|versendet|übermittelt)/i,
    /\bopens\b/i,
    /\b(is|was|has been|will be|is being) open(ed)?\b/i,
    /\bwill open\b/i,
    /\b(is|was|has been|will be|is being) (sent|submitted|delivered)\b/i,
  ];
  // Die einzige erlaubte Aussage zum Versand ist die Verneinung.
  const negation =
    /Es wurde noch nichts versendet\.|Nothing has been sent yet\./;
  for (const lang of ["de", "en"]) {
    for (const [key, value] of Object.entries(draft.TEXT[lang])) {
      assert.equal(typeof value, "string");
      assert.ok(value.length > 0, `${lang}.${key}`);
      assert.doesNotMatch(value, /[\u2013\u2014]/, `${lang}.${key}`);
      for (const claim of claims)
        assert.doesNotMatch(
          value.replace(negation, ""),
          claim,
          `${lang}.${key}`,
        );
    }
  }
});

test("show writes the honest status, builds the draft panel and only then hands over", () => {
  const app = shown();
  assert.deepEqual(app.lines(), [
    app.text.ready,
    app.text.tried,
    app.text.alt,
  ]);
  assert.match(app.lines()[0], /noch nichts versendet/);
  assert.deepEqual(app.calls, ["after", "scroll:smooth", "href"]);
  assert.equal(app.win.location.href, app.composed.href);

  const { panel, actions, subject, area, open, copy } = app.parts();
  assert.equal(panel.tagName, "div");
  assert.equal(panel.className, "draft-panel");
  assert.equal(panel.children.length, 3);
  assert.equal(actions.tagName, "div");
  assert.equal(actions.className, "draft-actions");
  assert.equal(actions.children.length, 2);
  assert.equal(open.tagName, "a");
  assert.equal(open.className, "button");
  assert.equal(open.textContent, "E-Mail-Programm öffnen");
  assert.equal(open.href, app.win.location.href);
  assert.equal(copy.tagName, "button");
  assert.equal(copy.className, "button button-light");
  assert.equal(copy.type, "button");
  assert.equal(copy.textContent, "Text kopieren");
  assert.equal(subject.tagName, "p");
  assert.equal(subject.className, "draft-subject");
  assert.equal(
    subject.textContent,
    "Betreff: Anfrage zur Hausverwaltung - Miethaus",
  );
  assert.equal(area.tagName, "textarea");
  assert.equal(area.className, "draft-text");
  assert.equal(area.readOnly, true);
  assert.equal(area.value, app.composed.body);
  assert.equal(area.attributes["aria-label"], "Text Ihrer Nachricht");
});

test("show uses English texts on English pages", () => {
  const app = shown({ lang: "en" });
  assert.deepEqual(app.lines(), [
    "Your draft is ready. Nothing has been sent yet.",
    app.text.tried,
    app.text.alt,
  ]);
  const { subject, area, open, copy } = app.parts();
  assert.equal(open.textContent, "Open email app");
  assert.equal(copy.textContent, "Copy text");
  assert.match(subject.textContent, /^Subject: /);
  assert.equal(area.attributes["aria-label"], "Text of your message");
});

test("show explains a draft that is too long and keeps the full text for copying", () => {
  const message = "Wort ".repeat(600);
  const app = shown({}, { body: message });
  assert.deepEqual(app.lines(), [
    app.text.ready,
    app.text.tooLong,
    app.text.alt,
  ]);
  assert.equal(app.parts().area.value, message);
  assert.equal(
    new URL(app.win.location.href).searchParams.get("body"),
    app.text.placeholder,
  );
  assert.equal(app.parts().open.href, app.win.location.href);
});

test("a second draft reuses the one panel and replaces its content", () => {
  const app = shown();
  const first = app.parts().panel;
  const next = draft.compose({
    subject: "Zweiter Betreff",
    body: "Zweiter Text",
    lang: "de",
  });
  draft.show({
    doc: app.doc,
    win: app.win,
    status: app.status,
    draft: next,
    lang: "de",
  });
  assert.equal(app.calls.filter((call) => call === "after").length, 1);
  assert.equal(app.parts().panel, first);
  assert.equal(app.parts().open.href, next.href);
  assert.equal(app.parts().area.value, "Zweiter Text");
  assert.equal(app.parts().subject.textContent, "Betreff: Zweiter Betreff");
  assert.equal(app.win.location.href, next.href);
});

test("show respects reduced motion and survives a page that cannot scroll or navigate", () => {
  assert.deepEqual(shown({ reduced: true }).calls, [
    "after",
    "scroll:auto",
    "href",
  ]);
  const dom = fakeDom();
  dom.win.matchMedia = undefined;
  Object.defineProperty(dom.win, "location", {
    value: {
      set href(value) {
        throw new Error("blocked");
      },
    },
  });
  const composed = draft.compose({ subject: "S", body: "T", lang: "de" });
  assert.doesNotThrow(() =>
    draft.show({
      doc: dom.doc,
      win: dom.win,
      status: dom.status,
      draft: composed,
      lang: "de",
    }),
  );
  assert.equal(dom.lines().length, 3);
  assert.equal(dom.parts().open.href, composed.href);
});

test("Copy text: success through the Clipboard API is confirmed", async () => {
  const written = [];
  const app = shown({
    clipboard: {
      writeText: async (value) => {
        written.push(value);
      },
    },
  });
  app.parts().copy.listeners.click();
  await tick();
  assert.deepEqual(written, [app.composed.body]);
  assert.deepEqual(app.lines(), [app.text.copied]);
  assert.equal(app.calls.includes("exec:copy"), false);
});

test("Copy text: without a Clipboard API the selection fallback copies", async () => {
  const app = shown({ clipboard: undefined, execCopy: true });
  const { area, copy } = app.parts();
  copy.listeners.click();
  await tick();
  assert.ok(app.calls.includes("exec:copy"));
  assert.equal(area.selected, true);
  assert.deepEqual(area.range, [0, app.composed.body.length]);
  assert.deepEqual(app.lines(), [app.text.copied]);
  assert.equal(app.doc.activeElement, copy);
});

test("Copy text: when nothing works the text stays selected and the status says so", async () => {
  for (const execCopy of [false, "throw"]) {
    const app = shown({
      lang: "en",
      execCopy,
      clipboard: {
        writeText: async () => {
          throw new Error("NotAllowedError");
        },
      },
    });
    const { area, copy } = app.parts();
    copy.listeners.click();
    await tick();
    assert.deepEqual(app.lines(), [app.text.copyFailed]);
    assert.match(app.lines()[0], /copy it manually/);
    assert.equal(area.selected, true);
    assert.equal(app.doc.activeElement, area);
  }
});

test("Copy text always copies the latest draft", async () => {
  const written = [];
  const app = shown({
    clipboard: {
      writeText: async (value) => {
        written.push(value);
      },
    },
  });
  draft.show({
    doc: app.doc,
    win: app.win,
    status: app.status,
    draft: draft.compose({ subject: "Neu", body: "Neuer Text", lang: "de" }),
    lang: "de",
  });
  app.parts().copy.listeners.click();
  await tick();
  assert.deepEqual(written, ["Neuer Text"]);
});
