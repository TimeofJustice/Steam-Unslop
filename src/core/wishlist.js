// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { foldUmlauts } from "./detection.js";
import { addClass, appIdOf, removeClass } from "./dom.js";
import { removedFromWishlist } from "./steam-api.js";
import { boundsOf } from "./tiles.js";

export const isWishlist = () => location.pathname.startsWith("/wishlist");

// Controls (drag handle, remove, add to cart) stay sharp and usable.
const CONTROL_SELECTOR = 'button, [role="button"], [draggable="true"], input, select, textarea';
const REMOVE_LABEL = /^(?:[\u00d7\u2715x]\s*)?(?:entfernen|remove|loeschen|delete)$/i;
const DRAG_CURSOR = /^(?:grab|grabbing|move)$/;

const cursorOf = element => (element ? getComputedStyle(element).cursor : "");

const isRemoveControl = element =>
  element.childElementCount <= 3 && REMOVE_LABEL.test(foldUmlauts(element.textContent.trim()));

function isControl(element) {
  if (element.matches(CONTROL_SELECTOR) || isRemoveControl(element)) return true;

  const cursor = cursorOf(element);
  return DRAG_CURSOR.test(cursor) && cursor !== cursorOf(element.parentElement);
}

const containsControl = element =>
  isControl(element) || [...element.querySelectorAll("*")].some(isControl);

const hasRemoveControl = row => !!row && [...row.querySelectorAll("*")].some(isRemoveControl);

function dimWithoutControls(element, dimmedElements) {
  if (element.classList.contains("unslop-overlay")) return;

  if (!containsControl(element)) {
    addClass(element, "unslop-dim");
    dimmedElements.push(element);
  } else if (!isControl(element)) {
    for (const child of element.children) dimWithoutControls(child, dimmedElements);
  }
}

function rowOf(link) {
  const appId = link.dataset.unslopId;
  const linkHeight = boundsOf(link).height;
  let row = link;

  for (let depth = 0; depth < 8; depth++) {
    const parent = row.parentElement;
    if (!parent || parent === document.body) break;

    const linksOtherGames = [...parent.querySelectorAll('a[href*="/app/"]')].some(
      otherLink => appIdOf(otherLink) !== appId,
    );
    if (linksOtherGames) break;

    if (linkHeight && parent.getBoundingClientRect().height > linkHeight * 2 + 40) break;
    row = parent;
  }

  return row;
}

// Wishlist rows have no stable class names. The row is the largest ancestor that only links to
// this game and is not much taller than the capsule.
export function dimRow(link) {
  if (!isWishlist()) return;

  const row = rowOf(link);
  undimRow(link);
  link._unslopRow = row;

  const dimmedElements = [];
  for (let element = link; element !== row; element = element.parentElement) {
    for (const sibling of element.parentElement.children) {
      if (sibling !== element) dimWithoutControls(sibling, dimmedElements);
    }
  }
  link._unslopDimmed = dimmedElements;

  if (removedFromWishlist.has(link.dataset.unslopId)) hideRow(link);
}

export function undimRow(link) {
  link._unslopDimmed?.forEach(element => removeClass(element, "unslop-dim"));
  link._unslopDimmed = null;
}

export function hideRow(link) {
  const row = link._unslopRow;
  if (!row || row === link) return;

  addClass(row, "unslop-gone");
  link._unslopHiddenRow = row;
}

export function showHiddenRow(link) {
  if (link._unslopHiddenRow) removeClass(link._unslopHiddenRow, "unslop-gone");
  link._unslopHiddenRow = null;
}

// Only the user's own wishlist has remove controls; only there ignoring also removes the game.
export const isOwnWishlistRow = link => isWishlist() && hasRemoveControl(link._unslopRow);
