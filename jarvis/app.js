"use strict";

let API_BASE = "";
const TOKEN_KEY = "hex_jarvis_token";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  voiceOutput: localStorage.getItem("hex_voice_output") !== "off",
  recorder: null,
  stream: null,
  chunks: [],
  currentNote: null,
  sparksLoaded: false,
  busy: false,
};

const elements = {
  loginScreen: $("#login-screen"),
  app: $("#app"),
  loginForm: $("#login-form"),
  loginButton: $("#login-button"),
  password: $("#password"),
  loginError: $("#login-error"),
  linkDot: $("#link-dot"),
  clock: $("#clock"),
  face: $("#hex-face"),
  faceState: $("#face-state"),
  faceSubstate: $("#face-substate"),
  conversation: $("#conversation"),
  chatForm: $("#chat-form"),
  messageInput: $("#message-input"),
  sendButton: $("#send-button"),
  voiceButton: $("#voice-button"),
  voiceToggle: $("#voice-output-toggle"),
  toast: $("#toast"),
  sparkGrid: $("#spark-grid"),
  vaultResults: $("#vault-results"),
  noteDialog: $("#note-dialog"),
};

async function api(path, options = {}) {
  if (!API_BASE) throw new Error("Secure endpoint is not configured");
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (error) {
    setConnection(false);
    throw new Error("Secure link unavailable");
  }
  setConnection(true);
  if (response.status === 401 && path !== "/api/auth/login") {
    logout("Session expired. Verify identity again.");
    throw new Error("Authentication required");
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch (_) { /* response was not JSON */ }
    throw new Error(detail);
  }
  return response;
}

function setConnection(online) {
  elements.linkDot.classList.toggle("offline", !online);
  elements.linkDot.title = online ? "Secure link online" : "Secure link offline";
}

function showToast(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", error);
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function setFaceState(mode, label, substate) {
  elements.face.dataset.state = mode;
  elements.face.setAttribute("aria-label", `Hex is ${mode}`);
  elements.faceState.textContent = label || mode.toUpperCase();
  elements.faceSubstate.textContent = substate || "";
}

function showApp() {
  elements.loginScreen.hidden = true;
  elements.app.hidden = false;
  elements.voiceToggle.classList.toggle("active", state.voiceOutput);
  elements.voiceToggle.textContent = state.voiceOutput ? "VOICE" : "MUTE";
  setFaceState("idle", "SYSTEM READY", "Tap the core to speak");
  loadSparks();
}

function showLogin(message = "") {
  elements.app.hidden = true;
  elements.loginScreen.hidden = false;
  elements.loginError.textContent = message;
  setTimeout(() => elements.password.focus(), 100);
}

function logout(message = "Secure session ended.") {
  state.token = "";
  localStorage.removeItem(TOKEN_KEY);
  showLogin(message);
}

async function restoreSession() {
  if (!state.token) {
    showLogin();
    return;
  }
  try {
    await api("/api/me");
    showApp();
  } catch (_) {
    if (state.token) logout("Unable to restore secure session.");
  }
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginError.textContent = "";
  elements.loginButton.disabled = true;
  elements.loginButton.firstElementChild.textContent = "Verifying...";
  try {
    const response = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: elements.password.value }),
    });
    const payload = await response.json();
    state.token = payload.token;
    localStorage.setItem(TOKEN_KEY, state.token);
    elements.password.value = "";
    showApp();
  } catch (error) {
    elements.loginError.textContent = error.message;
  } finally {
    elements.loginButton.disabled = false;
    elements.loginButton.firstElementChild.textContent = "Establish secure link";
  }
});

$("#toggle-password").addEventListener("click", () => {
  const visible = elements.password.type === "text";
  elements.password.type = visible ? "password" : "text";
  $("#toggle-password").setAttribute("aria-label", visible ? "Show password" : "Hide password");
});

$("#logout-button").addEventListener("click", () => logout());

function appendMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role === "HEX" ? "hex-message" : "user-message"}`;
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role;
  const body = document.createElement("p");
  body.textContent = text;
  wrapper.append(label, body);
  elements.conversation.append(wrapper);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

async function sendMessage(rawMessage) {
  const message = rawMessage.trim();
  if (!message || state.busy) return;
  state.busy = true;
  elements.sendButton.disabled = true;
  appendMessage("RAUL", message);
  elements.messageInput.value = "";
  autoSizeMessage();
  setFaceState("thinking", "PROCESSING", "Hex is working across your systems");
  try {
    const response = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    const payload = await response.json();
    appendMessage("HEX", payload.response);
    if (state.voiceOutput) {
      await speak(payload.response);
    } else {
      setFaceState("idle", "SYSTEM READY", "Tap the core to speak");
    }
  } catch (error) {
    appendMessage("HEX", `Connection error: ${error.message}`);
    setFaceState("error", "LINK ERROR", error.message);
    showToast(error.message, true);
    setTimeout(() => setFaceState("idle", "SYSTEM READY", "Tap the core to speak"), 2500);
  } finally {
    state.busy = false;
    elements.sendButton.disabled = false;
  }
}

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(elements.messageInput.value);
});

elements.messageInput.addEventListener("input", autoSizeMessage);
elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});

function autoSizeMessage() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 120)}px`;
}

async function speak(text) {
  setFaceState("speaking", "RESPONDING", "Voice channel active");
  try {
    const response = await api("/api/voice/speak", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await new Promise((resolve, reject) => {
      audio.addEventListener("ended", resolve, { once: true });
      audio.addEventListener("error", reject, { once: true });
      audio.play().catch(reject);
    });
    URL.revokeObjectURL(url);
  } catch (error) {
    showToast(`Voice unavailable: ${error.message}`, true);
  } finally {
    setFaceState("idle", "SYSTEM READY", "Tap the core to speak");
  }
}

elements.voiceToggle.addEventListener("click", () => {
  state.voiceOutput = !state.voiceOutput;
  localStorage.setItem("hex_voice_output", state.voiceOutput ? "on" : "off");
  elements.voiceToggle.classList.toggle("active", state.voiceOutput);
  elements.voiceToggle.textContent = state.voiceOutput ? "VOICE" : "MUTE";
  elements.voiceToggle.setAttribute("aria-label", state.voiceOutput ? "Disable spoken replies" : "Enable spoken replies");
});

function supportedAudioType() {
  const choices = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return choices.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast("Voice recording is not supported in this browser.", true);
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mimeType = supportedAudioType();
    state.chunks = [];
    state.recorder = mimeType ? new MediaRecorder(state.stream, { mimeType }) : new MediaRecorder(state.stream);
    state.recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) state.chunks.push(event.data);
    });
    state.recorder.addEventListener("stop", processRecording, { once: true });
    state.recorder.start(250);
    elements.voiceButton.classList.add("recording");
    elements.voiceButton.setAttribute("aria-label", "Stop voice input");
    setFaceState("listening", "LISTENING", "Tap again when you're finished");
    navigator.vibrate?.(40);
  } catch (error) {
    showToast(error.name === "NotAllowedError" ? "Microphone permission is required." : error.message, true);
    setFaceState("idle", "SYSTEM READY", "Tap the core to speak");
  }
}

function stopRecording() {
  if (state.recorder?.state === "recording") state.recorder.stop();
  state.stream?.getTracks().forEach((track) => track.stop());
  elements.voiceButton.classList.remove("recording");
  elements.voiceButton.setAttribute("aria-label", "Start voice input");
  setFaceState("thinking", "TRANSCRIBING", "Local speech recognition active");
  navigator.vibrate?.([30, 20, 30]);
}

async function processRecording() {
  const mimeType = state.recorder?.mimeType || state.chunks[0]?.type || "audio/webm";
  const blob = new Blob(state.chunks, { type: mimeType });
  state.recorder = null;
  state.stream = null;
  if (blob.size < 500) {
    setFaceState("idle", "SYSTEM READY", "Recording was too short");
    return;
  }
  const form = new FormData();
  const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("wav") ? "wav" : "webm";
  form.append("audio", blob, `voice.${extension}`);
  try {
    const response = await api("/api/voice/transcribe", { method: "POST", body: form });
    const payload = await response.json();
    await sendMessage(payload.transcript);
  } catch (error) {
    setFaceState("error", "VOICE ERROR", error.message);
    showToast(error.message, true);
    setTimeout(() => setFaceState("idle", "SYSTEM READY", "Tap the core to speak"), 2200);
  }
}

elements.voiceButton.addEventListener("click", () => {
  if (state.recorder?.state === "recording") stopRecording();
  else if (!state.busy) startRecording();
});

elements.face.addEventListener("click", () => {
  if (state.recorder?.state === "recording") stopRecording();
  else if (!state.busy) startRecording();
});

$$('.nav-button').forEach((button) => {
  button.addEventListener("click", () => activatePanel(button.dataset.panel));
});

function activatePanel(name) {
  $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${name}`));
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.panel === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "sparks") loadSparks(true);
}

async function loadSparks(force = false) {
  if (state.sparksLoaded && !force) return;
  if (force) {
    elements.sparkGrid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
  }
  try {
    const response = await api("/api/sparks");
    const payload = await response.json();
    renderSparks(payload.nodes || []);
    state.sparksLoaded = true;
  } catch (error) {
    elements.sparkGrid.replaceChildren(makeEmptyState(`Cluster probe failed: ${error.message}`));
  }
}

function renderSparks(nodes) {
  elements.sparkGrid.replaceChildren();
  const online = nodes.filter((node) => node.online).length;
  const models = new Set(nodes.flatMap((node) => (node.model_endpoints || []).flatMap((endpoint) => endpoint.models || [])));
  $("#cluster-online").textContent = `${online} / 4`;
  $("#spark-count").textContent = `${online} / 4`;
  $("#cluster-state").textContent = online === 4 ? "NOMINAL" : online ? "DEGRADED" : "OFFLINE";
  $("#cluster-models").textContent = String(models.size);
  nodes.forEach((node) => elements.sparkGrid.append(makeSparkCard(node)));
}

function makeSparkCard(node) {
  const card = document.createElement("article");
  card.className = `spark-card glass${node.online ? "" : " offline"}`;

  const header = document.createElement("div");
  header.className = "spark-card-header";
  const title = document.createElement("div");
  const name = document.createElement("span");
  name.textContent = node.name || "DGX SPARK";
  const hostname = document.createElement("strong");
  hostname.textContent = node.hostname || node.host || "offline";
  title.append(name, hostname);
  const led = document.createElement("i");
  led.className = "node-led";
  header.append(title, led);
  card.append(header);

  if (!node.online) {
    const offline = document.createElement("div");
    offline.className = "model-list";
    offline.textContent = "Node unreachable";
    card.append(offline);
    return card;
  }

  const metrics = document.createElement("div");
  metrics.className = "spark-metrics";
  metrics.append(
    metric("GPU", node.gpu_util_pct == null ? "N/A" : `${node.gpu_util_pct}%`),
    metric("TEMP", node.gpu_temp_c == null ? "N/A" : `${node.gpu_temp_c}°C`),
    metric("POWER", node.power_w == null ? "N/A" : `${Math.round(node.power_w)}W`),
    metric("LOAD", Number(node.load_1m || 0).toFixed(1))
  );
  const memory = document.createElement("div");
  memory.className = "metric memory-bar";
  const memoryLabel = document.createElement("span");
  const used = Number(node.uma_used_gb || 0);
  const total = Number(node.uma_total_gb || 0);
  memoryLabel.textContent = `UMA ${used.toFixed(1)} / ${total.toFixed(1)} GB`;
  const track = document.createElement("div");
  track.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  fill.style.width = `${total ? Math.min(100, used / total * 100) : 0}%`;
  track.append(fill);
  memory.append(memoryLabel, track);
  metrics.append(memory);
  card.append(metrics);

  const endpointModels = (node.model_endpoints || []).flatMap((endpoint) => endpoint.models || []);
  const models = document.createElement("div");
  models.className = "model-list";
  const modelLabel = document.createElement("strong");
  modelLabel.textContent = endpointModels.length ? "SERVING " : "READY ";
  models.append(modelLabel, document.createTextNode(endpointModels.join(", ") || "No model API detected"));
  card.append(models);
  return card;
}

function metric(label, value) {
  const item = document.createElement("div");
  item.className = "metric";
  const span = document.createElement("span");
  span.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  item.append(span, strong);
  return item;
}

$("#refresh-sparks").addEventListener("click", () => loadSparks(true));

$("#vault-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  searchVault($("#vault-query").value);
});

$$('[data-vault-query]').forEach((button) => button.addEventListener("click", () => {
  $("#vault-query").value = button.dataset.vaultQuery;
  searchVault(button.dataset.vaultQuery);
}));

async function searchVault(query) {
  const cleaned = query.trim();
  if (!cleaned) return;
  elements.vaultResults.replaceChildren(makeEmptyState("Searching the knowledge core..."));
  try {
    const response = await api(`/api/vault/search?q=${encodeURIComponent(cleaned)}`);
    const payload = await response.json();
    renderVaultResults(payload.results || []);
  } catch (error) {
    elements.vaultResults.replaceChildren(makeEmptyState(error.message));
  }
}

function renderVaultResults(results) {
  elements.vaultResults.replaceChildren();
  if (!results.length) {
    elements.vaultResults.append(makeEmptyState("No matching notes found."));
    return;
  }
  results.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vault-result";
    const path = document.createElement("span");
    path.textContent = result.path;
    const title = document.createElement("strong");
    title.textContent = result.title;
    const snippet = document.createElement("p");
    snippet.textContent = result.snippet;
    button.append(path, title, snippet);
    button.addEventListener("click", () => openNote(result.path));
    elements.vaultResults.append(button);
  });
}

function makeEmptyState(message) {
  const item = document.createElement("div");
  item.className = "empty-state glass";
  const text = document.createElement("p");
  text.textContent = message;
  item.append(text);
  return item;
}

async function openNote(path) {
  try {
    const response = await api(`/api/vault/note?path=${encodeURIComponent(path)}`);
    const note = await response.json();
    state.currentNote = note;
    $("#note-title").textContent = note.title;
    $("#note-path").textContent = note.path;
    $("#note-content").textContent = note.content;
    elements.noteDialog.showModal();
  } catch (error) {
    showToast(error.message, true);
  }
}

$("#close-note").addEventListener("click", () => elements.noteDialog.close());
elements.noteDialog.addEventListener("click", (event) => {
  if (event.target === elements.noteDialog) elements.noteDialog.close();
});
$("#ask-about-note").addEventListener("click", () => {
  if (!state.currentNote) return;
  elements.noteDialog.close();
  activatePanel("command");
  elements.messageInput.value = `Regarding the Obsidian note "${state.currentNote.title}" (${state.currentNote.path}): `;
  autoSizeMessage();
  elements.messageInput.focus();
});

function updateClock() {
  elements.clock.textContent = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
setInterval(updateClock, 1000);
updateClock();

window.addEventListener("online", () => setConnection(true));
window.addEventListener("offline", () => setConnection(false));

function startParticleField() {
  const canvas = $("#field");
  const context = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let particles = [];

  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * scale;
    canvas.height = innerHeight * scale;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    particles = Array.from({ length: Math.min(52, Math.floor(innerWidth / 10)) }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 1.2 + .2,
      speed: Math.random() * .15 + .04,
      alpha: Math.random() * .32 + .08,
    }));
  }

  function draw() {
    context.clearRect(0, 0, innerWidth, innerHeight);
    for (const particle of particles) {
      context.fillStyle = `rgba(69,245,223,${particle.alpha})`;
      context.fillRect(particle.x, particle.y, particle.r, particle.r);
      if (!reduced) {
        particle.y -= particle.speed;
        if (particle.y < -2) { particle.y = innerHeight + 2; particle.x = Math.random() * innerWidth; }
      }
    }
    requestAnimationFrame(draw);
  }

  addEventListener("resize", resize, { passive: true });
  resize();
  draw();
}

startParticleField();

async function initialize() {
  try {
    const response = await fetch("api-endpoint.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Endpoint discovery failed");
    const payload = await response.json();
    const endpoint = String(payload.api_base || "").replace(/\/$/, "");
    if (!/^https:\/\/[a-z0-9-]+[.]trycloudflare[.]com$/i.test(endpoint)) {
      throw new Error("Endpoint configuration is invalid");
    }
    API_BASE = endpoint;
    await restoreSession();
  } catch (error) {
    setConnection(false);
    showLogin("Secure endpoint is updating. Reload in a moment.");
  }
}

initialize();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("/jarvis/sw.js").catch(() => {}));
}
