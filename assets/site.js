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
  for (const form of document.querySelectorAll("[data-email-form]")) {
    form.hidden = false;
    if (form.dataset.emailForm === "owner") {
      const query = (window.location && window.location.search) || "";
      const match = /(?:\?|&)type=([^&#]*)/.exec(query);
      const context = match ? decodeURIComponent(match[1]) : "";
      const optionIndex = { weg: 1, miethaus: 2, wohnung: 3 }[context];
      const topic = form.querySelector('[name="topic"]');
      if (topic && optionIndex && topic.options[optionIndex]) {
        topic.selectedIndex = optionIndex;
        form.closest("details")?.setAttribute("open", "");
      }
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const tenant = form.dataset.emailForm === "tenant";
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
      const href = `mailto:info@pani-hv.de?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${lines.join("\n")}\n\n${fields.get("message")}`)}`;
      const status = form.querySelector('[role="status"]');
      status.replaceChildren(
        document.createTextNode(
          english
            ? "Your draft is ready to open in your email app. Nothing has been sent yet. "
            : "Ihr Entwurf wird im E-Mail-Programm geöffnet. Es wurde noch nichts versendet. ",
        ),
      );
      const retry = document.createElement("a");
      retry.href = href;
      retry.textContent = english
        ? "Open draft again"
        : "Entwurf erneut öffnen";
      status.append(
        retry,
        document.createTextNode(
          english
            ? ". Alternatively, email info@pani-hv.de directly."
            : ". Alternativ schreiben Sie direkt an info@pani-hv.de.",
        ),
      );
      window.location.href = href;
    });
  }
})();
