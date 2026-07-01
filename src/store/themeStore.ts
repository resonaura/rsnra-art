import { create } from "zustand";
import { persist } from "zustand/middleware";
import themes from "react95/dist/themes";
import type { Theme } from "react95/dist/themes/types";

export interface ThemeOption {
  id: string;
  label: string;
  theme: Theme;
}

// A curated subset of react95's ~55 bundled schemes — mirrors the classic
// Windows 95 "Display Properties > Appearance" scheme list (Brick, Eggplant,
// Hotdog Stand, Lilac, Marine, Plum, Rose, Storm, Teal...) plus a few extra
// modern/dark options for variety.
export const THEMES: ThemeOption[] = [
  { id: "original", label: "Windows Standard", theme: themes.original },
  { id: "highContrast", label: "High Contrast", theme: themes.highContrast },
  { id: "blackAndWhite", label: "Black & White", theme: themes.blackAndWhite },
  { id: "coldGray", label: "Cold Gray", theme: themes.coldGray },
  { id: "darkTeal", label: "Dark Teal", theme: themes.darkTeal },
  { id: "brick", label: "Brick", theme: themes.brick },
  { id: "eggplant", label: "Eggplant", theme: themes.eggplant },
  { id: "hotdogStand", label: "Hotdog Stand", theme: themes.hotdogStand },
  { id: "lilac", label: "Lilac", theme: themes.lilac },
  { id: "maple", label: "Maple", theme: themes.maple },
  { id: "marine", label: "Marine", theme: themes.marine },
  { id: "olive", label: "Olive", theme: themes.olive },
  { id: "plum", label: "Plum", theme: themes.plum },
  { id: "redWine", label: "Redwine", theme: themes.redWine },
  { id: "rose", label: "Rose", theme: themes.rose },
  { id: "slate", label: "Slate", theme: themes.slate },
  { id: "spruce", label: "Spruce", theme: themes.spruce },
  { id: "stormClouds", label: "Storm", theme: themes.stormClouds },
  { id: "vaporTeal", label: "Vapor Teal", theme: themes.vaporTeal },
  { id: "matrix", label: "Matrix", theme: themes.matrix },
  { id: "modernDark", label: "Modern Dark", theme: themes.modernDark },
];

const DEFAULT_THEME_ID = "original";

export function getThemeById(id: string): Theme {
  return THEMES.find((t) => t.id === id)?.theme ?? themes[DEFAULT_THEME_ID];
}

interface ThemeStoreState {
  themeId: string;
  setThemeId: (id: string) => void;
}

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      setThemeId: (id) => set({ themeId: id }),
    }),
    { name: "rsnra95-theme" },
  ),
);
