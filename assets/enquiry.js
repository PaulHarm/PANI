// Klick-Fragebogen "Betreuung anfragen": ein Schritt nach dem anderen,
// Fortschritt, Zurueck, Zusammenfassung und am Ende ein E-Mail-Entwurf per
// mailto. Es wird nichts automatisch versendet. Ohne JavaScript bleibt das
// Formular eine lange Seite, die per mailto-Action abgeschickt wird.
(() => {
  "use strict";
  const form = document.querySelector("[data-enquiry]");
  if (!form) return;
  const english = document.documentElement.lang === "en";
  const text = english
    ? {
        progress: (n, total) => `Step ${n} of ${total}`,
        next: "Continue",
        skip: "Skip",
        toSummary: "Back to summary",
        chooseOne: "Please choose one of the cards to continue.",
        change: "Change",
        none: "Not specified",
        subject: "Property management enquiry",
        labels: {
          name: "Name",
          email: "Email",
          phone: "Phone",
          address: "Property address / district",
          objekt: "Property",
          groesse: "Units",
          situation: "Management today",
          themen: "Topics",
          lage: "Location",
          message: "Message",
        },
        status: {
          ready: "Your draft is ready to open in your email app. Nothing has been sent yet. ",
          retry: "Open draft again",
          alt: ". Alternatively, email info@pani-hv.de directly.",
        },
      }
    : {
        progress: (n, total) => `Schritt ${n} von ${total}`,
        next: "Weiter",
        skip: "Überspringen",
        toSummary: "Zur Zusammenfassung",
        chooseOne: "Bitte wählen Sie eine der Karten, um fortzufahren.",
        change: "Ändern",
        none: "Keine Angabe",
        subject: "Anfrage zur Hausverwaltung",
        labels: {
          name: "Name",
          email: "E-Mail",
          phone: "Telefon",
          address: "Objektadresse / Bezirk",
          objekt: "Objekt",
          groesse: "Einheiten",
          situation: "Verwaltung heute",
          themen: "Themen",
          lage: "Lage",
          message: "Nachricht",
        },
        status: {
          ready: "Ihr Entwurf wird im E-Mail-Programm geöffnet. Es wurde noch nichts versendet. ",
          retry: "Entwurf erneut öffnen",
          alt: ". Alternativ schreiben Sie direkt an info@pani-hv.de.",
        },
      };

  const steps = Array.from(form.querySelectorAll("[data-step]"));
  const progress = form.querySelector("[data-progress]");
  const progressText = form.querySelector("[data-progress-text]");
  const progressBar = form.querySelector("[data-progress-bar]");
  const presetLine = form.querySelector("[data-preset]");
  const detailHint = form.querySelector("[data-detail-hint]");
  const back = form.querySelector("[data-back]");
  const next = form.querySelector("[data-next]");
  const submit = form.querySelector("[data-submit]");
  const summary = form.querySelector("[data-summary]");
  const status = form.querySelector('[role="status"]');
  const nextLabel = next.firstChild;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const stepById = (id) => steps.find((step) => step.dataset.step === id);
  const value = (name) =>
    form.querySelector(`input[name="${name}"]:checked`)?.value || "";
  const labelFor = (input) =>
    input.closest(".choice")?.querySelector("strong")?.textContent.trim() ||
    input.value;
  const answers = (name) =>
    Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(
      labelFor,
    );

  // Die Einheitenfrage entfaellt bei einer einzelnen Wohnung.
  const isSkipped = (step) =>
    step.dataset.step === "groesse" && value("objekt") === "wohnung";
  const activeSteps = () => steps.filter((step) => !isSkipped(step));
  const isAnswered = (step) =>
    step.dataset.type !== "single" || Boolean(value(step.dataset.step));
  const contactIndex = () =>
    activeSteps().findIndex((step) => step.dataset.type === "contact");

  let current = 0;
  let advanceTimer = 0;
  // Nach "Aendern" in der Zusammenfassung geht es nach der Antwort direkt
  // zurueck zum Kontaktschritt, sofern kein offener Pflichtschritt dazwischen liegt.
  let returnToSummary = false;
  let presetUsed = false;

  const showError = (step, message) => {
    const error = step.querySelector("[data-error]");
    if (!error) return;
    error.textContent = message || "";
    error.hidden = !message;
  };

  // Scrollt so, dass der Kopf des Schritts (Frage, Hilfe, Fehlermeldung) im Bild ist.
  const scrollToStep = (step) => {
    const top = step.getBoundingClientRect().top + window.scrollY - 110;
    if (top < window.scrollY || top > window.scrollY + 40) {
      window.scrollTo({
        top: Math.max(0, top),
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    }
  };

  // Erster offener Pflichtschritt zwischen dem aktuellen und dem Kontaktschritt.
  const nextOpenStep = () => {
    const list = activeSteps();
    for (let i = current + 1; i < list.length; i++) {
      if (list[i].dataset.type === "contact") return -1;
      if (!isAnswered(list[i])) return i;
    }
    return -1;
  };

  const renderSummary = () => {
    if (!summary) return;
    const list = summary.querySelector("dl");
    list.replaceChildren();
    for (const step of activeSteps()) {
      if (step.dataset.type === "contact") continue;
      const id = step.dataset.step;
      const dt = document.createElement("dt");
      dt.textContent = text.labels[id] || id;
      const dd = document.createElement("dd");
      const chosen = answers(id);
      const span = document.createElement("span");
      span.textContent = chosen.length ? chosen.join(", ") : text.none;
      const change = document.createElement("button");
      change.type = "button";
      change.textContent = text.change;
      change.setAttribute(
        "aria-label",
        `${text.change}: ${step.querySelector(".enquiry-question").textContent}`,
      );
      change.addEventListener("click", () => {
        returnToSummary = true;
        goTo(activeSteps().indexOf(step));
      });
      dd.append(span, change);
      list.append(dt, dd);
    }
    summary.hidden = false;
  };

  const renderPreset = () => {
    if (!presetLine) return;
    const active = activeSteps()[current];
    const show =
      presetUsed && current > 0 && active.dataset.type !== "contact";
    presetLine.hidden = !show;
    if (!show) return;
    presetLine.replaceChildren(
      document.createTextNode(
        `${text.labels.objekt}: ${answers("objekt")[0] || text.none} `,
      ),
    );
    const change = document.createElement("button");
    change.type = "button";
    change.textContent = text.change;
    change.setAttribute(
      "aria-label",
      `${text.change}: ${stepById("objekt").querySelector(".enquiry-question").textContent}`,
    );
    change.addEventListener("click", () => goTo(0));
    presetLine.append(change);
  };

  const renderDetailHint = () => {
    if (!detailHint) return;
    detailHint.hidden = !(
      value("objekt") === "offen" || value("situation") === "sonstiges"
    );
  };

  const updateNextLabel = (active) => {
    if (returnToSummary && nextOpenStep() === -1) {
      nextLabel.textContent = text.toSummary;
    } else if (active.dataset.type === "multi") {
      nextLabel.textContent = answers(active.dataset.step).length
        ? text.next
        : text.skip;
    } else {
      nextLabel.textContent = text.next;
    }
  };

  const goTo = (index, { focus = true } = {}) => {
    window.clearTimeout(advanceTimer);
    const list = activeSteps();
    current = Math.max(0, Math.min(index, list.length - 1));
    const active = list[current];
    for (const step of steps) {
      const on = step === active;
      step.classList.toggle("is-active", on);
      // Uebersprungene Schritte zaehlen weder fuer die Pruefung noch fuer den Entwurf.
      step.disabled = isSkipped(step);
      if (!on) showError(step, "");
    }
    const type = active.dataset.type;
    if (type === "contact") returnToSummary = false;
    progressText.textContent = text.progress(current + 1, list.length);
    progressBar.style.width = `${Math.round(((current + 1) / list.length) * 100)}%`;
    back.hidden = current === 0;
    next.hidden = type === "contact";
    submit.hidden = type !== "contact";
    updateNextLabel(active);
    renderPreset();
    if (type === "contact") {
      renderSummary();
      renderDetailHint();
    }
    if (focus) {
      const heading = active.querySelector(".enquiry-question");
      heading.focus({ preventScroll: true });
      scrollToStep(active);
    }
  };

  const validateStep = (step) => {
    if (step.dataset.type === "single" && !value(step.dataset.step)) {
      showError(step, text.chooseOne);
      // Die Fehlermeldung steht im Kopf des Schritts: erst dorthin scrollen,
      // dann die erste Karte fokussieren, ohne den Ausschnitt zu verschieben.
      scrollToStep(step);
      step.querySelector("input")?.focus({ preventScroll: true });
      return false;
    }
    showError(step, "");
    return true;
  };

  const forward = () => {
    const active = activeSteps()[current];
    if (!validateStep(active)) return;
    if (returnToSummary) {
      const open = nextOpenStep();
      goTo(open === -1 ? contactIndex() : open);
      return;
    }
    goTo(current + 1);
  };

  // Mausklick oder Tipp auf eine Karte: kurz warten, dann weiter. Bei
  // Tastaturbedienung (Pfeiltasten) bleibt der Schritt offen, Enter oder
  // "Weiter" fuehrt weiter.
  let pointerAt = 0;
  form.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".choice")) pointerAt = Date.now();
  });
  form.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const step = input.closest("[data-step]");
    if (!step) return;
    if (step.dataset.type === "single") {
      showError(step, "");
      if (step.dataset.step === "objekt") {
        // Auswahl der Objektart aendert die Zahl der Schritte.
        goTo(current, { focus: false });
      } else {
        updateNextLabel(step);
      }
      const byPointer = Date.now() - pointerAt < 600;
      if (byPointer) {
        window.clearTimeout(advanceTimer);
        advanceTimer = window.setTimeout(forward, reducedMotion.matches ? 0 : 250);
      }
    } else if (step.dataset.type === "multi") {
      // "Nichts Besonderes" schliesst die anderen Themen aus und umgekehrt.
      if (input.checked) {
        const boxes = step.querySelectorAll(`input[name="${input.name}"]`);
        for (const box of boxes) {
          if (box === input) continue;
          if (input.value === "keine" || box.value === "keine") box.checked = false;
        }
      }
      updateNextLabel(step);
    }
  });
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const step = event.target.closest("[data-step]");
    if (!step || step.dataset.type === "contact") return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (input.type === "checkbox") {
      // Enter schaltet nur um; weiter geht es ueber "Weiter".
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (input.type === "radio") input.checked = true;
    forward();
  });
  back.addEventListener("click", () => {
    returnToSummary = false;
    goTo(current - 1);
  });
  next.addEventListener("click", forward);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = activeSteps();
    for (let i = 0; i < list.length; i++) {
      if (list[i].dataset.type !== "contact" && !validateStep(list[i])) {
        goTo(i);
        return;
      }
    }
    const contact = stepById("kontakt");
    for (const field of contact.querySelectorAll("input, textarea")) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return;
      }
    }
    const fields = new FormData(form);
    const get = (key) => String(fields.get(key) || "").trim();
    const objekt = answers("objekt")[0] || text.none;
    const subject = `${text.subject} - ${objekt}`;
    const lines = [
      `${text.labels.name}: ${get("name")}`,
      `${text.labels.email}: ${get("email")}`,
      `${text.labels.phone}: ${get("phone") || "-"}`,
      `${text.labels.address}: ${get("address") || "-"}`,
      "",
    ];
    for (const step of list) {
      if (step.dataset.type === "contact") continue;
      const id = step.dataset.step;
      const chosen = answers(id);
      lines.push(
        `${text.labels[id]}: ${chosen.length ? chosen.join(", ") : text.none}`,
      );
    }
    const message = get("message");
    if (message) lines.push("", `${text.labels.message}:`, message);
    const href = `mailto:info@pani-hv.de?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    status.replaceChildren(document.createTextNode(text.status.ready));
    const retry = document.createElement("a");
    retry.href = href;
    retry.textContent = text.status.retry;
    status.append(retry, document.createTextNode(text.status.alt));
    window.location.href = href;
  });

  // Desktop: die schwebende Mieter-Pille tritt zurueck, solange der Fragebogen
  // im Bild ist, damit sie nie ueber "Weiter" oder den Feldern liegt (wie
  // site.js, das das ganze Kontaktformular beobachtet).
  const dock = document.querySelector(".tenant-dock");
  if (dock && typeof IntersectionObserver !== "undefined") {
    const pillMode = window.matchMedia("(min-width: 801px)");
    let visible = false;
    const applyDock = () =>
      dock.classList.toggle("is-tucked", pillMode.matches && visible);
    new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        applyDock();
      },
      { threshold: 0 },
    ).observe(form);
    pillMode.addEventListener("change", applyDock);
  }

  // Start: Formular umschalten, Vorbelegung ueber ?type= beruecksichtigen.
  form.classList.add("is-enhanced");
  progress.hidden = false;
  for (const node of form.querySelectorAll("[data-js-only]")) node.hidden = false;
  const match = /(?:\?|&)type=([^&#]*)/.exec(window.location.search || "");
  const preset = match ? decodeURIComponent(match[1]) : "";
  const presetInput = ["weg", "miethaus", "wohnung"].includes(preset)
    ? form.querySelector(`input[name="objekt"][value="${preset}"]`)
    : null;
  if (presetInput) {
    presetInput.checked = true;
    presetUsed = true;
    goTo(1, { focus: false });
  } else {
    goTo(0, { focus: false });
  }
})();
