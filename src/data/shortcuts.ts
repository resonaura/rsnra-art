import type { VfsNode } from "../store/vfsStore";
import type { AppId } from "../types/window";
import { APPS } from "./apps";

const GENERIC_SHORTCUT_ICON = "/icons/shell32.dll/076.ico";

// Shared representation of a .lnk shortcut and its icon. All activation goes
// through openVfsNode so Desktop, Explorer, Find, and Start use one dispatcher.
export interface LnkData {
  type: "app" | "url" | "file" | "missing";
  target: string; // AppId for "app", URL for "url", "" for "missing"
  icon?: string; // explicit override; else derived from APPS[target]
  shortcut?: boolean;
  title?: string; // optional openApp() title override
  data?: Record<string, unknown>; // optional openApp() data override
  file?: string; // .exe name shown by the "missing" alert
}

export function parseLnk(node: VfsNode): LnkData | null {
  if (!node.name.toLowerCase().endsWith(".lnk")) return null;
  try {
    return JSON.parse(node.content ?? "") as LnkData;
  } catch {
    return null;
  }
}

export function lnkIcon(lnk: LnkData): string {
  // Repair shortcuts persisted by an older build which referenced a PNG that
  // never existed. Keeping this alias here also fixes existing localStorage
  // installations without forcing users to reset their virtual disk.
  if (lnk.icon === "/icons/pinball.png") {
    return "/icons/pinball.exe/000.ico";
  }
  if (lnk.icon) return lnk.icon;
  if (lnk.type === "app" && APPS[lnk.target as AppId]) {
    return APPS[lnk.target as AppId].icon;
  }
  return GENERIC_SHORTCUT_ICON;
}
