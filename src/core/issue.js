// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import english from "../locales/en.json";
import { REPOSITORY_URL, VERSION } from "./project.js";

/* "Wrong rating? Report it on GitHub": opens the issue form .github/ISSUE_TEMPLATE/wrong-rating.yml
   with its fields filled in through the URL. The report is in English whatever the user's
   language, so it reads the same for everyone. The statement is cut, as URLs have a limit. */
const MAX_STATEMENT_LENGTH = 1500;

function shownRatingOf(info, rating, excludedTags) {
  const level = rating.allExcluded ? "Left out" : english.ui.levels[rating.level];
  const tags = info.tags.map(tagKey => {
    const label = english.ui.tags[tagKey] || tagKey;
    return excludedTags.includes(tagKey) ? `${label} (left out in my settings)` : label;
  });

  return tags.length ? `${level}: ${tags.join(", ")}` : level;
}

export function wrongRatingIssueUrl({ appId, name, info, rating, excludedTags }) {
  const statement = info.text || "";
  const shortStatement =
    statement.length > MAX_STATEMENT_LENGTH
      ? `${statement.slice(0, MAX_STATEMENT_LENGTH)}...`
      : statement;

  const parameters = new URLSearchParams({
    template: "wrong-rating.yml",
    title: `Wrong rating: ${name}`,
    game: name,
    "store-page": `https://store.steampowered.com/app/${appId}/`,
    "shown-rating": shownRatingOf(info, rating, excludedTags),
    statement: shortStatement,
    version: VERSION,
  });

  return `${REPOSITORY_URL}/issues/new?${parameters}`;
}
