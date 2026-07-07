/**
 * CursorGlobalStyle — initialises cursor image assets (prefetches .cur/.ani
 * blobs and hotspots) so SoftwareCursor can resolve URLs synchronously during
 * mouse events. Does NOT inject `cursor:` CSS variables or patch the DOM
 * (that was the old approach — SoftwareCursor now handles rendering directly).
 */
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCursorStore } from "../store/cursorStore";
import { initActiveSchemeCursors } from "../lib/cursorManager";

export function CursorGlobalStyle() {
  const schemeId = useCursorStore((s) => s.schemeId);
  const files = useCursorStore(useShallow((s) => s.files));
  const shadowEnabled = useCursorStore((s) => s.shadowEnabled);

  useEffect(() => {
    initActiveSchemeCursors(files, shadowEnabled);
  }, [schemeId, files, shadowEnabled]);

  return null;
}
