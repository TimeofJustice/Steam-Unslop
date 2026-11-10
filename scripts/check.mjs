// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Repository checks run in CI: license headers, ASCII-only code, matching versions.
// Usage: node scripts/check.mjs (after a build)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const trackedFiles = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const problems = [];

const SOURCE_FILE = /\.(?:js|mjs|ts|tsx|css|html|ya?ml|toml)$|(?:^|\/)\.gitignore$/;
const CODE_FILE = /\.(?:js|mjs|ts|tsx|css|html)$/;
const GENERATED_FILE =
  /^(?:dist|release)\/|platforms\/millennium\/(?:webview\/core\.js|frontend\/strings\.generated\.ts)$/;

const isHandWritten = file => !GENERATED_FILE.test(file);

// Every source file names the copyright holder and the license.
for (const file of trackedFiles.filter(file => SOURCE_FILE.test(file) && isHandWritten(file))) {
  const header = readFileSync(file, "utf8").split("\n").slice(0, 4).join("\n");

  const hasHeader =
    header.includes("Copyright 2026 Jonas Oelschner") &&
    header.includes("SPDX-License-Identifier: Apache-2.0");
  if (!hasHeader) problems.push(`${file}: missing license header`);
}

// Code is ASCII; texts in other languages live in src/locales and src/data.
for (const file of trackedFiles.filter(file => CODE_FILE.test(file) && isHandWritten(file))) {
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, index) => {
    if (/[^\t\r\x20-\x7e]/.test(line)) problems.push(`${file}:${index + 1}: non-ASCII character`);
  });
}

// The build writes the version from package.json into the plugin; the changelog has an entry.
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

const millenniumVersion = readFileSync("platforms/millennium/millennium.toml", "utf8").match(
  /^version = "(.*)"$/m,
)?.[1];
if (millenniumVersion !== version) {
  problems.push(`millennium.toml has version ${millenniumVersion}, package.json ${version}`);
}

const extensionVersion = JSON.parse(readFileSync("dist/extension/manifest.json", "utf8")).version;
if (extensionVersion !== version) {
  problems.push(
    `dist/extension/manifest.json has version ${extensionVersion}, package.json ${version}`,
  );
}

const changelogSection = new RegExp(`^## ${version.replace(/\./g, "\\.")}\\b`, "m");
if (!changelogSection.test(readFileSync("CHANGELOG.md", "utf8"))) {
  problems.push(`CHANGELOG.md has no section for ${version}`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Checked ${trackedFiles.length} files: OK`);
