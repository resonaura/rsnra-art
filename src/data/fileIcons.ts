import type { VfsNode } from "../store/vfsStore";
import { APPS } from "./apps";

// Map a file extension to its Win95-style icon. Drives/folders are handled by
// the caller; this is for files. Executables with an appId use the app icon.
const EXT_ICONS: Record<string, string> = {
  txt: "/icons/w98_file_lines.ico",
  log: "/icons/w98_file_lines.ico",
  ini: "/icons/w2k_ini_&_inf.ico",
  inf: "/icons/w2k_ini_&_inf.ico",
  hlp: "/icons/w2k_help.ico",
  fon: "/icons/w2k_font_2.ico",
  bmp: "/icons/w98_imagOthe.ico",
  png: "/icons/w98_imagPNG.ico",
  jpg: "/icons/w98_imagJPEG.ico",
  jpeg: "/icons/w98_imagJPEG.ico",
  gif: "/icons/w98_imagGIF.ico",
  bat: "/icons/w2k_ms-dos_batch_file.ico",
  com: "/icons/w98_executable_script.ico",
  dll: "/icons/w2k_ini_&_inf.ico",
  exe: "/icons/w98_executable.ico",
  wav: "/icons/w2k_wave_sound.ico",
  mid: "/icons/w2k_midi_sequence.ico",
  rmi: "/icons/w2k_midi_sequence.ico",
};

const FOLDER_OPEN = "/icons/w2k_folder_open.ico";
const DEFAULT_FILE = "/icons/w2k_unknown_filetype";

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
