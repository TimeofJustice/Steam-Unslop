// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import STYLES from "./styles.css";
import { TAGS, analyze, levelOf, rate } from "./detection.js";
import { setLanguage, steamLanguage } from "./i18n.js";
import { SETTINGS_KEY, loadSessionSettings, setSettings, shouldBlur } from "./settings.js";
import { addClass, appIdOf, currentAppId, removeClass, restoreClasses } from "./dom.js";
import {
  CACHE_KEY,
  LEGACY_CACHE_KEY,
  OLD_KEYS,
  PAUSE_KEY,
  applyPause,
  applyStoredCache,
  cache,
  cachedEntry,
  fetchRating,
  flushPersistentCache,
  flushSessionCache,
  loadSessionCache,
  markPersistentCacheLoaded,
  mergeStoredEntries,
  saveCache,
  setCache,
  setStorage,
  storage,
  toEntry,
} from "./cache.js";
import { OLD_STAR_KEYS, STAR_KEY, countPageForStar, loadStarState } from "./star.js";
import { openTutorial } from "./tutorial.js";
import { addPageBadge, blockGamePage } from "./dialog.js";
import { addReportBanner } from "./report.js";
import { preloadCartRatings, watchCheckout } from "./cart.js";
import {
  bundleIdOf,
  bundleKeyOf,
  cachedBundleEntry,
  fetchBundleRating,
  isBundleKey,
} from "./bundles.js";
import { dimRow } from "./wishlist.js";
import { blurCard, unblurCard } from "./card.js";
import {
  HOVER_KEY,
  arrangeOverlays,
  blurTile,
  hasCapsuleImage,
  hoverTileShapes,
  isHoverTile,
  isOverlayPlaced,
  setHoverTileShapes,
  tileGroupOf,
  unblurTile,
  unblurTileGroup,
} from "./tiles.js";
import { decorateHovers, recentHover, trackHover } from "./hover.js";
import { revealedAppIds, scanMedia } from "./media.js";
import { ensureNavButton } from "./nav.js";

// Tiles link to a game or to a bundle, which counts as AI when one of its games does.
const TILE_LINK_SELECTOR = 'a[href*="/app/"], a[href*="/bundle/"]';

function tileKeyOf(link) {
  const bundleId = !appIdOf(link) && bundleIdOf(link);
  return appIdOf(link) || (bundleId ? bundleKeyOf(bundleId) : undefined);
}

const cachedTileEntry = key => (isBundleKey(key) ? cachedBundleEntry(key) : cachedEntry(key));
const fetchTileRating = key => (isBundleKey(key) ? fetchBundleRating(key) : fetchRating(key));

// Store pages are only fetched once a tile comes this close to the viewport.
export const SCAN_MARGIN = 800;

const waitingTiles = new Set();

const tileVisibility = new IntersectionObserver(
  entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) checkTile(entry.target);
    }
  },
  { rootMargin: `${SCAN_MARGIN}px 0px` },
);

function checkTile(link) {
  const appId = link.dataset.unslopId;

  tileVisibility.unobserve(link);
  waitingTiles.delete(link);

  fetchTileRating(appId).then(info => {
    // The element may have been reused for another game in the meantime.
    if (link.dataset.unslopId === appId) settleTile(link, info);
  });
}

/* Tiles stay blurred (unslop-wait) until their rating is known, so AI art never flashes up.
   Both a scan and the pending rating may settle a tile; only the first one does. */
function settleTile(link, info) {
  if (!link.classList.contains("unslop-wait")) return;

  removeClass(link, "unslop-wait");
  unblurCard(link);

  if (info && link.isConnected && shouldBlur(info, link.dataset.unslopId)) blurTile(link, info);
}

function waitForRating(link) {
  addClass(link, "unslop-wait");
  blurCard(link);

  waitingTiles.add(link);
  tileVisibility.observe(link);
}

// Fallback for tiles the IntersectionObserver misses, e.g. tab lists switched by CSS only.
function checkWaitingTiles() {
  for (const link of waitingTiles) {
    if (!link.isConnected) {
      waitingTiles.delete(link);
      tileVisibility.unobserve(link);
      continue;
    }

    const bounds = link.getBoundingClientRect();
    const isNearViewport =
      bounds.width &&
      bounds.height &&
      bounds.bottom > -SCAN_MARGIN &&
      bounds.top < innerHeight + SCAN_MARGIN;
    if (isNearViewport) checkTile(link);
  }
}

export function checkHoveredLink(link, appId) {
  if (cachedEntry(appId)) return;

  if (waitingTiles.has(link)) checkTile(link);
  fetchRating(appId).then(decorateHovers);
}

let scanQueued = false;

export function requestScan() {
  if (scanQueued) return;
  scanQueued = true;

  setTimeout(() => {
    scanQueued = false;
    scan();
  }, 30);
}

const hasLostDimming = link =>
  link._unslopDimmed?.some(
    element => !element.isConnected || !element.classList.contains("unslop-dim"),
  );

// Repairs a known tile after the page re-rendered parts of it.
function restoreTile(link, appId) {
  const entry = cachedTileEntry(appId);

  if (link.classList.contains("unslop-wait") && entry) {
    return settleTile(link, entry.ai ? entry : null);
  }

  tileGroupOf(link).forEach(restoreClasses);

  const isBlurred = link.classList.contains("unslop-blur");
  const isPlainMember = !!link.dataset.unslopPlain;
  const isShown = !!link.dataset.unslopShown;
  const blur = !!entry?.ai && shouldBlur(entry, appId);

  // The minimum level was raised above this game's rating.
  if (!blur && isBlurred && !isPlainMember) return unblurTileGroup(link);

  const overlayIsMissing = !tileGroupOf(link).some(isOverlayPlaced);
  if (blur && !isShown && !isPlainMember && overlayIsMissing) {
    unblurTile(link);
    blurTile(link, entry);
  } else if (isBlurred && hasLostDimming(link)) {
    dimRow(link);
  }

  const isWaiting = link.classList.contains("unslop-wait");
  if (!link.dataset.unslopShown && (link.classList.contains("unslop-blur") || isWaiting)) {
    blurCard(link);
  }
}

function scanLink(link, pageAppId) {
  const appId = tileKeyOf(link);
  const isTile = () => link.dataset.unslopId === appId || hasCapsuleImage(link);

  if (!appId || appId === pageAppId || !isTile()) {
    // Links that are no tiles: the hold style stops blurring their images.
    if (!link.dataset.unslopId) link.dataset.unslopSkip = "1";
    return;
  }
  delete link.dataset.unslopSkip;

  if (link.dataset.unslopId === appId) return restoreTile(link, appId);

  // Virtualized lists reuse elements for other games.
  if (link.dataset.unslopId) unblurTile(link);
  link.dataset.unslopId = appId;

  if (revealedAppIds.has(appId)) {
    link.dataset.unslopShown = "1";
    return;
  }

  const entry = cachedTileEntry(appId);
  if (!entry) waitForRating(link);
  else if (entry.ai && shouldBlur(entry, appId)) blurTile(link, entry);
}

export function scan() {
  const pageAppId = currentAppId();
  for (const link of document.querySelectorAll(TILE_LINK_SELECTOR)) scanLink(link, pageAppId);

  checkWaitingTiles();
  scanMedia();
  ensureNavButton();
  countPageForStar();
  preloadCartRatings();

  const hoverIsActive =
    recentHover() || document.querySelector('[data-unslop-hover], [id^="hover_app_"]');
  if (hoverIsActive) decorateHovers();
}

function injectStyles() {
  if (document.getElementById("unslop-styles")) return;

  const style = document.createElement("style");
  style.id = "unslop-styles";
  style.textContent = STYLES;
  (document.head || document.documentElement).appendChild(style);
}

/* Called by the wrappers at document_start: game images stay blurred until scan() has seen
   them, and a game page stays hidden until the gate has decided. The state lives in data
   attributes because Steam rewrites the class attribute of <html>. */
function hold() {
  if (hold.done) return;

  const root = document.documentElement;
  if (!root) {
    // Too early, the document has no root element yet.
    new MutationObserver((records, observer) => {
      if (!document.documentElement) return;
      observer.disconnect();
      hold();
    }).observe(document, { childList: true });
    return;
  }

  hold.done = true;
  injectStyles();
  root.dataset.unslopHold = "";

  if (currentAppId()) {
    root.dataset.unslopHoldPage = "";

    // Never leave the page hidden if start() does not run.
    setTimeout(() => delete root.dataset.unslopHoldPage, 8000);
  }
}

// Returns whether the mutation changed the page structure (and not only a class).
function handleMutation(record) {
  if (record.type === "attributes" && record.attributeName === "class") {
    restoreClasses(record.target);
    return false;
  }

  // A reused element links to another game now: drop the old state before the next paint.
  const knownAppId = record.target.dataset?.unslopId;
  if (record.type === "attributes" && knownAppId && tileKeyOf(record.target) !== knownAppId) {
    unblurTile(record.target);
    delete record.target.dataset.unslopId;
  }
  return true;
}

function observePage() {
  let scanScheduled = false;

  new MutationObserver(records => {
    const changedStructure = records.map(handleMutation).some(Boolean);

    // Throttled rather than debounced, so it keeps up with constant changes such as scrolling.
    if (!changedStructure || scanScheduled) return;
    scanScheduled = true;

    setTimeout(() => {
      scanScheduled = false;
      scan();
    }, 150);
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "class"],
  });

  // Visibility changes through classes or styles cause no structural mutation.
  setInterval(() => {
    if (!document.hidden) scan();
  }, 1000);
}

function loadSessionHoverShapes() {
  try {
    setHoverTileShapes(new Set(JSON.parse(sessionStorage.getItem(HOVER_KEY) || "[]")));
  } catch {
    // Storage blocked.
  }
}

// The page is still hidden here; the question depends on the stored minimum level.
async function handleGamePage(appId, hasSessionSettings) {
  if (!hasSessionSettings) setSettings(await storage.load(SETTINGS_KEY), false);

  const info = analyze(document.body.innerHTML);
  cache[appId] = toEntry(info);
  if (info) cache[appId].name = document.querySelector("#appHubAppName")?.textContent.trim() || "";
  saveCache();

  if (!info) return addReportBanner();
  if (shouldBlur(info, appId)) blockGamePage(info, appId);
  else addPageBadge(info);
}

async function loadPersistentState() {
  const [storedCache, legacyCache, storedHoverShapes, storedStarState, storedSettings] =
    await Promise.all(
      [CACHE_KEY, LEGACY_CACHE_KEY, HOVER_KEY, STAR_KEY, SETTINGS_KEY].map(key =>
        storage.load(key),
      ),
    );

  if (storedSettings) setSettings(storedSettings, false);
  else openTutorial();

  mergeStoredEntries(legacyCache);
  mergeStoredEntries(storedCache);
  markPersistentCacheLoaded();

  if (Array.isArray(storedHoverShapes)) {
    storedHoverShapes.forEach(shape => hoverTileShapes.add(shape));
  }
  loadStarState(storedStarState);

  if (legacyCache) flushPersistentCache();
  storage.remove([...OLD_KEYS, ...OLD_STAR_KEYS]);

  // Hover tiles learned in other sessions show the info only.
  for (const link of document.querySelectorAll("a.unslop-blur:not([data-unslop-plain])")) {
    if (link._unslopInfo && isHoverTile(link)) arrangeOverlays(link, true);
  }
}

// adapter: { load(key), save(key, value), remove(keys) }
export async function start(adapter) {
  if (start.done) return;
  start.done = true;

  setStorage(adapter);
  setLanguage(steamLanguage());
  hold();
  document.addEventListener("mouseover", trackHover, true);
  watchCheckout();

  // The session cache is synchronous, so known games are blurred right away.
  setCache(loadSessionCache());
  const hasSessionSettings = loadSessionSettings();
  loadSessionHoverShapes();

  const pageAppId = currentAppId();
  if (pageAppId) await handleGamePage(pageAppId, hasSessionSettings);

  delete document.documentElement.dataset.unslopHoldPage;
  scan();

  await loadPersistentState();
  flushSessionCache();
  scan();

  addEventListener("pagehide", () => {
    flushSessionCache();
    flushPersistentCache();
  });
  observePage();
}

// Wrappers forward storage changes made by other tabs (results, rate limits, settings).
function applyStored(key, value) {
  if (!start.done || value === undefined || value === null) return;

  if (key === CACHE_KEY) {
    applyStoredCache(value);
    requestScan();
  } else if (key === PAUSE_KEY) {
    applyPause(value);
  } else if (key === SETTINGS_KEY) {
    setSettings(value, false);
  }
}

globalThis.SteamUnslop = {
  hold,
  start,
  analyze,
  levelOf,
  rate,
  TAGS,
  applyStored,
  applySettings: settings => setSettings(settings, false),
};
