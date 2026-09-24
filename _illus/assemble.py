"""Setzt Baukasten (kit.html) und Motive (_illus/<step>.json) in anfrage.html und
en-enquiry.html ein. Idempotent: ersetzt vorhandenen Kit-Block und die inneren
SVG-Inhalte der Karten je (name, value)."""
import glob
import json
import os
import re

SITE = r"C:\Files 2\PANI\Website"
SVG_OPEN = '<svg class="choice-art" viewBox="0 0 120 80" aria-hidden="true" focusable="false">'
kit = open(f"{SITE}/_illus/kit.html", encoding="utf-8").read().strip()
steps = {}
for f in sorted(glob.glob(f"{SITE}/_illus/*.json")):
    steps[os.path.basename(f)[:-5]] = json.load(open(f, encoding="utf-8"))

for fn in ("anfrage.html", "en-enquiry.html"):
    p = f"{SITE}/{fn}"
    s = open(p, encoding="utf-8").read()
    indent = "        "
    block = indent + kit.replace("\n", "\n" + indent)
    if 'class="enquiry-kit"' in s:
        s, k = re.subn(r'[ \t]*<svg class="enquiry-kit".*?</svg>', lambda m: block, s, count=1, flags=re.S)
        assert k == 1
    else:
        m = re.search(r"<form[^>]*data-enquiry[^>]*>", s)
        assert m, fn
        s = s[: m.end()] + "\n" + block + s[m.end():]
    n = 0
    for step, opts in steps.items():
        for value, inner in opts.items():
            assert "<svg" not in inner, (step, value, "verschachteltes svg")
            assert "\u2013" not in inner and "\u2014" not in inner
            head = '<input[^>]*name="%s"[^>]*value="%s"[^>]*>' % (re.escape(step), re.escape(value))
            pat = re.compile("(" + head + "[ \\t\\r\\n]*" + re.escape(SVG_OPEN) + ").*?(</svg>)", re.S)
            s, k = pat.subn(lambda m: m.group(1) + inner.strip() + m.group(2), s, count=1)
            assert k == 1, (fn, step, value)
            n += 1
    open(p, "w", encoding="utf-8", newline="").write(s)
    print(fn, "Motive eingesetzt:", n)
