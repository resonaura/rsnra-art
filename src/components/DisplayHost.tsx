import { useEffect } from "react";
import { useDisplayStore } from "../store/displayStore";

// feComponentTransfer tables emulating lower color depths (Settings ▸ Colors).
const DEPTH_TABLES: Record<number, string | null> = {
  32: null,
  16: "0 0.2 0.4 0.6 0.8 1", // High Color — barely-visible banding
  8: "0 0.14 0.29 0.43 0.57 0.71 0.86 1", // 256 Colors
  4: "0 0.33 0.67 1", // 16 Colors — heavy posterization
};

/**
 * Applies the "live" Display Properties state to the document: Screen area
 * (zoom on <body>), font smoothing, menu transition flag and the color-depth
 * posterization filter.
 */
export function DisplayHost() {
  const zoom = useDisplayStore((s) => s.zoom);
  const smoothFonts = useDisplayStore((s) => s.smoothFonts);
  const transitionEffects = useDisplayStore((s) => s.transitionEffects);
  const colorDepth = useDisplayStore((s) => s.colorDepth);

  useEffect(() => {
    document.body.style.zoom = String(zoom);
    return () => {
      document.body.style.zoom = "";
    };
  }, [zoom]);

  useEffect(() => {
    document.body.style.setProperty(
      "-webkit-font-smoothing",
      smoothFonts ? "antialiased" : "none",
    );
  }, [smoothFonts]);

  useEffect(() => {
    document.body.toggleAttribute("data-rsnra-transitions", transitionEffects);
  }, [transitionEffects]);

  useEffect(() => {
    const root = document.getElementById("rsnra-desktop-root");
    if (!root) return;
    root.style.filter = DEPTH_TABLES[colorDepth]
      ? "url(#rsnra-color-depth)"
      : "";
  }, [colorDepth]);

  const table = DEPTH_TABLES[colorDepth];
  if (!table) return null;

  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="rsnra-color-depth">
        <feComponentTransfer>
          <feFuncR type="discrete" tableValues={table} />
          <feFuncG type="discrete" tableValues={table} />
          <feFuncB type="discrete" tableValues={table} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
