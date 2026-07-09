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
  txt: "/icons/w98_file_lines.ico",
  log: "/icons/w98_file_lines.ico",
  // Images (Paint)
  bmp: "/icons/w98_paint.ico",
  png: "/icons/w98_imagPNG.ico",
  jpg: "/icons/w98_imagJPEG.ico",
  jpeg: "/icons/w98_imagJPEG.ico",
  gif: "/icons/w98_imagGIF.ico",
  // Audio (Sound Recorder / Winamp)
  wav: "/icons/w2k_wave_sound.ico",
  mp3: "/icons/w98_cd_audio_cd.ico",
  mid: "/icons/w2k_midi_sequence.ico",
  midi: "/icons/w2k_midi_sequence.ico",
  rmi: "/icons/w2k_midi_sequence.ico",
  ogg: "/icons/w98_cd_audio_cd.ico",
  // System / config
  ini: "/icons/w2k_ini_&_inf.ico",
  inf: "/icons/w2k_ini_&_inf.ico",
  sys: "/icons/w2k_ini_&_inf.ico",
  reg: "/icons/w2k_ini_&_inf.ico",
  dll: "/icons/w2k_ini_&_inf.ico",
  // Executables
  exe: "/icons/w98_executable.ico",
  com: "/icons/w98_executable_script.ico",
  bat: "/icons/w2k_ms-dos_batch_file.ico",
  // Help / docs
  hlp: "/icons/w2k_help.ico",
  chm: "/icons/w2k_help.ico",
  // Fonts
  fon: "/icons/w2k_font_2.ico",
  ttf: "/icons/w2k_font_2.ico",
  // Cursors
  cur: "/icons/w98_mouse.ico",
  ani: "/icons/w98_mouse.ico",
  // Shortcuts
  lnk: "/icons/w2k_shortcut.ico",
  // Archives
  zip: "/icons/w98_zip.ico",
  cab: "/icons/w98_zip.ico",
  // WordPad / rich text
  doc: "/icons/w98_wordpad.ico",
  rtf: "/icons/w98_wordpad.ico",
};

// ─── Extension → descriptive type name ────────────────────────────────────────
// Powers the File Types manager (Folder Options ▸ File Types) and Explorer's
// "Type" column. Keep in sync with EXT_ICONS above.
const EXT_TYPE_LABELS: Readonly<Record<string, string>> = {
  txt: "Text Document",
  log: "Text Document",
  bmp: "Bitmap Image",
  png: "Portable Network Graphic",
  jpg: "JPEG Image",
  jpeg: "JPEG Image",
  gif: "GIF Image",
  wav: "Wave Sound",
  mp3: "MP3 Audio",
  mid: "MIDI Sequence",
  midi: "MIDI Sequence",
  rmi: "MIDI Sequence",
  ogg: "OGG Audio",
  ini: "Configuration Settings",
  inf: "Setup Information",
  sys: "System File",
  reg: "Registration Entries",
  dll: "Application Extension",
  exe: "Application",
  com: "MS-DOS Application",
  bat: "MS-DOS Batch File",
  hlp: "Help File",
  chm: "Compiled HTML Help",
  fon: "Font File",
  ttf: "TrueType Font File",
  cur: "Cursor",
  ani: "Animated Cursor",
  lnk: "Shortcut",
  zip: "Compressed (zipped) Folder",
  cab: "Cabinet File",
  doc: "WordPad Document",
  rtf: "Rich Text Document",
};

/** Descriptive type name for a bare extension (no dot), for the File Types manager. */
export function typeLabelForExtension(ext: string): string {
  const lower = ext.toLowerCase();
  return EXT_TYPE_LABELS[lower] ?? `${lower.toUpperCase()} File`;
}

/** All extensions with a built-in icon + type registration. */
export const KNOWN_EXTENSIONS: readonly string[] = Object.keys(EXT_ICONS);

/**
 * Curated icon pool for the "Change Icon" picker — every built-in file-type
 * icon plus every app's own icon (our stand-in for browsing a real .exe's
 * embedded icon resources, since nothing here is an actual binary).
 */
export function iconPickerPool(): string[] {
  const pool = new Set<string>([
    ...Object.values(EXT_ICONS),
    ...Object.values(APPS).map((a) => a.icon),
    FILE_DEFAULT,
  ]);
  return Array.from(pool);
}

// ─── Named folder icons ───────────────────────────────────────────────────────
// Key = lowercase folder name. Add entries here for well-known directories.
const SPECIAL_FOLDER_ICONS: Readonly<Record<string, string>> = {
  windows: "/icons/explorer.exe/095.ico",
  "program files": "/icons/explorer.exe/095.ico",
  "my documents": "/icons/explorer.exe/011.ico",
  "my pictures": "/icons/explorer.exe/012.ico",
  "start menu": "/icons/shell32.dll/095.ico",
  programs: "/icons/shell32.dll/083.ico",
  accessories: "/icons/shell32.dll/095.ico",
  games: "/icons/games/000.ico",
  desktop: "/icons/shell32.dll/095.ico",
  recycled: "/icons/shell32.dll/078.ico",
  temp: "/icons/shell32.dll/095.ico",
  system: "/icons/shell32.dll/095.ico",
  cursors: "/icons/mouse.cpl/000.ico",
  media: "/icons/sndrec32.dll/001.ico",
  fonts: "/icons/shell32.dll/027.ico",
  help: "/icons/shell32.dll/069.ico",
  winamp: "/icons/winamp.exe/000.ico",
  rsnra: "/icons/shell32.dll/088.ico",
  "internet explorer": "/icons/shell32.dll/098.ico",
  command: "/icons/cmd.exe/000.ico",
};

const FOLDER_DEFAULT = "/icons/shell32.dll/086.ico";
const FILE_DEFAULT = "/icons/shell32.dll/000.ico";

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Extract the lowercase extension from a filename (without the dot). */
export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Resolve the icon for a bare filename based on its extension.
 * Consults `overrides` (the user's Folder Options ▸ File Types customizations)
 * first, then EXT_ICONS; falls back to the generic unknown-filetype icon.
 */
export function extIcon(
  name: string,
  overrides?: Record<string, string>,
): string {
  const ext = extOf(name);
  if (!ext) return FILE_DEFAULT;
  return overrides?.[ext] ?? EXT_ICONS[ext] ?? FILE_DEFAULT;
}

/** Is this a "known" file type — i.e. one with a registered EXT_ICONS entry? */
export function isKnownExtension(name: string): boolean {
  const ext = extOf(name);
  return ext !== "" && ext in EXT_ICONS;
}

/**
 * Filename as it should be displayed given the "Hide extensions for known
 * file types" preference — strips the extension only when it's registered
 * in EXT_ICONS, matching real Explorer behavior (unrecognized extensions
 * always stay visible).
 */
export function displayName(
  name: string,
  hideKnownExtensions: boolean,
): string {
  if (!hideKnownExtensions || !isKnownExtension(name)) return name;
  return name.slice(0, name.lastIndexOf("."));
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
 *
 * @param extensionIconOverrides per-extension icon overrides from Folder
 * Options ▸ File Types ▸ Change Icon (`useFilePrefsStore.extensionIcons`).
 * Pass this from components that need to react to the user customizing a
 * type's icon; omit it for one-off/non-reactive lookups.
 */
export function iconForNode(
  node: VfsNode,
  extensionIconOverrides?: Record<string, string>,
): string {
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
  return extIcon(node.name, extensionIconOverrides);
}
