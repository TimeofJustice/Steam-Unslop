// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { analyze, rate } from "./detection.js";
import { formatText, texts } from "./i18n.js";
import { compactLevelHTML, meterHTML } from "./render.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";
import { ratingInfoHTML } from "./tiles.js";

/* Finds the minimum level from examples: the user decides for a few sample disclosures whether
   they should be blurred, then the best matching level is suggested and confirmed. The samples
   run through the real detection, so the suggestion always matches what the store would show. */
const examplePageHTML = text => `<h2>AI Generated Content Disclosure</h2><p>${text}</p><h2></h2>`;

function quizExamples() {
  return texts.quizExamples.map(text => {
    const info = analyze(examplePageHTML(text)) || { tags: [], text };
    return { info, level: rate(info).level };
  });
}

// The level with the fewest disagreements; on a tie the lower one, which blurs more.
function suggestLevel(examples, wantsBlurred) {
  let bestLevel = 0;
  let fewestMisses = Infinity;

  for (let minLevel = 0; minLevel <= 3; minLevel++) {
    const misses = examples.filter(
      (example, index) => example.level >= minLevel !== wantsBlurred[index],
    ).length;

    if (misses < fewestMisses) {
      bestLevel = minLevel;
      fewestMisses = misses;
    }
  }

  return bestLevel;
}

export function selectLevel(root, level) {
  const input = root.querySelector(`input[name="unslop-min-level"][value="${level}"]`);
  if (!input) return;

  input.checked = true;
  input.focus({ preventScroll: true });
}

const quizDialogHTML =
  titleId => `<div class="unslop-dialog unslop-quiz" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable: true })}
    <div class="unslop-dialog-body"><div class="unslop-quiz-step"></div><div class="unslop-actions"></div></div></div>`;

function summaryItemHTML(example, suggestedLevel) {
  const blurred = example.level >= suggestedLevel;
  const stateText = blurred ? texts.quizBlurred : texts.quizVisible;

  return (
    `<li>${compactLevelHTML(rate(example.info))}<span class="unslop-quiz-text"></span>` +
    `<span class="unslop-quiz-state${blurred ? " on" : ""}">${stateText}</span></li>`
  );
}

// onKeep(level): the user accepted the suggestion. onChoose(level): they want to pick themselves.
export function openLevelQuiz({ onKeep, onChoose }) {
  const examples = quizExamples();
  const wantsBlurred = [];
  const titleId = nextModalId();

  let currentIndex = 0;
  let suggestedLevel = 0;

  const handleClick = (event, close) => {
    const answerButton = event.target.closest("[data-answer]");
    if (answerButton) {
      wantsBlurred[currentIndex] = answerButton.dataset.answer === "1";

      if (currentIndex < examples.length - 1) showExample(currentIndex + 1);
      else showSuggestion();
      return;
    }

    if (event.target.closest("[data-quiz-back]")) return showExample(currentIndex - 1);

    if (event.target.closest("[data-quiz-keep]")) {
      close();
      onKeep(suggestedLevel);
    } else if (event.target.closest("[data-quiz-choose]")) {
      close();
      onChoose(suggestedLevel);
    }
  };

  openModal(quizDialogHTML(titleId), {
    dismissable: true,
    focus: '[data-answer="1"]',
    onClick: handleClick,
  });

  const root = document.getElementById(titleId).closest(".unslop-quiz");
  root.querySelector(".unslop-dialog-sub").remove();
  root.querySelector(`#${titleId}`).textContent = texts.quizTitle;

  const stepElement = root.querySelector(".unslop-quiz-step");
  const actionsElement = root.querySelector(".unslop-actions");

  function showExample(index) {
    currentIndex = index;
    const { info } = examples[index];
    const progress = formatText(texts.quizProgress, { n: index + 1, total: examples.length });

    stepElement.innerHTML = `<span class="unslop-label">${progress}</span>
      <div class="unslop-quiz-card">${ratingInfoHTML(rate(info), info.tags)}<blockquote></blockquote></div>
      <p>${texts.quizQuestion}</p>`;
    stepElement.querySelector("blockquote").textContent = info.text;

    const backButton = index
      ? `<button class="unslop-btn unslop-btn-secondary unslop-push" data-quiz-back>${texts.back}</button>`
      : "";

    actionsElement.innerHTML =
      backButton +
      `<button class="unslop-btn unslop-btn-secondary" data-answer="0">${texts.quizShow}</button>` +
      `<button class="unslop-btn unslop-btn-primary" data-answer="1">${texts.quizBlur}</button>`;

    actionsElement.querySelector('[data-answer="1"]').focus({ preventScroll: true });
  }

  function showSuggestion() {
    suggestedLevel = suggestLevel(examples, wantsBlurred);

    const meter = suggestedLevel ? meterHTML(suggestedLevel) : "";
    const summary = examples.map(example => summaryItemHTML(example, suggestedLevel)).join("");

    stepElement.innerHTML =
      `<p>${texts.quizResult}</p>
      <div class="unslop-choice unslop-quiz-result"><span class="unslop-choice-text"><b>${texts.minLevelOptions[suggestedLevel]}</b>` +
      `<span>${texts.minLevelHints[suggestedLevel]}</span></span>${meter}</div>
      <ul class="unslop-quiz-summary">${summary}</ul>
      <p>${texts.quizKeepQuestion}</p>`;

    stepElement.querySelectorAll(".unslop-quiz-text").forEach((element, index) => {
      element.textContent = examples[index].info.text;
    });

    actionsElement.innerHTML =
      `<button class="unslop-btn unslop-btn-secondary" data-quiz-choose>${texts.quizChoose}</button>` +
      `<button class="unslop-btn unslop-btn-primary" data-quiz-keep>${texts.quizKeep}</button>`;

    actionsElement.querySelector("[data-quiz-keep]").focus({ preventScroll: true });
  }

  showExample(0);
}
