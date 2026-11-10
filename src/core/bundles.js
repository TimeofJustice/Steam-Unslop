// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { cachedEntry, fetchRating } from "./cache.js";
import { shouldBlur } from "./settings.js";

/* Bundles have no disclosure of their own; they count as AI when one of their games does. The
   store API names the games of a bundle. A bundle tile uses the key "bundle-<id>" where game
   tiles use the app id, and its rating sums up the AI games it contains. */
const STORE_ITEMS_URL = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";
const SESSION_KEY = "unslopBundles";
const BUNDLE_KEY_PREFIX = "bundle-";
const BATCH_DELAY = 50;
const BATCH_SIZE = 50;

export const isBundleKey = key => String(key).startsWith(BUNDLE_KEY_PREFIX);
export const bundleKeyOf = bundleId => `${BUNDLE_KEY_PREFIX}${bundleId}`;
const bundleIdOfKey = key => String(key).slice(BUNDLE_KEY_PREFIX.length);

export const bundleIdOf = link => link.href?.match(/\/bundle\/(\d+)/)?.[1];

// Bundle id -> { name, appIds }; kept for the session, as bundles rarely change.
const bundleContents = loadSessionContents();
const pendingBundles = new Map();
let batchTimer = null;

function loadSessionContents() {
  try {
    return new Map(Object.entries(JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}")));
  } catch {
    return new Map();
  }
}

function saveSessionContents() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(Object.fromEntries(bundleContents)));
  } catch {
    // Storage blocked.
  }
}

async function requestBundles(bundleIds) {
  const input = {
    ids: bundleIds.map(bundleId => ({ bundleid: Number(bundleId) })),
    context: { language: "english", country_code: "US" },
    data_request: { include_included_items: true },
  };
  const response = await fetch(
    `${STORE_ITEMS_URL}?input_json=${encodeURIComponent(JSON.stringify(input))}`,
  );
  const data = await response.json();

  for (const item of data.response?.store_items || []) {
    bundleContents.set(String(item.id), {
      name: item.name || "",
      appIds: (item.included_appids || []).map(String),
    });
  }
  saveSessionContents();
}

// Bundles requested close together share one request.
function runBatch() {
  batchTimer = null;
  const batch = [...pendingBundles.keys()].slice(0, BATCH_SIZE);
  if (pendingBundles.size > batch.length) batchTimer = setTimeout(runBatch, BATCH_DELAY);

  const finish = () => {
    for (const bundleId of batch) {
      pendingBundles.get(bundleId).resolve(bundleContents.get(bundleId) || null);
      pendingBundles.delete(bundleId);
    }
  };
  requestBundles(batch).then(finish, finish);
}

export function fetchBundleContents(bundleId) {
  const known = bundleContents.get(bundleId);
  if (known) return Promise.resolve(known);

  if (!pendingBundles.has(bundleId)) {
    let resolve;
    const promise = new Promise(done => (resolve = done));
    pendingBundles.set(bundleId, { promise, resolve });
    batchTimer ||= setTimeout(runBatch, BATCH_DELAY);
  }
  return pendingBundles.get(bundleId).promise;
}

// The games of the bundle that the user's settings blur.
function blurredGamesOf(contents) {
  return contents.appIds
    .map(appId => ({ appId, entry: cachedEntry(appId) }))
    .filter(({ appId, entry }) => entry?.ai && shouldBlur(entry, appId));
}

/* An entry shaped like a game's: ai, tags (all kinds of AI use in the bundle) and a name, plus
   games, the bundle's AI games as [{ appId, entry }]. undefined while games are not rated yet. */
function bundleEntryOf(contents) {
  const allRated = contents.appIds.every(appId => cachedEntry(appId));
  if (!allRated) return undefined;

  const blurredGames = blurredGamesOf(contents);
  return {
    ai: blurredGames.length > 0,
    bundle: true,
    tags: [...new Set(blurredGames.flatMap(({ entry }) => entry.tags))],
    hints: [],
    name: contents.name,
    games: blurredGames,
  };
}

export function cachedBundleEntry(key) {
  const contents = bundleContents.get(bundleIdOfKey(key));
  return contents ? bundleEntryOf(contents) : undefined;
}

// Resolves like fetchRating(): the entry when the bundle holds AI games, otherwise null.
export async function fetchBundleRating(key) {
  const contents = await fetchBundleContents(bundleIdOfKey(key));
  if (!contents) return null;

  await Promise.all(contents.appIds.map(fetchRating));
  const entry = bundleEntryOf(contents);
  return entry?.ai ? entry : null;
}

export async function appIdsOfBundles(bundleIds) {
  const contents = await Promise.all(bundleIds.map(fetchBundleContents));
  return contents.flatMap(content => content?.appIds || []);
}
