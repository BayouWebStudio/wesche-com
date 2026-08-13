const tabs = [...document.querySelectorAll("[data-scene]")];
const frame = document.querySelector("#scene-frame");
const title = document.querySelector("#scene-title");
const meta = document.querySelector("#scene-meta");
const openLink = document.querySelector("#scene-open");
const rawLink = document.querySelector("#scene-raw");
const restart = document.querySelector("#scene-restart");
const stage = document.querySelector(".scene-stage");

function selectScene(tab, updateHash = true) {
  if (!tab || !frame) return;

  tabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
  });

  title.textContent = tab.dataset.title;
  meta.textContent = tab.dataset.meta;
  openLink.href = tab.dataset.src;
  if (rawLink) {
    rawLink.hidden = !tab.dataset.raw;
    rawLink.href = tab.dataset.raw || "#";
  }
  stage.classList.add("is-loading");
  frame.src = tab.dataset.src;

  if (updateHash) history.replaceState(null, "", `#${tab.dataset.scene}`);
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectScene(tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    next.focus();
    selectScene(next);
  });
});

frame?.addEventListener("load", () => stage.classList.remove("is-loading"));
restart?.addEventListener("click", () => {
  stage.classList.add("is-loading");
  frame.src = frame.src;
});

const initial = tabs.find((tab) => tab.dataset.scene === location.hash.slice(1)) || tabs[0];
selectScene(initial, false);
