const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const model = require("../assets/energy-model.js");

test("class C reproduces the disclosed example", () => {
  assert.deepEqual(model.calculate("C"), {
    demand: 87,
    percent: 52,
    euros: 1210,
  });
});
test("the unchanged baseline produces no savings", () => {
  assert.deepEqual(model.calculate("F"), { demand: 180, percent: 0, euros: 0 });
});
test("all better classes reduce demand monotonically and use the disclosed assumptions", () => {
  let previous = 0;
  for (const key of ["F", "E", "D", "C", "B", "A", "A+"]) {
    const result = model.calculate(key);
    assert(result.euros >= previous);
    assert.equal(
      result.euros,
      Math.round(((180 - result.demand) * 100 * 0.13) / 10) * 10,
    );
    previous = result.euros;
  }
});
test("invalid or worse targets cannot be presented as renovation savings", () => {
  for (const key of ["G", "H", "bad", null, undefined])
    assert.throws(() => model.calculate(key), RangeError);
});

function setup({ reduced = false, english = false } = {}) {
  const listeners = {};
  const scheduled = new Map();
  let nextFrame = 0;
  const fields = ["demand", "percent", "euros"].map((value) => ({
    dataset: { value },
    textContent: "",
  }));
  const status = { textContent: "" };
  const fieldset = { disabled: true };
  const motion = {
    matches: reduced,
    addEventListener: (type, handler) => {
      listeners.motion = handler;
    },
  };
  const calculator = {
    dataset: {},
    querySelector: (selector) => (selector === "fieldset" ? fieldset : status),
    querySelectorAll: () => fields,
    addEventListener: (type, handler) => {
      listeners.change = handler;
    },
  };
  const document = {
    documentElement: { lang: english ? "en" : "de" },
    querySelectorAll: (selector) =>
      selector === "[data-energy]" ? [calculator] : [],
    addEventListener: (type, handler) => {
      listeners[type] = handler;
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../assets/experience.js"), "utf8"),
    {
      document,
      window: { PaniEnergy: model, matchMedia: () => motion },
      Intl,
      performance: { now: () => 0 },
      requestAnimationFrame: (callback) => {
        scheduled.set(++nextFrame, callback);
        return nextFrame;
      },
      cancelAnimationFrame: (id) => scheduled.delete(id),
    },
  );
  return {
    fields,
    status,
    fieldset,
    scheduled,
    choose(value) {
      listeners.change({ target: { value, matches: () => true } });
    },
    complete() {
      for (const [id, callback] of [...scheduled]) {
        scheduled.delete(id);
        callback(600);
      }
    },
  };
}
test("rapid target changes cancel stale animations and finish at the last selection", () => {
  const app = setup();
  app.choose("A");
  app.choose("B");
  assert.equal(app.scheduled.size, 1);
  app.complete();
  assert.deepEqual(
    app.fields.map((field) => field.textContent),
    ["62", "−66", "1.530"],
  );
  assert.match(app.status.textContent, /Ziel B/);
});
test("reduced motion updates immediately without scheduling animation", () => {
  const app = setup({ reduced: true });
  assert.equal(app.fieldset.disabled, false);
  app.choose("F");
  assert.equal(app.scheduled.size, 0);
  assert.deepEqual(
    app.fields.map((field) => field.textContent),
    ["180", "0", "0"],
  );
});
test("English results and accessible status use English formatting", () => {
  const app = setup({ reduced: true, english: true });
  app.choose("C");
  assert.equal(app.fields[2].textContent, "1,210");
  assert.match(app.status.textContent, /Target C/);
});
