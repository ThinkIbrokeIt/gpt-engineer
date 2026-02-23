/* ===== Saved settings via localStorage ===== */
const STORAGE_KEY = "gpte_settings";

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/* ===== DOM refs ===== */
const setupScreen      = document.getElementById("setupScreen");
const mainScreen       = document.getElementById("mainScreen");
const setupDoneBtn     = document.getElementById("setupDoneBtn");
const setupApiKey      = document.getElementById("setupApiKey");
const setupBaseUrl     = document.getElementById("setupBaseUrl");
const setupBaseUrlWrap = document.getElementById("setupBaseUrlWrap");
const setupModel       = document.getElementById("setupModel");
const setupError       = document.getElementById("setupError");
const setupKeyHint     = document.getElementById("setupKeyHint");
const setupProviderBtns = document.getElementById("setupProviderBtns");

const settingsBtn       = document.getElementById("settingsBtn");
const settingsModal     = document.getElementById("settingsModal");
const settingsSaveBtn   = document.getElementById("settingsSaveBtn");
const settingsCancelBtn = document.getElementById("settingsCancelBtn");
const settingsApiKey    = document.getElementById("settingsApiKey");
const settingsBaseUrl   = document.getElementById("settingsBaseUrl");
const settingsBaseUrlWrap = document.getElementById("settingsBaseUrlWrap");
const settingsModel     = document.getElementById("settingsModel");
const settingsProviderBtns = document.getElementById("settingsProviderBtns");

const runButton         = document.getElementById("runButton");
const promptEl          = document.getElementById("prompt");
const interactionArea   = document.getElementById("interactionArea");
const outputArea        = document.getElementById("outputArea");
const jobInput          = document.getElementById("jobInput");
const sendInputButton   = document.getElementById("sendInputButton");
const sendYesButton     = document.getElementById("sendYesButton");
const sendNoButton      = document.getElementById("sendNoButton");
const statusEl          = document.getElementById("status");
const outputEl          = document.getElementById("output");

let pollTimer   = null;
let activeJobId = null;
let defaultProjectDir = "";

/* ===== Provider button helpers ===== */
function wireProviderButtons(container, onChange) {
  const btns = container.querySelectorAll(".provider-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      if (onChange) onChange(btn.dataset.provider);
    });
  });
}

function getSelectedProvider(container) {
  const sel = container.querySelector(".provider-btn.selected");
  return sel ? sel.dataset.provider : "openai";
}

function setSelectedProvider(container, value) {
  const btns = container.querySelectorAll(".provider-btn");
  btns.forEach(b => b.classList.toggle("selected", b.dataset.provider === value));
}

/* ===== Setup screen logic ===== */
function updateSetupHints(provider) {
  if (provider === "openrouter") {
    setupKeyHint.textContent = "Paste your OpenRouter API key. It stays on your computer.";
    setupApiKey.placeholder = "sk-or-v1-...";
    setupModel.placeholder = "openai/gpt-4o";
  } else if (provider === "private_server") {
    setupKeyHint.textContent = "API key for your server (or leave blank if not needed).";
    setupApiKey.placeholder = "sk-...";
    setupModel.placeholder = "your-model-name";
  } else {
    setupKeyHint.textContent = "Paste your OpenAI API key. It stays on your computer \u2014 never sent anywhere else.";
    setupApiKey.placeholder = "sk-...";
    setupModel.placeholder = "gpt-4o";
  }
  setupBaseUrlWrap.classList.toggle("hidden", provider !== "private_server");
}

wireProviderButtons(setupProviderBtns, updateSetupHints);

setupDoneBtn.addEventListener("click", () => {
  const provider = getSelectedProvider(setupProviderBtns);
  const key      = setupApiKey.value.trim();
  const base     = setupBaseUrl.value.trim();
  const mdl      = setupModel.value.trim();

  // Validate
  if (!key && provider !== "private_server") {
    setupError.textContent = "Please enter your API key to continue.";
    setupError.classList.remove("hidden");
    return;
  }
  if (provider === "private_server" && !base) {
    setupError.textContent = "Please enter your server URL.";
    setupError.classList.remove("hidden");
    return;
  }

  saveSettings({ provider, api_key: key, base_url: base, model: mdl });
  showMainScreen();
});

/* ===== Settings modal ===== */
function updateSettingsHints(provider) {
  settingsBaseUrlWrap.classList.toggle("hidden", provider !== "private_server");
}

wireProviderButtons(settingsProviderBtns, updateSettingsHints);

settingsBtn.addEventListener("click", () => {
  const s = loadSettings();
  settingsApiKey.value = s.api_key || "";
  settingsBaseUrl.value = s.base_url || "";
  settingsModel.value = s.model || "";
  setSelectedProvider(settingsProviderBtns, s.provider || "openai");
  updateSettingsHints(s.provider || "openai");
  settingsModal.classList.remove("hidden");
});

settingsCancelBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

settingsSaveBtn.addEventListener("click", () => {
  const provider = getSelectedProvider(settingsProviderBtns);
  saveSettings({
    provider,
    api_key: settingsApiKey.value.trim(),
    base_url: settingsBaseUrl.value.trim(),
    model: settingsModel.value.trim(),
  });
  settingsModal.classList.add("hidden");
});

/* ===== Screen transitions ===== */
function showMainScreen() {
  setupScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
}

/* ===== Job polling ===== */
function setStatus(text) { statusEl.textContent = text; }
function setOutput(text) {
  outputEl.textContent = text;
  outputEl.scrollTop = outputEl.scrollHeight;
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function setInteractiveEnabled(enabled) {
  sendInputButton.disabled = !enabled;
  sendYesButton.disabled   = !enabled;
  sendNoButton.disabled    = !enabled;
  interactionArea.classList.toggle("hidden", !enabled);
}

async function sendJobInput(value) {
  if (!activeJobId) return;
  const res = await fetch(`/api/jobs/${activeJobId}/input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: value }),
  });
  if (res.ok && jobInput.value.trim() === value.trim()) jobInput.value = "";
}

async function pollJob(jobId) {
  stopPolling();
  activeJobId = jobId;
  outputArea.classList.remove("hidden");
  pollTimer = setInterval(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) { setStatus("Failed to read status"); stopPolling(); return; }

    const data = await res.json();
    const label = data.status === "running" ? "Building..." : data.status === "completed" ? "Done!" : "Failed";
    setStatus(label);
    setOutput(data.output || "");
    setInteractiveEnabled(Boolean(data.accepting_input));

    if (data.status === "completed" || data.status === "failed") {
      stopPolling();
      runButton.disabled = false;
      activeJobId = null;
      setInteractiveEnabled(false);
    }
  }, 1200);
}

/* ===== Run button ===== */
runButton.addEventListener("click", async () => {
  const s = loadSettings();
  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  const promptText   = promptEl.value.trim();

  if (!promptText) { setStatus("Please describe what you want to build!"); outputArea.classList.remove("hidden"); return; }

  const payload = {
    project_path: defaultProjectDir || "",
    prompt: promptText,
    model: s.model || "",
    provider: s.provider || "openai",
    api_key: s.api_key || "",
    base_url: s.base_url || "",
    mode: selectedMode,
  };

  runButton.disabled = true;
  setInteractiveEnabled(false);
  outputArea.classList.remove("hidden");
  setStatus("Starting...");
  setOutput("");

  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Something went wrong" }));
    setStatus(data.error || "Something went wrong");
    runButton.disabled = false;
    return;
  }

  const data = await res.json();
  setStatus("Building...");
  pollJob(data.job_id);
});

/* ===== Input buttons ===== */
sendInputButton.addEventListener("click", async () => {
  const v = jobInput.value.trim();
  if (v) await sendJobInput(v);
});
sendYesButton.addEventListener("click", () => sendJobInput("y"));
sendNoButton.addEventListener("click",  () => sendJobInput("n"));

/* ===== Init ===== */
(async function init() {
  // Fetch the default project directory from server
  try {
    const res = await fetch("/api/default-project");
    if (res.ok) {
      const data = await res.json();
      defaultProjectDir = data.project_path || "";
    }
  } catch { /* ignore */ }

  // Decide which screen to show
  const settings = loadSettings();
  if (settings.api_key) {
    showMainScreen();
  } else {
    // Show setup — already visible by default
  }
})();
