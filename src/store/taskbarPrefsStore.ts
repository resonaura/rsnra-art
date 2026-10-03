import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TaskbarPreferences {
  alwaysOnTop: boolean;
  autoHide: boolean;
  showSmallStartIcons: boolean;
  showClock: boolean;
  usePersonalizedMenus: boolean;
  menuUse: Record<string, { count: number; lastUsed: number }>;
}

interface TaskbarPrefsState extends TaskbarPreferences {
  setPreferences: (preferences: TaskbarPreferences) => void;
  recordMenuUse: (id: string) => void;
}

export const useTaskbarPrefsStore = create<TaskbarPrefsState>()(
  persist(
    (set) => ({
      alwaysOnTop: true,
      autoHide: false,
      showSmallStartIcons: false,
      showClock: true,
      usePersonalizedMenus: true,
      menuUse: {},
      setPreferences: ({ menuUse: _menuUse, ...preferences }) =>
        set(preferences),
      recordMenuUse: (id) =>
        set((state) => {
          const relatedIds = [id];
          let parentPath = id;
          while (parentPath.includes("\\")) {
            parentPath = parentPath.slice(0, parentPath.lastIndexOf("\\"));
            if (!parentPath || parentPath.endsWith(":")) break;
            relatedIds.push(parentPath);
          }
          const menuUse = { ...state.menuUse };
          const lastUsed = Date.now();
          for (const relatedId of relatedIds) {
            const previous = menuUse[relatedId];
            menuUse[relatedId] = {
              count: (previous?.count ?? 0) + 1,
              lastUsed,
            };
          }
          return {
            menuUse,
          };
        }),
    }),
    {
      name: "rsnra-taskbar-prefs",
      version: 1,
      partialize: ({
        alwaysOnTop,
        autoHide,
        showSmallStartIcons,
        showClock,
        usePersonalizedMenus,
        menuUse,
      }) => ({
        alwaysOnTop,
        autoHide,
        showSmallStartIcons,
        showClock,
        usePersonalizedMenus,
        menuUse,
      }),
    },
  ),
);
