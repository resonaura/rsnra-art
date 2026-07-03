/**
 * fileIcons.ts — Single source of truth for icon resolution.
 *
 * All icon decisions (Explorer, Start Menu, FileIcon component, RecycleBin,
 * FileDialog, …) flow through `iconForNode`. The priority chain mirrors real
 * Windows 95/98:
 *
 *  1. `.lnk` shortcut  → icon embedded in the shortcut JSON, or the target app icon
 *  2. Virtual / custom  → node.icon property (set on virtual nodes like Control Panel applets)
 *  3. Directory         → SPECIAL_FOLDER_ICONS by name, then generic folder icon
 *  4. Executable with a known appId → the app's own icon from APPS[]
 *  5. File extension    → EXT_ICONS table (see below)
 *  6. Unknown           → generic unknown-filetype icon
 *
 * ── HOW TO ADD A NEW FILE TYPE ───────────────────────────────────────────────
 * 1. Add the extension and icon path to EXT_ICONS below.
 *    Use the same icon as the associated app when possible — this is how real
 *    Windows 95 works (the file type icon comes from the registered app).
 * 2. If the file type should be openable, also add it to OPEN_WITH_CATALOG
 *    in fileOpen.ts. The two places are intentionally kept separate to avoid
 *    a circular module dependency (fileOpen → apps → components → fileIcons).
 *
 * ── HOW TO ADD A NAMED FOLDER ICON ──────────────────────────────────────────
 * Add an entry to SPECIAL_FOLDER_ICONS (key = lowercase folder name).
 */

import type { VfsNode } from "../store/vfsStore";
import { APPS } from "./apps";
import { lnkIcon, parseLnk } from "./shortcuts";

// ─── Extension → icon table ───────────────────────────────────────────────────
// Icons here should match the registered app's document icon where one exists.
// Keep sorted alphabetically for readability.
const EXT_ICONS: Readonly<Record<string, string>> = {
  // Text / documents (Notepad)
  txt:  "/icons/w98_file_lines.ico",
  log:  "/icons/w98_file_lines.ico",
  // Images (Paint)
  bmp:  "/icons/w98_paint.ico",
  png:  "/icons/w98_imagPNG.ico",
  jpg:  "/icons/w98_imagJPEG.ico",
  jpeg: "/icons/w98_imagJPEG.ico",
  gif:  "/icons/w98_imagGIF.ico",
  // Audio (Sound Recorder / Winamp)
  wav:  "/icons/w2k_wave_sound.ico",
  mp3:  "/icons/w98_cd_audio_cd.ico",
  mid:  "/icons/w2k_midi_sequence.ico",
  midi: "/icons/w2k_midi_sequence.ico",
  rmi:  "/icons/w2k_midi_sequence.ico",
  ogg:  "/icons/w98_cd_audio_cd.ico",
  // System / config
  ini:  "/icons/w2k_ini_&_inf.ico",
  inf:  "/icons/w2k_ini_&_inf.ico",
  sys:  "/icons/w2k_ini_&_inf.ico",
  reg:  "/icons/w2k_ini_&_inf.ico",
  dll:  "/icons/w2k_ini_&_inf.ico",
  // Executables
  exe:  "/icons/w98_executable.ico",
  com:  "/icons/w98_executable_script.ico",
  bat:  "/icons/w2k_ms-dos_batch_file.ico",
  // Help / docs
  hlp:  "/icons/w2k_help.ico",
  chm:  "/icons/w2k_help.ico",
  // Fonts
  fon:  "/icons/w2k_font_2.ico",
  ttf:  "/icons/w2k_font_2.ico",
  // Cursors
  cur:  "/icons/w98_mouse.ico",
  ani:  "/icons/w98_mouse.ico",
  // Shortcuts
  lnk:  "/icons/w2k_shortcut.ico",
  // Archives
  zip:  "/icons/w98_zip.ico",
  cab:  "/icons/w98_zip.ico",
  // WordPad / rich text
  doc:  "/icons/w98_wordpad.ico",
  rtf:  "/icons/w98_wordpad.ico",
};

// ─── Named folder icons ───────────────────────────────────────────────────────
// Key = lowercase folder name. Add entries here for well-known directories.
const SPECIAL_FOLDER_ICONS: Readonly<Record<string, string>> = {
  "windows":           "/icons/w2k_folder_open.ico",
  "program files":     "/icons/w98_directory_open.ico",
  "my documents":      "/icons/w2k_my_documents.ico",
  "my pictures":       "/icons/w98_directory_pictures.ico",
  "start menu":        "/icons/w2k_folder_open.ico",
  "programs":          "/icons/w2k-programs.ico",
  "accessories":       "/icons/w2k_folder_open.ico",
  "games":             "/icons/w98_joystick.ico",
  "desktop":           "/icons/w98_directory_open.ico",
  "recycled":          "/icons/w2k_recycle_bin_empty.ico",
  "temp":              "/icons/w2k_folder_open.ico",
  "system":            "/icons/w2k_folder_open.ico",
  "cursors":           "/icons/w98_mouse.ico",
  "media":             "/icons/w98_mixer_sound.ico",
  "fonts":             "/icons/w2k_font_2.ico",
  "help":              "/icons/w2k_help.ico",
  "winamp":            "/icons/WinAMP_7.ico",
  "rsnra":             "/icons/w98_cd_audio_cd.ico",
  "internet explorer": "/icons/w98_internet_options.ico",
  "command":           "/icons/w98_console_prompt.ico",
};

const FOLDER_DEFAULT = "/icons/w2k_folder_open.ico";
const FILE_DEFAULT   = "/icons/w2k_unknown_filetype.ico";

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Extract the lowercase extension from a filename (without the dot). */
export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Resolve the icon for a bare filename based on its extension.
 * Consults EXT_ICONS; falls back to the generic unknown-filetype icon.
 */
export function extIcon(name: string): string {
  const ext = extOf(name);
  return ext ? (EXT_ICONS[ext] ?? FILE_DEFAULT) : FILE_DEFAULT;
}

/**
 * Resolve the icon for a directory node.
 *
 * Priority:
 *   1. node.icon explicitly set (e.g. virtual game/applet nodes)
 *   2. SPECIAL_FOLDER_ICONS by name (case-insensitive)
 *   3. Generic folder icon
 */
export function dirIcon(node: VfsNode): string {
  if ((node as any).icon) return (node as any).icon;
  return SPECIAL_FOLDER_ICONS[node.name.toLowerCase()] ?? FOLDER_DEFAULT;
}

/**
 * The canonical icon resolver — use this everywhere in the codebase.
 *
 * Priority chain (mirrors Windows 95/98):
 *   1. `.lnk` shortcut file → icon from the shortcut JSON or target app
 *   2. node.icon override   → explicit icon (virtual / applet nodes)
 *   3. Directory            → dirIcon()
 *   4. Executable with appId → app's own icon from APPS[]
 *   5. Extension            → extIcon()
 */
export function iconForNode(node: VfsNode): string {
  // 1. Shortcut
  const lnk = parseLnk(node);
  if (lnk) return lnkIcon(lnk);

  // 2. Explicit icon override (virtual nodes like Control Panel applets / games)
  if ((node as any).icon) return (node as any).icon;

  // 3. Directory
  if (node.type === "dir") return dirIcon(node);

  // 4. Executable with a known app → use that app's icon
  if (node.appId && APPS[node.appId as keyof typeof APPS]) {
    return APPS[node.appId as keyof typeof APPS].icon;
  }

  // 5. Extension-based
  return extIcon(node.name);
}
