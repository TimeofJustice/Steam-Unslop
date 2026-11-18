// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { definePlugin, DropdownItem, Field, pluginConfig, ToggleField } from "millennium";
import { useEffect, useState } from "react";
import { STRINGS } from "./strings.generated";

// The blurring runs in webview/preload.ts. This settings panel shares the settings with the store
// pages through Millennium's plugin config.
const PLUGIN_NAME = "steam-unslop";
const CONFIG_KEY = "settings";

const clientLanguage = (document.documentElement.lang || navigator.language || "").toLowerCase();
const texts = STRINGS[clientLanguage.startsWith("de") ? "de" : "en"];

// Same names as BEHAVIORS in src/core/settings.js; each is on unless it was turned off.
const BEHAVIORS = ["blur", "gatePages", "warnCart", "pauseTrailers"] as const;
type Behavior = (typeof BEHAVIORS)[number];

type Settings = { minLevel?: number; ignoreTags?: string[]; allow?: unknown[] } & Partial<
  Record<Behavior, boolean>
>;

function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    pluginConfig
      .get<Settings>(PLUGIN_NAME, CONFIG_KEY)
      .then(saved => setSettings(saved || {}))
      .catch(() => setSettings({}));
  }, []);

  if (!settings) return null;

  // The other settings (exceptions, always shown games) are kept.
  const saveChange = (change: Settings) => {
    const nextSettings = { ...settings, ...change };
    setSettings(nextSettings);
    pluginConfig.set(PLUGIN_NAME, CONFIG_KEY, nextSettings);
  };

  const levelOptions = texts.minLevelOptions.map((label, level) => ({ data: level, label }));

  return (
    <>
      <DropdownItem
        label={texts.minLevel}
        description={texts.minLevelHint}
        rgOptions={levelOptions}
        selectedOption={settings.minLevel ?? 0}
        onChange={option => saveChange({ minLevel: option.data })}
      />
      <Field label={texts.behaviorTitle} />
      {BEHAVIORS.map(behavior => (
        <ToggleField
          key={behavior}
          label={texts.behaviors[behavior].label}
          description={texts.behaviors[behavior].hint}
          checked={settings[behavior] !== false}
          onChange={checked => saveChange({ [behavior]: checked })}
        />
      ))}
      <Field label={texts.description} />
    </>
  );
}

export default definePlugin(() => ({
  title: texts.title,
  icon: <span style={{ marginRight: "5px", fontWeight: 700 }}>AI</span>,
  content: <SettingsPanel />,
}));
