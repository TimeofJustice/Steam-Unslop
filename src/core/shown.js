// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* Games the user chose to show on a tile ("Show"). Opening the game page right after does not
   ask again. Kept for a few minutes in localStorage, which store tabs share and which is read at
   once on the game page, before anything is shown. */
const SHOWN_KEY = "unslopShown";
const SHOWN_LIFETIME = 5 * 60 * 1000;

function loadShownGames() {
  try {
    const stored = JSON.parse(localStorage.getItem(SHOWN_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

export function rememberShownGame(appId) {
  const now = Date.now();
  const shownGames = loadShownGames();

  for (const [shownId, shownAt] of Object.entries(shownGames)) {
    if (now - shownAt > SHOWN_LIFETIME) delete shownGames[shownId];
  }
  shownGames[appId] = now;

  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(shownGames));
  } catch {
    // Storage blocked.
  }
}

export function wasShownRecently(appId) {
  const shownAt = loadShownGames()[appId];
  return Number.isFinite(shownAt) && Date.now() - shownAt <= SHOWN_LIFETIME;
}
