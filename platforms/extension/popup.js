// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Same key and shape as SETTINGS_KEY in src/core/settings.js.
const SETTINGS_KEY = "unslopSettings";
const message = name => chrome.i18n.getMessage(name);

for (const element of document.querySelectorAll("[data-i18n]")) {
  element.textContent = message(element.dataset.i18n);
}

const levelSelect = document.getElementById("min-level");
for (let level = 0; level < 4; level++) {
  levelSelect.add(new Option(message(`minLevelOption${level}`), String(level)));
}

const loadSettings = async () => (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];

loadSettings().then(settings => {
  levelSelect.value = String(settings?.minLevel ?? 0);
});

// The other settings (exceptions, always shown games) are kept.
levelSelect.addEventListener("change", async () => {
  const settings = (await loadSettings()) || {};
  const minLevel = Number(levelSelect.value);

  chrome.storage.local.set({ [SETTINGS_KEY]: { ...settings, minLevel } });
});
