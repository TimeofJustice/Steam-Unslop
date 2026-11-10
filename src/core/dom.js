// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

export const appIdOf = link => link.href?.match(/\/app\/(\d+)/)?.[1];

export const currentAppId = () => location.pathname.match(/^\/app\/(\d+)/)?.[1];

export function areaOf(element) {
  const rect = element.getBoundingClientRect();
  return rect.width * rect.height;
}

export function isVisible(element) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
}

/* State classes are remembered on the element: React rewrites className when it re-renders
   (e.g. a search suggestion row on hover) and drops them. restoreClasses() puts them back; the
   MutationObserver in main.js calls it before the next paint. */
export function addClass(element, ...classNames) {
  const remembered = (element._unslopClasses ||= new Set());
  classNames.forEach(name => remembered.add(name));
  element.classList.add(...classNames);
}

export function removeClass(element, ...classNames) {
  classNames.forEach(name => element._unslopClasses?.delete(name));
  element.classList.remove(...classNames);
}

export function toggleClass(element, className, enabled) {
  if (enabled) addClass(element, className);
  else removeClass(element, className);
}

export function restoreClasses(element) {
  const remembered = element._unslopClasses;
  if (!remembered?.size) return;

  for (const name of remembered) {
    if (!element.classList.contains(name)) element.classList.add(name);
  }
}

export const MEDIA_SELECTOR = 'img, video, [style*="background-image"]';

// Friend avatars ("friends who own this") and small icons are no game media.
export const AVATAR_SELECTOR =
  '[src*="avatar" i], [style*="avatar" i], [class*="avatar" i], [class*="avatar" i] *, ' +
  '[class*="friend" i] *, a[href*="steamcommunity.com"] *, a[href*="/profiles/"] *, a[href*="/id/"] *';

const SMALL_ICON_SIZE = 64;

export function isGameMedia(media) {
  if (media.matches(AVATAR_SELECTOR)) return false;

  const rect = media.getBoundingClientRect();
  const isSmallIcon =
    rect.width && rect.height && rect.width <= SMALL_ICON_SIZE && rect.height <= SMALL_ICON_SIZE;
  return !isSmallIcon;
}
