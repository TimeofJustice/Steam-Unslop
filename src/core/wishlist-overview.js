// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { formatText, texts } from "./i18n.js";
import { closeButtonHTML } from "./render.js";
import { cachedEntry, fetchRating } from "./cache.js";
import { shouldBlur } from "./settings.js";
import { wishlistAppIds } from "./userdata.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";
import { fillGameList, gameListHTML, sortByLevel } from "./game-list.js";
import { isWishlist } from "./wishlist.js";
import { appIdOf } from "./dom.js";

/* On the user's own wishlist, a small card in the corner counts the games with an AI disclosure
   and lists them. The games come from the user's store data, not from the page, which only
   renders the rows in view. Games not rated yet are checked in the background. */
const CLOSED_KEY = "unslopWishlistCardClosed";

function signedInSteamId() {
  try {
    const config = document.querySelector("#application_config");
    return JSON.parse(config?.dataset.userinfo || "{}").steamid || "";
  } catch {
    return "";
  }
}

const CHECK_INTERVAL = 1000;
const CHECK_TRIES = 15;
const MIN_SHARED_SHARE = 0.8;

// "/wishlist/" shows the own list, and so does an address with the user's Steam ID.
function addressIsOwn() {
  if (/^\/wishlist\/?$/.test(location.pathname)) return true;

  const steamId = signedInSteamId();
  return !!steamId && location.pathname.includes(steamId);
}

// The games the page lists; the header and the search suggestions are no part of the list.
function listedAppIds() {
  const links = [...document.querySelectorAll('a[href*="/app/"]')].filter(
    link => !link.closest("[id^='searchSuggestions'], header, .unslop-modal"),
  );
  return [...new Set(links.map(appIdOf).filter(Boolean))];
}

/* Opened through a link, the address often names the user by a custom name. Then the list is
   the own one when nearly all games it shows are on the user's wishlist. */
function listIsOwn(wishedAppIds) {
  const listed = listedAppIds();
  if (!listed.length) return null;

  const wished = new Set(wishedAppIds);
  const sharedCount = listed.filter(appId => wished.has(appId)).length;
  return sharedCount / listed.length >= MIN_SHARED_SHARE;
}

// The rows render after the start; wait for them a little while.
async function isOwnWishlist(wishedAppIds) {
  if (addressIsOwn()) return true;

  for (let tries = 0; tries < CHECK_TRIES; tries++) {
    const own = listIsOwn(wishedAppIds);
    if (own !== null) return own;
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
  }
  return false;
}

function wasClosed() {
  try {
    return !!sessionStorage.getItem(CLOSED_KEY);
  } catch {
    return false;
  }
}

const aiGamesOf = appIds =>
  appIds
    .map(appId => ({ appId, entry: cachedEntry(appId) }))
    .filter(({ appId, entry }) => entry?.ai && shouldBlur(entry, appId));

function openWishlistGames(appIds) {
  const games = sortByLevel(aiGamesOf(appIds));
  if (!games.length) return;

  const titleId = nextModalId();
  openModal(
    `<div class="unslop-dialog unslop-wishlist-games" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable: true, settingsButton: true })}
    <div class="unslop-dialog-body">
      ${gameListHTML(games)}
      <div class="unslop-actions"><button class="unslop-btn unslop-btn-primary" data-close>${texts.close}</button></div>
    </div></div>`,
    { dismissable: true },
  );

  const dialog = document.getElementById(titleId).closest(".unslop-wishlist-games");
  dialog.querySelector(`#${titleId}`).textContent = texts.wishlistTitle;
  dialog.querySelector(".unslop-dialog-sub").remove();
  fillGameList(dialog, games);
}

function createCard(appIds) {
  const card = document.createElement("div");
  card.className = "unslop-wishlist-card";
  card.setAttribute("role", "status");
  card.innerHTML =
    '<span class="unslop-wishlist-text"></span>' +
    `<button class="unslop-btn unslop-btn-secondary" type="button" data-wishlist-show>${texts.wishlistShow}</button>` +
    closeButtonHTML("unslop-icon-btn", "data-wishlist-close", texts.close);

  card.addEventListener("click", event => {
    if (event.target.closest("[data-wishlist-show]")) return openWishlistGames(appIds);
    if (!event.target.closest("[data-wishlist-close]")) return;

    card.remove();
    try {
      sessionStorage.setItem(CLOSED_KEY, "1");
    } catch {
      // Storage blocked.
    }
  });

  document.body.appendChild(card);
  return card;
}

// checkedCount: games rated or given up on (store page not available).
function updateCard(card, appIds, checkedCount) {
  const aiCount = aiGamesOf(appIds).length;

  let text;
  if (checkedCount < appIds.length) {
    text = formatText(texts.wishlistChecking, { n: checkedCount, total: appIds.length });
  } else if (aiCount) {
    text = formatText(texts.wishlistSummary, { n: aiCount, total: appIds.length });
  } else {
    text = formatText(texts.wishlistNone, { total: appIds.length });
  }

  card.querySelector(".unslop-wishlist-text").textContent = text;
  card.querySelector("[data-wishlist-show]").hidden = !aiCount;
}

export async function showWishlistOverview() {
  if (!isWishlist() || wasClosed()) return;

  const appIds = await wishlistAppIds();
  if (!appIds.length || !(await isOwnWishlist(appIds))) return;
  if (document.querySelector(".unslop-wishlist-card")) return;

  const card = createCard(appIds);
  const checked = new Set(appIds.filter(appId => cachedEntry(appId)));
  updateCard(card, appIds, checked.size);

  for (const appId of appIds) {
    if (checked.has(appId)) continue;

    fetchRating(appId).finally(() => {
      checked.add(appId);
      updateCard(card, appIds, checked.size);
    });
  }
}
