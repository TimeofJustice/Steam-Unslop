// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { analyze, findHints, gameNameFromPage } from "./detection.js";

export const CACHE_KEY = "unslopCache";
export const LEGACY_CACHE_KEY = "aiCache5";
export const OLD_KEYS = ["aiCache", "aiCache2", "aiCache3", "aiCache4", LEGACY_CACHE_KEY];
const SESSION_KEY = "unslopSession";

const ENTRY_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 4000;
const PARALLEL_REQUESTS = 4;
const MAX_TRIES = 3;

// The storage adapter of the platform: { load(key), save(key, value), remove(keys) }.
export let storage;

/* Ratings by app id. An entry is { ai, tags, hints, text, name, ignored, t, v }: t is the time it
   was rated and v the entry version; both stay short because the cache is stored as a whole. */
export let cache = {};

export const setStorage = adapter => {
  storage = adapter;
};

export const setCache = entries => {
  cache = entries;
};

let persistentSaveTimer;
let sessionSaveTimer;
let runningRequests = 0;
let pausedUntil = 0;
let persistentCacheLoaded = false;

export let markPersistentCacheLoaded;
const persistentCacheReady = new Promise(resolve => {
  markPersistentCacheLoaded = () => {
    persistentCacheLoaded = true;
    resolve();
  };
});

const requestQueue = [];
const pendingRatings = new Map();

const storePageUrl = appId => `https://store.steampowered.com/app/${appId}/`;

/* Raise it whenever the detection changes: entries rated by an older detection are fetched
   again, so improvements reach games that are already cached.
   2: every store language. 3: since 1.6.1, older entries may carry ratings of earlier builds.
   4: uses named after an exception ("no AI except for the voices"), assets replaced by people.
   5: human work described with adjectives ("made by our talented team"). */
export const ENTRY_VERSION = 5;

const hintKeysOf = info => findHints(info.text, info.tags).map(hint => hint.key);

export function toEntry(info) {
  return {
    ai: !!info,
    tags: info?.tags || [],
    hints: info ? hintKeysOf(info) : [],
    text: info?.text || "",
    t: Date.now(),
    v: ENTRY_VERSION,
  };
}

/* Stored entries keep the rating (tags and hint keys) but not the statement text, which is
   long and only needed by the reason dialog; it loads the text again on demand. */
function storedFormOf(entry) {
  if (!entry.ai) return { ai: false, t: entry.t, v: entry.v };

  return {
    ai: true,
    tags: entry.tags,
    hints: entry.hints ?? hintKeysOf(entry),
    name: entry.name,
    ignored: entry.ignored,
    t: entry.t,
    v: entry.v,
  };
}

const isFresh = entry => !!entry && Date.now() - entry.t < ENTRY_LIFETIME;

export function cachedEntry(appId) {
  const entry = cache[appId];
  return isFresh(entry) && entry.v >= ENTRY_VERSION ? entry : undefined;
}

// When the store page cannot be fetched again, an AI entry of an older detection still counts.
function outdatedAiEntry(appId) {
  const entry = cache[appId];
  return isFresh(entry) && entry.ai ? entry : null;
}

// Mature games show an age check instead of the page until the user passed it once.
const isAgeCheck = response => /\/agecheck\//.test(response.url || "");

// A copy in sessionStorage is read synchronously on startup, so known games are blurred before
// the persistent cache has loaded.
export function loadSessionCache() {
  try {
    const entries = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    return entries && typeof entries === "object" ? entries : {};
  } catch {
    return {};
  }
}

function storedFormOfCache() {
  const stored = {};
  for (const [appId, entry] of Object.entries(cache)) stored[appId] = storedFormOf(entry);
  return stored;
}

export function flushSessionCache() {
  clearTimeout(sessionSaveTimer);

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedFormOfCache()));
  } catch {
    // Quota exceeded or storage blocked.
  }
}

function removeOldEntries() {
  const now = Date.now();
  for (const [appId, entry] of Object.entries(cache)) {
    if (!entry || !(now - entry.t < ENTRY_LIFETIME)) delete cache[appId];
  }

  const appIds = Object.keys(cache);
  if (appIds.length <= MAX_ENTRIES) return;

  appIds
    .sort((first, second) => cache[first].t - cache[second].t)
    .slice(0, appIds.length - MAX_ENTRIES)
    .forEach(appId => delete cache[appId]);
}

export function flushPersistentCache() {
  clearTimeout(persistentSaveTimer);
  removeOldEntries();

  // Saving before the persistent cache has loaded would overwrite it with the session subset.
  if (persistentCacheLoaded) storage.save(CACHE_KEY, storedFormOfCache());
}

export function saveCache() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(flushSessionCache, 200);

  clearTimeout(persistentSaveTimer);
  persistentSaveTimer = setTimeout(flushPersistentCache, 1000);
}

// The newer entry wins; a statement text already known is kept.
export function mergeStoredEntries(storedEntries) {
  for (const [appId, stored] of Object.entries(storedEntries || {})) {
    const current = cache[appId];

    if (!current || stored.t > current.t) {
      cache[appId] = {
        ...stored,
        ...(current?.ignored && { ignored: true }),
        ...(current?.text && !stored.text && { text: current.text }),
      };
    } else if (current.ai && !current.text && stored.text) {
      current.text = stored.text;
    }
  }
}

/* Store tabs share their results and rate limits through the storage (the wrappers forward
   changes made by other tabs), so a game is fetched once and a 429 pauses every tab. */
export const PAUSE_KEY = "unslopPause";

export function applyStoredCache(storedEntries) {
  mergeStoredEntries(storedEntries);

  for (let index = requestQueue.length - 1; index >= 0; index--) {
    const request = requestQueue[index];
    const entry = cachedEntry(request.appId);
    if (!entry) continue;

    requestQueue.splice(index, 1);
    pendingRatings.delete(request.appId);
    request.resolve(entry.ai ? entry : null);
  }
}

export function applyPause(until) {
  if (!Number.isFinite(until) || until <= pausedUntil) return;

  pausedUntil = until;
  processQueue();
}

// Resolves with the AI entry of a game, or null without a disclosure. Newest requests first,
// so the tiles that just became visible are handled first.
export function fetchRating(appId) {
  const entry = cachedEntry(appId);
  if (entry) return Promise.resolve(entry.ai ? entry : null);

  if (!persistentCacheLoaded) return persistentCacheReady.then(() => fetchRating(appId));

  if (!pendingRatings.has(appId)) {
    const rating = new Promise(resolve => {
      requestQueue.unshift({ appId, resolve, tries: 0 });
      processQueue();
    });
    pendingRatings.set(appId, rating);
  }
  return pendingRatings.get(appId);
}

let wakeUpTimer = null;

function processQueue() {
  // While paused, wake up once the pause is over, even with no request in flight.
  if (requestQueue.length && Date.now() < pausedUntil && !wakeUpTimer) {
    wakeUpTimer = setTimeout(() => {
      wakeUpTimer = null;
      processQueue();
    }, pausedUntil - Date.now());
  }

  while (runningRequests < PARALLEL_REQUESTS && requestQueue.length && Date.now() >= pausedUntil) {
    runRequest(requestQueue.shift());
  }
}

function runRequest(request) {
  runningRequests++;

  fetch(storePageUrl(request.appId), { credentials: "include" })
    .then(response => {
      // Rate limits and error pages must never be cached as "no AI".
      if (!response.ok) throw response.status;
      if (isAgeCheck(response)) throw "agecheck";
      return response.text();
    })
    .then(html => {
      const previousEntry = cache[request.appId];
      const entry = (cache[request.appId] = toEntry(analyze(html)));

      if (entry.ai) {
        entry.name = gameNameFromPage(html) || previousEntry?.name || "";
        if (previousEntry?.ignored) entry.ignored = true;
      }

      saveCache();
      request.resolve(entry.ai ? entry : null);
    })
    .catch(failure => handleFailedRequest(request, failure))
    .finally(() => {
      runningRequests--;
      if (cachedEntry(request.appId) || request.tries > MAX_TRIES) {
        pendingRatings.delete(request.appId);
      }
      setTimeout(processQueue, Math.max(80, pausedUntil - Date.now()));
    });
}

function handleFailedRequest(request, failure) {
  // Not cached: the answer stays unknown until the age check was passed.
  if (failure === "agecheck") {
    request.tries = MAX_TRIES + 1;
    request.resolve(outdatedAiEntry(request.appId));
    return;
  }

  request.tries++;
  if (request.tries > MAX_TRIES) {
    request.resolve(outdatedAiEntry(request.appId));
    return;
  }

  if (failure === 429) {
    pausedUntil = Date.now() + 5000 * request.tries;
    storage.save(PAUSE_KEY, pausedUntil);
  }
  requestQueue.push(request);
}

// Session entries carry no texts and older ones no names; the dialog loads them on demand.
export function loadDetails(appId) {
  return fetch(storePageUrl(appId), { credentials: "include" })
    .then(response => (response.ok && !isAgeCheck(response) ? response.text() : ""))
    .then(html => {
      const text = (html && analyze(html)?.text) || "";
      const name = html ? gameNameFromPage(html) : "";

      if (cache[appId] && (text || name)) {
        if (text) cache[appId].text = text;
        if (name) cache[appId].name = name;
        saveCache();
      }
      return { text, name };
    })
    .catch(() => ({ text: "", name: "" }));
}
