// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { texts } from "./i18n.js";
import { ICONS, iconButtonHTML } from "./render.js";

/* Popups such as the search suggestions close when their input loses focus. While a modal is
   open, the page does not hear about focus leaving its elements (window capture runs before any
   page listener), so the popup stays open behind the modal. */
let openModalCount = 0;
let modalCounter = 0;

function hideFocusLossFromPage(event) {
  const leavesPageElement =
    event.target instanceof Element && !event.target.closest(".unslop-modal");
  if (openModalCount && leavesPageElement) event.stopImmediatePropagation();
}

addEventListener("focusout", hideFocusLossFromPage, true);
addEventListener("blur", hideFocusLossFromPage, true);

export const nextModalId = () => `unslop-modal-${++modalCounter}`;

// Keeps "click outside" handlers of the page from closing popups behind the modal.
const EVENTS_KEPT_INSIDE = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "touchstart",
  "click",
  "focusin",
];

const FOCUSABLE_SELECTOR = "button, a[href], input";

const isTopmostModal = modal =>
  modal.isConnected && [...document.querySelectorAll(".unslop-modal")].at(-1) === modal;

/* Shows html (one .unslop-dialog element) as a native modal dialog, which lives in the top
   layer above Steam's own modals and popovers.
   onClick(event, close) handles clicks inside; onClose runs once when the modal closes.
   Returns close(). */
export function openModal(
  html,
  { dismissable, onClick, onClose, focus = ".unslop-actions .unslop-btn:last-child" },
) {
  const previouslyFocused = document.activeElement;

  const modal = document.createElement("dialog");
  modal.className = "unslop-modal";
  modal.innerHTML = html;

  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;

    if (modal.open) {
      try {
        modal.close();
      } catch {
        // No native dialog support.
      }
    }
    modal.remove();

    openModalCount--;
    document.removeEventListener("keydown", handleKeyDown, true);
    onClose?.();

    if (previouslyFocused?.isConnected) previouslyFocused.focus?.({ preventScroll: true });
  };

  // Tab keeps the focus inside the modal.
  const handleKeyDown = event => {
    if (!isTopmostModal(modal)) return;

    if (dismissable && event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [...modal.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
      element => !element.closest("[hidden]") && !element.disabled,
    );
    if (!focusable.length) return;

    const focusedIndex = focusable.indexOf(document.activeElement);
    const isLeaving = event.shiftKey
      ? focusedIndex <= 0
      : focusedIndex < 0 || focusedIndex === focusable.length - 1;

    if (isLeaving) {
      event.preventDefault();
      focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
    }
  };

  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) return close();
    if (dismissable && event.target === modal) return close();
    onClick?.(event, close);
  });

  // Escape fires "cancel" on native dialogs.
  modal.addEventListener("cancel", event => {
    event.preventDefault();
    if (dismissable) close();
  });

  for (const type of EVENTS_KEPT_INSIDE) {
    modal.addEventListener(type, event => event.stopPropagation());
  }

  document.addEventListener("keydown", handleKeyDown, true);
  openModalCount++;
  document.body.appendChild(modal);

  try {
    modal.showModal();
  } catch {
    modal.setAttribute("open", "");
  }

  modal.querySelector(focus)?.focus({ preventScroll: true });
  return close;
}

export function modalHeaderHTML(titleId, { dismissable, settingsButton }) {
  const settingsHTML = settingsButton
    ? iconButtonHTML("unslop-icon-btn", "data-settings", texts.settings, ICONS.gear)
    : "";
  const closeHTML = dismissable
    ? iconButtonHTML("unslop-icon-btn", "data-close", texts.close, ICONS.close)
    : "";

  return `<header class="unslop-dialog-head">
    <div class="unslop-dialog-title" id="${titleId}"></div><div class="unslop-dialog-sub"></div>
    <div class="unslop-dialog-tools">${settingsHTML}${closeHTML}</div>
  </header>`;
}
