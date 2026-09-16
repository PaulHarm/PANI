(() => {
  "use strict";
  const page = document.querySelector(".services-page");
  if (!page) return;
  const english = document.documentElement.lang === "en";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Keep all content visible without JavaScript. Motion starts on entering view.
  const revealTargets = page.querySelectorAll(
    ".process-journey, .service-process-step, .special-carousel, .development-photo",
  );
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 },
    );
    for (const target of revealTargets) observer.observe(target);
    reducedMotion.addEventListener("change", (event) => {
      if (!event.matches) return;
      observer.disconnect();
      for (const target of revealTargets) target.classList.add("is-revealed");
    });
  } else {
    for (const target of revealTargets) target.classList.add("is-revealed");
  }

  for (const carousel of page.querySelectorAll("[data-carousel]")) {
    const slides = [...carousel.querySelectorAll("[data-carousel-slide]")];
    const previous = carousel.querySelector("[data-carousel-prev]");
    const next = carousel.querySelector("[data-carousel-next]");
    const position = carousel.querySelector("[data-carousel-position]");
    const dots = carousel.querySelector("[data-carousel-dots]");
    const track = carousel.querySelector(".special-carousel-track");
    if (slides.length < 2 || !previous || !next || !position || !dots || !track)
      continue;

    let active = Math.max(
      0,
      slides.findIndex((slide) => slide.classList.contains("is-active")),
    );
    carousel.setAttribute("role", "region");
    carousel.setAttribute("aria-labelledby", "special-title");
    carousel.dataset.direction = "next";

    const selectors = slides.map((slide, index) => {
      const title = slide.querySelector("h3").textContent.trim();
      slide.setAttribute("role", "group");
      slide.setAttribute(
        "aria-label",
        `${index + 1} ${english ? "of" : "von"} ${slides.length}: ${title}`,
      );
      const dot = document.createElement("button");
      dot.className = "carousel-dot";
      dot.type = "button";
      dot.title = title;
      dot.setAttribute(
        "aria-label",
        english ? `Show ${title}` : `${title} anzeigen`,
      );
      dot.addEventListener("click", () =>
        setSlide(index, index > active ? "next" : "previous"),
      );
      dots.append(dot);
      return dot;
    });

    const render = () => {
      slides.forEach((slide, index) => {
        const selected = index === active;
        slide.classList.toggle("is-active", selected);
        slide.setAttribute("aria-hidden", String(!selected));
        slide.inert = !selected;
        selectors[index].classList.toggle("is-active", selected);
        selectors[index].setAttribute("aria-current", String(selected));
      });
      position.textContent = `${String(active + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    };

    // CSS owns interruption and timing, so rapid clicks never queue old slides.
    const setSlide = (index, direction) => {
      const target = (index + slides.length) % slides.length;
      if (target === active) return;
      if (slides[active].contains(document.activeElement))
        carousel.focus({ preventScroll: true });
      carousel.dataset.direction = direction;
      active = target;
      render();
    };
    previous.addEventListener("click", () => setSlide(active - 1, "previous"));
    next.addEventListener("click", () => setSlide(active + 1, "next"));
    carousel.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const forwards = event.key === "ArrowRight";
      setSlide(active + (forwards ? 1 : -1), forwards ? "next" : "previous");
    });

    let gesture = null;
    track.addEventListener("pointerdown", (event) => {
      if (
        event.pointerType === "mouse" ||
        !event.isPrimary ||
        event.target.closest("a, button")
      )
        return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    track.addEventListener("pointercancel", () => {
      gesture = null;
    });
    track.addEventListener("pointerup", (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gesture = null;
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      setSlide(active + (dx < 0 ? 1 : -1), dx < 0 ? "next" : "previous");
    });
    render();
    carousel.classList.add("is-ready");
  }
})();
