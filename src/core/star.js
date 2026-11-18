// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { texts } from "./i18n.js";
import { ICONS, closeButtonHTML } from "./render.js";
import { storage } from "./cache.js";
import { REPOSITORY_URL } from "./project.js";

/* "Star on GitHub" reminder, asked for once:
   - in dialogs from the FIRST_DIALOG-th one on, until it is closed or its link is used;
   - as a small toast once, on the FIRST_PAGE-th page with blurred games.
   Closing either or using the link ends both for good. The settings keep a small link at all
   times. Nothing shows before the stored state has loaded, so nothing flashes up. */
export const STAR_KEY = "unslopStar";
export const OLD_STAR_KEYS = ["aislopStar", "aislopStarHidden", "aislopStarPause"];

const FIRST_DIALOG = 3;
const FIRST_PAGE = 5;
const TOAST_DELAY = 6000;
const TOAST_DURATION = 15000;

// { dialogsOpened, pagesCounted, done, toastShown }; null until loaded.
let starState = null;
let dialogsOpenedBeforeLoad = 0;
let pageCounted = false;

const starLinkHTML = () =>
  `<a class="unslop-btn unslop-btn-primary" href="${REPOSITORY_URL}" target="_blank" rel="noopener" data-star-link>` +
  `${ICONS.star}<span>${texts.starLink}</span></a>`;

const starContentHTML = () =>
  `<span class="unslop-star-text">${texts.starText}</span>${starLinkHTML()}` +
  closeButtonHTML("unslop-icon-btn", "data-star-hide", texts.starHide);

// The small link in the settings, always there.
export const starSettingsLinkHTML = () =>
  `<a class="unslop-star-hint" href="${REPOSITORY_URL}" target="_blank" rel="noopener">${ICONS.star}<span>${texts.starLink}</span></a>`;

const bannerIsDue = () => !!starState && !starState.done && starState.dialogsOpened >= FIRST_DIALOG;

export const starBannerHTML = () =>
  `<div class="unslop-star"${bannerIsDue() ? "" : " hidden"}>${starContentHTML()}</div>`;

function showStarBanners(visible) {
  document.querySelectorAll(".unslop-star").forEach(banner => {
    banner.hidden = !visible;
  });
}

function saveStarState() {
  storage.save(STAR_KEY, {
    opens: starState.dialogsOpened,
    pages: starState.pagesCounted,
    done: starState.done,
    toastShown: starState.toastShown,
  });
}

/* Before 2.0 the reminder came back after a while: modalAt and toastAt were the next due counts.
   Moved on from their first value, the user had already closed it or seen the toast. */
export function loadStarState(stored) {
  const saved = stored && typeof stored === "object" ? stored : {};
  const numberOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

  starState = {
    dialogsOpened: numberOr(saved.opens, 0) + dialogsOpenedBeforeLoad,
    pagesCounted: numberOr(saved.pages, 0),
    done: saved.done === true || numberOr(saved.modalAt, FIRST_DIALOG) > FIRST_DIALOG,
    toastShown: saved.toastShown === true || numberOr(saved.toastAt, FIRST_PAGE) > FIRST_PAGE,
  };

  // The game page question opens before the state has loaded; those opens must be stored too.
  if (dialogsOpenedBeforeLoad) saveStarState();
  dialogsOpenedBeforeLoad = 0;

  showStarBanners(bannerIsDue());
}

export function countDialogOpened() {
  if (!starState) {
    dialogsOpenedBeforeLoad++;
    return;
  }

  starState.dialogsOpened++;
  saveStarState();
}

// Closing the banner or the toast, or using the link, ends the reminder.
function finishStarReminder() {
  if (!starState) return;

  starState.done = true;
  showStarBanners(false);
  hideStarToast();
  saveStarState();
}

export const dismissStarReminder = finishStarReminder;
export const onStarLinkClicked = finishStarReminder;

// Called by scan(): counts pages with blurred games and shows the toast when it is due.
export function countPageForStar() {
  const hasBlurredGames = document.querySelector(".unslop-blur, .unslop-gmedia");
  if (!starState || pageCounted || !hasBlurredGames) return;

  pageCounted = true;
  starState.pagesCounted++;
  saveStarState();

  const toastIsDue =
    !starState.done && !starState.toastShown && starState.pagesCounted >= FIRST_PAGE;
  if (toastIsDue) setTimeout(showStarToast, TOAST_DELAY);
}

function showStarToast() {
  const dialogOpen = document.querySelector(".unslop-modal, .unslop-toast");
  const gameQuestionOpen = "unslopPage" in document.documentElement.dataset;
  if (dialogOpen || gameQuestionOpen || starState.done) return;

  // The toast shows once, also when it is only left to hide by itself.
  starState.toastShown = true;
  saveStarState();

  const toast = document.createElement("div");
  toast.className = "unslop-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = starContentHTML();

  toast.addEventListener("click", event => {
    if (event.target.closest("[data-star-link], [data-star-hide]")) finishStarReminder();
  });

  // The toast stays while the pointer is on it.
  let hideTimer = setTimeout(hideStarToast, TOAST_DURATION);
  toast.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  toast.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(hideStarToast, 4000);
  });

  document.body.appendChild(toast);
}

function hideStarToast() {
  const toast = document.querySelector(".unslop-toast");
  if (!toast || toast.classList.contains("unslop-toast-out")) return;

  toast.classList.add("unslop-toast-out");
  setTimeout(() => toast.remove(), 250);
}
