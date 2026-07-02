import { useEffect } from "react";
import { createGlobalStyle } from "styled-components";
import { CURSOR_ROLE_MAP, cursorCss } from "../data/cursors";
import { installCursorDomPatcher, clearPatchedCursors } from "../lib/cursorDomPatcher";
import { useCursorStore } from "../store/cursorStore";

// Defines --cursor-<role> custom properties on :root plus a handful of
// static rules for the most common elements (fast path — applies before any
// hover event fires). Anything else (react95 internals, resize handles,
// whatever we didn't think to list) is caught live by cursorDomPatcher,
// which reads each hovered element's *computed* `cursor` keyword and swaps
// in `var(--cursor-<role>)` — the indirection through the CSS variable is
// what lets a scheme change (or switching to "(None)") retroactively fix
// every already-patched element without re-walking the DOM.
const StyledCursors = createGlobalStyle<{ $c: Record<string, string> }>`
  :root {
    ${({ $c }) => Object.entries($c).map(([role, css]) => `--cursor-${role}: ${css};`).join("\n    ")}
  }

  html, body {
    cursor: var(--cursor-normal), default;
  }

  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
  textarea,
  [contenteditable="true"] {
    cursor: var(--cursor-text), text !important;
  }

  button:not(:disabled):not([aria-disabled="true"]),
  a[href],
  [role="button"]:not([aria-disabled="true"]),
  [role="option"]:not([aria-disabled="true"]) {
    cursor: var(--cursor-link), pointer !important;
  }

  button:disabled,
  [aria-disabled="true"] {
    cursor: var(--cursor-unavailable), not-allowed !important;
  }
`;

/** Applies the user's selected Mouse Properties pointer scheme app-wide. */
export function CursorGlobalStyle() {
  const schemeId = useCursorStore((s) => s.schemeId);
  const files = useCursorStore((s) => s.files);

  useEffect(() => installCursorDomPatcher(), []);

  useEffect(() => {
    clearPatchedCursors();
  }, [schemeId, files]);

  if (schemeId === "none") return null;

  const vars = Object.fromEntries(
    Object.entries(files).map(([role, file]) => [role, cursorCss(file)]),
  );
  // Ensure every var referenced above always resolves, even if a role's
  // file were ever missing from `files`.
  for (const role of Object.keys(CURSOR_ROLE_MAP)) {
    const def = CURSOR_ROLE_MAP[role as keyof typeof CURSOR_ROLE_MAP];
    vars[role] ??= cursorCss(def.file);
  }

  return <StyledCursors $c={vars} />;
}
