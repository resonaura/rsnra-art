import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type CursorRoleId } from "../data/cursors";

// Helper to parse comma-separated values from Windows Registry
function parseRegistryScheme(regStr: string): Record<string, string> {
  const parts = regStr.split(",").map((p) => p.trim());
  const rolesOrder: CursorRoleId[] = [
    "normal",
    "help",
    "workingInBackground",
    "busy",
    "precision",
    "text",
    "handwriting",
    "unavailable",
    "verticalResize",
    "horizontalResize",
    "diagonalResize1",
    "diagonalResize2",
    "move",
    "alternate",
    "link",
  ];
  const res: Partial<Record<CursorRoleId, string>> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      const filename = parts[i].split("\\").pop()!.replace(/"/g, "");
      if (filename && rolesOrder[i]) {
        res[rolesOrder[i]] = filename;
      }
    }
  }
  return res as Record<string, string>;
}

// All built-in system schemes parsed directly from real Windows registry values
export const SYSTEM_SCHEMES: Record<string, Record<string, string>> = {
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
  "windows-default": parseRegistryScheme(""),
  "windows-animated": parseRegistryScheme("C:\\WINDOWS\\Cursors\\rainbow.ani,,C:\\WINDOWS\\Cursors\\appstart.ani,C:\\WINDOWS\\Cursors\\hourglas.ani,C:\\WINDOWS\\Cursors\\cross.cur,,,,C:\\WINDOWS\\Cursors\\sizens.ani,C:\\WINDOWS\\Cursors\\sizewe.ani,C:\\WINDOWS\\Cursors\\sizenwse.ani,C:\\WINDOWS\\Cursors\\sizenesw.ani,,"),
  "3d-white": parseRegistryScheme("C:\\WINDOWS\\Cursors\\3dwarro.cur,,C:\\WINDOWS\\Cursors\\appstar3.ani,C:\\WINDOWS\\Cursors\\hourgla3.ani,C:\\WINDOWS\\Cursors\\cross.cur,,,C:\\WINDOWS\\Cursors\\3dwno.cur,C:\\WINDOWS\\Cursors\\3dwns.cur,C:\\WINDOWS\\Cursors\\3dwwe.cur,C:\\WINDOWS\\Cursors\\3dwnwse.cur,C:\\WINDOWS\\Cursors\\3dwnesw.cur,C:\\WINDOWS\\Cursors\\3dwmove.cur,"),
  "hands-1": parseRegistryScheme("C:\\WINDOWS\\Cursors\\harrow.cur,,C:\\WINDOWS\\Cursors\\handapst.ani,C:\\WINDOWS\\Cursors\\hand.ani,C:\\WINDOWS\\Cursors\\hcross.cur,C:\\WINDOWS\\Cursors\\hibeam.cur,,C:\\WINDOWS\\Cursors\\hnodrop.cur,C:\\WINDOWS\\Cursors\\hns.cur,C:\\WINDOWS\\Cursors\\hwe.cur,C:\\WINDOWS\\Cursors\\hnwse.cur,C:\\WINDOWS\\Cursors\\hnesw.cur,C:\\WINDOWS\\Cursors\\hmove.cur,"),
  "hands-2": parseRegistryScheme("C:\\WINDOWS\\Cursors\\harrow.cur,,C:\\WINDOWS\\Cursors\\handapst.ani,C:\\WINDOWS\\Cursors\\handwait.ani,C:\\WINDOWS\\Cursors\\hcross.cur,C:\\WINDOWS\\Cursors\\hibeam.cur,,C:\\WINDOWS\\Cursors\\handno.ani,C:\\WINDOWS\\Cursors\\handns.ani,C:\\WINDOWS\\Cursors\\handwe.ani,C:\\WINDOWS\\Cursors\\handnwse.ani,C:\\WINDOWS\\Cursors\\handnesw.ani,C:\\WINDOWS\\Cursors\\hmove.cur,"),
  "dinosaur": parseRegistryScheme("C:\\WINDOWS\\Cursors\\3dgarro.cur,,C:\\WINDOWS\\Cursors\\dinosaur.ani,C:\\WINDOWS\\Cursors\\dinosau2.ani,C:\\WINDOWS\\Cursors\\cross.cur,,,C:\\WINDOWS\\Cursors\\banana.ani,C:\\WINDOWS\\Cursors\\3dsns.cur,C:\\WINDOWS\\Cursors\\3dgwe.cur,C:\\WINDOWS\\Cursors\\3dsnwse.cur,C:\\WINDOWS\\Cursors\\3dgnesw.cur,C:\\WINDOWS\\Cursors\\3dsmove.cur,"),
  "old-fashioned": parseRegistryScheme("C:\\WINDOWS\\Cursors\\harrow.cur,,C:\\WINDOWS\\Cursors\\horse.ani,C:\\WINDOWS\\Cursors\\barber.ani,C:\\WINDOWS\\Cursors\\hcross.cur,C:\\WINDOWS\\Cursors\\hibeam.cur,,C:\\WINDOWS\\Cursors\\coin.ani,C:\\WINDOWS\\Cursors\\3dgns.cur,C:\\WINDOWS\\Cursors\\3dgwe.cur,C:\\WINDOWS\\Cursors\\3dgnwse.cur,C:\\WINDOWS\\Cursors\\3dgnesw.cur,C:\\WINDOWS\\Cursors\\3dgmove.cur,"),
  "conductor": parseRegistryScheme("C:\\WINDOWS\\Cursors\\harrow.cur,,C:\\WINDOWS\\Cursors\\drum.ani,C:\\WINDOWS\\Cursors\\metronom.ani,C:\\WINDOWS\\Cursors\\hcross.cur,C:\\WINDOWS\\Cursors\\hibeam.cur,,C:\\WINDOWS\\Cursors\\piano.ani,C:\\WINDOWS\\Cursors\\hns.cur,C:\\WINDOWS\\Cursors\\hwe.cur,C:\\WINDOWS\\Cursors\\hnwse.cur,C:\\WINDOWS\\Cursors\\hnesw.cur,C:\\WINDOWS\\Cursors\\hmove.cur,"),
  "magnified": parseRegistryScheme("C:\\WINDOWS\\Cursors\\larrow.cur,,C:\\WINDOWS\\Cursors\\lappstrt.cur,C:\\WINDOWS\\Cursors\\lwait.cur,C:\\WINDOWS\\Cursors\\lcross.cur,C:\\WINDOWS\\Cursors\\libeam.cur,,C:\\WINDOWS\\Cursors\\lnodrop.cur,C:\\WINDOWS\\Cursors\\lns.cur,C:\\WINDOWS\\Cursors\\lwe.cur,C:\\WINDOWS\\Cursors\\lnwse.cur,C:\\WINDOWS\\Cursors\\lnesw.cur,C:\\WINDOWS\\Cursors\\lmove.cur,"),
  "variations": parseRegistryScheme("C:\\WINDOWS\\Cursors\\fillitup.ani,,C:\\WINDOWS\\Cursors\\raindrop.ani,C:\\WINDOWS\\Cursors\\counter.ani,C:\\WINDOWS\\Cursors\\cross.cur,,,C:\\WINDOWS\\Cursors\\wagtail.ani,C:\\WINDOWS\\Cursors\\sizens.ani,C:\\WINDOWS\\Cursors\\sizewe.ani,C:\\WINDOWS\\Cursors\\sizenwse.ani,C:\\WINDOWS\\Cursors\\sizenesw.ani,"),
  "3d-bronze": parseRegistryScheme("C:\\WINDOWS\\Cursors\\3dgarro.cur,,C:\\WINDOWS\\Cursors\\appstar2.ani,C:\\WINDOWS\\Cursors\\hourgla2.ani,C:\\WINDOWS\\Cursors\\cross.cur,,,C:\\WINDOWS\\Cursors\\3dgno.cur,C:\\WINDOWS\\Cursors\\3dgns.cur,C:\\WINDOWS\\Cursors\\3dgwe.cur,C:\\WINDOWS\\Cursors\\3dgnwse.cur,C:\\WINDOWS\\Cursors\\3dgnesw.cur,C:\\WINDOWS\\Cursors\\3dgmove.cur,"),
  "windows-black": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_r.cur,C:\\WINDOWS\\cursors\\help_r.cur,C:\\WINDOWS\\cursors\\wait_r.cur,C:\\WINDOWS\\cursors\\busy_r.cur,C:\\WINDOWS\\cursors\\cross_r.cur,C:\\WINDOWS\\cursors\\beam_r.cur,C:\\WINDOWS\\cursors\\pen_r.cur,C:\\WINDOWS\\cursors\\no_r.cur,C:\\WINDOWS\\cursors\\size4_r.cur,C:\\WINDOWS\\cursors\\size3_r.cur,C:\\WINDOWS\\cursors\\size2_r.cur,C:\\WINDOWS\\cursors\\size1_r.cur,C:\\WINDOWS\\cursors\\move_r.cur,C:\\WINDOWS\\cursors\\up_r.cur"),
  "windows-black-l": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_rm.cur,C:\\WINDOWS\\cursors\\help_rm.cur,C:\\WINDOWS\\cursors\\wait_rm.cur,C:\\WINDOWS\\cursors\\busy_rm.cur,C:\\WINDOWS\\cursors\\cross_rm.cur,C:\\WINDOWS\\cursors\\beam_rm.cur,C:\\WINDOWS\\cursors\\pen_rm.cur,C:\\WINDOWS\\cursors\\no_rm.cur,C:\\WINDOWS\\cursors\\size4_rm.cur,C:\\WINDOWS\\cursors\\size3_rm.cur,C:\\WINDOWS\\cursors\\size2_rm.cur,C:\\WINDOWS\\cursors\\size1_rm.cur,C:\\WINDOWS\\cursors\\move_rm.cur,C:\\WINDOWS\\cursors\\up_rm.cur"),
  "windows-black-xl": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_rl.cur,C:\\WINDOWS\\cursors\\help_rl.cur,C:\\WINDOWS\\cursors\\wait_rl.cur,C:\\WINDOWS\\cursors\\busy_rl.cur,C:\\WINDOWS\\cursors\\cross_rl.cur,C:\\WINDOWS\\cursors\\beam_rl.cur,C:\\WINDOWS\\cursors\\pen_rl.cur,C:\\WINDOWS\\cursors\\no_rl.cur,C:\\WINDOWS\\cursors\\size4_rl.cur,C:\\WINDOWS\\cursors\\size3_rl.cur,C:\\WINDOWS\\cursors\\size2_rl.cur,C:\\WINDOWS\\cursors\\size1_rl.cur,C:\\WINDOWS\\cursors\\move_rl.cur,C:\\WINDOWS\\cursors\\up_rl.cur"),
  "windows-inverted": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_i.cur,C:\\WINDOWS\\cursors\\help_i.cur,C:\\WINDOWS\\cursors\\wait_i.cur,C:\\WINDOWS\\cursors\\busy_i.cur,C:\\WINDOWS\\cursors\\cross_i.cur,C:\\WINDOWS\\cursors\\beam_i.cur,C:\\WINDOWS\\cursors\\pen_i.cur,C:\\WINDOWS\\cursors\\no_i.cur,C:\\WINDOWS\\cursors\\size4_i.cur,C:\\WINDOWS\\cursors\\size3_i.cur,C:\\WINDOWS\\cursors\\size2_i.cur,C:\\WINDOWS\\cursors\\size1_i.cur,C:\\WINDOWS\\cursors\\move_i.cur,C:\\WINDOWS\\cursors\\up_i.cur"),
  "windows-inverted-l": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_im.cur,C:\\WINDOWS\\cursors\\help_im.cur,C:\\WINDOWS\\cursors\\wait_im.cur,C:\\WINDOWS\\cursors\\busy_im.cur,C:\\WINDOWS\\cursors\\cross_im.cur,C:\\WINDOWS\\cursors\\beam_im.cur,C:\\WINDOWS\\cursors\\pen_im.cur,C:\\WINDOWS\\cursors\\no_im.cur,C:\\WINDOWS\\cursors\\size4_im.cur,C:\\WINDOWS\\cursors\\size3_im.cur,C:\\WINDOWS\\cursors\\size2_im.cur,C:\\WINDOWS\\cursors\\size1_im.cur,C:\\WINDOWS\\cursors\\move_im.cur,C:\\WINDOWS\\cursors\\up_im.cur"),
  "windows-inverted-xl": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_il.cur,C:\\WINDOWS\\cursors\\help_il.cur,C:\\WINDOWS\\cursors\\wait_il.cur,C:\\WINDOWS\\cursors\\busy_il.cur,C:\\WINDOWS\\cursors\\cross_il.cur,C:\\WINDOWS\\cursors\\beam_il.cur,C:\\WINDOWS\\cursors\\pen_il.cur,C:\\WINDOWS\\cursors\\no_il.cur,C:\\WINDOWS\\cursors\\size4_il.cur,C:\\WINDOWS\\cursors\\size3_il.cur,C:\\WINDOWS\\cursors\\size2_il.cur,C:\\WINDOWS\\cursors\\size1_il.cur,C:\\WINDOWS\\cursors\\move_il.cur,C:\\WINDOWS\\cursors\\up_il.cur"),
  "windows-standard-l": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_m.cur,C:\\WINDOWS\\cursors\\help_m.cur,C:\\WINDOWS\\cursors\\wait_m.cur,C:\\WINDOWS\\cursors\\busy_m.cur,C:\\WINDOWS\\cursors\\cross_m.cur,C:\\WINDOWS\\cursors\\beam_m.cur,C:\\WINDOWS\\cursors\\pen_m.cur,C:\\WINDOWS\\cursors\\no_m.cur,C:\\WINDOWS\\cursors\\size4_m.cur,C:\\WINDOWS\\cursors\\size3_m.cur,C:\\WINDOWS\\cursors\\size2_m.cur,C:\\WINDOWS\\cursors\\size1_m.cur,C:\\WINDOWS\\cursors\\move_m.cur,C:\\WINDOWS\\cursors\\up_m.cur"),
  "windows-standard-xl": parseRegistryScheme("C:\\WINDOWS\\cursors\\arrow_l.cur,C:\\WINDOWS\\cursors\\help_l.cur,C:\\WINDOWS\\cursors\\wait_l.cur,C:\\WINDOWS\\cursors\\busy_l.cur,C:\\WINDOWS\\cursors\\cross_l.cur,C:\\WINDOWS\\cursors\\beam_l.cur,C:\\WINDOWS\\cursors\\pen_l.cur,C:\\WINDOWS\\cursors\\no_l.cur,C:\\WINDOWS\\cursors\\size4_l.cur,C:\\WINDOWS\\cursors\\size3_l.cur,C:\\WINDOWS\\cursors\\size2_l.cur,C:\\WINDOWS\\cursors\\size1_l.cur,C:\\WINDOWS\\cursors\\move_l.cur,C:\\WINDOWS\\cursors\\up_l.cur"),
};

export function getSchemeFiles(schemeId: string, customSchemes: Record<string, Record<string, string>> = {}): Record<CursorRoleId, string> {
  if (schemeId === "none") {
    return SYSTEM_SCHEMES.windows as Record<CursorRoleId, string>;
  }
  if (customSchemes[schemeId]) {
    return { ...SYSTEM_SCHEMES.windows, ...customSchemes[schemeId] } as Record<CursorRoleId, string>;
  }
  const sys = SYSTEM_SCHEMES[schemeId] || {};
  return { ...SYSTEM_SCHEMES.windows, ...sys } as Record<CursorRoleId, string>;
}

interface CursorStoreState {
  schemeId: string;
  files: Record<CursorRoleId, string>;
  shadowEnabled: boolean;
  customSchemes: Record<string, Record<CursorRoleId, string>>;
  setScheme: (id: string) => void;
  setRoleFile: (role: CursorRoleId, file: string) => void;
  resetRoleFile: (role: CursorRoleId) => void;
  resetAll: () => void;
  setShadowEnabled: (enabled: boolean) => void;
  saveCustomScheme: (name: string, files: Record<CursorRoleId, string>) => void;
  deleteCustomScheme: (name: string) => void;
}

export const useCursorStore = create<CursorStoreState>()(
  persist(
    (set, get) => ({
      schemeId: "windows",
      files: SYSTEM_SCHEMES.windows as Record<CursorRoleId, string>,
      shadowEnabled: true,
      customSchemes: {},
      setScheme: (id) => {
        const files = getSchemeFiles(id, get().customSchemes);
        set({ schemeId: id, files });
      },
      setRoleFile: (role, file) =>
        set((s) => ({ files: { ...s.files, [role]: file } })),
      resetRoleFile: (role) =>
        set((s) => {
          const defaults = getSchemeFiles(s.schemeId, s.customSchemes);
          return { files: { ...s.files, [role]: defaults[role] } };
        }),
      resetAll: () =>
        set((s) => {
          const defaults = getSchemeFiles(s.schemeId, s.customSchemes);
          return { files: defaults };
        }),
      setShadowEnabled: (enabled) => set({ shadowEnabled: enabled }),
      saveCustomScheme: (name, files) =>
        set((s) => ({
          customSchemes: { ...s.customSchemes, [name]: files },
          schemeId: name,
        })),
      deleteCustomScheme: (name) =>
        set((s) => {
          const nextSchemes = { ...s.customSchemes };
          delete nextSchemes[name];
          return {
            customSchemes: nextSchemes,
            schemeId: "windows",
            files: SYSTEM_SCHEMES.windows as Record<CursorRoleId, string>,
          };
        }),
    }),
    { name: "rsnra95-cursors" },
  ),
);
