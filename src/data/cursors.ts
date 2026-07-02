// Real Windows cursor assets (extracted from a Windows ME/XP-era .CUR pack —
// see public/cursors/ME/*.CUR). We re-author fresh .cur files rather than
// pointing CSS `cursor: url()` straight at the source files, for two reasons:
//  - Classic Windows cursors use a screen-invert trick (AND-mask=1 with a
//    non-black XOR color) for parts of their fill; browsers don't implement
//    that compositing mode for CSS cursors, so those pixels render as holes.
//    scripts/extract_cursor_previews.py bakes invert into opaque color.
//  - Browsers draw cursor images at their native pixel size in CSS px, so
//    the source 32x32 bitmaps look ~2x too big next to a real OS pointer;
//    the "live" set is re-authored at 16x16 with a matching native hotspot.
//
// The source pack's filenames don't reliably match their contents (a lot of
// files were mislabeled during extraction — e.g. some "WAIT_*" files are
// actually resize arrows). Each entry below was picked by rendering every
// candidate file to PNG and visually matching it to its real role.

import { CURSOR_HOTSPOTS } from "./cursorHotspots.generated";

const LIVE_DIR = "/cursors/ME-live";
const PREVIEW_DIR = "/cursors/ME-preview";
/** Substring unique to our own cursor URLs — cursorDomPatcher uses this to
 *  recognize an element that's already been customized (by a static CSS
 *  rule or a previous patch) and skip re-patching it. */
export const LIVE_CURSOR_PREFIX = LIVE_DIR;

export type CursorRoleId =
  | "normal"
  | "link"
  | "text"
  | "handwriting"
  | "precision"
  | "unavailable"
  | "move"
  | "alternate"
  | "help"
  | "workingInBackground"
  | "busy"
  | "verticalResize"
  | "horizontalResize"
  | "diagonalResize1"
  | "diagonalResize2";

export interface CursorRole {
  id: CursorRoleId;
  label: string;
  file: string;
  cssCursor: string;
}

// cssCursor is the standard fallback keyword used after the url(), matching
// the DIB/behavioral role in normal CSS terms.
export const CURSOR_ROLES: CursorRole[] = [
  { id: "normal", label: "Normal Select", file: "ARROW_IM.CUR", cssCursor: "default" },
  { id: "help", label: "Help Select", file: "MOVE_IM.CUR", cssCursor: "help" },
  {
    id: "workingInBackground",
    label: "Working In Background",
    file: "CROSS_RL.CUR",
    cssCursor: "progress",
  },
  { id: "busy", label: "Busy", file: "CROSS_RM.CUR", cssCursor: "wait" },
  { id: "precision", label: "Precision Select", file: "HELP_IL.CUR", cssCursor: "crosshair" },
  { id: "text", label: "Text Select", file: "BUSY_RM.CUR", cssCursor: "text" },
  { id: "handwriting", label: "Handwriting", file: "SIZE2_RL.CUR", cssCursor: "cell" },
  { id: "unavailable", label: "Unavailable", file: "SIZE2_IL.CUR", cssCursor: "not-allowed" },
  { id: "verticalResize", label: "Vertical Resize", file: "WAIT_M.CUR", cssCursor: "ns-resize" },
  {
    id: "horizontalResize",
    label: "Horizontal Resize",
    file: "WAIT_IM.CUR",
    cssCursor: "ew-resize",
  },
  {
    id: "diagonalResize1",
    label: "Diagonal Resize 1",
    file: "SIZE4_M.CUR",
    cssCursor: "nwse-resize",
  },
  {
    id: "diagonalResize2",
    label: "Diagonal Resize 2",
    file: "SIZE4_RL.CUR",
    cssCursor: "nesw-resize",
  },
  { id: "move", label: "Move", file: "PEN_L.CUR", cssCursor: "move" },
  { id: "alternate", label: "Alternate Select", file: "ARROW_IL.CUR", cssCursor: "default" },
  { id: "link", label: "Link Select", file: "HELP_RM.CUR", cssCursor: "pointer" },
];

export const CURSOR_ROLE_MAP: Record<CursorRoleId, CursorRole> = Object.fromEntries(
  CURSOR_ROLES.map((r) => [r.id, r]),
) as Record<CursorRoleId, CursorRole>;

/** The 16x16 native .cur used for the actual `cursor: url()` — a freshly
 *  authored file (not a raw copy of the source), with invert-trick fill
 *  baked to opaque color and a native embedded hotspot (see header comment
 *  in scripts/extract_cursor_previews.py). */
export function cursorUrl(file: string): string {
  return `${LIVE_DIR}/${file}`;
}

/** 32x32 native-resolution companion of cursorUrl(), for the `2x` branch of
 *  `cursor: image-set(...)` — lets a HiDPI display show a crisp native
 *  bitmap instead of upscaling (and blurring) the 16x16 one. */
export function cursorUrl2x(file: string): string {
  return `${LIVE_DIR}/${file.replace(/\.CUR$/i, "@2x.CUR")}`;
}

/** CSS hotspot `x y` fallback for engines that ignore a .cur's native
 *  hotspot (the file itself already carries the same coordinates). Used
 *  once for the whole image-set() — hotspot is in logical (1x) px. */
export function cursorHotspot(file: string): string {
  const [x, y] = CURSOR_HOTSPOTS[file] ?? [0, 0];
  return `${x} ${y}`;
}

/** Full `cursor:` value (sans trailing keyword fallback) for one role's
 *  file: `image-set()` first for a crisp native-res asset on HiDPI, then a
 *  plain single-res `url()` behind it for engines that don't recognize
 *  image-set() in `cursor` at all — `cursor` tries comma-separated image
 *  candidates in order and skips ones it can't use (the same mechanism
 *  that makes `url(...) x y, auto` degrade gracefully on a 404), so no
 *  vendor-prefix/feature-detection dance is needed. */
export function cursorCss(file: string, zoom = 1): string {
  const [hx, hy] = CURSOR_HOTSPOTS[file] ?? [0, 0];
  const compHx = hx / zoom;
  const compHy = hy / zoom;
  const hotspot = `${compHx} ${compHy}`;
  if (zoom === 1) {
    return [
      `image-set(url("${cursorUrl(file)}") 1x, url("${cursorUrl2x(file)}") 2x) ${hotspot}`,
      `url("${cursorUrl(file)}") ${hotspot}`,
    ].join(", ");
  }
  return [
    `image-set(url("${cursorUrl(file)}") ${zoom}x, url("${cursorUrl2x(file)}") ${zoom * 2}x) ${hotspot}`,
    `url("${cursorUrl(file)}") ${hotspot}`,
  ].join(", ");
}

/** 32x32 PNG for <img> thumbnails in the Mouse Properties picker UI. */
export function cursorPreviewUrl(file: string): string {
  return `${PREVIEW_DIR}/${file.replace(/\.CUR$/i, ".png")}`;
}

// Every valid, individually-selectable cursor file in the pack (for the
// Pointers tab's "Browse..." picker) — every image renders correctly on its
// own even where the filename doesn't match the pack's original intent.
export const CURSOR_GALLERY: string[] = [
  "ARROW_IL.CUR",
  "ARROW_IM.CUR",
  "BEAM_RL.CUR",
  "BEAM_RM.CUR",
  "BUSY_IM.CUR",
  "BUSY_L.CUR",
  "BUSY_M.CUR",
  "BUSY_RM.CUR",
  "CROSS_I.CUR",
  "CROSS_IL.CUR",
  "CROSS_L.CUR",
  "CROSS_M.CUR",
  "CROSS_RL.CUR",
  "CROSS_RM.CUR",
  "HAND-IL.CUR",
  "HAND-RL.CUR",
  "HELP_IL.CUR",
  "HELP_RL.CUR",
  "HELP_RM.CUR",
  "MOVE_I.CUR",
  "MOVE_IL.CUR",
  "MOVE_IM.CUR",
  "MOVE_L.CUR",
  "MOVE_RL.CUR",
  "MOVE_RM.CUR",
  "NO_IL.CUR",
  "PEN_IL.CUR",
  "PEN_IM.CUR",
  "PEN_L.CUR",
  "PEN_M.CUR",
  "PEN_RM.CUR",
  "SIZE1_IL.CUR",
  "SIZE1_IM.CUR",
  "SIZE1_L.CUR",
  "SIZE1_M.CUR",
  "SIZE1_RL.CUR",
  "SIZE2_I.CUR",
  "SIZE2_IL.CUR",
  "SIZE2_IM.CUR",
  "SIZE2_L.CUR",
  "SIZE2_M.CUR",
  "SIZE2_RL.CUR",
  "SIZE2_RM.CUR",
  "SIZE3_IL.CUR",
  "SIZE3_IM.CUR",
  "SIZE3_L.CUR",
  "SIZE3_M.CUR",
  "SIZE3_RL.CUR",
  "SIZE3_RM.CUR",
  "SIZE4_IM.CUR",
  "SIZE4_L.CUR",
  "SIZE4_M.CUR",
  "SIZE4_R.CUR",
  "SIZE4_RL.CUR",
  "SIZE4_RM.CUR",
  "UP_L.CUR",
  "UP_M.CUR",
  "UP_RL.CUR",
  "WAIT_IM.CUR",
  "WAIT_L.CUR",
  "WAIT_M.CUR",
  "WAIT_RL.CUR",
  "WAIT_RM.CUR",
];
