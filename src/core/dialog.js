// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { rate } from "./detection.js";
import { texts } from "./i18n.js";
import { levelHTML, tagsHTML, uncertaintyNoteHTML } from "./render.js";
import { allowGame, openSettings, shouldBlur } from "./settings.js";
import { loadDetails } from "./cache.js";
import { handleIgnoreClick } from "./steam-api.js";
import {
  countDialogOpened,
  dismissStarReminder,
  onStarLinkClicked,
  starBannerHTML,
} from "./star.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";

export const closeAction = () => ({
  label: texts.close,
  className: "unslop-btn-secondary",
  run: close => close(),
});

function actionButtonsHTML(actions, allowId) {
  const allowButton = allowId
    ? `<button class="unslop-btn unslop-btn-secondary unslop-push" data-allow>${texts.alwaysShow}</button>`
    : "";

  const actionButtons = actions
    .map(
      (action, index) =>
        `<button class="unslop-btn ${action.className}" data-action="${index}">${action.label}</button>`,
    )
    .join("");

  return allowButton + actionButtons;
}

function reasonDialogHTML(info, rating, { titleId, intro, actions, dismissable, allowId }) {
  const tagList = tagsHTML(info.tags) || `<em class="sev-0">${texts.noDetails}</em>`;
  const legend =
    `<em class="sev-3">${texts.levels[3]}</em>` +
    `<em class="sev-2">${texts.levels[2]}</em>` +
    `<em class="sev-1">${texts.levels[1]}</em>`;

  return `<div class="unslop-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable, settingsButton: true })}
    <div class="unslop-dialog-body">
      <p>${intro}</p>
      ${levelHTML(rating)}
      <div class="unslop-tags">${tagList}</div>
      ${uncertaintyNoteHTML(rating)}
      <section class="unslop-quote"><div class="unslop-label">${texts.devStatement}</div><blockquote></blockquote></section>
      <div class="unslop-legend"><span class="unslop-label">${texts.legend}</span>${legend}</div>
      <div class="unslop-actions">${actionButtonsHTML(actions, allowId)}</div>
    </div>${starBannerHTML()}</div>`;
}

/* The reason dialog. actions: [{ label, className, run(close, button) }]; returns close().
   subtitle: omitted means the game name from the store page (loaded if missing). Tiles in
   curator or developer sections show their name instead of the game's, so it never comes from
   the tile. */
export function openReasonDialog(
  info,
  { title, subtitle, intro, actions, dismissable, appId, allowId },
) {
  const rating = rate(info);
  const titleId = nextModalId();
  countDialogOpened();

  let subtitleElement;

  const handleClick = (event, close) => {
    if (event.target.closest("[data-star-hide]")) return dismissStarReminder("dialog");
    if (event.target.closest("[data-star-link]")) return onStarLinkClicked();
    if (event.target.closest("[data-settings]")) return openSettings();

    if (event.target.closest("[data-allow]")) {
      allowGame(allowId, info.name || subtitleElement.textContent || "");
      return close();
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) actions[actionButton.dataset.action].run(close, actionButton);
  };

  const close = openModal(
    reasonDialogHTML(info, rating, { titleId, intro, actions, dismissable, allowId }),
    { dismissable, onClick: handleClick },
  );

  const modal = document.getElementById(titleId).closest(".unslop-modal");
  modal.querySelector(".unslop-dialog-title").textContent = title;

  subtitleElement = modal.querySelector(".unslop-dialog-sub");
  const needsName = !!appId && subtitle === undefined && !info.name;
  const shownSubtitle = subtitle === undefined ? info.name || "" : subtitle;

  if (shownSubtitle) subtitleElement.textContent = shownSubtitle;
  else if (!needsName) subtitleElement.remove();

  // info is often the cache entry itself, which loadDetails() fills, so decide up front.
  const quote = modal.querySelector("blockquote");
  const needsText = !!appId && !info.text;

  quote.textContent = needsText ? texts.loading : info.text || texts.noText;
  quote.classList.toggle("unslop-loading", needsText);
  quote.setAttribute("aria-busy", String(needsText));

  if (needsText || needsName) {
    loadDetails(appId).then(({ text, name }) => {
      if (needsText) {
        if (text) info.text = text;

        quote.textContent = text || texts.noText;
        quote.classList.remove("unslop-loading");
        quote.setAttribute("aria-busy", "false");
      }

      if (needsName) {
        if (name) {
          info.name = name;
          subtitleElement.textContent = name;
        } else {
          subtitleElement.remove();
        }
      }
    });
  }

  return close;
}

// The open game page question. A raised minimum level that no longer covers the game releases it.
let pageGate = null;

function releasePageGate() {
  const { info, close } = pageGate;
  pageGate = null;

  delete document.documentElement.dataset.unslopPage;
  close();
  addPageBadge(info);
}

export function releasePageGateIfAllowed() {
  if (pageGate && !shouldBlur(pageGate.info, pageGate.appId)) releasePageGate();
}

function leaveGamePage() {
  if (history.length > 1) history.back();
  else location.href = "https://store.steampowered.com/";
}

// Blocks the game page until the user decides.
export function blockGamePage(info, appId) {
  document.documentElement.dataset.unslopPage = "";
  pageGate = { info, appId };

  pageGate.close = openReasonDialog(info, {
    title: texts.aiGame,
    allowId: appId,
    intro: texts.intro,
    actions: [
      { label: texts.back, className: "unslop-btn-secondary", run: leaveGamePage },
      {
        label: texts.ignore,
        className: "unslop-btn-secondary",
        run: (close, button) => handleIgnoreClick(button, appId, false),
      },
      { label: texts.yesShow, className: "unslop-btn-primary", run: releasePageGate },
    ],
  });
}

// Summary below the game title once the page is shown; opens the reason again.
export function addPageBadge(info) {
  const gameTitle = document.querySelector("#appHubAppName, .apphub_AppName");
  if (!gameTitle || document.querySelector(".unslop-badge")) return;

  const rating = rate(info);

  const pageBadge = document.createElement("div");
  pageBadge.className = "unslop-badge";
  pageBadge.dataset.level = rating.level;
  pageBadge.tabIndex = 0;
  pageBadge.title = texts.clickTip;
  pageBadge.setAttribute("role", "button");
  pageBadge.innerHTML = `${levelHTML(rating)}<span class="unslop-tags">${tagsHTML(info.tags)}</span>`;

  pageBadge.addEventListener("click", () =>
    openReasonDialog(info, {
      title: texts.disclosure,
      subtitle: gameTitle.textContent.trim(),
      intro: texts.intro,
      dismissable: true,
      actions: [closeAction()],
    }),
  );

  pageBadge.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pageBadge.click();
    }
  });

  gameTitle.after(pageBadge);
}
