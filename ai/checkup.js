// Free domain checkup: calls the scanner API and renders grades.
(() => {
  const API = "https://wesche-checkup.vercel.app/api/scan";
  const form = document.getElementById("scan-form");
  if (!form) return;
  const input = document.getElementById("scan-domain");
  const button = document.getElementById("scan-button");
  const status = document.getElementById("scan-status");
  const out = document.getElementById("scan-result");
  const LABEL = { red: "Fix now", yellow: "Worth fixing", green: "Good", grey: "Nothing to grade" };
  const MARK = { fail: "✗", warn: "!", pass: "✓", info: "·" };
  const ORDER = { fail: 0, warn: 1, pass: 2, info: 3 };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function render(data) {
    out.replaceChildren();
    const head = el("div", "scan-head");
    head.append(el("strong", null, data.domain), el("span", null, "Scanned " + data.scanned_at));
    out.append(head);

    const cards = el("div", "scan-cards");
    for (const [area, grade] of Object.entries(data.grades)) {
      const c = el("div", "scan-card " + grade);
      c.append(el("span", "dot"), el("strong", null, area), el("span", "g", LABEL[grade]));
      cards.append(c);
    }
    out.append(cards);

    const fixes = data.findings.filter(f => (f.status === "fail" || f.status === "warn") && f.fix)
      .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
    if (fixes.length) {
      out.append(el("h3", null, "Fix first"));
      const ol = el("ol", "scan-fixes");
      for (const f of fixes) {
        const li = el("li");
        li.append(el("strong", null, f.title + ". "), document.createTextNode(f.fix));
        ol.append(li);
      }
      out.append(ol);
    }

    const details = el("details", "scan-details");
    details.append(el("summary", null, "All findings"));
    for (const area of Object.keys(data.grades)) {
      const items = data.findings.filter(f => f.area === area).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
      if (!items.length) continue;
      details.append(el("h4", null, area));
      const ul = el("ul");
      for (const f of items) {
        const li = el("li", f.status);
        li.append(el("span", "m", MARK[f.status]), el("strong", null, f.title));
        if (f.detail) li.append(el("small", null, f.detail));
        ul.append(li);
      }
      details.append(ul);
    }
    out.append(details);

    const cta = el("p", "scan-cta");
    cta.append(document.createTextNode("This is an outside-in scan, not a full assessment. "));
    const a = el("a", null, "Ask about a full AI risk checkup ↘");
    a.href = "#contact";
    cta.append(a);
    out.append(cta);
    out.hidden = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const domain = input.value.trim();
    if (!domain) { input.focus(); return; }
    button.disabled = true;
    out.hidden = true;
    status.textContent = "Scanning " + domain + "… about 15 seconds.";
    try {
      const resp = await fetch(API + "?domain=" + encodeURIComponent(domain));
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "The scan failed.");
      status.textContent = "";
      render(data);
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      status.textContent = err.message || "The scan failed. Try again in a minute.";
    } finally {
      button.disabled = false;
    }
  });
})();
