// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { formatText, texts } from "./i18n.js";
import { cachedEntry, fetchRating } from "./cache.js";
import { shouldBlur } from "./settings.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";
import { appIdsOfBundles, bundleIdOf } from "./bundles.js";
import { fillGameList, gameListHTML, sortByLevel } from "./game-list.js";

/* Warns before paying for a cart with AI games. Single games come from Steam's user data
   (rgAppsInCart), which does not depend on the page layout or language. Bundles are missing
   there; they come from the cart's bundle images and are resolved into their games by the store
   API. The ratings are loaded when the cart opens, so the warning does not delay the click.
   Whatever fails, the purchase is never blocked: without an answer in time, the click goes
   through. */
const USER_DATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";
const CHECK_TIMEOUT = 4000;

// Recommendations and search suggestions also link to bundles, but are not in the cart.
const NOT_IN_CART_SELECTOR = ".ImpressionTrackedElement, [id^='searchSuggestions'], .unslop-modal";

// The cart's "Continue to payment" links: by target, and by label for Steam's own buttons.
const CHECKOUT_LABEL =
  /^(?:continue to payment|weiter zur zahlung|purchase for myself|f\u00fcr mich kaufen)$/i;

const isCartPage = () => location.pathname.startsWith("/cart");

let checkoutConfirmed = false;

async function singleAppIdsInCart() {
  const response = await fetch(`${USER_DATA_URL}?t=${Date.now()}`, { credentials: "include" });
  const userData = await response.json();
  return (userData.rgAppsInCart || []).map(String);
}

/* Each bundle in the cart shows its image as a link. Text links to bundles are offers such as
   "this item is also available as part of ...", which are not in the cart. */
function bundleIdsInCart() {
  const bundleIds = [...document.querySelectorAll('a[href*="/bundle/"]')]
    .filter(link => link.querySelector("img") || !link.textContent.trim())
    .filter(link => !link.closest(NOT_IN_CART_SELECTOR))
    .map(bundleIdOf)
    .filter(Boolean);

  return [...new Set(bundleIds)];
}

async function appIdsInCart() {
  const [singleAppIds, bundleAppIds] = await Promise.all([
    singleAppIdsInCart(),
    appIdsOfBundles(bundleIdsInCart()).catch(() => []),
  ]);

  return [...new Set([...singleAppIds, ...bundleAppIds])];
}

async function aiGamesInCart() {
  const appIds = await appIdsInCart();
  await Promise.all(appIds.map(fetchRating));

  return appIds
    .map(appId => ({ appId, entry: cachedEntry(appId) }))
    .filter(({ appId, entry }) => entry?.ai && shouldBlur(entry, appId));
}

const withTimeout = (promise, timeout) =>
  Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), timeout))]);

function checkoutElementOf(target) {
  const element = target instanceof Element && target.closest("a, button, [role='button']");
  if (!element || element.closest(".unslop-modal")) return null;

  const goesToCheckout = /checkout/i.test(element.getAttribute("href") || "");
  const isLabeledCheckout = CHECKOUT_LABEL.test(element.textContent.trim());
  return goesToCheckout || isLabeledCheckout ? element : null;
}

function continueCheckout(checkoutElement) {
  checkoutConfirmed = true;
  checkoutElement.click();
  checkoutConfirmed = false;
}

function showCartWarning(cartGames, checkoutElement) {
  const aiGames = sortByLevel(cartGames);
  const titleId = nextModalId();
  const intro =
    aiGames.length === 1
      ? texts.cartWarningIntroOne
      : formatText(texts.cartWarningIntro, { n: aiGames.length });

  openModal(
    `<div class="unslop-dialog unslop-cart-warning" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable: true, settingsButton: false })}
    <div class="unslop-dialog-body">
      <p>${intro}</p>
      ${gameListHTML(aiGames)}
      <div class="unslop-actions">
        <button class="unslop-btn unslop-btn-secondary" data-close>${texts.cartBack}</button>
        <button class="unslop-btn unslop-btn-primary" data-cart-continue>${texts.cartContinue}</button>
      </div>
    </div></div>`,
    {
      dismissable: true,
      focus: "[data-close]",
      onClick: (event, close) => {
        if (!event.target.closest("[data-cart-continue]")) return;
        close();
        continueCheckout(checkoutElement);
      },
    },
  );

  const dialog = document.getElementById(titleId).closest(".unslop-cart-warning");
  dialog.querySelector(`#${titleId}`).textContent = texts.cartWarningTitle;
  dialog.querySelector(".unslop-dialog-sub").remove();

  fillGameList(dialog, aiGames);
}

async function handleCheckoutClick(event) {
  if (checkoutConfirmed || !isCartPage()) return;

  const checkoutElement = checkoutElementOf(event.target);
  if (!checkoutElement) return;

  // Captured before Steam's own handlers, so the payment page does not open yet.
  event.preventDefault();
  event.stopImmediatePropagation();

  const aiGames = await withTimeout(
    aiGamesInCart().catch(() => null),
    CHECK_TIMEOUT,
  );

  if (aiGames?.length) showCartWarning(aiGames, checkoutElement);
  else continueCheckout(checkoutElement);
}

// Called once on start.
export function watchCheckout() {
  addEventListener("click", handleCheckoutClick, true);
}

let preloadedBundles = null;

/* Called by scan(): loads the ratings of the cart's games ahead of the click. Steam renders the
   cart after the start, so it loads again whenever other bundles have appeared. */
export function preloadCartRatings() {
  if (!isCartPage()) return;

  const bundles = bundleIdsInCart().join(",");
  if (bundles === preloadedBundles) return;

  preloadedBundles = bundles;
  aiGamesInCart().catch(() => {});
}
