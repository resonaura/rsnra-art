import { LIVE_CURSOR_PREFIX, type CursorRoleId, CURSOR_ROLE_MAP, cursorCss } from "../data/cursors";
import { useCursorStore } from "../store/cursorStore";

// Maps every native CSS cursor keyword we might see in `getComputedStyle`
// to the pointer-scheme role that should replace it. This is deliberately
// dynamic (found via the DOM, not a hand-maintained selector list) because
// react95 and friends set `cursor: pointer` (and resize/wait/etc keywords)
// all over the place via their own internal styled-components — a static
// `button, a, [role=button]` allowlist misses whatever we didn't think to
// list. Walking the actually-hovered element's *computed* cursor instead
// catches anything, however it got its cursor value.
const NATIVE_TO_ROLE: Partial<Record<string, CursorRoleId>> = {
  // Lots of components (DesktopIcon, the window header, ScrollArea's
  // buttons/thumb, disabled menu items…) explicitly set `cursor: default`
  // to opt out of inheriting a "text"/"pointer" cursor from an ancestor —
  // that beats our html/body rule (an explicit declaration always wins over
  // an inherited one), so without these two entries every such element fell
  // through to the browser's plain native arrow instead of ours.
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
};

const PATCHED_ATTR = "data-rsnra-cursor-patched";

function getCumulativeZoom(el: Element): number {
  let zoom = 1;
  let current: Element | null = el;
  while (current) {
    const style = getComputedStyle(current);
    const z = parseFloat(style.zoom);
    if (!isNaN(z) && z !== 0) {
      zoom *= z;
    }
    current = current.parentElement;
  }
  return zoom;
}

export function clearPatchedCursors() {
  const elements = document.querySelectorAll(`[${PATCHED_ATTR}]`);
  elements.forEach((el) => {
    el.removeAttribute(PATCHED_ATTR);
    (el as HTMLElement).style.removeProperty("cursor");
  });
}

function patch(el: Element) {
  if (el.hasAttribute(PATCHED_ATTR)) return;
  const computed = getComputedStyle(el).cursor;
  if (!computed) return;

  const { schemeId, files } = useCursorStore.getState();
  if (schemeId === "none") return;

  const zoom = getCumulativeZoom(el);
  if (computed.includes(LIVE_CURSOR_PREFIX) && Math.abs(zoom - 1) < 0.001) {
    // Already using our custom cursor at normal scale — skip
    el.setAttribute(PATCHED_ATTR, "1");
    return;
  }

  const fallback = computed.split(",").pop()?.trim();
  const role = fallback && NATIVE_TO_ROLE[fallback];
  if (!role) return;

  if (Math.abs(zoom - 1) < 0.001) {
    (el as HTMLElement).style.setProperty(
      "cursor",
      `var(--cursor-${role}), ${fallback}`,
      "important",
    );
  } else {
    const file = files[role] ?? CURSOR_ROLE_MAP[role].file;
    const cursorVal = `${cursorCss(file, zoom)}, ${fallback}`;
    (el as HTMLElement).style.setProperty("cursor", cursorVal, "important");
  }

  el.setAttribute(PATCHED_ATTR, "1");
}

function handlePointerOver(e: PointerEvent) {
  if (e.target instanceof Element) patch(e.target);
}

let refCount = 0;

/**
 * Watches the DOM for hovered elements using a plain native `cursor: pointer`
 * (or wait/text/*-resize/etc.) and swaps in the matching custom pointer-scheme
 * cursor via a `var(--cursor-<role>)` reference — live: if the CSS variable
 * later becomes unset (scheme switched to "(None)") or changes (a different
 * file/scheme picked), every already-patched element updates automatically
 * without re-walking the DOM, since it's a var() reference, not a frozen
 * literal `url(...)`.
 */
export function installCursorDomPatcher(): () => void {
  refCount += 1;
  if (refCount === 1) {
    document.addEventListener("pointerover", handlePointerOver, {
      capture: true,
      passive: true,
    });
  }
  return () => {
    refCount -= 1;
    if (refCount === 0) {
      document.removeEventListener("pointerover", handlePointerOver, {
        capture: true,
      });
    }
  };
}
