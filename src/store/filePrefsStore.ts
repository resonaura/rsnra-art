import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppId } from "../types/window";

// Global folder-view preferences (mirrors Win95's View ▸ Options ▸ View tab).
// `showHidden` controls whether files/folders with the Hidden attribute appear
// in the Explorer and on the Desktop; when shown they render semi-transparent.
//
// `openWithDefaults` mirrors the file-type association Windows remembers
// after you check "Always use this program to open this kind of file" in the
// Open With dialog — keyed by lowercase extension (no dot).

interface FilePrefsState {
  showHidden: boolean;
  setShowHidden: (v: boolean) => void;
  openWithDefaults: Record<string, AppId>;
  setOpenWithDefault: (extension: string, appId: AppId) => void;
}

export const useFilePrefsStore = create<FilePrefsState>()(
  persist(
    (set) => ({
      showHidden: false,
      setShowHidden: (showHidden) => set({ showHidden }),
      openWithDefaults: {},
      setOpenWithDefault: (extension, appId) =>
        set((s) => ({
          openWithDefaults: { ...s.openWithDefaults, [extension]: appId },
        })),
    }),
    { name: "rsnra95-fileprefs" },
  ),
);
