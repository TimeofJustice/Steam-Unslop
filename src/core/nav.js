// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { texts } from "./i18n.js";
import { ICONS } from "./render.js";
import { openSettings } from "./settings.js";

/* Settings button in the store header, in the browser and in the Steam client. It sits before the
   wishlist link and takes over its classes, so it looks like Steam's own header buttons; without
   a wishlist link (signed out) it follows the search. React may re-render the header, so scan()
   calls this again and re-inserts the button when it is gone. */
const SEARCH_SELECTORS = ['form[role="search"]', "#searchform", "#store_search"];

function headerWishlistLink() {
  return [...document.querySelectorAll('a[href*="/wishlist"]')].find(link => {
    const bounds = link.getBoundingClientRect();
    const isInHeader = bounds.top + scrollY < 260;
    return bounds.width && bounds.height && isInHeader && !link.closest(".unslop-modal");
  });
}

export function ensureNavButton() {
  if (document.querySelector(".unslop-nav-btn")?.isConnected) return;

  const wishlistLink = headerWishlistLink();
  const search =
    !wishlistLink &&
    SEARCH_SELECTORS.map(selector => document.querySelector(selector)).find(Boolean);
  if (!wishlistLink && !search?.parentElement) return;

  const button = document.createElement("a");
  button.href = "#";
  button.setAttribute("role", "button");
  button.className = wishlistLink
    ? `${wishlistLink.className} unslop-nav-btn unslop-nav-steam`
    : "unslop-nav-btn";
  button.title = `${texts.appName}: ${texts.settings}`;
  button.innerHTML = `${ICONS.hide}<span>${texts.navLabel}</span>`;

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openSettings();
  });

  if (wishlistLink) wishlistLink.before(button);
  else search.after(button);
}
