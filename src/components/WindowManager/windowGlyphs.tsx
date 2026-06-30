// Pixel-art window control glyphs (16x16 viewBox).
// Path data borrowed from a classic retro UI kit's picto set.

// Pixel-art window control glyphs (16x16 viewBox). Rendered at 1:1 (16px) so
// shapeRendering: crispEdges maps every path unit to exactly one device pixel —
// scaling to a non-integer size (e.g. 12px) fragments the close-X.
const GLYPH_PROPS = {
  viewBox: "0 0 16 16",
  width: 16,
  height: 16,
  "aria-hidden": true,
  shapeRendering: "crispEdges" as const,
};

export function MinimizeGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M4 10h6v2h-6z" fill="currentColor" />
    </svg>
  );
}

export function MaximizeGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M3 3h9v9h-9z M4 5v6h7v-6z" fill="currentColor" />
    </svg>
  );
}

export function RestoreGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path
        d="M5 3h6v6h-2v3h-6v-6h2z M6 5v1h3v2h1v-3z M4 8v3h4v-3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CloseGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path
        id="picto-close"
        d="M4 4h2v1h1v1h2v-1h1v-1h2v1h-1v1h-1v1h-1v1h1v1h1v1h1v1h-2v-1h-1v-1h-2v1h-1v1h-2v-1h1v-1h1v-1h1v-1h-1v-1h-1v-1h-1z"
      ></path>
    </svg>
  );
}
