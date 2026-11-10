// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { texts } from "./i18n.js";

/* Game pages without an AI disclosure get a small banner to report undisclosed AI content. It
   opens Steam's own "Report this Product" dialog; reason and text are left to the user, as Steam
   has no reason for AI. */
const REPORT_BUTTON_SELECTOR = "#ReportAppBtn";

const isAlreadyReported = () =>
  !!document.querySelector(REPORT_BUTTON_SELECTOR)?.classList.contains("btn_active");

function markReported(banner) {
  const button = banner.querySelector("button");
  button.disabled = true;
  button.textContent = texts.reportDone;
}

export function addReportBanner() {
  const gameTitle = document.querySelector("#appHubAppName, .apphub_AppName");
  const reportButton = document.querySelector(REPORT_BUTTON_SELECTOR);
  if (!gameTitle || !reportButton || document.querySelector(".unslop-report")) return;

  const banner = document.createElement("div");
  banner.className = "unslop-report";
  banner.innerHTML =
    `<span class="unslop-report-text">${texts.reportHint}</span>` +
    `<button class="unslop-btn unslop-btn-secondary" type="button">${texts.reportButton}</button>`;

  if (isAlreadyReported()) markReported(banner);

  // Steam marks its button once the report was sent.
  new MutationObserver((records, observer) => {
    if (!isAlreadyReported()) return;
    observer.disconnect();
    markReported(banner);
  }).observe(reportButton, { attributes: true, attributeFilter: ["class"] });

  // Steam's button runs its inline handler, which builds the dialog.
  banner.querySelector("button").addEventListener("click", () => reportButton.click());

  gameTitle.after(banner);
}
