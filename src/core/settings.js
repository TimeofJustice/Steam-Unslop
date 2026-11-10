// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { TAGS, TAG_BY_KEY, rate } from "./detection.js";
import { formatText, tagLabel, texts } from "./i18n.js";
import { ICONS, meterHTML } from "./render.js";
import { storage } from "./cache.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";
import { openLevelQuiz, selectLevel } from "./quiz.js";
import { releasePageGateIfAllowed } from "./dialog.js";
import { scan, start } from "./main.js";
import { AUTHOR_NAME, AUTHOR_URL, VERSION } from "./project.js";

/* User settings.
   minLevel:   games rated below it are not blurred (0 blurs every disclosure).
   ignoreTags: games whose AI use is only these kinds (e.g. translation) are not blurred.
   allow:      games the user always wants to see, [{ id, name }]. */
export const SETTINGS_KEY = "unslopSettings";
const DEFAULT_SETTINGS = { minLevel: 0, ignoreTags: [], allow: [] };
export let settings = { ...DEFAULT_SETTINGS };

function normalizeSettings(saved) {
  const minLevel = [0, 1, 2, 3].includes(saved?.minLevel)
    ? saved.minLevel
    : DEFAULT_SETTINGS.minLevel;

  const ignoreTags = Array.isArray(saved?.ignoreTags)
    ? saved.ignoreTags.filter(tagKey => TAG_BY_KEY[tagKey])
    : [];

  const allow = Array.isArray(saved?.allow)
    ? saved.allow
        .filter(game => /^\d+$/.test(game?.id))
        .map(game => ({ id: game.id, name: String(game.name || "") }))
    : [];

  return { minLevel, ignoreTags, allow };
}

// sessionStorage keeps a copy, so the first scan already uses the settings. Returns whether one
// was found.
export function loadSessionSettings() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SETTINGS_KEY) || "null");
    settings = normalizeSettings(saved);
    return !!saved;
  } catch {
    return false;
  }
}

export function setSettings(nextSettings, persist) {
  settings = normalizeSettings(nextSettings);

  try {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked.
  }

  if (persist) storage.save(SETTINGS_KEY, JSON.parse(JSON.stringify(settings)));

  releasePageGateIfAllowed();
  if (start.done) scan();
}

// info: a disclosure ({ tags, text }); whether a game has one at all is checked by the caller.
export function shouldBlur(info, appId) {
  const isAllowed = appId && settings.allow.some(game => game.id === String(appId));
  if (isAllowed) return false;

  const onlyIgnoredTags =
    info.tags.length && info.tags.every(tagKey => settings.ignoreTags.includes(tagKey));
  if (onlyIgnoredTags) return false;

  return rate(info).level >= settings.minLevel;
}

export function allowGame(appId, name) {
  const id = String(appId);
  const otherGames = settings.allow.filter(game => game.id !== id);

  setSettings({ ...settings, allow: [...otherGames, { id, name }] }, true);
}

// The level choices with the way into the example quiz, shared by the settings dialog and the
// last tutorial step.
export function levelChoicesHTML(selectedLevel = settings.minLevel) {
  const choices = texts.minLevelOptions
    .map(
      (optionText, level) => `<label class="unslop-choice">
      <input type="radio" name="unslop-min-level" value="${level}"${level === selectedLevel ? " checked" : ""}>
      <span class="unslop-choice-text"><b>${optionText}</b><span>${texts.minLevelHints[level]}</span></span>
      ${level ? meterHTML(level) : ""}
    </label>`,
    )
    .join("");

  return `<fieldset class="unslop-choices"><legend class="unslop-label">${texts.minLevel}</legend>
    ${choices}</fieldset>
  <button class="unslop-btn unslop-btn-secondary unslop-quiz-open" data-quiz>${texts.quizButton}</button>`;
}

export const pickedLevel = root =>
  Number(root.querySelector("input[name=unslop-min-level]:checked")?.value ?? settings.minLevel);

function ignoreTagsHTML() {
  const chips = TAGS.map(
    tag => `<label class="unslop-chip sev-${tag.severity}">
      <input type="checkbox" name="unslop-ignore-tag" value="${tag.key}"${settings.ignoreTags.includes(tag.key) ? " checked" : ""}><span>${tagLabel(tag.key)}</span>
    </label>`,
  ).join("");

  return `<section class="unslop-exceptions">
    <span class="unslop-label">${texts.ignoreTagsLabel}</span>
    <div class="unslop-chips">${chips}</div>
  </section>`;
}

// The always shown games: searchable, ALLOWED_GAMES_SHOWN at a time, so a long list stays short.
const ALLOWED_GAMES_SHOWN = 5;

const allowPanelHTML = () => `<p>${texts.allowIntro}</p>
  <input class="unslop-search" type="search" placeholder="${texts.allowSearch}" aria-label="${texts.allowSearch}">
  <ul class="unslop-allow"></ul>
  <span class="unslop-allow-more"></span>`;

const allowedGameHTML = game =>
  `<li data-id="${game.id}"><span class="unslop-allow-name"></span>` +
  `<button class="unslop-icon-btn" data-allow-remove title="${texts.allowRemove}" aria-label="${texts.allowRemove}">${ICONS.close}</button></li>`;

function renderAllowedGames(root, allowedGames, query) {
  const search = query.trim().toLowerCase();
  const matches = allowedGames.filter(
    game => !search || (game.name || game.id).toLowerCase().includes(search),
  );

  const list = root.querySelector(".unslop-allow");
  list.innerHTML = matches.slice(0, ALLOWED_GAMES_SHOWN).map(allowedGameHTML).join("");

  // Names come from store pages, so they are set as text.
  list.querySelectorAll("li").forEach((item, index) => {
    item.firstChild.textContent = matches[index].name || matches[index].id;
  });

  if (!matches.length) {
    const emptyText = allowedGames.length ? texts.allowNoMatch : texts.allowEmpty;
    list.innerHTML = `<li class="unslop-allow-empty">${emptyText}</li>`;
  }

  const hiddenCount = matches.length - ALLOWED_GAMES_SHOWN;
  root.querySelector(".unslop-allow-more").textContent =
    hiddenCount > 0 ? formatText(texts.allowMore, { n: hiddenCount }) : "";

  root.querySelector('[data-tab="allow"]').textContent = formatText(texts.tabAllow, {
    n: allowedGames.length,
  });
}

// Which version is running and who made it, below the dialog buttons.
function creditHTML() {
  const authorLink = `<a href="${AUTHOR_URL}" target="_blank" rel="noopener">${AUTHOR_NAME}</a>`;
  const credit = formatText(texts.credit, { version: VERSION, author: authorLink });

  return `<p class="unslop-credit">${credit}</p>`;
}

const settingsDialogHTML =
  titleId => `<div class="unslop-dialog unslop-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable: true })}
    <div class="unslop-tabs" role="tablist">
      <button class="unslop-tab" role="tab" data-tab="blur" aria-selected="true">${texts.tabBlur}</button>
      <button class="unslop-tab" role="tab" data-tab="allow" aria-selected="false"></button>
    </div>
    <div class="unslop-dialog-body">
      <div class="unslop-tab-panel" data-panel="blur">
        <p>${texts.settingsIntro}</p>
        ${levelChoicesHTML()}
        ${ignoreTagsHTML()}
      </div>
      <div class="unslop-tab-panel" data-panel="allow" hidden>${allowPanelHTML()}</div>
      <div class="unslop-actions">
        <button class="unslop-btn unslop-btn-secondary" data-close>${texts.cancel}</button>
        <button class="unslop-btn unslop-btn-primary" data-save>${texts.save}</button>
      </div>
      ${creditHTML()}
    </div></div>`;

function selectTab(root, selectedTab) {
  root.querySelectorAll("[data-tab]").forEach(tab => {
    tab.setAttribute("aria-selected", String(tab === selectedTab));
  });

  root.querySelectorAll("[data-panel]").forEach(panel => {
    panel.hidden = panel.dataset.panel !== selectedTab.dataset.tab;
  });

  if (selectedTab.dataset.tab === "allow") {
    root.querySelector(".unslop-search").focus({ preventScroll: true });
  }
}

// Opened by the header button and the gear button of every dialog. Changes apply on "Save".
export function openSettings() {
  if (document.querySelector(".unslop-settings-dialog")) return;

  const titleId = nextModalId();
  let allowedGames = [...settings.allow];
  let searchQuery = "";

  const handleClick = (event, close) => {
    const root = event.currentTarget;

    const tab = event.target.closest("[data-tab]");
    if (tab) return selectTab(root, tab);

    if (event.target.closest("[data-quiz]")) {
      return openLevelQuiz({
        onKeep: minLevel => {
          close();
          setSettings({ ...settings, minLevel }, true);
        },
        onChoose: level => selectLevel(root, level),
      });
    }

    const removeButton = event.target.closest("[data-allow-remove]");
    if (removeButton) {
      const removedId = removeButton.closest("li").dataset.id;
      allowedGames = allowedGames.filter(game => game.id !== removedId);
      return renderAllowedGames(root, allowedGames, searchQuery);
    }

    if (!event.target.closest("[data-save]")) return;

    const checkedTags = root.querySelectorAll("input[name=unslop-ignore-tag]:checked");
    const nextSettings = {
      minLevel: pickedLevel(root),
      ignoreTags: [...checkedTags].map(input => input.value),
      allow: allowedGames,
    };

    close();
    setSettings(nextSettings, true);
  };

  const close = openModal(settingsDialogHTML(titleId), {
    dismissable: true,
    focus: "input:checked",
    onClick: handleClick,
  });

  const title = document.getElementById(titleId);
  title.textContent = texts.settings;
  title.nextElementSibling.remove();

  const settingsDialog = title.closest(".unslop-settings-dialog");
  settingsDialog.querySelector(".unslop-search").addEventListener("input", event => {
    searchQuery = event.target.value;
    renderAllowedGames(settingsDialog, allowedGames, searchQuery);
  });

  renderAllowedGames(settingsDialog, allowedGames, searchQuery);
  return close;
}
