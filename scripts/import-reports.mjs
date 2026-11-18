// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* Imports "wrong rating" issues from GitHub into test/fixtures/reported.json, a local corpus next
   to disclosures.json (both gitignored). Each report is stored with the current rating and the
   reporter's expectation. Review it: set "tags" and "level" to what is right and "reviewed" to
   true; test/corpus.test.mjs then checks it. Reviewed entries are kept on later imports.
   Usage: node scripts/import-reports.mjs   (needs the built dist/core.js)
   GITHUB_TOKEN in the environment raises GitHub's limit of 60 requests an hour. */
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = join(repositoryRoot, "test/fixtures/reported.json");
const ISSUES_URL =
  "https://api.github.com/repos/TimeofJustice/Steam-Unslop/issues?labels=wrong%20rating&state=all&per_page=100";

const { window } = new JSDOM('<html lang="en"><body></body></html>', {
  runScripts: "outside-only",
  url: "https://store.steampowered.com/",
});

// Only the detection is used.
window.IntersectionObserver = class {
  observe() {}
  unobserve() {}
};
window.eval(readFileSync(join(repositoryRoot, "dist/core.js"), "utf8"));
const { SteamUnslop } = window;

function rateStatement(text) {
  const escapedText = text.replace(/</g, "&lt;").replace(/\n/g, "<br>");
  const info = SteamUnslop.analyze(
    `<h2>AI Generated Content Disclosure</h2><p>${escapedText}</p><h2></h2>`,
  );
  return { tags: [...info.tags], level: SteamUnslop.rate(info).level };
}

/* GitHub renders an issue form as "### Label" headings with the answer below; text areas with
   render: text are wrapped in a code block. "_No response_" marks an empty field. */
function formFieldsOf(body) {
  const fields = {};
  for (const section of (body || "").split(/^### /m).slice(1)) {
    const [label, ...lines] = section.split("\n");
    const answer = lines
      .join("\n")
      .trim()
      .replace(/^```\w*\n([\s\S]*?)\n```$/, "$1")
      .trim();
    fields[label.trim()] = answer === "_No response_" ? "" : answer;
  }
  return fields;
}

async function fetchReports() {
  const headers = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(ISSUES_URL, { headers });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return response.json();
}

const knownReports = existsSync(outputFile) ? JSON.parse(readFileSync(outputFile, "utf8")) : [];
const reportsByIssue = new Map(knownReports.map(report => [report.issue, report]));

for (const issue of await fetchReports()) {
  if (issue.pull_request) continue;

  const fields = formFieldsOf(issue.body);
  const appId = fields["Store page"]?.match(/\/app\/(\d+)/)?.[1];
  const statement = fields["Developer's statement"];
  if (!appId || !statement) {
    console.log(`#${issue.number}: no store page or statement, skipped`);
    continue;
  }

  // A reviewed report keeps its decided rating.
  const known = reportsByIssue.get(issue.number);
  if (known?.reviewed) continue;

  reportsByIssue.set(issue.number, {
    issue: issue.number,
    id: appId,
    name: fields.Game || "",
    text: statement,
    shown: fields["Rating shown by Steam Unslop"] || "",
    expected: fields["What would be right?"] || "",
    ...rateStatement(statement),
    reviewed: false,
  });
}

const reports = [...reportsByIssue.values()].sort((first, second) => first.issue - second.issue);
mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, JSON.stringify(reports, null, 2) + "\n");

// The reports to look at, with the rating now and what the reporter expects.
const levelNames = ["Unclear", "Low", "Medium", "High"];
const toReview = reports.filter(report => !report.reviewed);
for (const report of toReview) {
  console.log(`\n#${report.issue} ${report.name} (app ${report.id})`);
  console.log(`  shown then: ${report.shown}`);
  console.log(`  now:        ${levelNames[report.level]} [${report.tags.join(", ")}]`);
  console.log(`  expected:   ${report.expected.replace(/\s+/g, " ")}`);
}
console.log(
  `\nWrote ${reports.length} reports to test/fixtures/reported.json, ${toReview.length} to review.`,
);
