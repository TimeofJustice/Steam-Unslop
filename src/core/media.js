// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { rate } from "./detection.js";
import { texts } from "./i18n.js";
import { shouldBlur } from "./settings.js";
import { AVATAR_SELECTOR, MEDIA_SELECTOR, currentAppId, toggleClass } from "./dom.js";
import { cachedEntry, fetchRating } from "./cache.js";
import { handleIgnoreClick } from "./steam-api.js";
import { closeAction, openReasonDialog } from "./dialog.js";
import {
  actionButtonsHTML,
  fitTagsOnResize,
  ratingInfoHTML,
  revealTileGroup,
  tileAreaOf,
} from "./tiles.js";
import { SCAN_MARGIN, requestScan } from "./main.js";

/* Screenshots and trailers outside of game links, e.g. the large preview of the discovery queue.
   Steam serves them from URLs with the app id (/steam/apps/<id>/ss_*.jpg, /store_trailers/<id>/),
   so they can be assigned to a game whatever the markup looks like. */
const MEDIA_URL_APP_ID = /\/(?:steam\/apps|store_trailers)\/(\d+)\//;
const SKIPPED_MEDIA_SELECTOR =
  'a[href*="/app/"], .unslop-overlay, .unslop-modal, .unslop-hoverinfo, .unslop-mediainfo, .unslop-hoverblur';
const MIN_INFO_WIDTH = 280;
const MIN_INFO_HEIGHT = 140;

export const revealedAppIds = new Set();

// App id -> the info element on the largest medium of that game.
const mediaInfoBoxes = new Map();

function appIdFromUrl(url) {
  const appId = url && MEDIA_URL_APP_ID.exec(url)?.[1];

  // Old trailer files live under the movie id (256xxxxxx), which is no app id.
  return appId && appId.length < 9 ? appId : null;
}

function ownAppIdOf(media) {
  if (media.tagName === "IMG") {
    return (
      appIdFromUrl(media.currentSrc || media.getAttribute("src")) ||
      appIdFromUrl(media.getAttribute("srcset"))
    );
  }

  if (media.tagName === "VIDEO") {
    const sourceIds = [...media.querySelectorAll("source")].map(source =>
      appIdFromUrl(source.getAttribute("src")),
    );

    return (
      appIdFromUrl(media.getAttribute("poster")) ||
      appIdFromUrl(media.currentSrc || media.getAttribute("src")) ||
      sourceIds.find(Boolean) ||
      null
    );
  }

  return appIdFromUrl(media.style?.backgroundImage);
}

// Streamed videos (blob: URLs) have no id; they belong to the only game shown around them.
function mediaAppIdOf(media) {
  const ownAppId = ownAppIdOf(media);
  if (ownAppId || media.tagName !== "VIDEO") return ownAppId;

  let ancestor = media.parentElement;
  for (let depth = 0; ancestor && ancestor !== document.body && depth < 4; depth++) {
    const appIds = new Set(
      [...ancestor.querySelectorAll(MEDIA_SELECTOR)].map(ownAppIdOf).filter(Boolean),
    );
    if (appIds.size) return appIds.size === 1 ? [...appIds][0] : null;

    ancestor = ancestor.parentElement;
  }
  return null;
}

const isNearViewport = bounds =>
  bounds.width > 0 &&
  bounds.height > 0 &&
  bounds.bottom > -SCAN_MARGIN &&
  bounds.top < innerHeight + SCAN_MARGIN &&
  bounds.right > 0 &&
  bounds.left < innerWidth;

// state: "ai" (blurred), "wait" (rating loading) or null.
function setMediaState(media, state) {
  toggleClass(media, "unslop-gmedia", state === "ai");
  toggleClass(media, "unslop-gwait", state === "wait");
}

export function scanMedia() {
  const pageAppId = currentAppId();

  // App id -> the blurred media of that game.
  const blurredMediaByAppId = new Map();

  for (const media of document.querySelectorAll(MEDIA_SELECTOR)) {
    const appId = !media.closest(SKIPPED_MEDIA_SELECTOR) && mediaAppIdOf(media);

    const isExcluded =
      !appId || appId === pageAppId || revealedAppIds.has(appId) || media.matches(AVATAR_SELECTOR);
    if (isExcluded) {
      setMediaState(media, null);
      continue;
    }

    const entry = cachedEntry(appId);
    if (!entry) {
      setMediaState(media, "wait");
      if (isNearViewport(media.getBoundingClientRect())) fetchRating(appId).then(requestScan);
      continue;
    }

    const blur = entry.ai && shouldBlur(entry, appId);
    setMediaState(media, blur ? "ai" : null);

    if (blur) {
      if (!blurredMediaByAppId.has(appId)) blurredMediaByAppId.set(appId, []);
      blurredMediaByAppId.get(appId).push(media);
    }
  }

  placeMediaInfoBoxes(blurredMediaByAppId);
}

function removeMediaInfoBox(appId) {
  mediaInfoBoxes.get(appId)?.remove();
  mediaInfoBoxes.delete(appId);
}

// The largest area of a blurred tile per game, for the games given.
function largestTileAreas(appIds) {
  const largestAreas = new Map();

  for (const link of document.querySelectorAll("a.unslop-blur:not([data-unslop-plain])")) {
    const appId = link.dataset.unslopId;
    if (!appIds.has(appId)) continue;

    largestAreas.set(appId, Math.max(largestAreas.get(appId) || 0, tileAreaOf(link)));
  }
  return largestAreas;
}

function largestVisibleMedium(mediaList) {
  const areaOf = candidate => candidate.bounds.width * candidate.bounds.height;

  return mediaList
    .map(media => ({ media, bounds: media.getBoundingClientRect() }))
    .filter(
      ({ bounds }) =>
        isNearViewport(bounds) &&
        bounds.width >= MIN_INFO_WIDTH &&
        bounds.height >= MIN_INFO_HEIGHT,
    )
    .sort((first, second) => areaOf(second) - areaOf(first))[0];
}

/* The largest visible medium of an AI game gets the info, unless a tile of the same game that is
   at least as large already shows it (e.g. the trailer link on recommendation cards). */
function placeMediaInfoBoxes(blurredMediaByAppId) {
  for (const [appId, infoBox] of mediaInfoBoxes) {
    if (!blurredMediaByAppId.has(appId) || !infoBox.isConnected) removeMediaInfoBox(appId);
  }
  if (!blurredMediaByAppId.size) return;

  const tileAreas = largestTileAreas(blurredMediaByAppId);

  for (const [appId, mediaList] of blurredMediaByAppId) {
    const largest = largestVisibleMedium(mediaList);
    const largestArea = largest ? largest.bounds.width * largest.bounds.height : 0;

    if (!largest || (tileAreas.get(appId) || 0) >= largestArea) {
      removeMediaInfoBox(appId);
      continue;
    }

    const host = largest.media.parentElement;
    if (mediaInfoBoxes.get(appId)?.parentElement !== host) {
      removeMediaInfoBox(appId);
      mediaInfoBoxes.set(appId, createMediaInfoBox(appId, host));
    }

    positionMediaInfoBox(mediaInfoBoxes.get(appId), largest.media, host);
  }
}

function createMediaInfoBox(appId, host) {
  if (getComputedStyle(host).position === "static") host.dataset.unslopHost = "1";

  const info = cachedEntry(appId);

  const infoBox = document.createElement("div");
  infoBox.className = "unslop-mediainfo";
  infoBox.innerHTML = `<div class="unslop-box">${ratingInfoHTML(rate(info), info.tags)}${actionButtonsHTML(info, false)}</div>`;

  // Capture phase: carousels must neither navigate nor switch slides.
  for (const type of ["click", "mousedown", "pointerdown"]) {
    infoBox.addEventListener(
      type,
      event => {
        event.stopPropagation();
        if (type === "mousedown") event.preventDefault();
        if (type !== "click") return;

        event.preventDefault();
        const action = event.target.closest("[data-tile-action]")?.dataset.tileAction;

        if (action === "show") revealAppId(appId);
        else openMediaReason(appId);
      },
      true,
    );
  }

  host.appendChild(infoBox);
  fitTagsOnResize(infoBox);
  return infoBox;
}

function positionMediaInfoBox(infoBox, media, host) {
  const mediaBounds = media.getBoundingClientRect();
  const hostBounds = host.getBoundingClientRect();

  Object.assign(infoBox.style, {
    left: `${mediaBounds.left - hostBounds.left + host.scrollLeft}px`,
    top: `${mediaBounds.top - hostBounds.top + host.scrollTop}px`,
    width: `${mediaBounds.width}px`,
    height: `${mediaBounds.height}px`,
  });
}

function openMediaReason(appId) {
  const info = cachedEntry(appId);
  if (!info?.ai) return;

  const ignoreAction = {
    label: texts.ignore,
    className: "unslop-btn-secondary",
    run: (close, button) => handleIgnoreClick(button, appId, false, () => setTimeout(close, 900)),
  };

  const showAction = {
    label: texts.showAnyway,
    className: "unslop-btn-primary",
    run: close => {
      close();
      revealAppId(appId);
    },
  };

  openReasonDialog(info, {
    title: texts.disclosure,
    dismissable: true,
    appId,
    allowId: appId,
    intro: texts.intro,
    actions: [closeAction(), ...(info.ignored ? [] : [ignoreAction]), showAction],
  });
}

// "Show" on a tile or a medium reveals everything of that game on the page.
export function revealAppId(appId) {
  revealedAppIds.add(appId);

  for (const link of document.querySelectorAll("a.unslop-blur:not([data-unslop-plain])")) {
    if (link.dataset.unslopId === appId) revealTileGroup(link);
  }

  for (const media of document.querySelectorAll(".unslop-gmedia, .unslop-gwait")) {
    if (mediaAppIdOf(media) === appId) setMediaState(media, null);
  }

  removeMediaInfoBox(appId);
}
