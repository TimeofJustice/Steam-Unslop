// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { formatText, texts } from "./i18n.js";
import { ICONS } from "./render.js";
import { openSettings } from "./settings-dialog.js";
import { onNewsChanged, openNews, unseenNews } from "./news.js";

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

function showNewsCount(button) {
  const count = unseenNews().length;
  const badge = button.querySelector(".unslop-nav-count");

  badge.hidden = !count;
  badge.textContent = count ? String(count) : "";
  button.title = count
    ? formatText(texts.newsTip, { n: count })
    : `${texts.appName}: ${texts.settings}`;
}

onNewsChanged(() => {
  const button = document.querySelector(".unslop-nav-btn");
  if (button) showNewsCount(button);
});

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
  button.innerHTML = `${ICONS.hide}<span>${texts.navLabel}</span><b class="unslop-nav-count" hidden></b>`;
  showNewsCount(button);

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    // New disclosures on the wishlist come first; the settings are one click further.
    if (unseenNews().length) openNews();
    else openSettings();
  });

  if (wishlistLink) wishlistLink.before(button);
  else search.after(button);
}
