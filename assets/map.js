(() => {
  "use strict";
  // Two-click map: Google Maps is only requested after an explicit click, so
  // no visitor data reaches Google while the page is merely being viewed.
  for (const wrap of document.querySelectorAll("[data-map]")) {
    const placeholder = wrap.querySelector("[data-map-placeholder]");
    const consent = wrap.querySelector("[data-map-consent]");
    const load = wrap.querySelector("[data-map-load]");
    const hide = wrap.querySelector("[data-map-hide]");
    if (!placeholder || !consent || !load || !hide) continue;
    consent.hidden = false;
    let frame = null;

    load.addEventListener("click", () => {
      frame = document.createElement("iframe");
      frame.className = "map-frame";
      frame.src = wrap.dataset.mapSrc;
      frame.title = wrap.dataset.mapTitle;
      frame.referrerPolicy = "no-referrer-when-downgrade";
      frame.allowFullscreen = true;
      placeholder.hidden = true;
      wrap.insertBefore(frame, hide);
      hide.hidden = false;
      hide.focus();
    });

    hide.addEventListener("click", () => {
      frame?.remove();
      frame = null;
      placeholder.hidden = false;
      hide.hidden = true;
      load.focus();
    });
  }
})();
