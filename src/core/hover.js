// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { rateForUser, shouldBlur } from "./settings.js";
import { addClass, appIdOf, isVisible, removeClass } from "./dom.js";
import { cachedEntry, fetchRating } from "./cache.js";
import { arrangeOverlays, capsuleNameOf, learnHoverTile, ratingInfoHTML } from "./tiles.js";
import { redrawOnRatingChange } from "./refresh.js";
import { checkHoveredLink } from "./main.js";

/* Hover popovers and preview panes get the AI info inserted and their images blurred. Steam has
   the classic #hover_app_<id>, tab list preview panes and newer React popovers without stable
   markup; the latter are matched through the last hovered game. */
const HOVER_LIFETIME = 3000;
const POPOVER_SELECTOR =
  '#global_hover, [role="tooltip"], [class*="hover" i], [class*="popover" i], ' +
  '[class*="tooltip" i], [class*="flyout" i], [class*="preview" i]';
const OWN_UI_SELECTOR = ".unslop-overlay, .unslop-modal, .unslop-hoverinfo, .unslop-dialog";
const CHECK_DELAYS = [120, 350, 700, 1200, 2000];

redrawOnRatingChange(() => {
  document.querySelectorAll(".unslop-hoverinfo").forEach(infoBox => infoBox.remove());
});

// { appId, link, name, time } of the last hovered game link.
let hovered = null;

export const recentHover = () =>
  hovered && Date.now() - hovered.time < HOVER_LIFETIME ? hovered : null;

const looksLikePreview = element =>
  /preview/i.test(element.className) || /preview/i.test(element.id);

function isFloating(element) {
  let current = element;
  for (let depth = 0; current && depth < 4; depth++) {
    if (/^(?:fixed|absolute)$/.test(getComputedStyle(current).position)) return true;
    current = current.parentElement;
  }
  return false;
}

function undecorate(popover) {
  popover.querySelectorAll(".unslop-hoverinfo").forEach(infoBox => infoBox.remove());
  removeClass(popover, "unslop-hoverblur");

  delete popover.dataset.unslopHover;
  delete popover.dataset.unslopWait;
}

// Rating still loading: keep the images blurred and decorate once it has arrived.
function decorateWhileLoading(popover, appId) {
  if (popover.dataset.unslopHover === appId && popover.dataset.unslopWait) return;

  undecorate(popover);
  popover.dataset.unslopHover = appId;
  popover.dataset.unslopWait = "1";
  addClass(popover, "unslop-hoverblur");

  fetchRating(appId).then(decorateHovers);
}

function titleElementOf(popover, name) {
  const knownTitle = popover.querySelector(".hover_release, .hover_title");
  if (knownTitle || !name) return knownTitle;

  return [...popover.querySelectorAll("*")].find(
    element => element.childElementCount === 0 && element.textContent.trim() === name,
  );
}

function decorate(popover, appId, name) {
  const entry = cachedEntry(appId);
  if (!entry) return decorateWhileLoading(popover, appId);
  if (!(entry.ai && shouldBlur(entry, appId))) return undecorate(popover);

  const alreadyDecorated =
    popover.dataset.unslopHover === appId && popover.querySelector(".unslop-hoverinfo");
  if (alreadyDecorated) return;

  undecorate(popover);
  popover.dataset.unslopHover = appId;
  addClass(popover, "unslop-hoverblur");

  const infoBox = document.createElement("div");
  infoBox.className = "unslop-hoverinfo";
  infoBox.innerHTML = ratingInfoHTML(rateForUser(entry), entry.tags);

  const titleElement = titleElementOf(popover, name);
  if (titleElement) titleElement.after(infoBox);
  else popover.prepend(infoBox);
}

const isRevealed = appId => hovered?.appId === appId && hovered.link.dataset.unslopShown;

function updatePopover(popover, appId) {
  if (isVisible(popover) && !isRevealed(appId)) decorate(popover, appId);
  else undecorate(popover);
}

function decorateKnownPopovers() {
  for (const popover of document.querySelectorAll('[id^="hover_app_"]')) {
    updatePopover(popover, popover.id.match(/\d+/)?.[0]);
  }

  // Preview panes are static side panels, often with the app id in their id attribute.
  for (const pane of document.querySelectorAll('.tab_preview, [id*="preview_"]')) {
    if (pane.closest(OWN_UI_SELECTOR) || pane.id.startsWith("hover_app_")) continue;

    const appId = pane.id.match(/(\d{3,})/)?.[1] || pane.dataset.dsAppid;
    if (!appId) continue;

    pane.dataset.unslopPreview = "1";
    updatePopover(pane, appId);
  }
}

function unknownPopovers() {
  return [...document.querySelectorAll(POPOVER_SELECTOR)].filter(
    popover =>
      !popover.closest(OWN_UI_SELECTOR) &&
      !popover.querySelector('[id^="hover_app_"], [data-unslop-preview]') &&
      !popover.id.startsWith("hover_app_") &&
      !popover.dataset.unslopPreview,
  );
}

// Whether a popover without stable markup belongs to the hovered game.
function belongsToHover(popover, hover, allPopovers) {
  if (!hover || hover.link.dataset.unslopShown || !hover.name) return false;
  if (!isVisible(popover) || popover.contains(hover.link) || hover.link.contains(popover)) {
    return false;
  }
  if (!(isFloating(popover) || looksLikePreview(popover))) return false;
  if (!popover.textContent.includes(hover.name)) return false;

  // Cards with their own copy of the tile are blurred as tiles.
  if (popover.querySelector(`a[href*="/app/${hover.appId}/"] img`)) return false;

  // Only the outermost popover counts.
  return !allPopovers.some(
    other =>
      other !== popover &&
      other.contains(popover) &&
      isVisible(other) &&
      other.textContent.includes(hover.name),
  );
}

export function decorateHovers() {
  decorateKnownPopovers();

  const hover = recentHover();
  if (hover) {
    learnHoverTile(hover);

    // Hover cards may have been blurred while still hidden (size 0); arrange again with real sizes.
    const mainLink = hover.link._unslopMain || hover.link;
    const needsArranging =
      mainLink._unslopPlain?.length && mainLink._unslopInfo && !mainLink.dataset.unslopShown;
    if (needsArranging) arrangeOverlays(mainLink, true);
  }

  const popovers = unknownPopovers();
  for (const popover of popovers) {
    if (belongsToHover(popover, hover, popovers)) {
      decorate(popover, hover.appId, hover.name);
      continue;
    }

    const decoratedFor = popover.dataset.unslopHover;
    const isStale = !hover || decoratedFor !== hover.appId || !isVisible(popover);
    if (decoratedFor && isStale) undecorate(popover);
  }
}

// Popovers appear with a delay, so they are checked a few times after a game link is hovered.
export function trackHover(event) {
  const link = event.target instanceof Element && event.target.closest('a[href*="/app/"]');
  const appId = link && appIdOf(link);
  if (!appId) return;

  if (hovered?.link === link) {
    hovered.time = Date.now();
    return;
  }

  const name =
    cachedEntry(appId)?.name || link.getAttribute("aria-label") || capsuleNameOf(link) || "";
  hovered = { appId, link, name, time: Date.now() };

  checkHoveredLink(link, appId);
  for (const delay of CHECK_DELAYS) setTimeout(decorateHovers, delay);
}
