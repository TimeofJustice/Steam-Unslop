// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { formatText, texts } from "./i18n.js";
import { cache, onRatingChanged, storage } from "./cache.js";
import { wishlistAppIds } from "./userdata.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";
import { fillGameList, gameListHTML, sortByLevel } from "./game-list.js";
import { openSettings } from "./settings-dialog.js";
import { shouldBlur } from "./settings.js";

/* Games on the user's wishlist that added an AI disclosure or changed theirs. Noticed when a game
   is rated again by the same detection, so a better detection never reads as news. The Unslop
   button in the store header shows how many there are; opening them marks them as seen. */
export const NEWS_KEY = "unslopNews";
const MAX_NEWS = 20;

// [{ appId, kind: "new" | "changed", time }]
let news = [];

const redrawListeners = new Set();
export const onNewsChanged = listener => redrawListeners.add(listener);

function saveNews() {
  storage.save(NEWS_KEY, news);
  redrawListeners.forEach(listener => listener());
}

export function loadNews(stored) {
  news = Array.isArray(stored) ? stored.filter(item => /^\d+$/.test(item?.appId)) : [];
  redrawListeners.forEach(listener => listener());
}

// The news that still count: rated as AI and blurred by the current settings.
export function unseenNews() {
  return news.filter(item => {
    const entry = cache[item.appId];
    return entry?.ai && shouldBlur(entry, item.appId);
  });
}

onRatingChanged(async ({ appId, previousEntry, entry }) => {
  if (!entry.ai || !previousEntry || previousEntry.v !== entry.v) return;

  const isNew = !previousEntry.ai;
  const isChanged = previousEntry.ai && previousEntry.fp && previousEntry.fp !== entry.fp;
  if (!isNew && !isChanged) return;

  if (!(await wishlistAppIds()).includes(appId)) return;

  news = [
    { appId, kind: isNew ? "new" : "changed", time: Date.now() },
    ...news.filter(item => item.appId !== appId),
  ].slice(0, MAX_NEWS);
  saveNews();
});

export function openNews() {
  const items = unseenNews();
  const games = sortByLevel(items.map(item => ({ appId: item.appId, entry: cache[item.appId] })));
  const titleId = nextModalId();

  const intro =
    items.length === 1 ? texts.newsIntroOne : formatText(texts.newsIntro, { n: items.length });

  openModal(
    `<div class="unslop-dialog unslop-news" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable: true, settingsButton: false })}
    <div class="unslop-dialog-body">
      <p>${intro}</p>
      ${gameListHTML(games)}
      <div class="unslop-actions">
        <button class="unslop-btn unslop-btn-secondary" data-news-settings>${texts.settings}</button>
        <button class="unslop-btn unslop-btn-primary" data-close>${texts.newsDone}</button>
      </div>
    </div></div>`,
    {
      dismissable: true,
      onClick: (event, close) => {
        if (!event.target.closest("[data-news-settings]")) return;
        close();
        openSettings();
      },
      // Seen once opened.
      onClose: () => {
        news = [];
        saveNews();
      },
    },
  );

  const dialog = document.getElementById(titleId).closest(".unslop-news");
  dialog.querySelector(`#${titleId}`).textContent = texts.newsTitle;
  dialog.querySelector(".unslop-dialog-sub").remove();
  fillGameList(dialog, games);
}
