import { useEffect } from "react";
import { FONT_SIZE_SCALE, useDisplayStore } from "../store/displayStore";
import { fontFamilyCss, useThemeStore, type AppearanceItemId } from "../store/themeStore";

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
  const fontSize = useDisplayStore((s) => s.fontSize);
  const smoothFonts = useDisplayStore((s) => s.smoothFonts);
  const transitionEffects = useDisplayStore((s) => s.transitionEffects);
  const colorDepth = useDisplayStore((s) => s.colorDepth);
  const itemFonts = useThemeStore((s) => s.itemFonts);
  const headerGradientEnd = useThemeStore((s) => s.headerGradientEnd);

  useEffect(() => {
    document.body.style.zoom = String(zoom);
    return () => {
      document.body.style.zoom = "";
    };
  }, [zoom]);

  // Font size scales *text only*, via the root font-size — react95's own
  // components already size their type in `rem`, so this alone rescales all
  // of them. It must stay independent of Screen area's `zoom`: zoom is a
  // real coordinate-space transform that SoftwareCursor divides pointer
  // coordinates by, so folding fontSize into that same zoom desynced the
  // cursor overlay (and hit-testing) from the actual rendered layout
  // whenever fontSize wasn't "normal".
  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZE_SCALE[fontSize] * 100}%`;
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [fontSize]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (key: AppearanceItemId) => {
      const font = itemFonts[key];
      if (font) {
        root.style.setProperty(`--rsnra-font-${key}-family`, fontFamilyCss(font.family));
        root.style.setProperty(`--rsnra-font-${key}-size`, `${font.size}px`);
        root.style.setProperty(`--rsnra-font-${key}-weight`, font.bold ? "bold" : "normal");
        root.style.setProperty(`--rsnra-font-${key}-style`, font.italic ? "italic" : "normal");
      } else {
        root.style.removeProperty(`--rsnra-font-${key}-family`);
        root.style.removeProperty(`--rsnra-font-${key}-size`);
        root.style.removeProperty(`--rsnra-font-${key}-weight`);
        root.style.removeProperty(`--rsnra-font-${key}-style`);
      }
    };
    apply("window");
    apply("menu");
    apply("msgbox");
  }, [itemFonts]);

  // Active Title Bar "Color 2": AppWindow always renders the active header as
  // a gradient from headerBackground to this var, falling back to
  // headerBackground itself when unset — so it reads as solid until a
  // second color is actually chosen.
  useEffect(() => {
    const root = document.documentElement;
    if (headerGradientEnd) {
      root.style.setProperty("--rsnra-header-gradient-end", headerGradientEnd);
    } else {
      root.style.removeProperty("--rsnra-header-gradient-end");
    }
  }, [headerGradientEnd]);

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
