// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { texts } from "./i18n.js";

/* Links to GitHub are real links. In the Steam client a plain link would open in a Steam window,
   so there they go through steam://openurl_external/, which opens the user's own browser.
   Next to them a small button copies the plain address. */
const EXTERNAL_PREFIX = "steam://openurl_external/";
const COPIED_TIME = 1500;

const isSteamClient = () => /Valve Steam (?:Client|GameOverlay)/.test(navigator.userAgent);

export const externalUrl = url => (isSteamClient() ? `${EXTERNAL_PREFIX}${url}` : url);

const plainUrl = url => (url.startsWith(EXTERNAL_PREFIX) ? url.slice(EXTERNAL_PREFIX.length) : url);

// attributes: further attributes of the link, e.g. its class.
export const externalLinkHTML = (url, content, attributes = "") =>
  `<a href="${externalUrl(url)}" target="_blank" rel="noopener"${attributes ? ` ${attributes}` : ""}>${content}</a>`;

const COPY_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 3.2V3a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3v5.5A1.5 1.5 0 0 0 3.5 10h.3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

// Copies the address of the link right before it.
export const copyButtonHTML = () =>
  `<button class="unslop-icon-btn unslop-copy" type="button" data-copy-link title="${texts.copyLink}" aria-label="${texts.copyLink}">${COPY_ICON}</button>`;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard API is not allowed here: copy from a selected text field instead.
    const field = document.createElement("textarea");
    field.value = text;
    field.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(field);
    field.select();

    const copied = document.execCommand?.("copy") ?? false;
    field.remove();
    return copied;
  }
}

function showCopied(button) {
  button.classList.add("unslop-copied");
  button.title = texts.linkCopied;

  setTimeout(() => {
    button.classList.remove("unslop-copied");
    button.title = texts.copyLink;
  }, COPIED_TIME);
}

async function handleCopyClick(event) {
  const button = event.target instanceof Element && event.target.closest("[data-copy-link]");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  // A link may build its address when used (the issue form), so it is asked to do so now.
  const link = button.previousElementSibling;
  link?.dispatchEvent(new Event("unslop-refresh-link"));
  if (!link?.href) return;

  if (await copyText(plainUrl(link.href))) showCopied(button);
}

export function enableCopyButtons() {
  document.addEventListener("click", handleCopyClick, true);
}
