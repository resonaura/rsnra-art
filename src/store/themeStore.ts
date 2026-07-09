import { useMemo } from "react";
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

// ─── Item fonts ─────────────────────────────────────────────────────────────
// react95's Theme carries colors only, not fonts, so per-item font choices
// (Appearance ▸ Item ▸ Font/Size) are tracked as a parallel layer, applied via
// CSS custom properties (see DisplayHost) rather than the Theme object itself.

export type AppearanceItemId = "window" | "menu" | "msgbox";

export interface ItemFont {
  family: string;
  size: number;
  bold?: boolean;
  italic?: boolean;
}

export interface FontFamilyOption {
  id: string;
  label: string;
  css: string;
}

// Only MS Sans Serif is bundled as a real pixel font; the rest are period-
// accurate picks from the real Windows 95 font list, rendered with whatever
// the browser/OS provides for them (exactly what Windows itself did when a
// font wasn't installed — it fell back to a substitute).
export const FONT_FAMILIES: FontFamilyOption[] = [
  { id: "ms_sans_serif", label: "MS Sans Serif", css: "'ms_sans_serif', sans-serif" },
  { id: "small_fonts", label: "Small Fonts", css: "'ms_sans_serif', sans-serif" },
  { id: "system", label: "System", css: "Tahoma, Geneva, sans-serif" },
  { id: "arial", label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { id: "times", label: "Times New Roman", css: "'Times New Roman', Times, serif" },
  { id: "courier", label: "Courier New", css: "'Courier New', Courier, monospace" },
];

export function fontFamilyCss(id: string): string {
  return FONT_FAMILIES.find((f) => f.id === id)?.css ?? FONT_FAMILIES[0].css;
}

export const ITEM_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

// ─── Custom schemes ───────────────────────────────────────────────────────────

export interface CustomThemeEntry {
  id: string;
  label: string;
  theme: Theme;
  itemFonts: Partial<Record<AppearanceItemId, ItemFont>>;
  /** Active Title Bar "Color 2" — the gradient's end color, or null for solid. */
  headerGradientEnd: string | null;
}

export function isBuiltinLabel(label: string): boolean {
  const trimmed = label.trim().toLowerCase();
  return THEMES.some((t) => t.label.toLowerCase() === trimmed);
}

export function isCustomThemeId(id: string): boolean {
  return id.startsWith("custom:");
}

export function resolveThemeId(
  id: string,
  customThemes: CustomThemeEntry[],
): Theme {
  const builtin = THEMES.find((t) => t.id === id);
  if (builtin) return builtin.theme;
  const custom = customThemes.find((c) => c.id === id);
  return custom?.theme ?? themes[DEFAULT_THEME_ID];
}

interface ThemeStoreState {
  themeId: string;
  customThemes: CustomThemeEntry[];
  /** Unsaved per-color tweaks layered on top of `themeId`'s base scheme. */
  overrides: Partial<Theme>;
  /** Unsaved per-item font tweaks, same "layered until saved" semantics. */
  itemFonts: Partial<Record<AppearanceItemId, ItemFont>>;
  /** Unsaved Active Title Bar "Color 2" tweak. */
  headerGradientEnd: string | null;
  /** Selects a scheme and clears any unsaved tweaks, like loading a .theme file. */
  setThemeId: (id: string) => void;
  setOverrides: (overrides: Partial<Theme>) => void;
  setItemFonts: (itemFonts: Partial<Record<AppearanceItemId, ItemFont>>) => void;
  setHeaderGradientEnd: (color: string | null) => void;
  /** Creates a new custom scheme, or overwrites the existing one sharing `id`. */
  saveCustom: (
    id: string,
    label: string,
    theme: Theme,
    itemFonts: Partial<Record<AppearanceItemId, ItemFont>>,
    headerGradientEnd: string | null,
  ) => void;
  deleteCustom: (id: string) => void;
}

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      customThemes: [],
      overrides: {},
      itemFonts: {},
      headerGradientEnd: null,
      setThemeId: (id) =>
        set({ themeId: id, overrides: {}, itemFonts: {}, headerGradientEnd: null }),
      setOverrides: (overrides) => set({ overrides }),
      setItemFonts: (itemFonts) => set({ itemFonts }),
      setHeaderGradientEnd: (color) => set({ headerGradientEnd: color }),
      saveCustom: (id, label, theme, itemFonts, headerGradientEnd) =>
        set((s) => {
          const idx = s.customThemes.findIndex((c) => c.id === id);
          const entry: CustomThemeEntry = { id, label, theme, itemFonts, headerGradientEnd };
          const customThemes =
            idx >= 0
              ? s.customThemes.map((c, i) => (i === idx ? entry : c))
              : [...s.customThemes, entry];
          return { customThemes };
        }),
      deleteCustom: (id) =>
        set((s) => {
          const customThemes = s.customThemes.filter((c) => c.id !== id);
          if (s.themeId === id) {
            return {
              customThemes,
              themeId: DEFAULT_THEME_ID,
              overrides: {},
              itemFonts: {},
              headerGradientEnd: null,
            };
          }
          return { customThemes };
        }),
    }),
    { name: "rsnra95-theme" },
  ),
);

/** Non-reactive base-scheme lookup (built-in or custom), for call sites that
 *  can't take a hook — reads the live customThemes list via getState(). */
export function getThemeById(id: string): Theme {
  return resolveThemeId(id, useThemeStore.getState().customThemes);
}

/** The theme actually painted on screen right now: base scheme + any
 *  unsaved Appearance-tab color tweaks layered on top. */
export function useEffectiveTheme(): Theme {
  const themeId = useThemeStore((s) => s.themeId);
  const customThemes = useThemeStore((s) => s.customThemes);
  const overrides = useThemeStore((s) => s.overrides);
  return useMemo(
    () => ({ ...resolveThemeId(themeId, customThemes), ...overrides }),
    [themeId, customThemes, overrides],
  );
}
