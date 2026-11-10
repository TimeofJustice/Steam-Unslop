// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Renders the README images from the live Steam store with the built core injected.
// Usage: npm run build && node scripts/screenshots.mjs [search term]
// Output: docs/images/*.png and docs/images/demo.gif. Results depend on the current store.
import { chromium } from "playwright";
import { PNG } from "pngjs";
import gifenc from "gifenc";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const imageFolder = join(repositoryRoot, "docs/images");
const searchTerm = process.argv[2] || "puzzle";
const GIF_SCALE = 0.6;

// The README images show real store results, so the search leaves out games with Steam tags
// for mature or sensitive themes.
const EXCLUDED_TAG_IDS = [
  12095, 6650, 9130, 4345, 4667, 1667, 1721, 4085, 9551, 31579, 180368, 1678,
];

/* Games that slip through can be left out locally: copy scripts/screenshots-excluded.example.json
   to scripts/screenshots-excluded.json (not in the repository) and fill in app ids or title
   words. Title words match whole words, case-insensitively. */
const EXCLUSION_FILE = join(repositoryRoot, "scripts/screenshots-excluded.json");
const exclusions = existsSync(EXCLUSION_FILE)
  ? JSON.parse(readFileSync(EXCLUSION_FILE, "utf8"))
  : {};
const excludedAppIds = (exclusions.appIds || []).map(String);
const excludedTitleWords = exclusions.titleWords || [];

mkdirSync(imageFolder, { recursive: true });

// Same start sequence as the wrappers, with in-memory storage.
const bootScript = `${readFileSync(join(repositoryRoot, "dist/core.js"), "utf8")}
(() => {
  if (window.top !== window || location.hostname !== "store.steampowered.com") return;

  // Settings are preset, so the first start welcome does not cover the pages.
  const memory = { unslopSettings: { minLevel: 0 } };
  const storage = {
    load: async key => memory[key],
    save: async (key, value) => { memory[key] = value; },
    remove: async () => {},
  };

  SteamUnslop.hold();
  const startCore = () => SteamUnslop.start(storage);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCore, { once: true });
  } else {
    startCore();
  }
})();`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: "en-US",
  colorScheme: "dark",
});

await context.addCookies(
  ["Steam_Language=english", "birthtime=470703601", "wants_mature_content=1"].map(cookie => {
    const [name, value] = cookie.split("=");
    return { name, value, domain: "store.steampowered.com", path: "/" };
  }),
);
await context.addInitScript(bootScript);
const page = await context.newPage();

async function openStorePage(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  await page
    .getByText("Reject All")
    .click({ timeout: 8000 })
    .catch(() => {});
}

const takeScreenshot = (fileName, clip) =>
  page.screenshot({ path: join(imageFolder, fileName), clip });

const waitForBlurredTile = () =>
  page.waitForSelector("a.unslop-blur:not([data-unslop-plain]) .unslop-overlay", {
    timeout: 60000,
  });

// Frames of the GIF: the whole viewport, so dialogs are complete and centered.
// Each frame lasts until the next one was taken, so the GIF plays in real time. Unchanged
// frames only extend the previous one.
const FRAME_DURATION = 180;
const frames = [];

async function recordFrames(duration) {
  for (const endTime = Date.now() + duration; Date.now() < endTime;) {
    const frameTime = Date.now();
    const png = await page.screenshot();
    const previousFrame = frames.at(-1);

    if (!previousFrame?.png.equals(png)) {
      if (previousFrame) previousFrame.delay = frameTime - previousFrame.time;
      frames.push({ png, time: frameTime, delay: FRAME_DURATION });
    }

    await page.waitForTimeout(Math.max(0, FRAME_DURATION - (Date.now() - frameTime)));
  }
}

// Removes the rows of locally excluded games and hides what shows the excluded tags: the notes
// above the results and the "Narrow by tag" block in the sidebar.
const prepareSearchPage = () =>
  page.evaluate(
    ({ appIds, titleWords }) => {
      const escapedWords = titleWords.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const excludedTitle = escapedWords.length
        ? new RegExp(`(?<![\\p{L}\\d])(?:${escapedWords.join("|")})(?![\\p{L}\\d])`, "iu")
        : null;

      for (const row of document.querySelectorAll("a.search_result_row")) {
        const title = row.querySelector(".title")?.textContent || "";
        const isExcluded = appIds.includes(row.dataset.dsAppid) || !!excludedTitle?.test(title);

        if (isExcluded) row.remove();
      }

      const filterNotes = document.querySelectorAll(
        '.termcontainer, .search_results_filtered_warning, [data-collapse-name="tags"]',
      );
      for (const note of filterNotes) note.style.display = "none";
    },
    { appIds: excludedAppIds, titleWords: excludedTitleWords },
  );

// 1. Search results with blurred rows, scrolled so the first one sits below the sticky header.
const searchUrl = new URL("https://store.steampowered.com/search/");
searchUrl.searchParams.set("term", searchTerm);
searchUrl.searchParams.set("untags", EXCLUDED_TAG_IDS.join(","));

await openStorePage(searchUrl.href);
await page.waitForSelector("a.search_result_row", { timeout: 60000 });

await prepareSearchPage();
await waitForBlurredTile();
await page.waitForTimeout(6000);

// Rows loaded meanwhile by the infinite scroll are checked too.
await prepareSearchPage();

const scrollToFirstBlurredRow = () =>
  page.evaluate(() => {
    const firstRow = document.querySelector("a.unslop-blur:not([data-unslop-plain])");
    scrollTo(0, Math.max(0, firstRow.getBoundingClientRect().top + scrollY - 220));
  });

await scrollToFirstBlurredRow();
await page.waitForTimeout(800);
await takeScreenshot("search.png", { x: 40, y: 60, width: 880, height: 520 });

// 2. Reason dialog of the blurred row with the most tags, then the settings.
const blurredRows = page.locator("a.unslop-blur:not([data-unslop-plain])");
const tagCounts = await blurredRows.evaluateAll(rows =>
  rows.map(row => row.querySelectorAll(".unslop-tags em").length),
);
const row = blurredRows.nth(tagCounts.indexOf(Math.max(...tagCounts)));
const appId = await row.getAttribute("data-unslop-id");

await row.scrollIntoViewIfNeeded();
await row.locator('[data-tile-action="why"]').click();
await page.waitForSelector(".unslop-dialog blockquote:not(.unslop-loading)");
await page.waitForTimeout(500);
await takeScreenshot("dialog.png", await page.locator(".unslop-dialog").boundingBox());

await page.locator(".unslop-dialog [data-settings]").click();
await page.waitForSelector(".unslop-settings-dialog");
await page.waitForTimeout(400);
await takeScreenshot("settings.png", await page.locator(".unslop-settings-dialog").boundingBox());

await page.locator(".unslop-settings-dialog .unslop-actions [data-close]").click();
await page.locator(".unslop-dialog-tools [data-close]").click();

// 3. Animated walkthrough: blurred list, reason, close, show anyway.
await scrollToFirstBlurredRow();
await page.waitForTimeout(500);
await recordFrames(900);

await row.hover();
await recordFrames(700);

await row.locator('[data-tile-action="why"]').click();
await page.waitForSelector(".unslop-dialog blockquote:not(.unslop-loading)");
await recordFrames(3500);

await page.locator(".unslop-dialog-tools [data-close]").click();
await recordFrames(800);

await row.locator('[data-tile-action="show"]').click();
await recordFrames(1800);
frames.at(-1).delay = 1500;

// 4. Game page gate and the badge after confirming.
await openStorePage(`https://store.steampowered.com/app/${appId}/`);
await page.waitForSelector(".unslop-modal[open]");
await page.waitForTimeout(1500);
await takeScreenshot("gate.png");

await page.locator(".unslop-actions .unslop-btn-primary").click();
const pageBadge = page.locator(".unslop-badge");
await pageBadge.waitFor();
await page.waitForTimeout(800);

const badgeBounds = await pageBadge.boundingBox();
await takeScreenshot("badge.png", {
  x: Math.max(0, badgeBounds.x - 24),
  y: Math.max(0, badgeBounds.y - 70),
  width: Math.min(900, badgeBounds.width + 48),
  height: badgeBounds.height + 100,
});

await browser.close();

// Box filter downscale by any factor below 1.
function downscale(image, scale) {
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const rgba = new Uint8Array(width * height * 4);

  for (let targetY = 0; targetY < height; targetY++) {
    const sourceTop = Math.floor(targetY / scale);
    const sourceBottom = Math.max(sourceTop + 1, Math.floor((targetY + 1) / scale));

    for (let targetX = 0; targetX < width; targetX++) {
      const sourceLeft = Math.floor(targetX / scale);
      const sourceRight = Math.max(sourceLeft + 1, Math.floor((targetX + 1) / scale));
      const channelSums = [0, 0, 0, 0];

      for (let sourceY = sourceTop; sourceY < sourceBottom; sourceY++) {
        for (let sourceX = sourceLeft; sourceX < sourceRight; sourceX++) {
          const sourceIndex = (sourceY * image.width + sourceX) * 4;
          for (let channel = 0; channel < 4; channel++) {
            channelSums[channel] += image.data[sourceIndex + channel];
          }
        }
      }

      const pixelCount = (sourceBottom - sourceTop) * (sourceRight - sourceLeft);
      const targetIndex = (targetY * width + targetX) * 4;
      for (let channel = 0; channel < 4; channel++) {
        rgba[targetIndex + channel] = channelSums[channel] / pixelCount;
      }
    }
  }

  return { width, height, rgba };
}

// One palette per frame keeps the Steam gradients clean.
const gif = GIFEncoder();

for (const { png, delay } of frames) {
  const { width, height, rgba } = downscale(PNG.sync.read(png), GIF_SCALE);
  const palette = quantize(rgba, 256);
  gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay });
}

gif.finish();
writeFileSync(join(imageFolder, "demo.gif"), gif.bytes());
console.log(`Wrote docs/images (app ${appId}, ${frames.length} GIF frames)`);
