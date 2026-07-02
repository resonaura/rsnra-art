import { useEffect, useState } from "react";
import { createGlobalStyle } from "styled-components";
import { CURSOR_ROLE_MAP, cursorCss } from "../data/cursors";
import { installCursorDomPatcher, clearPatchedCursors } from "../lib/cursorDomPatcher";
import { useCursorStore } from "../store/cursorStore";
import { initActiveSchemeCursors } from "../lib/cursorManager";

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

export function CursorGlobalStyle() {
  const schemeId = useCursorStore((s) => s.schemeId);
  const files = useCursorStore((s) => s.files);
  const [ready, setReady] = useState(false);

  useEffect(() => installCursorDomPatcher(), []);

  useEffect(() => {
    setReady(false);
    initActiveSchemeCursors(files).then(() => {
      clearPatchedCursors();
      setReady(true);
    });
  }, [schemeId, files]);

  if (schemeId === "none" || !ready) return null;

  const vars = Object.fromEntries(
    Object.entries(files).map(([role, file]) => [role, cursorCss(file)]),
  );
  for (const role of Object.keys(CURSOR_ROLE_MAP)) {
    const def = CURSOR_ROLE_MAP[role as keyof typeof CURSOR_ROLE_MAP];
    vars[role] ??= cursorCss(def.file);
  }

  return <StyledCursors $c={vars} />;
}
