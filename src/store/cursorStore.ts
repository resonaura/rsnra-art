import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CURSOR_ROLES, type CursorRoleId } from "../data/cursors";

export type CursorSchemeId = "none" | "windows" | "3d-gold" | "3d-silver" | "3d-white";

export const SCHEME_FILES: Record<Exclude<CursorSchemeId, "none">, Record<CursorRoleId, string>> = {
  "windows": {
    normal: "arrow_i.cur",
    help: "help_i.cur",
    workingInBackground: "wait_i.cur",
    busy: "busy_i.cur",
    precision: "cross_i.cur",
    text: "beam_i.cur",
    handwriting: "pen_i.cur",
    unavailable: "no_i.cur",
    verticalResize: "size4_i.cur",
    horizontalResize: "size3_i.cur",
    diagonalResize1: "size2_i.cur",
    diagonalResize2: "size1_i.cur",
    move: "move_i.cur",
    alternate: "up_i.cur",
    link: "link_i.cur",
  },
  "3d-gold": {
    normal: "3dgarro.cur",
    help: "3dghelpsel.cur",
    workingInBackground: "3dgwagtail.ani",
    busy: "3dgtwist.ani",
    precision: "3dgcross.cur",
    text: "3dgbeam.cur",
    handwriting: "3dgpen.cur",
    unavailable: "3dgno.cur",
    verticalResize: "3dgns.cur",
    horizontalResize: "3dgwe.cur",
    diagonalResize1: "3dgnwse.cur",
    diagonalResize2: "3dgnesw.cur",
    move: "3dgmove.cur",
    alternate: "3dgup.ani",
    link: "3dglink.ani",
  },
  "3d-silver": {
    normal: "3dsarro.cur",
    help: "3dshelpsel.cur",
    workingInBackground: "3dswagtail.ani",
    busy: "3dstwist.ani",
    precision: "3dscross.cur",
    text: "3dsbeam.cur",
    handwriting: "3dspen.cur",
    unavailable: "3dsno.cur",
    verticalResize: "3dsns.cur",
    horizontalResize: "3dswe.cur",
    diagonalResize1: "3dsnwse.cur",
    diagonalResize2: "3dsnesw.cur",
    move: "3dsmove.cur",
    alternate: "3dsup.ani",
    link: "3dslink.ani",
  },
  "3d-white": {
    normal: "3dwarro.cur",
    help: "3dwhelpsel.cur",
    workingInBackground: "3dwwagtail.ani",
    busy: "3dwtwist.ani",
    precision: "3dwcross.cur",
    text: "3dwbeam.cur",
    handwriting: "3dwpen.cur",
    unavailable: "3dwno.cur",
    verticalResize: "3dwns.cur",
    horizontalResize: "3dwwe.cur",
    diagonalResize1: "3dwnwse.cur",
    diagonalResize2: "3dwnesw.cur",
    move: "3dwmove.cur",
    alternate: "3dwup.ani",
    link: "3dwlink.ani",
  },
};

const DEFAULT_FILES: Record<CursorRoleId, string> = SCHEME_FILES.windows;

interface CursorStoreState {
  schemeId: CursorSchemeId;
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
      setScheme: (id) => {
        if (id === "none") {
          set({ schemeId: id });
        } else {
          const merged = { ...SCHEME_FILES.windows, ...SCHEME_FILES[id] };
          set({ schemeId: id, files: merged });
        }
      },
      setRoleFile: (role, file) =>
        set((s) => ({ files: { ...s.files, [role]: file } })),
      resetRoleFile: (role) =>
        set((s) => {
          const scheme = s.schemeId === "none" ? "windows" : s.schemeId;
          return { files: { ...s.files, [role]: SCHEME_FILES[scheme][role] } };
        }),
      resetAll: () =>
        set((s) => {
          const scheme = s.schemeId === "none" ? "windows" : s.schemeId;
          return { files: SCHEME_FILES[scheme] };
        }),
    }),
    { name: "rsnra95-cursors" },
  ),
);
