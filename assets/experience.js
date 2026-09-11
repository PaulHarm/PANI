(() => {
  "use strict";
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const english = document.documentElement.lang === "en";
  const format = new Intl.NumberFormat(english ? "en-GB" : "de-DE");
  for (const calculator of document.querySelectorAll("[data-energy]")) {
    const model = window.PaniEnergy;
    if (!model) continue;
    calculator.querySelector("fieldset").disabled = false;
    const outputs = [...calculator.querySelectorAll("[data-value]")];
    const summary = calculator.querySelector("[data-energy-summary]");
    let current = model.calculate("C");
    let frame = 0;
    let target = current;
    function paint(values) {
      for (const node of outputs) {
        const value = Math.round(values[node.dataset.value]);
        const sign = node.dataset.value === "percent" && value > 0 ? "−" : "";
        node.textContent = sign + format.format(value);
      }
    }
    function stop() {
      cancelAnimationFrame(frame);
      current = target;
      paint(current);
    }
    function update(key) {
      target = model.calculate(key);
      cancelAnimationFrame(frame);
      calculator.dataset.target = key;
      summary.textContent = english
        ? `Target ${key}: ${target.demand} kWh per square metre per year, ${target.percent}% less energy, approximately ${format.format(target.euros)} euros saved per year in this example.`
        : `Ziel ${key}: ${target.demand} Kilowattstunden je Quadratmeter und Jahr, ${target.percent} Prozent weniger Energie, im Beispiel rund ${format.format(target.euros)} Euro Ersparnis im Jahr.`;
      if (motion.matches) {
        stop();
        return;
      }
      const from = { ...current };
      const started = performance.now();
      function animate(now) {
        const progress = Math.min(1, (now - started) / 550);
        const eased = 1 - Math.pow(1 - progress, 3);
        for (const name of Object.keys(target))
          current[name] = from[name] + (target[name] - from[name]) * eased;
        paint(current);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      frame = requestAnimationFrame(animate);
    }
    calculator.addEventListener("change", (event) => {
      if (event.target.matches('input[name="energy-target"]'))
        update(event.target.value);
    });
    motion.addEventListener("change", () => {
      if (motion.matches) stop();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
    });
  }
  const visuals = document.querySelectorAll("[data-animate]");
  if (motion.matches || !("IntersectionObserver" in window)) {
    visuals.forEach((node) => node.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    visuals.forEach((node) => observer.observe(node));
  }
})();
