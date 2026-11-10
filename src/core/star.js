// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { texts } from "./i18n.js";
import { ICONS, closeButtonHTML } from "./render.js";
import { storage } from "./cache.js";
import { REPOSITORY_URL } from "./project.js";

/* "Star on GitHub" reminder, counted in uses rather than days:
   - in dialogs from the FIRST_DIALOG-th one on, and DIALOGS_BETWEEN dialogs after it is closed;
   - as a small toast on pages with blurred games, at most once per session and every
     PAGES_BETWEEN such pages.
   Clicking the link pauses both CLICKED_PAUSE_FACTOR times longer. Nothing shows before the
   stored state has loaded, so it does not flash up while paused. */
export const STAR_KEY = "unslopStar";
const TOAST_SHOWN_KEY = "unslopStarToast";
export const OLD_STAR_KEYS = ["aislopStar", "aislopStarHidden", "aislopStarPause"];

const FIRST_DIALOG = 3;
const DIALOGS_BETWEEN = 15;
const FIRST_PAGE = 5;
const PAGES_BETWEEN = 30;
const TOAST_DELAY = 6000;
const TOAST_DURATION = 15000;
const CLICKED_PAUSE_FACTOR = 5;

// { dialogsOpened, nextDialog, pagesCounted, nextPage }; null until loaded.
let starState = null;
let dialogsOpenedBeforeLoad = 0;
let pageCounted = false;

const starLinkHTML = () =>
  `<a class="unslop-btn unslop-btn-primary" href="${REPOSITORY_URL}" target="_blank" rel="noopener" data-star-link>` +
  `${ICONS.star}<span>${texts.starLink}</span></a>`;

const starContentHTML = () =>
  `<span class="unslop-star-text">${texts.starText}</span>${starLinkHTML()}` +
  closeButtonHTML("unslop-icon-btn", "data-star-hide", texts.starHide);

const bannerIsDue = () => !!starState && starState.dialogsOpened >= starState.nextDialog;

export const starBannerHTML = () =>
  `<div class="unslop-star"${bannerIsDue() ? "" : " hidden"}>${starContentHTML()}</div>`;

function showStarBanners(visible) {
  document.querySelectorAll(".unslop-star").forEach(banner => {
    banner.hidden = !visible;
  });
}

// Stored with the old short names, so existing counts are kept.
function saveStarState() {
  storage.save(STAR_KEY, {
    opens: starState.dialogsOpened,
    modalAt: starState.nextDialog,
    pages: starState.pagesCounted,
    toastAt: starState.nextPage,
  });
}

export function loadStarState(stored) {
  const saved = stored && typeof stored === "object" ? stored : {};
  const numberOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

  starState = {
    dialogsOpened: numberOr(saved.opens, 0) + dialogsOpenedBeforeLoad,
    nextDialog: numberOr(saved.modalAt, FIRST_DIALOG),
    pagesCounted: numberOr(saved.pages, 0),
    nextPage: numberOr(saved.toastAt, FIRST_PAGE),
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

export function dismissStarReminder(where) {
  if (!starState) return;

  if (where === "dialog") {
    starState.nextDialog = starState.dialogsOpened + DIALOGS_BETWEEN;
    showStarBanners(false);
  } else {
    starState.nextPage = starState.pagesCounted + PAGES_BETWEEN;
  }
  saveStarState();
}

export function onStarLinkClicked() {
  if (!starState) return;

  starState.nextDialog = starState.dialogsOpened + DIALOGS_BETWEEN * CLICKED_PAUSE_FACTOR;
  starState.nextPage = starState.pagesCounted + PAGES_BETWEEN * CLICKED_PAUSE_FACTOR;
  showStarBanners(false);
  hideStarToast();
  saveStarState();
}

// Called by scan(): counts pages with blurred games and shows the toast when it is due.
export function countPageForStar() {
  const hasBlurredGames = document.querySelector(".unslop-blur, .unslop-gmedia");
  if (!starState || pageCounted || !hasBlurredGames) return;

  pageCounted = true;
  starState.pagesCounted++;
  saveStarState();

  let shownThisSession = false;
  try {
    shownThisSession = !!sessionStorage.getItem(TOAST_SHOWN_KEY);
  } catch {
    // Storage blocked.
  }

  if (!shownThisSession && starState.pagesCounted >= starState.nextPage) {
    setTimeout(showStarToast, TOAST_DELAY);
  }
}

function showStarToast() {
  const dialogOpen = document.querySelector(".unslop-modal, .unslop-toast");
  const gameQuestionOpen = "unslopPage" in document.documentElement.dataset;
  if (dialogOpen || gameQuestionOpen) return;

  try {
    sessionStorage.setItem(TOAST_SHOWN_KEY, "1");
  } catch {
    // Storage blocked.
  }

  // Shown counts as seen, so an ignored toast also comes back only PAGES_BETWEEN pages later.
  dismissStarReminder("toast");

  const toast = document.createElement("div");
  toast.className = "unslop-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = starContentHTML();

  toast.addEventListener("click", event => {
    if (event.target.closest("[data-star-link]")) onStarLinkClicked();
    else if (event.target.closest("[data-star-hide]")) hideStarToast();
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
