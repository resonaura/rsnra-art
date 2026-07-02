import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CURSOR_ROLES, type CursorRoleId } from "../data/cursors";

export type CursorSchemeId = "none" | "windows";

const DEFAULT_FILES: Record<CursorRoleId, string> = Object.fromEntries(
  CURSOR_ROLES.map((r) => [r.id, r.file]),
) as Record<CursorRoleId, string>;

interface CursorStoreState {
  /** "none" = plain browser cursors; "windows" = the real .cur pointer set. */
  schemeId: CursorSchemeId;
  /** Per-role file overrides (Pointers tab "Browse..."), relative to /cursors/ME/. */
  files: Record<CursorRoleId, string>;
  setScheme: (id: CursorSchemeId) => void;
  setRoleFile: (role: CursorRoleId, file: string) => void;
  resetRoleFile: (role: CursorRoleId) => void;
  resetAll: () => void;
}

export const useCursorStore = create<CursorStoreState>()(
  persist(
    (set) => ({
      schemeId: "windows",
      files: DEFAULT_FILES,
      setScheme: (id) => set({ schemeId: id }),
      setRoleFile: (role, file) =>
        set((s) => ({ files: { ...s.files, [role]: file } })),
      resetRoleFile: (role) =>
        set((s) => ({ files: { ...s.files, [role]: DEFAULT_FILES[role] } })),
      resetAll: () => set({ files: DEFAULT_FILES }),
    }),
    { name: "rsnra95-cursors" },
  ),
);
