// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { TAG_BY_KEY } from "./detection.js";
import { texts, formatText, tagLabel } from "./i18n.js";

// HTML snippets shared by overlays, popovers, dialogs and the page badge.
export const ICONS = {
  close:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M6.9 1h2.2l.4 1.9 1.2.5 1.6-1.1 1.6 1.6-1.1 1.6.5 1.2 1.9.4v2.2l-1.9.4-.5 1.2 1.1 1.6-1.6 1.6-1.6-1.1-1.2.5-.4 1.9H6.9l-.4-1.9-1.2-.5-1.6 1.1-1.6-1.6 1.1-1.6-.5-1.2L1 9.1V6.9l1.9-.4.5-1.2-1.1-1.6 1.6-1.6 1.6 1.1 1.2-.5zM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z"/></svg>',
  hide: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/><path d="M2.5 13.5l11-11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.2l-3.9 2.2.9-4.3-3.2-3 4.3-.5z" fill="currentColor"/></svg>',
};

export function sortBySeverity(tagKeys) {
  return tagKeys
    .filter(key => TAG_BY_KEY[key])
    .sort((first, second) => TAG_BY_KEY[second].severity - TAG_BY_KEY[first].severity);
}

export function tagsHTML(tagKeys) {
  return sortBySeverity(tagKeys)
    .map(key => `<em class="sev-${TAG_BY_KEY[key].severity}">${tagLabel(key)}</em>`)
    .join("");
}

export const meterHTML = level =>
  `<span class="unslop-meter lvl-${level}"><i></i><i></i><i></i></span>`;

export const hintListText = rating => rating.hints.map(hint => texts.hints[hint.key]).join(", ");

export const iconButtonHTML = (className, attribute, title, icon) =>
  `<button class="${className}" ${attribute} title="${title}" aria-label="${title}">${icon}</button>`;

export const closeButtonHTML = (className, attribute, title) =>
  iconButtonHTML(className, attribute, title, ICONS.close);

// "AI Medium ===", with a "?" when the rating is uncertain; used on tiles and popovers.
export function compactLevelHTML(rating) {
  const uncertainMark = rating.uncertain
    ? `<span class="unslop-unsure" title="${texts.unsureTip}: ${hintListText(rating)}">?</span>`
    : "";

  return (
    `<span class="unslop-level unslop-compact"><span class="unslop-ai">${texts.ai}</span>` +
    `<b class="lvl-${rating.level}">${texts.levels[rating.level]}</b>${meterHTML(rating.level)}` +
    `${uncertainMark}</span>`
  );
}

// "AI USAGE Medium === UNCERTAIN"; used in dialogs and the page badge.
export function levelHTML(rating) {
  const uncertainMark = rating.uncertain
    ? `<span class="unslop-unsure" title="${texts.perDev}: ${hintListText(rating)}">${texts.unsure}</span>`
    : "";

  return (
    `<span class="unslop-level"><span class="unslop-label">${texts.usage}</span>` +
    `<b class="lvl-${rating.level}">${texts.levels[rating.level]}</b>${meterHTML(rating.level)}` +
    `${uncertainMark}</span>`
  );
}

// Explains an uncertain rating: the developer's qualifiers and whether they lowered the level.
export function uncertaintyNoteHTML(rating) {
  if (!rating.uncertain) return "";

  const hintChips = rating.hints
    .map(hint => `<em class="sev-0">${texts.hints[hint.key]}</em>`)
    .join("");
  const loweredText = rating.lowered
    ? formatText(texts.lowered, {
        from: `<b class="lvl-${rating.rawLevel}">${texts.levels[rating.rawLevel]}</b>`,
        to: `<b class="lvl-${rating.level}">${texts.levels[rating.level]}</b>`,
      })
    : "";

  return `<div class="unslop-note">
    <div>${texts.noteHead}</div>
    <div class="unslop-tags">${hintChips}</div>
    <div>${loweredText}${texts.noteTail}</div>
  </div>`;
}
