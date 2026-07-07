import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WallpaperMode = "center" | "tile" | "stretch";
export type ColorDepth = 4 | 8 | 16 | 32;

/** Effects tab desktop-icon slots that can be re-themed via "Change Icon…". */
export type DesktopIconSlot =
  | "myComputer"
  | "myDocuments"
  | "recycleFull"
  | "recycleEmpty";

export const DEFAULT_DESKTOP_ICONS: Record<DesktopIconSlot, string> = {
  myComputer: "/icons/explorer.exe/000.ico",
  myDocuments: "/icons/w2k_my_documents.ico",
  recycleFull: "/icons/w2k_recycle_bin_full.ico",
  recycleEmpty: "/icons/w2k_recycle_bin_empty.ico",
};

/**
 * Everything owned by Display Properties: wallpaper, pattern, screen saver,
 * appearance extras, visual effects and the Settings tab (color depth +
 * "screen area" implemented as a zoom factor applied to <body>).
 */
export interface DisplayStoreState {
  /** Absolute VFS path of the wallpaper image, or null for (None). */
  wallpaperPath: string | null;
  wallpaperMode: WallpaperMode;
  /** Pattern name from PATTERNS, or null. Visible where the wallpaper isn't. */
  pattern: string | null;
  /** Appearance ▸ Item "Desktop" color — the base desktop background. */
  desktopColor: string;

  screenSaverId: string;
  screenSaverWait: number; // minutes
  screenSaverPassword: boolean;

  /** Settings ▸ Screen area — zoom applied to <body>. 1 = native. */
  zoom: number;
  colorDepth: ColorDepth;

  // Effects ▸ Visual effects
  transitionEffects: boolean;
  smoothFonts: boolean;
  largeIcons: boolean;
  fullColorIcons: boolean;
  dragFullWindows: boolean;

  desktopIcons: Record<DesktopIconSlot, string>;

  set: (partial: Partial<DisplayStoreState>) => void;
  setDesktopIcon: (slot: DesktopIconSlot, icon: string) => void;
}

export const useDisplayStore = create<DisplayStoreState>()(
  persist(
    (set) => ({
      wallpaperPath: null,
      // The default wallpapers are small seamless tiles — Center would show a
      // barely-visible 32–96px patch in the middle of the screen.
      wallpaperMode: "tile",
      pattern: null,
      desktopColor: "#2d1b4e",

      screenSaverId: "dvd",
      screenSaverWait: 14,
      screenSaverPassword: false,

      zoom: 1,
      colorDepth: 32,

      transitionEffects: true,
      smoothFonts: false,
      largeIcons: false,
      fullColorIcons: true,
      dragFullWindows: true,

      desktopIcons: { ...DEFAULT_DESKTOP_ICONS },

      set: (partial) => set(partial),
      setDesktopIcon: (slot, icon) =>
        set((s) => ({ desktopIcons: { ...s.desktopIcons, [slot]: icon } })),
    }),
    { name: "rsnra95-display" },
  ),
);
