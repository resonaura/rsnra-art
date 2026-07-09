import { showMissingFileAlert } from "../lib/systemDialogs";
import { openWebamp } from "../lib/webamp";
import type { VfsNode } from "../store/vfsStore";
import type { AppId } from "../types/window";
import { APPS, openApp } from "./apps";

const GENERIC_SHORTCUT_ICON = "/icons/shell32.dll/076.ico";

// The single shared representation of a .lnk shortcut — its JSON `content`,
// how to resolve its icon, and how to activate it. Desktop, the Start Menu
// Programs tree, and My Computer all read/execute shortcuts through this
// module so a shortcut behaves identically no matter where it's clicked.
export interface LnkData {
  type: "app" | "url" | "missing";
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
  if (lnk.icon) return lnk.icon;
  if (lnk.type === "app" && APPS[lnk.target as AppId]) {
    return APPS[lnk.target as AppId].icon;
  }
  return GENERIC_SHORTCUT_ICON;
}

export function openLnk(lnk: LnkData, label: string) {
  if (lnk.type === "missing") {
    showMissingFileAlert(label, lnk.file ?? `${label}.exe`);
    return;
  }
  if (lnk.type === "url") {
    window.open(lnk.target, "_blank", "noopener,noreferrer");
    return;
  }
  if (lnk.target === "winamp") {
    void openWebamp();
    return;
  }
  openApp(lnk.target as AppId, { title: lnk.title, data: lnk.data });
}
