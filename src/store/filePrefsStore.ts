import { create } from "zustand";
import { persist } from "zustand/middleware";

// Global folder-view preferences (mirrors Win95's View ▸ Options ▸ View tab).
// `showHidden` controls whether files/folders with the Hidden attribute appear
// in the Explorer and on the Desktop; when shown they render semi-transparent.

interface FilePrefsState {
  showHidden: boolean;
  setShowHidden: (v: boolean) => void;
}

export const useFilePrefsStore = create<FilePrefsState>()(
  persist(
    (set) => ({
      showHidden: false,
      setShowHidden: (showHidden) => set({ showHidden }),
    }),
    { name: "rsnra95-fileprefs" },
  ),
);
