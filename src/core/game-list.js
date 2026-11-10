// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { rate } from "./detection.js";
import { formatText, texts } from "./i18n.js";
import { compactLevelHTML, tagsHTML } from "./render.js";
import { loadDetails } from "./cache.js";

/* The AI games of a bundle or a cart, one page per game: name, level, tags and the developer's
   statement, with buttons (and the arrow keys) to turn the pages. A statement is loaded when its
   page is shown first, so a large bundle does not fetch all its store pages at once.
   games: [{ appId, entry }]. */
const levelOf = game => rate(game.entry).level;

export const sortByLevel = games =>
  [...games].sort(
    (first, second) =>
      levelOf(second) - levelOf(first) ||
      (first.entry.name || "").localeCompare(second.entry.name || ""),
  );

export const gameListHTML = games => `<div class="unslop-game-pages">
    <div class="unslop-game-page" aria-live="polite">
      <div class="unslop-game-head">
        <span class="unslop-game-name"></span>
        <span class="unslop-game-rating"></span>
      </div>
      <blockquote></blockquote>
    </div>
    <div class="unslop-game-nav"${games.length > 1 ? "" : " hidden"}>
      <button class="unslop-icon-btn unslop-page-prev" type="button" data-page-prev aria-label="${texts.previousGame}" title="${texts.previousGame}"></button>
      <span class="unslop-game-count"></span>
      <button class="unslop-icon-btn unslop-page-next" type="button" data-page-next aria-label="${texts.nextGame}" title="${texts.nextGame}"></button>
    </div>
  </div>`;

const gameNameOf = game => game.entry.name || `App ${game.appId}`;

function setStatement(quote, text, loading) {
  quote.textContent = text;
  quote.classList.toggle("unslop-loading", loading);
  quote.setAttribute("aria-busy", String(loading));
}

// Fills in the pages; names and statements come from store pages, so they are set as text.
export function fillGameList(root, games) {
  const pages = root.querySelector(".unslop-game-pages");
  const nameElement = pages.querySelector(".unslop-game-name");
  const ratingElement = pages.querySelector(".unslop-game-rating");
  const quote = pages.querySelector("blockquote");
  const previousButton = pages.querySelector("[data-page-prev]");
  const nextButton = pages.querySelector("[data-page-next]");

  let currentIndex = 0;

  function showStatement(game, index) {
    const { appId, entry } = game;
    if (entry.text) return setStatement(quote, entry.text, false);

    setStatement(quote, texts.loading, true);

    // The entry is the cache entry itself, so the loaded text is kept for later.
    loadDetails(appId).then(({ text, name }) => {
      if (text) entry.text = text;
      if (name && !entry.name) entry.name = name;

      // The user may have turned the page meanwhile.
      if (index !== currentIndex) return;
      nameElement.textContent = gameNameOf(game);
      setStatement(quote, text || texts.noText, false);
    });
  }

  function showPage(index) {
    currentIndex = index;
    const game = games[index];

    nameElement.textContent = gameNameOf(game);
    ratingElement.innerHTML =
      compactLevelHTML(rate(game.entry)) +
      `<span class="unslop-tags">${tagsHTML(game.entry.tags)}</span>`;
    showStatement(game, index);

    pages.querySelector(".unslop-game-count").textContent = formatText(texts.gamePage, {
      n: index + 1,
      total: games.length,
    });
    previousButton.disabled = index === 0;
    nextButton.disabled = index === games.length - 1;
  }

  const turnPage = step => {
    const index = currentIndex + step;
    if (index >= 0 && index < games.length) showPage(index);
  };

  previousButton.addEventListener("click", () => turnPage(-1));
  nextButton.addEventListener("click", () => turnPage(1));

  root.addEventListener("keydown", event => {
    if (games.length < 2 || event.target.closest("input, textarea")) return;

    if (event.key === "ArrowLeft") turnPage(-1);
    else if (event.key === "ArrowRight") turnPage(1);
  });

  showPage(0);
}
