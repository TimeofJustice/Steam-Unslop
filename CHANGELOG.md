# Changelog

## 1.6.0

First release.

- Blurs games with an AI disclosure everywhere in the Steam store: capsules, search results and
  suggestions, lists, the wishlist, bundles, hover popovers, screenshots and trailers.
- Rates the AI use as Low, Medium or High with tags for what it was used for (art, 3D models,
  video, voices, music, sound effects, text, marketing, translation, code, concepts, upscaling and
  live AI), and marks the rating as uncertain when the developer qualifies the use (reworked,
  starting point only, upscaled, optional, placeholder, unintended at most, denies using AI).
- Reads the disclosure in every Steam store language; keywords cover English and German
  statements, plus Chinese, Japanese and Korean ones.
- Asks before showing the page of an AI game; a badge below the title shows the rating.
- Settings for the level from which games are blurred, with a quiz that suggests a level from
  eight example disclosures, and exceptions: kinds of use that alone never blur a game, and games
  that are always shown. Opened by the Unslop button in the store header and the gear in every
  dialog; the level is also in the Chrome popup and the Millennium settings. A short tutorial
  runs on the first start.
- Show a game anyway, or put it on Steam's ignore list (and remove it from your own wishlist).
- Store tabs share their results and rate limits; ratings are cached for 7 days without the
  statement texts, which the dialog loads on demand.
- Available as a Chrome extension and as a Millennium plugin for the Steam client, through
  GitHub Releases only.
- Licensed under the Apache License 2.0.
