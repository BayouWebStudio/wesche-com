// Free chatbot audit: calls the wesche-audit API and renders findings.
(() => {
  const API = "https://wesche-audit.vercel.app/api/audit";
  const form = document.getElementById("bot-form");
  if (!form) return;
  const input = document.getElementById("bot-url");
  const button = document.getElementById("bot-button");
  const status = document.getElementById("bot-status");
  const out = document.getElementById("bot-result");
  const LABEL = { red: "Fix now", yellow: "Worth fixing", green: "Good", grey: "Nothing to grade" };
  const MARK = { red: "✗", yellow: "!", green: "✓", grey: "·" };
  const ORDER = { red: 0, yellow: 1, green: 2, grey: 3 };
  const SCORE = { RED: "red", YELLOW: "yellow", GREEN: "green" };
  const SEV = { critical: "red", high: "red", medium: "yellow", low: "grey" };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  async function run(e) {
    e.preventDefault();
    const target = input.value.trim();
    if (!target) return;
    button.disabled = true;
    status.textContent = "Running audit…";
    out.hidden = true;
    try {
      const resp = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        status.textContent = data.error || "The audit could not run. Check the endpoint URL.";
        return;
      }
      status.textContent = "";
      render(data);
    } catch (err) {
      status.textContent = "Network error — the audit API could not be reached.";
    } finally {
      button.disabled = false;
    }
  }

  function render(data) {
    out.replaceChildren();
    const head = el("div", "scan-head");
    head.append(el("strong", null, data.target || "chatbot"), el("span", null, "Scanned " + data.scanned_at));
    out.append(head);

    const grade = SCORE[data.score] || "grey";
    const cards = el("div", "scan-cards");
    const overall = el("div", "scan-card " + grade);
    overall.append(el("span", "dot"), el("strong", null, "Overall"), el("span", "g", LABEL[grade]));
    cards.append(overall);
    const stats = [
      ["Attacks run", data.attacks_run],
      ["Findings", data.findings.length],
      ["Resisted", Object.values(data.resisted || {}).reduce((a, b) => a + b, 0)]
    ];
    for (const [label, value] of stats) {
      const c = el("div", "scan-card green");
      c.append(el("span", "dot"), el("strong", null, label), el("span", "g", String(value)));
      cards.append(c);
    }
    out.append(cards);

    const fixes = data.findings.filter(f => SEV[f.severity] === "red" || SEV[f.severity] === "yellow")
      .sort((a, b) => ORDER[SEV[a.severity]] - ORDER[SEV[b.severity]]);
    if (fixes.length) {
      out.append(el("h3", null, "Fix first"));
      const ol = el("ol", "scan-fixes");
      for (const f of fixes) {
        const li = el("li");
        li.append(el("strong", null, f.name + ". "), document.createTextNode(f.description));
        if (f.response_excerpt) li.append(el("small", null, "Bot replied: " + f.response_excerpt));
        ol.append(li);
      }
      out.append(ol);
    } else {
      out.append(el("h3", null, "No injection or leak issues found in this run."));
    }

    const details = el("details", "scan-details");
    details.append(el("summary", null, "All findings"));
    for (const sev of Object.keys(ORDER)) {
      const items = data.findings.filter(f => SEV[f.severity] === sev).sort((a, b) => ORDER[SEV[a.severity]] - ORDER[SEV[b.severity]]);
      if (!items.length) continue;
      details.append(el("h4", null, LABEL[sev]));
      const ul = el("ul");
      for (const f of items) {
        const li = el("li", sev);
        li.append(el("span", "m", MARK[sev]), el("strong", null, f.name));
        if (f.owasp) li.append(el("small", null, "OWASP " + f.owasp));
        if (f.description) li.append(el("small", null, f.description));
        ul.append(li);
      }
      details.append(ul);
    }
    out.append(details);
    out.hidden = false;
  }

  form.addEventListener("submit", run);
})();
