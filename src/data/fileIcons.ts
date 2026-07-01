import type { VfsNode } from "../store/vfsStore";
import { APPS } from "./apps";

// Map a file extension to its Win95-style icon. Drives/folders are handled by
// the caller; this is for files. Executables with an appId use the app icon.
const EXT_ICONS: Record<string, string> = {
  txt: "/icons/file-txt.png",
  log: "/icons/file-txt.png",
  ini: "/icons/file-ini.png",
  inf: "/icons/file-ini.png",
  hlp: "/icons/file-hlp.png",
  fon: "/icons/file-font.png",
  bmp: "/icons/file-bmp.png",
  png: "/icons/file-bmp.png",
  jpg: "/icons/file-img.png",
  jpeg: "/icons/file-img.png",
  gif: "/icons/file-img.png",
  bat: "/icons/file-bat.png",
  com: "/icons/msdos.png",
  dll: "/icons/file-dll.png",
  exe: "/icons/msdos.png",
  wav: "/icons/sound.png",
  mid: "/icons/sound.png",
  rmi: "/icons/sound.png",
};

const FOLDER_OPEN = "/icons/folder-open.png";
const DEFAULT_FILE = "/icons/file-txt.png";

export function extIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_ICONS[ext] ?? DEFAULT_FILE;
}

// Icon for any VFS node, used by Explorer / file dialogs / etc.
export function iconForNode(node: VfsNode): string {
  if (node.type === "dir") return FOLDER_OPEN;
  if (node.appId && APPS[node.appId as keyof typeof APPS]) {
    return APPS[node.appId as keyof typeof APPS].icon;
  }
  return extIcon(node.name);
}
