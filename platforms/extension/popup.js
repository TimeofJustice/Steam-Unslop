// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Same key and shape as SETTINGS_KEY and BEHAVIORS in src/core/settings.js.
const SETTINGS_KEY = "unslopSettings";
const BEHAVIORS = ["blur", "gatePages", "warnCart", "pauseTrailers"];
const message = name => chrome.i18n.getMessage(name);

for (const element of document.querySelectorAll("[data-i18n]")) {
  element.textContent = message(element.dataset.i18n);
}

const levelSelect = document.getElementById("min-level");
for (let level = 0; level < 4; level++) {
  levelSelect.add(new Option(message(`minLevelOption${level}`), String(level)));
}

const behaviorList = document.getElementById("behaviors");
for (const behavior of BEHAVIORS) {
  const label = document.createElement("label");
  label.className = "behavior";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.dataset.behavior = behavior;

  label.append(checkbox, message(`behavior_${behavior}`));
  behaviorList.append(label);
}

const loadSettings = async () => (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];

// Each behavior is on unless it was turned off.
loadSettings().then(settings => {
  levelSelect.value = String(settings?.minLevel ?? 0);

  for (const checkbox of behaviorList.querySelectorAll("input")) {
    checkbox.checked = settings?.[checkbox.dataset.behavior] !== false;
  }
});

// The other settings (exceptions, always shown games) are kept.
async function saveChange(change) {
  const settings = (await loadSettings()) || {};
  chrome.storage.local.set({ [SETTINGS_KEY]: { ...settings, ...change } });
}

levelSelect.addEventListener("change", () => saveChange({ minLevel: Number(levelSelect.value) }));

behaviorList.addEventListener("change", event => {
  const checkbox = event.target;
  saveChange({ [checkbox.dataset.behavior]: checkbox.checked });
});
