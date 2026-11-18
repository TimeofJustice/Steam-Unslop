// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { TAG_BY_KEY, rate } from "./detection.js";
import { setExcludedTags } from "./render.js";
import { storage } from "./cache.js";
import { releasePageGateIfAllowed } from "./dialog.js";
import { scan, start } from "./main.js";
import { refreshOverlays } from "./tiles.js";
import { redrawRatings } from "./refresh.js";

/* User settings.
   minLevel:   games rated below it are not blurred (0 blurs every disclosure).
   ignoreTags: kinds of use (e.g. translation) left out of the rating; a game with nothing else
               is not blurred.
   allow:      games the user always wants to see, [{ id, name }].
   Behavior, each on by default; all off leaves an information mode that blocks nothing:
   blur:          blur the images of AI games (off: a small sign shows level and tags);
   gatePages:     ask before the page of an AI game opens;
   warnCart:      warn before paying for a cart with AI games;
   pauseTrailers: trailers on the page of an AI game only start on the user's click. */
export const SETTINGS_KEY = "unslopSettings";
export const BEHAVIORS = ["blur", "gatePages", "warnCart", "pauseTrailers"];
const DEFAULT_SETTINGS = {
  minLevel: 0,
  ignoreTags: [],
  allow: [],
  ...Object.fromEntries(BEHAVIORS.map(behavior => [behavior, true])),
};
export let settings = { ...DEFAULT_SETTINGS };

function normalizeSettings(saved) {
  const minLevel = [0, 1, 2, 3].includes(saved?.minLevel)
    ? saved.minLevel
    : DEFAULT_SETTINGS.minLevel;

  const ignoreTags = Array.isArray(saved?.ignoreTags)
    ? saved.ignoreTags.filter(tagKey => TAG_BY_KEY[tagKey])
    : [];

  const allow = Array.isArray(saved?.allow)
    ? saved.allow
        .filter(game => /^\d+$/.test(game?.id))
        .map(game => ({ id: game.id, name: String(game.name || "") }))
    : [];

  const behaviors = Object.fromEntries(
    BEHAVIORS.map(behavior => [
      behavior,
      typeof saved?.[behavior] === "boolean" ? saved[behavior] : DEFAULT_SETTINGS[behavior],
    ]),
  );

  return { minLevel, ignoreTags, allow, ...behaviors };
}

// sessionStorage keeps a copy, so the first scan already uses the settings. Returns whether one
// was found.
function applyToPage() {
  setExcludedTags(settings.ignoreTags);
  document.documentElement?.toggleAttribute("data-unslop-no-blur", !settings.blur);
}

export function loadSessionSettings() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SETTINGS_KEY) || "null");
    settings = normalizeSettings(saved);
    applyToPage();
    return !!saved;
  } catch {
    return false;
  }
}

export function setSettings(nextSettings, persist) {
  const excludedBefore = settings.ignoreTags.join(",");
  const blurBefore = settings.blur;
  settings = normalizeSettings(nextSettings);
  applyToPage();

  try {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked.
  }

  if (persist) storage.save(SETTINGS_KEY, JSON.parse(JSON.stringify(settings)));

  releasePageGateIfAllowed();
  const changedLook =
    settings.ignoreTags.join(",") !== excludedBefore || settings.blur !== blurBefore;
  if (start.done && changedLook) {
    refreshOverlays();
    redrawRatings();
  }
  if (start.done) scan();
}

const countedTagsOf = info => info.tags.filter(tagKey => !settings.ignoreTags.includes(tagKey));

/* The rating with the excluded kinds of use left out, as the user sees it. The developer's
   qualifiers are worked out from the whole statement, so leaving out a tag never turns it into
   a denial. allExcluded: every kind of use was left out. */
export function rateForUser(info) {
  const countedTags = countedTagsOf(info);
  const hintKeys = rate(info).hints.map(hint => hint.key);

  return {
    ...rate({ ...info, tags: countedTags, hints: hintKeys }),
    allExcluded: info.tags.length > 0 && countedTags.length === 0,
  };
}

// info: a disclosure ({ tags, text }); whether a game has one at all is checked by the caller.
export function shouldBlur(info, appId) {
  const isAllowed = appId && settings.allow.some(game => game.id === String(appId));
  if (isAllowed) return false;

  // Every kind of use was excluded, so nothing is left to blur for.
  if (info.tags.length && !countedTagsOf(info).length) return false;

  return rateForUser(info).level >= settings.minLevel;
}

export function allowGame(appId, name) {
  const id = String(appId);
  const otherGames = settings.allow.filter(game => game.id !== id);

  setSettings({ ...settings, allow: [...otherGames, { id, name }] }, true);
}
