// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { TAGS } from "./detection.js";
import { formatText, tagLabel, texts } from "./i18n.js";
import { ICONS, meterHTML } from "./render.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";
import { openLevelQuiz, selectLevel } from "./quiz.js";
import { starSettingsLinkHTML } from "./star.js";
import { AUTHOR_NAME, AUTHOR_URL, VERSION } from "./project.js";
import { externalLinkHTML } from "./links.js";
import { BEHAVIORS, setSettings, settings } from "./settings.js";

// The settings dialog, opened by the header button and the gear of every dialog; the settings
// themselves live in settings.js.

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
  const authorLink = externalLinkHTML(AUTHOR_URL, AUTHOR_NAME);
  const credit = formatText(texts.credit, { version: VERSION, author: authorLink });

  return `<p class="unslop-credit">${credit} \u00b7 ${starSettingsLinkHTML()}</p>`;
}

function behaviorPanelHTML() {
  const switches = BEHAVIORS.map(
    behavior => `<label class="unslop-switch">
      <input type="checkbox" name="unslop-behavior" value="${behavior}"${settings[behavior] ? " checked" : ""}>
      <span class="unslop-choice-text"><b>${texts.behaviors[behavior].label}</b><span>${texts.behaviors[behavior].hint}</span></span>
    </label>`,
  ).join("");

  return `<p>${texts.behaviorIntro}</p><div class="unslop-switches">${switches}</div>`;
}

const settingsDialogHTML =
  titleId => `<div class="unslop-dialog unslop-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable: true })}
    <div class="unslop-tabs" role="tablist">
      <button class="unslop-tab" role="tab" data-tab="blur" aria-selected="true">${texts.tabBlur}</button>
      <button class="unslop-tab" role="tab" data-tab="behavior" aria-selected="false">${texts.tabBehavior}</button>
      <button class="unslop-tab" role="tab" data-tab="allow" aria-selected="false"></button>
    </div>
    <div class="unslop-dialog-body">
      <div class="unslop-tab-panel" data-panel="blur">
        <p>${texts.settingsIntro}</p>
        ${levelChoicesHTML()}
        ${ignoreTagsHTML()}
      </div>
      <div class="unslop-tab-panel" data-panel="behavior" hidden>${behaviorPanelHTML()}</div>
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
      ...Object.fromEntries(
        BEHAVIORS.map(behavior => [
          behavior,
          root.querySelector(`input[name=unslop-behavior][value=${behavior}]`).checked,
        ]),
      ),
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
