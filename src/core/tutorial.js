// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { rate } from "./detection.js";
import { texts } from "./i18n.js";
import { ICONS } from "./render.js";
import { levelChoicesHTML, pickedLevel, setSettings, settings } from "./settings.js";
import { modalHeaderHTML, nextModalId, openModal } from "./modal.js";
import { openLevelQuiz, selectLevel } from "./quiz.js";
import { ratingInfoHTML } from "./tiles.js";

/* Short introduction on the first start (nothing stored yet). The last step picks the minimum
   level. Closing it early keeps the default, and it does not come back. */
const DEMO_INFO = { tags: ["art", "voice", "transl"], text: "" };

const fakeButtonHTML = (className, content) =>
  `<span class="unslop-btn ${className}">${content}</span>`;

const demoTileHTML = () =>
  `<div class="unslop-demo-tile" aria-hidden="true">
    <div class="unslop-demo-art"></div>
    <div class="unslop-overlay unslop-mode-full"><div class="unslop-box">${ratingInfoHTML(rate(DEMO_INFO), DEMO_INFO.tags)}
      <span class="unslop-btns">` +
  fakeButtonHTML("unslop-btn-secondary", texts.why) +
  fakeButtonHTML("unslop-btn-secondary", texts.ignore) +
  fakeButtonHTML("unslop-btn-primary", texts.showShort) +
  `</span>
    </div></div>
  </div>`;

function demoActionsHTML() {
  const explanations = [
    [fakeButtonHTML("unslop-btn-secondary", texts.why), texts.tutorialWhy],
    [fakeButtonHTML("unslop-btn-primary", texts.showShort), texts.tutorialShow],
    [fakeButtonHTML("unslop-btn-secondary", texts.ignore), texts.tutorialIgnore],
  ];

  const entries = explanations.map(([term, text]) => `<dt>${term}</dt><dd>${text}</dd>`).join("");
  return `<dl class="unslop-demo-list">${entries}</dl>`;
}

const demoSettingsHTML = () => `<dl class="unslop-demo-list">
    <dt>${fakeButtonHTML("unslop-btn-secondary", `${ICONS.hide}<span>${texts.navLabel}</span>`)}</dt><dd>${texts.tutorialNav}</dd>
    <dt><span class="unslop-icon-btn unslop-demo-icon">${ICONS.gear}</span></dt><dd>${texts.tutorialGear}</dd>
  </dl>`;

const TUTORIAL_STEPS = [
  {
    title: () => texts.welcomeTitle,
    body: () => `<p>${texts.tutorialIntro}</p>${demoTileHTML()}`,
  },
  {
    title: () => texts.tutorialTileTitle,
    body: () => `<p>${texts.tutorialTile}</p>${demoActionsHTML()}`,
  },
  {
    title: () => texts.tutorialPagesTitle,
    body: () => `<p>${texts.tutorialPages}</p>${demoSettingsHTML()}`,
  },
  {
    title: () => texts.tutorialLevelTitle,
    body: chosenLevel => `<p>${texts.tutorialLevel}</p>${levelChoicesHTML(chosenLevel)}`,
  },
];

const LAST_STEP = TUTORIAL_STEPS.length - 1;

const tutorialDialogHTML =
  titleId => `<div class="unslop-dialog unslop-tutorial" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    ${modalHeaderHTML(titleId, { dismissable: true })}
    <div class="unslop-dialog-body">
      <div class="unslop-tutorial-step"></div>
      <div class="unslop-tutorial-foot">
        <span class="unslop-dots">${TUTORIAL_STEPS.map(() => "<i></i>").join("")}</span>
        <span class="unslop-actions">
          <button class="unslop-btn unslop-btn-secondary" data-back>${texts.back}</button>
          <button class="unslop-btn unslop-btn-primary" data-next></button>
        </span>
      </div>
    </div></div>`;

export function openTutorial() {
  if (document.querySelector(".unslop-tutorial")) return;

  const titleId = nextModalId();
  let currentStep = 0;
  let finished = false;
  let chosenLevel = settings.minLevel;

  const finishWithLevel = (close, minLevel) => {
    finished = true;
    close();
    setSettings({ ...settings, minLevel }, true);
  };

  const handleClick = (event, close) => {
    if (event.target.closest("[data-back]")) return showStep(currentStep - 1);

    if (event.target.closest("[data-quiz]")) {
      return openLevelQuiz({
        onKeep: minLevel => finishWithLevel(close, minLevel),
        onChoose: level => selectLevel(root, level),
      });
    }

    if (!event.target.closest("[data-next]")) return;

    if (currentStep < LAST_STEP) return showStep(currentStep + 1);
    finishWithLevel(close, pickedLevel(event.currentTarget));
  };

  const close = openModal(tutorialDialogHTML(titleId), {
    dismissable: true,
    focus: "[data-next]",
    onClick: handleClick,

    // Skipped: store the default, so the tutorial does not open again.
    onClose: () => {
      if (!finished) setSettings(settings, true);
    },
  });

  const root = document.getElementById(titleId).closest(".unslop-tutorial");
  root.querySelector(".unslop-dialog-sub").remove();

  function showStep(stepIndex) {
    // Keep a choice made on the last step when going back and forth.
    if (currentStep === LAST_STEP) chosenLevel = pickedLevel(root);
    currentStep = stepIndex;

    const step = TUTORIAL_STEPS[stepIndex];
    root.querySelector(`#${titleId}`).textContent = step.title();
    root.querySelector(".unslop-tutorial-step").innerHTML = step.body(chosenLevel);

    root.querySelectorAll(".unslop-dots i").forEach((dot, dotIndex) => {
      dot.classList.toggle("on", dotIndex === stepIndex);
    });
    root.querySelector("[data-back]").hidden = stepIndex === 0;

    const nextButton = root.querySelector("[data-next]");
    nextButton.textContent = stepIndex === LAST_STEP ? texts.tutorialDone : texts.next;
    nextButton.focus({ preventScroll: true });
  }

  showStep(0);
  return close;
}
