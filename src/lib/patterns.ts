/**
 * Classic Windows desktop patterns — the authentic 8×8 1-bit definitions from
 * Windows 95's CONTROL.INI [Patterns] section. Each entry is 8 bytes, one per
 * row; a set bit draws a black pixel over the desktop color.
 */
export const PATTERNS: Record<string, number[]> = {
  "Boxes": [127, 65, 65, 65, 65, 65, 127, 0],
  "Critters": [0, 80, 114, 32, 0, 5, 39, 2],
  "Diamonds": [32, 80, 136, 80, 32, 0, 0, 0],
  "Paisley": [2, 7, 7, 2, 32, 80, 80, 32],
  "Quilt": [130, 68, 40, 17, 40, 68, 130, 1],
  "Scottie": [64, 192, 200, 120, 120, 72, 0, 0],
  "Spinner": [20, 12, 200, 121, 158, 19, 48, 40],
  "Thatches": [248, 116, 34, 71, 143, 23, 34, 113],
  "Tulip": [0, 0, 84, 124, 124, 56, 146, 124],
  "Waffle": [0, 0, 0, 0, 128, 128, 128, 240],
  "Weave": [136, 84, 34, 69, 136, 21, 34, 81],
  "50% Gray": [170, 85, 170, 85, 170, 85, 170, 85],
};

export const PATTERN_NAMES = ["(None)", ...Object.keys(PATTERNS)];

const uriCache: Record<string, string> = {};

/**
 * Render a pattern to a tiny tileable data-URI (black pixels, transparent
 * background) for use as a repeating background-image layer.
 */
export function patternDataUri(name: string | null): string | null {
  if (!name || !PATTERNS[name]) return null;
  if (uriCache[name]) return uriCache[name];
  const rows = PATTERNS[name];
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((rows[y] >> (7 - x)) & 1) ctx.fillRect(x, y, 1, 1);
    }
  }
  uriCache[name] = canvas.toDataURL();
  return uriCache[name];
}
