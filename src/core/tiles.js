// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { tagLabel, texts } from "./i18n.js";
import { compactLevelHTML, hintListText, sortBySeverity, tagsHTML } from "./render.js";
import { addClass, appIdOf, areaOf, removeClass } from "./dom.js";
import { storage } from "./cache.js";
import { handleIgnoreClick } from "./steam-api.js";
import { closeAction, openReasonDialog } from "./dialog.js";
import { dimRow, hideRow, isOwnWishlistRow, showHiddenRow, undimRow } from "./wishlist.js";
import { blurCard, unblurCard } from "./card.js";
import { revealAppId, revealedAppIds } from "./media.js";
import { rateForUser } from "./settings.js";

const NAME_SELECTOR = ".title, .tab_item_name, [class*='Title'], [class*='name']";

export function capsuleNameOf(element) {
  const name =
    element.querySelector(NAME_SELECTOR)?.textContent || element.querySelector("img")?.alt;
  return (name || "").trim();
}

// A tile is a link with a real image, not just a small icon such as a platform logo.
export function hasCapsuleImage(link) {
  for (const image of link.querySelectorAll("img")) {
    const width = image.getBoundingClientRect().width;
    if (width >= 40) return true;

    // Not laid out yet.
    const looksLikeIcon = /icon|platform/i.test(`${image.src} ${image.className}`);
    if (!width && !looksLikeIcon) return true;
  }
  return false;
}

/* Links without a box of their own (display: contents, or inline around block children) cannot
   position an overlay; it would cover some ancestor such as the whole search dropdown. Their
   largest child hosts the overlay instead and stands in for their size. */
const canHostOverlay = element =>
  !/^(?:IMG|VIDEO|PICTURE|CANVAS|SVG|svg|INPUT|BUTTON|IFRAME|SOURCE)$/.test(element.tagName) &&
  !element.classList.contains("unslop-overlay");

function needsOverlayHost(link) {
  const display = getComputedStyle(link).display;
  if (display === "contents") return true;
  if (display !== "inline") return false;

  return [...link.children].some(
    child => canHostOverlay(child) && !/^inline/.test(getComputedStyle(child).display || "inline"),
  );
}

function largestHostChild(link) {
  let largestChild = null;
  let largestArea = -1;

  for (const child of link.children) {
    if (!canHostOverlay(child)) continue;

    const childArea = areaOf(child);
    if (childArea > largestArea) {
      largestChild = child;
      largestArea = childArea;
    }
  }
  return largestChild;
}

function overlayHostOf(link) {
  const needsHost = needsOverlayHost(link);
  const currentHost = link._unslopHost;

  // A host that was replaced on re-render or is not laid out yet is chosen again.
  const hostIsValid =
    currentHost?.isConnected && currentHost.parentElement === link && areaOf(currentHost);
  if (needsHost && hostIsValid) return currentHost;

  if (currentHost) {
    delete currentHost.dataset.unslopTileHost;
    link._unslopHost = null;
  }
  if (!needsHost) return link;

  const host = largestHostChild(link);
  if (!host) return link;

  const isStatic = /^(?:static)?$/.test(getComputedStyle(host).position);
  host.dataset.unslopTileHost = isStatic ? "static" : "1";

  link._unslopHost = host;
  return host;
}

export const boundsOf = link => overlayHostOf(link).getBoundingClientRect();
export const tileAreaOf = link => areaOf(overlayHostOf(link));

const overlayOf = link =>
  link.querySelector(":scope > .unslop-overlay, :scope > * > .unslop-overlay");

export function isOverlayPlaced(link) {
  const overlay = overlayOf(link);
  return !!overlay && overlay.parentElement === overlayHostOf(link);
}

/* The same game is often linked several times in one card (an image and a strip below it on
   hover cards). The main element holds the state; the largest member shows the info, a flat
   strip shows the actions and any other member is only blurred. */
export const tileGroupOf = mainLink => [mainLink, ...(mainLink._unslopPlain || [])];

const linksOtherGame = (root, appId) =>
  [...root.querySelectorAll('a[href*="/app/"]')].some(link => {
    const otherId = appIdOf(link);
    return otherId && otherId !== appId;
  });

// Only links within an area that shows no other game belong together; the same game listed
// twice in search results is two separate tiles.
function blurredTwinOf(link, appId) {
  let root = link.parentElement;

  for (let depth = 0; root && root !== document.body && depth < 4; depth++) {
    if (linksOtherGame(root, appId)) return null;

    const twin = [...root.querySelectorAll("a.unslop-blur")].find(
      other =>
        other !== link &&
        !other.dataset.unslopPlain &&
        appIdOf(other) === appId &&
        !other.contains(link) &&
        !link.contains(other),
    );
    if (twin) return twin;

    root = root.parentElement;
  }
  return null;
}

function blurAsPlainMember(link, mainLink) {
  unblurCard(link);
  addClass(link, "unslop-blur");

  link.dataset.unslopPlain = "1";
  link._unslopMain = mainLink;
  (mainLink._unslopPlain ||= []).push(link);
}

export function blurTile(link, info) {
  if (link.classList.contains("unslop-blur") || link.dataset.unslopShown) return;

  const twin = blurredTwinOf(link, link.dataset.unslopId);

  // The larger link becomes the main element of the group.
  if (twin && tileAreaOf(twin) >= tileAreaOf(link)) {
    blurAsPlainMember(link, twin);
    return arrangeOverlays(twin);
  }

  if (twin) {
    const twinMembers = twin._unslopPlain || [];
    twin._unslopPlain = null;
    blurAsPlainMember(twin, link);

    twinMembers.forEach(member => {
      member._unslopMain = link;
      link._unslopPlain.push(member);
    });
  }

  addClass(link, "unslop-blur");

  // Elements without their own box must not be clipped; it would hide the whole tile.
  if (/^(?:inline|contents)$/.test(getComputedStyle(link).display)) {
    link.dataset.unslopInline = "1";
  }

  link._unslopInfo = info;
  arrangeOverlays(link);
  dimRow(link);
  blurCard(link);
}

export function unblurTile(link) {
  undimRow(link);
  unblurCard(link);
  showHiddenRow(link);

  removeClass(link, "unslop-blur", "unslop-wait");
  overlayOf(link)?.remove();

  if (link._unslopHost) {
    delete link._unslopHost.dataset.unslopTileHost;
    link._unslopHost = null;
  }

  delete link.dataset.unslopShown;
  delete link.dataset.unslopPlain;
}

/* Tiles covered by a hover card cannot offer usable buttons. When hovering shows a card of the
   same game on top of a tile, the tile's shape (classes of link and parent) is remembered and
   all tiles of that shape show the info only. */
export const HOVER_KEY = "unslopHoverTiles";
const MAX_HOVER_SHAPES = 50;
export let hoverTileShapes = new Set();

export const setHoverTileShapes = shapes => {
  hoverTileShapes = shapes;
};

function classShapeOf(element) {
  if (!element) return "";

  const ownClasses = [...element.classList].filter(className => !className.startsWith("unslop"));
  return `${element.tagName}.${ownClasses.sort().join(".")}`;
}

const tileShapeOf = link => `${classShapeOf(link)}>${classShapeOf(link.parentElement)}`;

const hasOwnClasses = link =>
  [link, link.parentElement].some(
    element => element && [...element.classList].some(name => !name.startsWith("unslop")),
  );

export const isHoverTile = link => hoverTileShapes.has(tileShapeOf(link));

// The share of the first element's area that the second one covers.
function coveredShare(covered, cover) {
  const coveredBounds = covered.getBoundingClientRect();
  const coverBounds = cover.getBoundingClientRect();

  const overlapWidth =
    Math.min(coveredBounds.right, coverBounds.right) -
    Math.max(coveredBounds.left, coverBounds.left);
  const overlapHeight =
    Math.min(coveredBounds.bottom, coverBounds.bottom) -
    Math.max(coveredBounds.top, coverBounds.top);

  const hasArea = coveredBounds.width && coveredBounds.height;
  if (overlapWidth <= 0 || overlapHeight <= 0 || !hasArea) return 0;

  return (overlapWidth * overlapHeight) / (coveredBounds.width * coveredBounds.height);
}

// The hover card of the same game lying on top of the tile, if there is one.
function coveringHoverCard(tile, appId) {
  const bounds = boundsOf(tile);
  const topElement = document.elementFromPoint?.(
    bounds.left + bounds.width / 2,
    bounds.top + bounds.height / 2,
  );
  if (!topElement || tile.contains(topElement)) return null;

  let element = topElement;
  for (let depth = 0; element && element !== document.body && depth < 8; depth++) {
    if (element.contains(tile)) return null;

    const showsSameGame =
      element.matches("[data-unslop-hover]") ||
      [...element.querySelectorAll('a[href*="/app/"]')].some(link => appIdOf(link) === appId);
    if (showsSameGame) return element;

    element = element.parentElement;
  }
  return null;
}

function rememberHoverTileShape(shape) {
  hoverTileShapes.add(shape);
  const shapes = [...hoverTileShapes].slice(-MAX_HOVER_SHAPES);

  storage.save(HOVER_KEY, shapes);
  try {
    sessionStorage.setItem(HOVER_KEY, JSON.stringify(shapes));
  } catch {
    // Storage blocked.
  }
}

// hovered: { appId, link } of the game link the pointer is on.
export function learnHoverTile(hovered) {
  const tile = hovered.link;
  const isBlurredMain = tile.classList.contains("unslop-blur") && !tile.dataset.unslopPlain;
  if (!isBlurredMain || !hasOwnClasses(tile)) return;

  const shape = tileShapeOf(tile);
  if (hoverTileShapes.has(shape)) return;

  const hoverCard = coveringHoverCard(tile, hovered.appId);
  if (!hoverCard || coveredShare(tile, hoverCard) < 0.5) return;

  rememberHoverTileShape(shape);

  for (const link of document.querySelectorAll("a.unslop-blur:not([data-unslop-plain])")) {
    if (link._unslopInfo && tileShapeOf(link) === shape) arrangeOverlays(link);
  }
}

const isStrip = (bounds, link, largest) =>
  link !== largest && bounds.height >= 22 && bounds.width >= bounds.height * 3;

// mode: "full" (info and actions), "info" or "actions".
function overlayLayoutOf(mainLink) {
  const members = tileGroupOf(mainLink).map(link => ({ link, bounds: boundsOf(link) }));
  const sizeOf = member => member.bounds.width * member.bounds.height;
  const largest = members.reduce((best, member) =>
    sizeOf(member) > sizeOf(best) ? member : best,
  ).link;

  const hoverTile = isHoverTile(mainLink);
  const flatness = member => member.bounds.width / member.bounds.height;
  const strip = hoverTile
    ? null
    : members
        .filter(member => isStrip(member.bounds, member.link, largest))
        .sort((first, second) => flatness(second) - flatness(first))[0]?.link || null;

  return { largest, strip, mode: strip || hoverTile ? "info" : "full" };
}

const sameLayout = (first, second) =>
  first.largest === second.largest && first.strip === second.strip && first.mode === second.mode;

export function arrangeOverlays(mainLink, onlyIfChanged) {
  const layout = overlayLayoutOf(mainLink);
  const previousLayout = mainLink._unslopLayout;
  if (onlyIfChanged && previousLayout && sameLayout(previousLayout, layout)) return;

  mainLink._unslopLayout = layout;
  tileGroupOf(mainLink).forEach(link => overlayOf(link)?.remove());

  addOverlay(layout.largest, mainLink, layout.mode);
  if (layout.strip) addOverlay(layout.strip, mainLink, "actions");
}

/* Tags in one line (low tiles, flat rows) that do not fit: the last ones are hidden and "+N"
   stands in for them, with their names as tooltip. At least one tag stays. */
function fitTags(tagList) {
  tagList.querySelector(".unslop-more")?.remove();
  const tags = [...tagList.children];
  tags.forEach(tag => (tag.hidden = false));

  const fits = () => tagList.scrollWidth <= tagList.clientWidth;
  if (getComputedStyle(tagList).flexWrap !== "nowrap" || fits()) return;

  const more = document.createElement("em");
  more.className = "unslop-more sev-0";
  tagList.append(more);

  for (let hiddenCount = 1; hiddenCount < tags.length; hiddenCount++) {
    const hiddenTags = tags.slice(-hiddenCount);
    tags.forEach(tag => (tag.hidden = hiddenTags.includes(tag)));

    more.textContent = `+${hiddenCount}`;
    more.title = hiddenTags.map(tag => tag.textContent).join(", ");
    if (fits()) return;
  }
}

// Tiles change size with the page layout, so the tags are fitted again on every resize.
const tagFitter =
  typeof ResizeObserver === "function"
    ? new ResizeObserver(entries => {
        for (const entry of entries) entry.target.querySelectorAll(".unslop-tags").forEach(fitTags);
      })
    : null;

export const fitTagsOnResize = element => tagFitter?.observe(element);

const ignoredHTML = () => `<span class="unslop-ignored">${texts.ignored}</span>`;

export function actionButtonsHTML(info, withIgnore = true) {
  const whyButton = `<button class="unslop-btn unslop-btn-secondary" data-tile-action="why">${texts.why}</button>`;
  const showButton = `<button class="unslop-btn unslop-btn-primary" data-tile-action="show" title="${texts.showAnyway}">${texts.showShort}</button>`;

  let ignoreButton = "";
  if (withIgnore && !info.bundle) {
    ignoreButton = info.ignored
      ? ignoredHTML()
      : `<button class="unslop-btn unslop-btn-secondary unslop-btn-ignore" data-tile-action="ignore">${texts.ignore}</button>`;
  }

  return `<span class="unslop-btns">${whyButton}${ignoreButton}${showButton}</span>`;
}

export const ratingInfoHTML = (rating, tags) =>
  `${compactLevelHTML(rating)}<span class="unslop-tags">${tagsHTML(tags)}</span>`;

function overlayTooltip(info, rating) {
  const usedFor = sortBySeverity(info.tags).map(tagLabel).join(", ") || texts.noneGiven;
  const uncertainty = rating.uncertain ? `\n${texts.unsureTip}: ${hintListText(rating)}` : "";

  return `${texts.usedFor}: ${usedFor}${uncertainty}\n${texts.clickTip}`;
}

function addOverlay(target, mainLink, mode) {
  const info = mainLink._unslopInfo;
  const appId = mainLink.dataset.unslopId;
  const rating = rateForUser(info);

  const overlay = document.createElement("div");
  overlay.className = `unslop-overlay unslop-mode-${mode}`;
  overlay.title = overlayTooltip(info, rating);

  const infoPart = mode !== "actions" ? ratingInfoHTML(rating, info.tags) : "";
  const actionsPart = mode !== "info" ? actionButtonsHTML(info) : "";
  overlay.innerHTML = `<div class="unslop-box">${infoPart}${actionsPart}</div>`;

  // Pressing a button must not take the focus from e.g. the search field, or its suggestions close.
  overlay.addEventListener("mousedown", event => event.preventDefault());

  // Capture phase, so the link underneath never navigates.
  overlay.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      const button = event.target.closest("[data-tile-action]");
      const action = button?.dataset.tileAction;

      if (action === "show") {
        revealTileGroup(mainLink);
      } else if (action === "ignore") {
        handleIgnoreClick(button, appId, isOwnWishlistRow(mainLink), () => markIgnored(mainLink));
      } else {
        openTileReason(mainLink);
      }
    },
    true,
  );

  overlayHostOf(target).appendChild(overlay);
  fitTagsOnResize(overlay);
}

// Rebuilds the overlays, e.g. after the excluded kinds of use changed.
export function refreshOverlays() {
  for (const link of document.querySelectorAll("a.unslop-blur:not([data-unslop-plain])")) {
    if (link._unslopInfo) arrangeOverlays(link);
  }
}

export function unblurTileGroup(mainLink) {
  for (const link of tileGroupOf(mainLink)) unblurTile(link);
  mainLink._unslopPlain = null;
}

export function revealTileGroup(mainLink) {
  for (const link of tileGroupOf(mainLink)) {
    unblurTile(link);
    link.dataset.unslopShown = "1";
  }
  mainLink._unslopPlain = null;

  const appId = mainLink.dataset.unslopId;
  if (appId && !revealedAppIds.has(appId)) revealAppId(appId);
}

function markIgnored(mainLink) {
  if (isOwnWishlistRow(mainLink)) return hideRow(mainLink);

  for (const link of tileGroupOf(mainLink)) {
    const ignoreButton = overlayOf(link)?.querySelector('[data-tile-action="ignore"]');
    if (ignoreButton) ignoreButton.outerHTML = ignoredHTML();
  }
}

function openTileReason(mainLink) {
  const info = mainLink._unslopInfo;
  const appId = mainLink.dataset.unslopId;

  const ignoreAction = {
    label: texts.ignore,
    className: "unslop-btn-secondary",
    run: (close, button) =>
      handleIgnoreClick(button, appId, isOwnWishlistRow(mainLink), () => {
        markIgnored(mainLink);
        setTimeout(close, 900);
      }),
  };

  const showAction = {
    label: texts.showAnyway,
    className: "unslop-btn-primary",
    run: close => {
      close();
      revealTileGroup(mainLink);
    },
  };

  if (info.bundle) {
    openReasonDialog(info, {
      title: texts.disclosure,
      dismissable: true,
      intro: texts.bundleIntro,
      actions: [closeAction(), showAction],
    });
    return;
  }

  openReasonDialog(info, {
    title: texts.disclosure,
    dismissable: true,
    appId,
    allowId: appId,
    intro: texts.intro,
    actions: [closeAction(), ...(info.ignored ? [] : [ignoreAction]), showAction],
  });
}
