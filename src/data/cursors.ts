import { getCachedHotspot, getResolvedCursorUrl } from "../lib/cursorManager";

const LIVE_DIR = "/cursors";
const PREVIEW_DIR = "/cursors";
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

export const CURSOR_ROLES: CursorRole[] = [
  { id: "normal", label: "Normal Select", file: "arrow_i.cur", cssCursor: "default" },
  { id: "help", label: "Help Select", file: "help_i.cur", cssCursor: "help" },
  { id: "workingInBackground", label: "Working In Background", file: "wait_i.cur", cssCursor: "progress" },
  { id: "busy", label: "Busy", file: "busy_i.cur", cssCursor: "wait" },
  { id: "precision", label: "Precision Select", file: "cross_i.cur", cssCursor: "crosshair" },
  { id: "text", label: "Text Select", file: "beam_i.cur", cssCursor: "text" },
  { id: "handwriting", label: "Handwriting", file: "pen_i.cur", cssCursor: "cell" },
  { id: "unavailable", label: "Unavailable", file: "no_i.cur", cssCursor: "not-allowed" },
  { id: "verticalResize", label: "Vertical Resize", file: "size4_i.cur", cssCursor: "ns-resize" },
  { id: "horizontalResize", label: "Horizontal Resize", file: "size3_i.cur", cssCursor: "ew-resize" },
  { id: "diagonalResize1", label: "Diagonal Resize 1", file: "size2_i.cur", cssCursor: "nwse-resize" },
  { id: "diagonalResize2", label: "Diagonal Resize 2", file: "size1_i.cur", cssCursor: "nesw-resize" },
  { id: "move", label: "Move", file: "move_i.cur", cssCursor: "move" },
  { id: "alternate", label: "Alternate Select", file: "up_i.cur", cssCursor: "default" },
  { id: "link", label: "Link Select", file: "link_i.cur", cssCursor: "pointer" },
];

export const CURSOR_ROLE_MAP: Record<CursorRoleId, CursorRole> = Object.fromEntries(
  CURSOR_ROLES.map((r) => [r.id, r]),
) as Record<CursorRoleId, CursorRole>;

export function cursorUrl(file: string): string {
  return getResolvedCursorUrl(file);
}

export function cursorPreviewUrl(file: string): string {
  return `${PREVIEW_DIR}/${file}`;
}

export function cursorCss(file: string, zoom = 1): string {
  const isAni = file.endsWith(".ani") || file.endsWith(".ANI");
  const [hx, hy] = getCachedHotspot(file);
  const compHx = hx / zoom;
  const compHy = hy / zoom;
  const hotspot = `${compHx} ${compHy}`;

  if (isAni) {
    const safeName = file.replace(/[^a-zA-Z0-9-]/g, "-");
    const varRef = `var(--cursor-anim-url-${safeName})`;
    if (zoom === 1) {
      return `${varRef} ${hotspot}`;
    }
    return `image-set(${varRef} ${zoom}x) ${hotspot}, ${varRef} ${hotspot}`;
  }

  if (zoom === 1) {
    return `url("${cursorUrl(file)}") ${hotspot}`;
  }
  return `image-set(url("${cursorUrl(file)}") ${zoom}x) ${hotspot}, url("${cursorUrl(file)}") ${hotspot}`;
}

export const CURSOR_GALLERY: string[] = [
  "default_arrow.cur",
  "default_busy.cur",
  "default_helpsel.cur",
  "default_ibeam.cur",
  "default_link.cur",
  "default_move.cur",
  "default_no.cur",
  "default_pen.cur",
  "default_size1.cur",
  "default_size2.cur",
  "default_size3.cur",
  "default_size4.cur",
  "default_up.cur",
  "default_wait.cur",
  "cross.cur",
  "appstart.ani",
  "hourglas.ani",
  "3dgarro.cur",
  "3dgbeam.cur",
  "3dgcross.cur",
  "3dghelpsel.cur",
  "3dglin1.ani",
  "3dglink.ani",
  "3dgmove.cur",
  "3dgmove_ani.ani",
  "3dgnesw.cur",
  "3dgnesw_ani.ani",
  "3dgno.cur",
  "3dgnodrop.cur",
  "3dgns.cur",
  "3dgns_ani.ani",
  "3dgnwse.cur",
  "3dgnwse_ani.ani",
  "3dgpen.cur",
  "3dgtwist.ani",
  "3dgup.ani",
  "3dgup_ani.ani",
  "3dgwagtail.ani",
  "3dgwe.cur",
  "3dgwe_ani.ani",
  "3dsarro.cur",
  "3dsbeam.cur",
  "3dscross.cur",
  "3dshelpsel.cur",
  "3dslin1.ani",
  "3dslink.ani",
  "3dsmove.cur",
  "3dsmove_ani.ani",
  "3dsnesw.cur",
  "3dsnesw_ani.ani",
  "3dsno.cur",
  "3dsnodrop.cur",
  "3dsns.cur",
  "3dsns_ani.ani",
  "3dsnwse.cur",
  "3dsnwse_ani.ani",
  "3dspen.cur",
  "3dstwist.ani",
  "3dsup.ani",
  "3dsup_ani.ani",
  "3dswagtail.ani",
  "3dswe.cur",
  "3dswe_ani.ani",
  "3dwarro.cur",
  "3dwbeam.cur",
  "3dwcross.cur",
  "3dwhelpsel.cur",
  "3dwlin1.ani",
  "3dwlink.ani",
  "3dwmove.cur",
  "3dwmove_ani.ani",
  "3dwnesw.cur",
  "3dwnesw_ani.ani",
  "3dwno.cur",
  "3dwnodrop.cur",
  "3dwns.cur",
  "3dwns_ani.ani",
  "3dwnwse.cur",
  "3dwnwse_ani.ani",
  "3dwpen.cur",
  "3dwtwist.ani",
  "3dwup.ani",
  "3dwup_ani.ani",
  "3dwwagtail.ani",
  "3dwwe.cur",
  "3dwwe_ani.ani",
  "banana.ani",
  "barber.ani",
  "coin.ani",
  "counter.ani",
  "dinosaur.ani",
  "dinosau2.ani",
  "drum.ani",
  "fillitup.ani",
  "hand.ani",
  "horse.ani",
  "metronom.ani",
  "piano.ani",
  "rainbow.ani",
  "raindrop.ani",
  "stopwtch.ani",
  "wagtail.ani",
  "vanisher.ani",
];
