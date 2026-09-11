(function (root) {
  "use strict";
  const classes = Object.freeze(
    [
      { key: "H", demand: 275, color: "#923e35" },
      { key: "G", demand: 225, color: "#a65336" },
      { key: "F", demand: 180, color: "#a45d2d" },
      { key: "E", demand: 145, color: "#906c28" },
      { key: "D", demand: 115, color: "#827735" },
      { key: "C", demand: 87, color: "#667b3e" },
      { key: "B", demand: 62, color: "#477342" },
      { key: "A", demand: 40, color: "#306845" },
      { key: "A+", demand: 25, color: "#235b40" },
    ].map(Object.freeze),
  );
  const baseline = 180;
  const area = 100;
  const price = 0.13;
  function calculate(key) {
    const target = classes.find((item) => item.key === key);
    if (!target || target.demand > baseline)
      throw new RangeError("Invalid renovation target");
    const saved = baseline - target.demand;
    return {
      demand: target.demand,
      percent: Math.round((saved / baseline) * 100),
      euros: Math.round((saved * area * price) / 10) * 10,
    };
  }
  const api = Object.freeze({ classes, baseline, area, price, calculate });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PaniEnergy = api;
})(globalThis);
