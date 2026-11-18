// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { formatText, texts } from "./i18n.js";
import { compactLevelHTML, tagsHTML } from "./render.js";
import { loadDetails } from "./cache.js";
import { rateForUser } from "./settings.js";

/* The AI games of a bundle, a cart or the wishlist, one page per game: name, level, tags and the
   developer's statement, with buttons (and the arrow keys) to turn the pages. A statement is
   loaded when its page is shown first, so a large bundle does not fetch all its store pages at
   once.
   All pages lie on top of each other and only the shown one is visible, so the dialog is as
   high as its highest page head and keeps its height when turning pages; with several pages the
   statement box has a fixed height, so loading a statement does not change it either.
   games: [{ appId, entry }]. */
const levelOf = game => rateForUser(game.entry).level;

export const sortByLevel = games =>
  [...games].sort(
    (first, second) =>
      levelOf(second) - levelOf(first) ||
      (first.entry.name || "").localeCompare(second.entry.name || ""),
  );

const gamePageHTML = () => `<div class="unslop-game-page">
      <div class="unslop-game-head">
        <span class="unslop-game-name"></span>
        <span class="unslop-game-rating"></span>
      </div>
      <blockquote></blockquote>
    </div>`;

export const gameListHTML = games => `<div class="unslop-game-pages">
    <div class="unslop-game-stack" aria-live="polite">${games.map(gamePageHTML).join("")}</div>
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

function drawPageHead(pageElement, game) {
  pageElement.querySelector(".unslop-game-name").textContent = gameNameOf(game);
  pageElement.querySelector(".unslop-game-rating").innerHTML =
    compactLevelHTML(rateForUser(game.entry)) +
    `<span class="unslop-tags">${tagsHTML(game.entry.tags)}</span>`;
}

// The entry is the cache entry itself, so a loaded text is kept for later.
function showStatement(pageElement, game) {
  const quote = pageElement.querySelector("blockquote");
  if (quote.dataset.shown) return;
  quote.dataset.shown = "1";

  const { appId, entry } = game;
  if (entry.text) return setStatement(quote, entry.text, false);

  setStatement(quote, texts.loading, true);
  loadDetails(appId).then(({ text, name }) => {
    if (text) entry.text = text;
    if (name && !entry.name) entry.name = name;

    pageElement.querySelector(".unslop-game-name").textContent = gameNameOf(game);
    setStatement(quote, text || texts.noText, false);
  });
}

// Fills in the pages; names and statements come from store pages, so they are set as text.
export function fillGameList(root, games) {
  const pages = root.querySelector(".unslop-game-pages");
  const pageElements = [...pages.querySelectorAll(".unslop-game-page")];
  const previousButton = pages.querySelector("[data-page-prev]");
  const nextButton = pages.querySelector("[data-page-next]");

  let currentIndex = 0;

  // Statements already known go in at once, so the stack has its full height from the start.
  pageElements.forEach((pageElement, index) => {
    drawPageHead(pageElement, games[index]);
    if (games[index].entry.text) showStatement(pageElement, games[index]);
  });

  function showPage(index) {
    currentIndex = index;

    pageElements.forEach((pageElement, pageIndex) => {
      const isShown = pageIndex === index;
      pageElement.setAttribute("aria-hidden", String(!isShown));
      pageElement.inert = !isShown;
    });
    showStatement(pageElements[index], games[index]);

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

  // Draws the page heads again, e.g. after the excluded kinds of use changed.
  return () =>
    pageElements.forEach((pageElement, index) => drawPageHead(pageElement, games[index]));
}
