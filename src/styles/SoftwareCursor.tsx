/**
 * SoftwareCursor — replaces the native browser cursor with a DOM element
 * that tracks mouse position. This avoids the cursor-hotspot compensation
 * hack needed when `body zoom` is active, and lets Paint's custom cursors
 * work the same way (they just set a CSS cursor value; we read it and
 * render the matching image or .cur sprite as a positioned <img>).
 *
 * How it works:
 *   1. A dedicated <style> hides every native cursor (`cursor:none !important`).
 *   2. `document.elementFromPoint(x, y)` finds the hovered element.
 *   3. To learn which cursor the page *wanted* there, we briefly disable the
 *      hide-stylesheet and read `getComputedStyle(el).cursor` — with the sheet
 *      active it would always read "none". The read is cached per element so
 *      the double style invalidation only happens when the hovered element
 *      changes (or the cache entry goes stale).
 *   4. We map that to one of our cursor roles or extract a custom image URL.
 *   5. We render an `<img>` at (x - hotspotX, y - hotspotY) in a fixed overlay,
 *      dividing by the active `body zoom` (Display Properties ▸ Screen area) —
 *      the overlay lives inside the zoomed body, but mouse coordinates arrive
 *      in unzoomed viewport pixels.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CURSOR_ROLE_MAP, type CursorRoleId } from "../data/cursors";
import {
  getCachedHotspot,
  getResolvedCursorUrl,
  initActiveSchemeCursors,
  subscribeAniFrame,
} from "../lib/cursorManager";
import { useCursorStore } from "../store/cursorStore";
import { useDisplayStore } from "../store/displayStore";
import { useShallow } from "zustand/react/shallow";

// Re-read the underlying cursor of the same element after this long — cheap
// insurance for cursors that change in place (busy states, Paint tools).
const CURSOR_CACHE_TTL_MS = 150;

// ── CSS-cursor keyword → role mapping ──────────────────────────────────────────
const NATIVE_TO_ROLE: Partial<Record<string, CursorRoleId>> = {
  default: "normal",
  auto: "normal",
  pointer: "link",
  text: "text",
  wait: "busy",
  progress: "workingInBackground",
  help: "help",
  "not-allowed": "unavailable",
  move: "move",
  crosshair: "precision",
  cell: "handwriting",
  "ns-resize": "verticalResize",
  "row-resize": "verticalResize",
  "n-resize": "verticalResize",
  "s-resize": "verticalResize",
  "ew-resize": "horizontalResize",
  "col-resize": "horizontalResize",
  "e-resize": "horizontalResize",
  "w-resize": "horizontalResize",
  "nwse-resize": "diagonalResize1",
  "nw-resize": "diagonalResize1",
  "se-resize": "diagonalResize1",
  "nesw-resize": "diagonalResize2",
  "ne-resize": "diagonalResize2",
  "sw-resize": "diagonalResize2",
  "zoom-in": "precision",
  "zoom-out": "precision",
  grab: "move",
  grabbing: "move",
  copy: "link",
  alias: "link",
};

// ── Parse CSS cursor value → { url, hotX, hotY } or role ─────────────────────
interface CursorImage {
  kind: "image";
  url: string;
  hotX: number;
  hotY: number;
}
interface CursorRole {
  kind: "role";
  role: CursorRoleId;
}
interface CursorHidden {
  kind: "hidden";
}
type CursorInfo = CursorImage | CursorRole | CursorHidden;

function parseCursorValue(raw: string): CursorInfo {
  const parts = raw.split(",").map((s) => s.trim());

  // Try custom image first
  for (const part of parts) {
    const urlMatch = part.match(/url\("?([^")]+)"?\)\s*([\d.]+)?\s*([\d.]+)?/);
    if (urlMatch) {
      return {
        kind: "image",
        url: urlMatch[1],
        hotX: parseFloat(urlMatch[2] ?? "0") || 0,
        hotY: parseFloat(urlMatch[3] ?? "0") || 0,
      };
    }
  }

  // Fallback to keyword role
  const keyword = parts[parts.length - 1].trim();
  if (keyword === "none") return { kind: "hidden" };
  const role = NATIVE_TO_ROLE[keyword];
  return { kind: "role", role: role ?? "normal" };
}

// ── Main component ─────────────────────────────────────────────────────────────
interface CursorState {
  x: number;
  y: number;
  imgUrl: string;
  hotX: number;
  hotY: number;
  visible: boolean;
}

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  // The cursor must beat everything, including body-portaled menus/dropdowns
  // (z 999999+). Anything that should visually cover the cursor (screen
  // saver) does it by setting `cursor: none`, which hides the cursor instead.
  zIndex: 2147483647,
  overflow: "hidden",
};

export function SoftwareCursor() {
  const schemeId = useCursorStore((s) => s.schemeId);
  const files = useCursorStore(useShallow((s) => s.files));
  const shadowEnabled = useCursorStore((s) => s.shadowEnabled);
  const zoom = useDisplayStore((s) => s.zoom);

  const [state, setState] = useState<CursorState>({
    x: -100,
    y: -100,
    imgUrl: "",
    hotX: 0,
    hotY: 0,
    visible: false,
  });

  const filesRef = useRef(files);
  filesRef.current = files;

  // The hide-all-native-cursors stylesheet. Kept as a plain <style> element
  // (not styled-components) so updateCursor can flip `.disabled` to peek at
  // the cursor the page actually declared underneath.
  const hideStyleRef = useRef<HTMLStyleElement | null>(null);
  const cursorReadCache = useRef<{
    el: Element;
    value: string;
    t: number;
  } | null>(null);

  useEffect(() => {
    if (schemeId === "none") return;
    const styleEl = document.createElement("style");
    styleEl.textContent = "*, *::before, *::after { cursor: none !important; }";
    document.head.appendChild(styleEl);
    hideStyleRef.current = styleEl;
    return () => {
      styleEl.remove();
      hideStyleRef.current = null;
      cursorReadCache.current = null;
    };
  }, [schemeId]);

  // Initialise cursor files when scheme changes
  useEffect(() => {
    initActiveSchemeCursors(files, shadowEnabled);
  }, [schemeId, files, shadowEnabled]);

  // Resolve a role to {url, hotX, hotY, file}
  const resolveRole = useCallback(
    (role: CursorRoleId): { url: string; hotX: number; hotY: number; file: string } => {
      const file =
        filesRef.current[role] ??
        CURSOR_ROLE_MAP[role]?.file ??
        "arrow_i.cur";
      const [hx, hy] = getCachedHotspot(file);
      const url = getResolvedCursorUrl(file);
      return { url, hotX: hx, hotY: hy, file };
    },
    [],
  );

  // ── Main pointer-tracking logic ───────────────────────────────────────────
  useEffect(() => {
    let rafId: number | null = null;
    let lastX = -100;
    let lastY = -100;
    let pending = false;

    // Tracks the currently-subscribed .ani cursor role, so a running
    // animation keeps updating the rendered frame even while the mouse sits
    // still (an hourglass shouldn't freeze between pointer moves).
    let aniFile: string | null = null;
    let unsubscribeAni: (() => void) | null = null;
    const setAniFile = (file: string | null) => {
      if (file === aniFile) return;
      unsubscribeAni?.();
      unsubscribeAni = null;
      aniFile = file;
      if (file) {
        unsubscribeAni = subscribeAniFrame(file, (url) => {
          setState((s) => ({ ...s, imgUrl: url }));
        });
      }
    };

    // What cursor would this element have without our hide-stylesheet?
    // `cursor` is inherited, so one computed-style read on the hit element is
    // enough. Toggling the sheet invalidates styles document-wide, hence the
    // per-element cache.
    const readIntendedCursor = (el: Element): string => {
      const cached = cursorReadCache.current;
      const now = performance.now();
      if (cached && cached.el === el && now - cached.t < CURSOR_CACHE_TTL_MS) {
        return cached.value;
      }
      const styleEl = hideStyleRef.current;
      let value = "default";
      if (styleEl) {
        styleEl.disabled = true;
        value = getComputedStyle(el).cursor || "default";
        styleEl.disabled = false;
      }
      cursorReadCache.current = { el, value, t: now };
      return value;
    };

    const updateCursor = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return;

      const rawCursor = readIntendedCursor(el);

      const parsed = parseCursorValue(rawCursor);
      let imgUrl: string;
      let hotX: number;
      let hotY: number;

      if (parsed.kind === "hidden") {
        setState((s) => ({ ...s, x: clientX, y: clientY, visible: false }));
        return;
      }

      if (parsed.kind === "image") {
        imgUrl = parsed.url;
        hotX = parsed.hotX;
        hotY = parsed.hotY;
        setAniFile(null);
      } else {
        const resolved = resolveRole(parsed.role);
        imgUrl = resolved.url;
        hotX = resolved.hotX;
        hotY = resolved.hotY;
        setAniFile(resolved.file.endsWith(".ani") || resolved.file.endsWith(".ANI") ? resolved.file : null);
      }

      setState({ x: clientX, y: clientY, imgUrl, hotX, hotY, visible: true });
    };

    // Tracked via pointer events, not mousemove: several draggable controls
    // (sliders, scrollbars, Paint's canvas) call preventDefault() on their own
    // pointerdown to block text-selection/touch-scroll while dragging, which
    // per spec suppresses the browser's synthesized *mouse* compatibility
    // events (mousemove included) for the rest of that gesture — freezing this
    // cursor overlay mid-drag. pointermove isn't part of that suppression.
    const onPointerMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(() => {
          pending = false;
          updateCursor(lastX, lastY);
        });
      }
    };

    const onPointerLeave = () =>
      setState((s) => ({ ...s, visible: false }));
    const onPointerEnter = () =>
      setState((s) => ({ ...s, visible: true }));

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.documentElement.addEventListener("pointerenter", onPointerEnter);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.documentElement.removeEventListener("pointerenter", onPointerEnter);
      unsubscribeAni?.();
    };
  }, [resolveRole]);

  if (schemeId === "none") return null;

  // Mouse coordinates are unzoomed viewport px; the overlay renders inside the
  // zoomed <body>, so its coordinate space is scaled by `zoom`.
  const z = zoom || 1;

  return (
    <>
      <div style={OVERLAY_STYLE} aria-hidden>
        {state.visible && state.imgUrl && (
          <img
            src={state.imgUrl}
            alt=""
            style={{
              position: "absolute",
              left: state.x / z - state.hotX,
              top: state.y / z - state.hotY,
              pointerEvents: "none",
              imageRendering: "pixelated",
              userSelect: "none",
              display: "block",
            }}
            draggable={false}
          />
        )}
      </div>
    </>
  );
}
