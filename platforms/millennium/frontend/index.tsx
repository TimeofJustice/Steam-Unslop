// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { definePlugin, DropdownItem, Field, pluginConfig } from "millennium";
import { useEffect, useState } from "react";
import { STRINGS } from "./strings.generated";

// The blurring runs in webview/preload.ts. This settings panel shares the settings with the store
// pages through Millennium's plugin config.
const PLUGIN_NAME = "steam-unslop";
const CONFIG_KEY = "settings";

const clientLanguage = (document.documentElement.lang || navigator.language || "").toLowerCase();
const texts = STRINGS[clientLanguage.startsWith("de") ? "de" : "en"];

type Settings = { minLevel?: number; ignoreTags?: string[]; allow?: unknown[] };

function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    pluginConfig
      .get<Settings>(PLUGIN_NAME, CONFIG_KEY)
      .then(saved => setSettings(saved || {}))
      .catch(() => setSettings({}));
  }, []);

  if (!settings) return null;

  const setMinLevel = (minLevel: number) => {
    const nextSettings = { ...settings, minLevel };
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
        onChange={option => setMinLevel(option.data)}
      />
      <Field label={texts.description} />
    </>
  );
}

export default definePlugin(() => ({
  title: texts.title,
  icon: <span style={{ marginRight: "5px", fontWeight: 700 }}>AI</span>,
  content: <SettingsPanel />,
}));
