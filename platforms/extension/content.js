// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Runs at document_start, so game images are blurred before the page first paints.
SteamUnslop.hold();

const storage = {
  load: async key => (await chrome.storage.local.get(key))[key],
  save: (key, value) => chrome.storage.local.set({ [key]: value }),
  remove: keys => chrome.storage.local.remove(keys),
};

// Results, rate limits and settings from other tabs and from the popup.
chrome.storage.onChanged.addListener((changes, storageArea) => {
  if (storageArea !== "local") return;

  for (const [key, { newValue }] of Object.entries(changes)) {
    SteamUnslop.applyStored(key, newValue);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => SteamUnslop.start(storage), { once: true });
} else {
  SteamUnslop.start(storage);
}
