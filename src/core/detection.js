// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import headingsByLanguage from "../data/ai-headings.json";
import cjkKeywords from "../data/keywords-cjk.json";

const escapeForRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Steam's mandatory "AI Generated Content Disclosure". The block shares its markup with the
   mature content description; only the heading tells them apart. The headings of all store
   languages come from src/data/ai-headings.json (scripts/collect-headings.mjs). */
const AI_HEADINGS = [...new Set(Object.values(headingsByLanguage))];

const DISCLOSURE_HEADING = new RegExp(
  [
    ...AI_HEADINGS.map(escapeForRegex),
    "AI[\\s-]Generated Content Disclosure",
    "KI-generierte[nr]? Inhalt",
    "Offenlegung[^<]{0,30}KI",
  ].join("|"),
  "i",
);

const DESCRIPTOR_BLOCK = /<div id="game_area_content_descriptors"[^>]*>([\s\S]*?)<\/div>/g;
const MAX_STATEMENT_LENGTH = 2000;

// Keywords are written in ASCII; umlauts in the text are folded first (ue matches both spellings).
const UMLAUT_SPELLINGS = { "\u00e4": "ae", "\u00f6": "oe", "\u00fc": "ue", "\u00df": "ss" };

export const foldUmlauts = text =>
  text.toLowerCase().replace(/[\u00e4\u00f6\u00fc\u00df]/g, umlaut => UMLAUT_SPELLINGS[umlaut]);

// Whole-word match; \b would treat letters such as accented ones as word boundaries.
const wholeWords = alternatives =>
  new RegExp(`(?<![\\p{L}\\d])(?:${alternatives.join("|")})(?![\\p{L}\\d])`, "iu");

// severity: 3 = core content, 2 = supporting content, 1 = tooling or minor use.
export const TAGS = [
  // A tool name such as ChatGPT alone says nothing about runtime use, so it is no keyword here.
  {
    key: "live",
    severity: 3,
    pattern: wholeWords([
      "real[- ]?time",
      "runtime",
      "during gameplay",
      "on the fly",
      "dynamically generated",
      "generated (?:live|during|at runtime)",
      "in[- ]game generat\\w*",
      "llms?",
      "large language models?",
      "while (?:you|the player|players) plays?",
      "connects? to (?:an? )?(?:external |third[- ]party )\\w*",
      "ai[- ](?:npcs?|companions?|chat\\w*)",
      "echtzeit",
      "waehrend des spiel\\w*",
      "verbindung zu (?:einem )?drittanbieter\\w*",
    ]),
  },
  {
    key: "art",
    severity: 3,
    pattern: wholeWords([
      "art",
      "arts",
      "artworks?",
      "images?",
      "illustrations?",
      "textures?",
      "sprites?",
      "portraits?",
      "backgrounds?",
      "graphics?",
      "visuals?",
      "icons?",
      "cgs?",
      "character designs?",
      "(?:in-)?game assets",
      "bilder?",
      "grafik\\w*",
      "texturen?",
      "illustrationen?",
      "hintergruende?",
    ]),
  },
  {
    key: "model",
    severity: 3,
    pattern: wholeWords(["3d[- ]?(?:models?|assets?|meshes)", "meshes", "3d-modell\\w*"]),
  },
  {
    key: "video",
    severity: 3,
    pattern: wholeWords([
      "videos?(?! ?games?)",
      "footage",
      "fmv",
      "full[- ]motion",
      "cinematics?",
      "cut[- ]?scenes?",
      "animations?",
      "animated",
      "movies?",
      "films?",
      "zwischensequenzen?",
      "filmsequenzen?",
      "animationen?",
    ]),
  },
  {
    key: "voice",
    severity: 3,
    pattern: wholeWords([
      "voices?",
      "voice[- ]?(?:over|acting|lines?)",
      "tts",
      "text[- ]to[- ]speech",
      "narrat(?:ion|or)",
      "dubbing",
      "speech",
      "stimmen?",
      "sprachausgabe",
      "vertonung",
      "synchronisation",
    ]),
  },
  {
    key: "music",
    severity: 3,
    pattern: wholeWords(["music", "soundtracks?", "songs?", "bgm", "musik"]),
  },
  {
    key: "sfx",
    severity: 2,
    pattern: wholeWords([
      "sound[- ]?effects?",
      "sfx",
      "audio",
      "sounds?",
      "soundeffekte?",
      "geraeusche?",
    ]),
  },
  {
    key: "text",
    severity: 2,
    pattern: wholeWords([
      "story",
      "stories",
      "dialogu?es?",
      "writing(?! (?:the |of |our )?(?:game'?s? )?(?:code|scripts?))",
      "narrative",
      "lore",
      "(?<!store )texts?",
      "quests?",
      "descriptions?",
      "written content",
      "geschichten?",
      "dialoge?",
      "(?<!store )texte?",
      "handlung",
    ]),
  },
  {
    key: "promo",
    severity: 2,
    pattern: wholeWords([
      "store page",
      "steam page",
      "steam store",
      "library images?",
      "store (?:page )?(?:texts?|descriptions?|assets?|art(?:work)?|images?|graphics?|visuals?|copy|capsules?)",
      "trailers?",
      "capsules?",
      "marketing",
      "promotional",
      "key art",
      "thumbnails?",
      "werbung",
      "werbematerial\\w*",
    ]),
  },
  {
    key: "transl",
    severity: 1,
    pattern: wholeWords(["translat\\w*", "locali[sz]\\w*", "uebersetz\\w*", "lokalisier\\w*"]),
  },
  {
    key: "code",
    severity: 1,
    pattern: wholeWords([
      "code",
      "coding",
      "programming",
      "scripting",
      "copilot",
      "debugging",
      "netcode",
      "front[- ]?end",
      "back[- ]?end",
      "programmier\\w*",
    ]),
  },
  {
    key: "idea",
    severity: 1,
    pattern: wholeWords([
      "concepts?",
      "placeholders?",
      "prototyp\\w*",
      "(?<!(?:with|in) )references?(?! to)",
      "inspiration",
      "brainstorm\\w*",
      "ideas?",
      "ideation",
      "mood ?boards?",
      "konzept\\w*",
      "platzhalter",
      "ideen?",
    ]),
  },
  // Existing material made sharper or smoother. Only unambiguous words; the hint below is broader.
  {
    key: "upscale",
    severity: 1,
    pattern: wholeWords([
      "upscal\\w*",
      "up-?res\\w*",
      "super[- ]?resolution",
      "denois\\w*",
      "frame interpolation",
      "interpolat\\w* (?:frames?|animations?|videos?)",
      "(?:higher|increase\\w*|improve\\w*|enhanc\\w*) (?:the )?(?:resolution|frame ?rates?)",
      "restor\\w* (?:the |old |original )?(?:footage|images?|videos?|audio|textures?|recordings?|films?)",
      "remaster\\w*",
      "hochskalier\\w*",
      "aufloesung (?:erhoeht|verbessert)",
      "bildrate",
    ]),
  },
];
export const TAG_BY_KEY = Object.fromEntries(TAGS.map(t => [t.key, t]));

const CLAUSE_SPLIT =
  /[.!?;:]+(?:\s+|$)|[\u3002\uff01\uff1f\uff1b]+|\n|,?\s+(?:but|however|although|whereas|aber|jedoch|sondern|allerdings)\s+/i;
const NEGATION = wholeWords([
  "not(?! only| just)",
  "\\w+n't",
  "no",
  "never",
  "none",
  "nothing",
  "neither",
  "nor",
  "without",
  "nicht(?! nur)",
  "kein\\w*",
  "nichts",
  "nie",
  "niemals",
  "weder",
  "ohne",
]);

/* Chinese, Japanese and Korean have no word boundaries, so their keywords
   (src/data/keywords-cjk.json) are matched as plain substrings. */
const substringsOf = list =>
  list?.length ? new RegExp(list.map(escapeForRegex).join("|"), "i") : null;

for (const tag of TAGS) tag.cjkPattern = substringsOf(cjkKeywords.tags[tag.key]);

const CJK_NEGATION = substringsOf(cjkKeywords.negation);

const isNegated = clause => NEGATION.test(clause) || !!CJK_NEGATION?.test(clause);

// Qualifiers such as "only as a starting point". lowersLevel: drops the level one step.
// Any hint marks the rating as uncertain.
const HINTS = [
  {
    key: "upscale",
    lowersLevel: true,
    pattern: wholeWords([
      "upscal\\w*",
      "up-?res\\w*",
      "enhanc\\w*",
      "denois\\w*",
      "restor\\w*",
      "remaster\\w*",
      "super[- ]?resolution",
      "(?:higher|increase\\w*|improve\\w*) (?:the )?(?:resolution|frame ?rate)",
      "frame ?rate",
      "frame interpolation",
      "interpolat\\w*",
      "sharpen\\w*",
      "hochskalier\\w*",
      "aufgewertet",
      "verbessert\\w*",
      "restauriert\\w*",
      "bildrate",
    ]),
  },
  {
    key: "rework",
    lowersLevel: true,
    pattern: wholeWords([
      "edited",
      "retouch\\w*",
      "remodel\\w*",
      "composit\\w*",
      "rework\\w*",
      "refin\\w*",
      "revised",
      "reviewed",
      "polished",
      "redrawn",
      "repainted",
      "painted over",
      "modified",
      "by (?:our )?(?:art |human )?(?:team|artists?|humans?|hand)",
      "human \\w+",
      "hand[- ](?:drawn|painted|made|crafted)",
      "ueberarbeitet",
      "nachbearbeitet",
      "bearbeitet",
      "angepasst",
      "verfeinert",
      "geprueft",
      "korrigiert",
      "von hand",
      "menschlich\\w*",
    ]),
  },
  {
    key: "start",
    lowersLevel: true,
    pattern: wholeWords([
      "starting points?",
      "early stages?",
      "(?:first|initial|rough) drafts?",
      "(?<!(?:with|in) )references?(?! to)",
      "inspiration",
      "ausgangspunkt",
      "grundlage",
      "entwuerfe?",
      "fruehen? (?:phase|stadium|entwicklungsphase)",
    ]),
  },
  {
    key: "temp",
    lowersLevel: true,
    pattern: wholeWords([
      "provisional\\w*",
      "preliminary",
      "temporar\\w*",
      "placeholders?",
      "(?:will|to) be replaced",
      "vorlaeufig\\w*",
      "uebergangsweise",
      "platzhalter",
      "(?:wird|werden) ersetzt",
    ]),
  },
  {
    key: "unintended",
    lowersLevel: true,
    pattern: wholeWords([
      "slipped through",
      "unintentional\\w*",
      "unknowingly",
      "inadvertent\\w*",
      "by accident",
      "stock (?:photos?|images?|assets?|footage)",
      "(?:purchased|bought|licensed|third[- ]party) assets?",
      "asset (?:store|packs?)",
      "unbeabsichtigt",
      "unwissentlich",
      "versehentlich",
      "gekaufte assets?",
      "stockfotos?",
    ]),
  },
  {
    key: "optional",
    lowersLevel: false,
    pattern: wholeWords([
      "optional\\w*",
      "can (?:be )?(?:disabled?|turned off|switched off)",
      "opt[- ]in",
      "abschaltbar",
      "deaktivierbar",
      "(?:kann|koennen) (?:deaktiviert|abgeschaltet|ausgeschaltet) werden",
    ]),
  },
  {
    key: "part",
    lowersLevel: false,
    pattern: wholeWords([
      "partially",
      "partly",
      "some",
      "a few",
      "minor",
      "limited",
      "small (?:number|portion|amount|part)",
      "teilweise",
      "einige",
      "wenige",
    ]),
  },
];
const REWORK_HINT = HINTS.find(hint => hint.key === "rework");
const DENIED_HINT = { key: "denied", lowersLevel: true };
const HINT_BY_KEY = Object.fromEntries([...HINTS, DENIED_HINT].map(hint => [hint.key, hint]));
// "If you believe an artwork looks like AI" talks about AI without describing any use.
const HYPOTHETICAL = wholeWords([
  "if (?:there|you|any\\w*)",
  "whether",
  "believe",
  "looks? like",
  "seems? like",
  "suspect\\w*",
  "distinguish\\w*",
  "tell apart",
  "concerns?",
  "point (?:it |them )?out",
  "report (?:it|them)",
  "slipped through",
  "falls (?:du|ihr|sie|es)",
  "wenn (?:du|ihr|sie|es)",
  "glaubst",
  "aussieht",
  "unterscheiden",
  "melde\\w*",
]);
const AI_WORD = wholeWords([
  "ai",
  "a\\.i\\.",
  "ki",
  "generative",
  "kuenstliche intelligenz",
  "artificial intelligence",
  "machine learning",
]);
// "All of our art is created by human artists" describes human work, unless it also mentions AI.
const HUMAN_MADE = wholeWords([
  "(?:created|made|written|composed|drawn|painted|produced|performed|recorded|voiced|designed|done|authored|developed|crafted|directed)" +
    "(?: or \\w+)? (?:entirely |solely |directly |manually |fully |completely )?by (?:a |an |the |our |my |its )?(?:own )?" +
    "(?:real |professional |human |internal |in-house )?(?:humans?|human \\w+|hands?|people|persons?|developers?|devs?|team|" +
    "creators?|artists?|musicians?|composers?|writers?|illustrators?|me|myself|us|ourselves)",
  "(?:created|made|written|drawn|done|developed|designed) (?:entirely |fully )?(?:manually|by hand|in-house)",
  "(?:original|own) work",
  "work of (?:human |real |professional )?(?:artists?|people|humans?|musicians?)",
  "licensed",
  "cc0",
  "(?:actual|real) (?:in-game |gameplay )?footage",
  "drawn by code",
  "synthesi[sz]ed mathematically",
  "(?:asset|art) packs?",
  "human[- ](?:made|created|written|authored|composed)",
  "hand[- ](?:drawn|painted|made|crafted|written)",
  "von (?:echten |professionellen )?(?:menschen|menschlichen \\w+|hand) (?:erstellt|gemacht|geschrieben|gezeichnet|komponiert|gemalt|vertont)",
  "handgemacht\\w*",
  "handgezeichnet\\w*",
  "public[- ]domain",
  "(?:by|from) (?:famous |historical |real |classic )*(?:human )?(?:artists|painters)",
  "gemeinfrei\\w*",
]);
const MENTIONS_USE = wholeWords([
  "ai",
  "a\\.i\\.",
  "ki",
  "generat\\w*",
  "llms?",
  "language models?",
  "gpt\\S*",
  "tts",
  "text[- ]to[- ]speech",
  "machine learning",
  "kuenstliche intelligenz",
]);
// "No AI output was used as-is" is negated but still implies rework.
const NOT_AS_IS = wholeWords(["as[- ]is", "unveraendert", "direkt uebernommen"]);

// Text that was only translated ("text translation", "the dialogues were translated") is
// translation, not written content; such phrases are reduced to "translation" before matching.
const TEXT_NOUN =
  "(?:(?:store (?:page )?|system |user )?(?:texts?|texte|story|stories|dialogu?es?|dialoge|descriptions?|lore|quests?|" +
  "subtitles?|strings|ui|interface|menus?|buttons?|(?:store|steam) pages?|geschichten?|beschreibungen?|untertitel|menues?))";
const TEXT_ITEM = `(?: (?:the|all|our|its|in-game|game'?s?|die|der|das))* ${TEXT_NOUN}`;
const TRANSLATED_TEXT = new RegExp(
  "(?<![\\p{L}\\d])(?:" +
    [
      `${TEXT_NOUN}[- ](?:translations?|localization)`,
      `(?:translat|locali[sz])\\w*(?: of| into)?${TEXT_ITEM}(?:(?:,? (?:and|or|und|oder)|,)${TEXT_ITEM})*`,
      `${TEXT_NOUN} (?:(?:was|were|is|are|has been|have been|got|get|gets)(?: \\w+){0,2} )?translated`,
      `uebersetzung (?:der |des |von |aller )?${TEXT_NOUN}`,
      `${TEXT_NOUN} (?:wurden?|werden|wird|sind|ist)(?: \\w+){0,4} uebersetzt`,
    ].join("|") +
    ")(?![\\p{L}\\d])",
  "giu",
);

// "All of it was reviewed and directed by the developer" is about checking AI output, not human work.
const REVIEW = wholeWords([
  "review\\w*",
  "edit\\w*",
  "refin\\w*",
  "revis\\w*",
  "polish\\w*",
  "retouch\\w*",
  "adjust\\w*",
  "curat\\w*",
  "check\\w*",
  "tested",
  "selected",
  "ueberarbeitet",
  "bearbeitet",
  "geprueft",
  "angepasst",
]);
const isOnlyHumanWork = clause =>
  HUMAN_MADE.test(clause) && !MENTIONS_USE.test(clause) && !REVIEW.test(clause);

const describesUse = clause => !isNegated(clause) && !isOnlyHumanWork(clause);

const clausesOf = text =>
  foldUmlauts(text || "")
    .split(CLAUSE_SPLIT)
    .filter(Boolean);

function plainTextOf(html) {
  const withLineBreaks = html.replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n");
  const text = new DOMParser().parseFromString(withLineBreaks, "text/html").body.textContent;

  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// The developer's statement is the <i> element of the AI block, in every store language.
function disclosureStatement(html) {
  for (const [, block] of html.matchAll(DESCRIPTOR_BLOCK)) {
    const heading = block.match(/<h2[^>]*>([^<]*)<\/h2>/)?.[1].trim();
    if (!heading || !DISCLOSURE_HEADING.test(heading)) continue;

    const statement = block.match(/<i>([\s\S]*?)<\/i>/)?.[1];
    return plainTextOf(statement ?? block.replace(/<h2[\s\S]*?<\/h2>/, ""));
  }

  return disclosureStatementFallback(html);
}

// Other markup (older pages, tests): the text after the heading up to the next section.
function disclosureStatementFallback(html) {
  const headingMatch = DISCLOSURE_HEADING.exec(html);
  if (!headingMatch) return null;

  let section = html.slice(headingMatch.index, headingMatch.index + 8000);
  const sectionEnd = section.slice(headingMatch[0].length).search(/<h2|<div class="block\b/);
  if (sectionEnd >= 0) section = section.slice(0, sectionEnd + headingMatch[0].length);

  return plainTextOf(section)
    .replace(DISCLOSURE_HEADING, "")
    .replace(/^[\s\S]{0,200}?(?:like this|wie folgt|folgenderma(?:\u00df|ss)en)\s*:/i, "")
    .trim();
}

// "Concept art" is a concept and "art direction" a human role, neither is final art.
function joinForMatching(clauses) {
  return clauses
    .join(". ")
    .replace(/concept[- ]art/g, "concept")
    .replace(/(?:art|creative) direction/g, "direction")
    .replace(TRANSLATED_TEXT, "translation");
}

// Returns { tags, text } for a store page with a disclosure, otherwise null.
export function analyze(html) {
  const statement = disclosureStatement(html);
  if (statement === null) return null;

  const usageClauses = clausesOf(statement).filter(describesUse);
  // Live AI also counts in conditional clauses ("if you ask an NPC, an LLM answers").
  const allUsage = joinForMatching(usageClauses);
  const actualUsage = joinForMatching(usageClauses.filter(clause => !HYPOTHETICAL.test(clause)));

  const tags = TAGS.filter(tag => {
    const usage = tag.key === "live" ? allUsage : actualUsage;
    return tag.pattern.test(usage) || !!tag.cjkPattern?.test(usage);
  }).map(tag => tag.key);

  const text =
    statement.length > MAX_STATEMENT_LENGTH
      ? statement.slice(0, MAX_STATEMENT_LENGTH) + "..."
      : statement;
  return { tags, text };
}

export function gameNameFromPage(html) {
  const nameMatch =
    html.match(/id="appHubAppName"[^>]*>([^<]+)</) ||
    html.match(/property="og:title" content="([^"]+)"/);
  if (!nameMatch) return "";

  return new DOMParser()
    .parseFromString(nameMatch[1], "text/html")
    .body.textContent.replace(/ (?:on|auf) Steam$/, "")
    .trim();
}

// 3 = high, 2 = medium, 1 = low, 0 = unclear (a disclosure without recognizable keywords).
export function levelOf(tags) {
  if (!tags.length) return 0;

  const score = tags.reduce((sum, key) => sum + TAG_BY_KEY[key].severity, 0);
  if (tags.includes("live") || score >= 6) return 3;
  return score >= 3 ? 2 : 1;
}

export function findHints(text, tags = []) {
  const clauses = clausesOf(text);
  const usageClauses = clauses.filter(describesUse);
  const found = HINTS.filter(hint => usageClauses.some(clause => hint.pattern.test(clause)));

  const notUsedAsIs = clauses.some(clause => isNegated(clause) && NOT_AS_IS.test(clause));
  if (notUsedAsIs && !found.includes(REWORK_HINT)) found.unshift(REWORK_HINT);

  const deniesUse = clauses.some(
    clause => (isNegated(clause) && AI_WORD.test(clause)) || isOnlyHumanWork(clause),
  );
  if (!tags.length && deniesUse) found.unshift(DENIED_HINT);

  return found;
}

/* Returns { rawLevel, level, lowered, hints, uncertain }. Live AI is never lowered: runtime
   generation stays high whatever the developer adds. Cache entries carry their hint keys, so
   they are rated the same without the statement text. */
export function rate(info) {
  const hints = Array.isArray(info.hints)
    ? info.hints.map(key => HINT_BY_KEY[key]).filter(Boolean)
    : findHints(info.text, info.tags);

  const rawLevel = levelOf(info.tags);
  const lowered =
    rawLevel > 1 && !info.tags.includes("live") && hints.some(hint => hint.lowersLevel);

  return {
    rawLevel,
    level: lowered ? rawLevel - 1 : rawLevel,
    lowered,
    hints,
    uncertain: hints.length > 0,
  };
}
