(() => {
  "use strict";
  const english = document.documentElement.lang === "en";
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");
  const setMenu = (open) => {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      english
        ? open
          ? "Close menu"
          : "Open menu"
        : open
          ? "Menü schließen"
          : "Menü öffnen",
    );
    toggle.setAttribute("title", toggle.getAttribute("aria-label"));
    menu.hidden = !open;
  };
  toggle?.addEventListener("click", () =>
    setMenu(toggle.getAttribute("aria-expanded") !== "true"),
  );
  menu?.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle?.getAttribute("aria-expanded") === "true"
    ) {
      setMenu(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-header")) setMenu(false);
  });
  window
    .matchMedia("(min-width: 801px)")
    .addEventListener("change", (event) => {
      if (event.matches) setMenu(false);
    });

  // Desktop: services dropdown. Mouse users open it on hover (CSS); the
  // chevron button toggles it for keyboard and touch.
  for (const item of document.querySelectorAll("[data-nav-menu]")) {
    const button = item.querySelector(".nav-menu-toggle");
    if (!button) continue;
    const setOpen = (open) => {
      item.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
    };
    button.addEventListener("click", () =>
      setOpen(!item.classList.contains("is-open")),
    );
    item.addEventListener("focusout", (event) => {
      if (!item.contains(event.relatedTarget)) setOpen(false);
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && item.classList.contains("is-open")) {
        setOpen(false);
        button.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!item.contains(event.target)) setOpen(false);
    });
  }

  // Desktop: the floating tenant pill steps back while the contact form is
  // in view, so it never sits on top of input fields.
  const dock = document.querySelector(".tenant-dock");
  const contactForm = document.querySelector("[data-email-form]");
  if (
    dock &&
    contactForm &&
    typeof IntersectionObserver !== "undefined" &&
    !document.body.classList.contains("no-tenant-dock")
  ) {
    const pillMode = window.matchMedia("(min-width: 801px)");
    let formVisible = false;
    const applyDock = () => {
      dock.classList.toggle("is-tucked", pillMode.matches && formVisible);
    };
    new IntersectionObserver(
      (entries) => {
        formVisible = entries.some((entry) => entry.isIntersecting);
        applyDock();
      },
      { threshold: 0 },
    ).observe(contactForm);
    pillMode.addEventListener("change", applyDock);
  }

  // Prepare a draft locally. No form data is sent to an unconfigured service.
  // Status texts, the copy panel and the mailto address come from the shared
  // draft module (assets/draft.js, loaded before this file). Without it the
  // forms stay hidden and the contact details on the page remain the way in.
  const draft = window.PaniDraft;
  const lang = english ? "en" : "de";
  // Start page: ?type= preselects the matching entry of the topic list (by
  // position, so the option texts can change without touching this table).
  const ownerTopics = new Map([
    ["weg", 1],
    ["miethaus", 2],
    ["wohnung", 3],
    ["sanierung", 4],
    ["baubetreuung", 4],
  ]);
  const emailForms = draft
    ? document.querySelectorAll("[data-email-form]")
    : [];
  for (const form of emailForms) {
    const tenant = form.dataset.emailForm === "tenant";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const subject = `${tenant ? (english ? "Tenant enquiry" : "Mieteranliegen") : english ? "Property management enquiry" : "Anfrage zur Hausverwaltung"} - ${fields.get("topic")}`;
      const lines = english
        ? [
            `Name: ${fields.get("name")}`,
            `Email: ${fields.get("email")}`,
            `Phone: ${fields.get("phone") || "-"}`,
            `Topic: ${fields.get("topic")}`,
          ]
        : [
            `Name: ${fields.get("name")}`,
            `E-Mail: ${fields.get("email")}`,
            `Telefon: ${fields.get("phone") || "-"}`,
            `Anliegen: ${fields.get("topic")}`,
          ];
      if (tenant)
        lines.push(
          `${english ? "Property / apartment" : "Objekt / Wohnung"}: ${fields.get("address")}`,
        );
      draft.show({
        doc: document,
        win: window,
        status: form.querySelector('[role="status"]'),
        draft: draft.compose({
          subject,
          body: `${lines.join("\n")}\n\n${fields.get("message")}`,
          lang,
        }),
        lang,
      });
    });
    // Changing a field after a draft was prepared withdraws the status and
    // the draft panel, so the page never shows a draft that no longer
    // matches the fields.
    const statusNode = form.querySelector('[role="status"]');
    for (const type of ["input", "change"])
      form.addEventListener(type, () => draft.reset(statusNode));
    if (form.dataset.emailForm === "owner") {
      // presetFor never throws: a broken or unknown ?type= simply selects
      // nothing.
      const preset = draft.presetFor(window.location && window.location.search);
      const optionIndex = preset ? ownerTopics.get(preset.key) : 0;
      const topic = form.querySelector('[name="topic"]');
      if (topic && optionIndex && topic.options[optionIndex])
        topic.selectedIndex = optionIndex;
    }
    // Last step: the form only appears once its submit handler is in place.
    form.hidden = false;
  }
})();
