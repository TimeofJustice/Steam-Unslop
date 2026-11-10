// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { MEDIA_SELECTOR, addClass, appIdOf, isGameMedia, removeClass } from "./dom.js";
import { isWishlist } from "./wishlist.js";
import { boundsOf } from "./tiles.js";

/* Cards often show more media of the same game outside the link, e.g. screenshots next to the
   trailer on recommendation pages. The card is the largest ancestor that only links to this
   game and is not much taller than the tile; its images and videos are blurred as well. */
function cardOf(link) {
  const knownCard = link._unslopCard;
  if (knownCard?.isConnected && knownCard.contains(link)) return knownCard;

  const appId = link.dataset.unslopId;
  const linkHeight = boundsOf(link).height;
  let card = link;

  for (let depth = 0; depth < 8; depth++) {
    const parent = card.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) break;

    const linksOtherGames = [...parent.querySelectorAll('a[href*="/app/"]')].some(otherLink => {
      const otherId = appIdOf(otherLink);
      return otherId && otherId !== appId;
    });
    if (linksOtherGames) break;

    if (linkHeight && parent.getBoundingClientRect().height > linkHeight * 2 + 40) break;
    card = parent;
  }

  link._unslopCard = card;
  return card;
}

const isHandledElsewhere = media =>
  media.classList.contains("unslop-media") ||
  !isGameMedia(media) ||
  !!media.closest(".unslop-overlay, .unslop-hoverinfo, a.unslop-blur, a.unslop-wait");

// Idempotent; scan() calls it again to catch media that is rendered later.
export function blurCard(link) {
  if (isWishlist() || link.dataset.unslopPlain) return;

  const card = cardOf(link);
  if (card === link) return;

  const blurredMedia = (link._unslopCardMedia ||= []);
  for (const media of card.querySelectorAll(MEDIA_SELECTOR)) {
    if (isHandledElsewhere(media)) continue;

    addClass(media, "unslop-media");
    blurredMedia.push(media);
  }
}

export function unblurCard(link) {
  link._unslopCardMedia?.forEach(media => removeClass(media, "unslop-media"));
  link._unslopCardMedia = null;
  link._unslopCard = null;
}
