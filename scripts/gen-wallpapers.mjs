// Generates the default Windows-style wallpaper tiles as real .bmp files into
// public/windows/web/wallpaper/ — pixel-procedural recreations of the classic
// Windows 95/98/Me tile wallpapers (Black Thatch, Blue Rivets, Houndstooth,
// Gold Petals…). Run once: `node scripts/gen-wallpapers.mjs`; outputs are
// committed, the script only exists to regenerate/tweak them.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "windows",
  "web",
  "wallpaper",
);
mkdirSync(OUT, { recursive: true });

/** 24-bit uncompressed BMP from a per-pixel [r,g,b] function. */
function bmp(width, height, pixelFn) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const dataSize = rowSize * height;
  const buf = Buffer.alloc(54 + dataSize);
  buf.write("BM", 0);
  buf.writeUInt32LE(54 + dataSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      const off = 54 + (height - 1 - y) * rowSize + x * 3;
      buf[off] = b | 0;
      buf[off + 1] = g | 0;
      buf[off + 2] = r | 0;
    }
  }
  return buf;
}

/** Deterministic PRNG so regeneration is stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value-noise grid (bilinear-interpolated), tileable over size. */
function makeNoise(size, cells, seed) {
  const rnd = mulberry32(seed);
  const g = [];
  for (let i = 0; i < cells * cells; i++) g.push(rnd());
  const at = (cx, cy) => g[((cy % cells) + cells) % cells * cells + (((cx % cells) + cells) % cells)];
  return (x, y) => {
    const fx = (x / size) * cells;
    const fy = (y / size) * cells;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const s = (v) => v * v * (3 - 2 * v);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * s(tx) + (c - a) * s(ty) + (a - b - c + d) * s(tx) * s(ty);
  };
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const wallpapers = {};

// ── Black Thatch — black bg, gray diagonal thatch strokes ────────────────────
wallpapers["Black Thatch"] = (() => {
  const S = 32;
  const rnd = mulberry32(7);
  const strokes = [];
  for (let i = 0; i < 26; i++) {
    strokes.push({
      x: Math.floor(rnd() * S),
      y: Math.floor(rnd() * S),
      len: 4 + Math.floor(rnd() * 6),
      dir: rnd() > 0.5 ? 1 : -1,
      c: 70 + Math.floor(rnd() * 110),
    });
  }
  const grid = new Array(S * S).fill(0);
  for (const st of strokes) {
    for (let i = 0; i < st.len; i++) {
      const px = (((st.x + i) % S) + S) % S;
      const py = (((st.y + i * st.dir) % S) + S) % S;
      grid[py * S + px] = st.c;
      grid[py * S + ((px + 1) % S)] = Math.max(grid[py * S + ((px + 1) % S)], st.c - 40);
    }
  }
  return [S, (x, y) => {
    const v = grid[(y % S) * S + (x % S)];
    return [v, v, v];
  }];
})();

// ── Blue Rivets — steel-blue plate with a grid of rivet studs ────────────────
wallpapers["Blue Rivets"] = (() => {
  const S = 32;
  const base = [70, 90, 140];
  return [S, (x, y) => {
    const cx = (x % 16) - 8;
    const cy = (y % 16) - 8;
    const d = Math.sqrt(cx * cx + cy * cy);
    if (d < 3.4) {
      const lit = (-cx - cy) / 4.8; // light from top-left
      return mix(base, lit > 0 ? [190, 205, 235] : [30, 40, 75], Math.min(1, Math.abs(lit)));
    }
    if (d < 4.4) return [30, 40, 75];
    const n = ((x * 31 + y * 17) % 7) / 7;
    return mix(base, [90, 110, 160], n * 0.4);
  }];
})();

// ── Bubbles — deep teal water with glossy bubbles ────────────────────────────
wallpapers["Bubbles"] = (() => {
  const S = 96;
  const rnd = mulberry32(42);
  const bubbles = [];
  for (let i = 0; i < 14; i++) {
    bubbles.push({ x: rnd() * S, y: rnd() * S, r: 4 + rnd() * 12 });
  }
  const noise = makeNoise(S, 6, 5);
  return [S, (x, y) => {
    let col = mix([0, 60, 70], [0, 95, 105], noise(x, y));
    for (const b of bubbles) {
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S], [S, S], [-S, -S], [S, -S], [-S, S]]) {
        const dx = x - b.x - ox;
        const dy = y - b.y - oy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < b.r) {
          const edge = d / b.r;
          col = mix(col, [120, 210, 215], 0.25 + edge * edge * 0.55);
          const hx = dx + b.r * 0.4;
          const hy = dy + b.r * 0.4;
          const hd = Math.sqrt(hx * hx + hy * hy);
          if (hd < b.r * 0.3) col = mix(col, [235, 255, 255], 1 - hd / (b.r * 0.3));
        }
      }
    }
    return col;
  }];
})();

// ── Carved Stone — embossed gray stone ───────────────────────────────────────
wallpapers["Carved Stone"] = (() => {
  const S = 64;
  const noise = makeNoise(S, 8, 11);
  return [S, (x, y) => {
    const h = noise(x, y);
    const hx = noise(x + 1, y);
    const hy = noise(x, y + 1);
    const lit = (h - hx) * 4 + (h - hy) * 4;
    const v = 105 + lit * 160 + (h - 0.5) * 30;
    const c = Math.max(40, Math.min(190, v));
    return [c, c, c];
  }];
})();

// ── Circles — interlocking ring lattice on gray ──────────────────────────────
wallpapers["Circles"] = (() => {
  const S = 32;
  return [S, (x, y) => {
    const ring = (cx, cy) => {
      const dx = ((x - cx + S / 2 + S) % S) - S / 2;
      const dy = ((y - cy + S / 2 + S) % S) - S / 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      return Math.abs(d - 10) < 1.2;
    };
    if (ring(0, 0) || ring(16, 16)) return [245, 245, 245];
    if (ring(1, 1) || ring(17, 17)) return [90, 90, 90];
    return [170, 170, 170];
  }];
})();

// ── Houndstooth — the classic black/white check ──────────────────────────────
wallpapers["Houndstooth"] = (() => {
  // Authentic 8×8 1-bit houndstooth motif.
  const rows = [
    0b10001111,
    0b11000111,
    0b11100011,
    0b11110001,
    0b00011000,
    0b00001100,
    0b10000110,
    0b11000011,
  ];
  return [8, (x, y) => ((rows[y % 8] >> (7 - (x % 8))) & 1 ? [16, 16, 16] : [235, 235, 235])];
})();

// ── Diagonal Sand (Windows Me) — sandy grain with diagonal drift ─────────────
wallpapers["Diagonal Sand"] = (() => {
  const S = 96;
  const noise = makeNoise(S, 12, 21);
  const fine = makeNoise(S, 32, 22);
  return [S, (x, y) => {
    const diag = Math.sin(((x + y) / S) * Math.PI * 6) * 0.5 + 0.5;
    const t = noise(x, y) * 0.5 + fine(x, y) * 0.3 + diag * 0.2;
    return mix([176, 148, 108], [226, 206, 168], t);
  }];
})();

// ── Gold Petals (Windows Me) — golden weave with dark red petal knots ────────
wallpapers["Gold Petals"] = (() => {
  const S = 64;
  const noise = makeNoise(S, 10, 31);
  return [S, (x, y) => {
    const wx = Math.sin(((x * 2 + y) / S) * Math.PI * 4);
    const wy = Math.sin(((y * 2 - x) / S) * Math.PI * 4);
    let col = mix([148, 128, 42], [196, 172, 74], (wx * wy) * 0.5 + 0.5);
    col = mix(col, [230, 208, 120], noise(x, y) * 0.35);
    // petal knots at a sparse grid
    const kx = ((x % 32) + 32) % 32 - 16;
    const ky = ((y % 32) + 32) % 32 - 16;
    const kd = Math.sqrt(kx * kx * 1.6 + ky * ky);
    if (kd < 4.5) col = mix(col, [122, 26, 62], 1 - kd / 4.5);
    return col;
  }];
})();

// ── Iceberg (Windows Me) — pale ice with cracks ──────────────────────────────
wallpapers["Iceberg"] = (() => {
  const S = 96;
  const noise = makeNoise(S, 7, 51);
  const fine = makeNoise(S, 24, 52);
  return [S, (x, y) => {
    const t = noise(x, y) * 0.7 + fine(x, y) * 0.3;
    let col = mix([150, 185, 215], [235, 245, 252], t);
    const crack = Math.abs(Math.sin((x / S) * Math.PI * 3 + noise(y, x) * 5));
    if (crack < 0.04) col = mix(col, [90, 130, 175], 0.8);
    return col;
  }];
})();

// ── Ocean Wave (Windows Me) — layered teal sine waves ────────────────────────
wallpapers["Ocean Wave"] = (() => {
  const S = 96;
  const noise = makeNoise(S, 8, 61);
  return [S, (x, y) => {
    const w1 = Math.sin((x / S) * Math.PI * 4 + (y / S) * Math.PI * 2);
    const w2 = Math.sin((y / S) * Math.PI * 6 - (x / S) * Math.PI * 2 + 1.3);
    const t = (w1 * 0.4 + w2 * 0.3 + noise(x, y) * 0.6) * 0.5 + 0.35;
    return mix([10, 60, 90], [80, 170, 190], Math.max(0, Math.min(1, t)));
  }];
})();

// ── Pinstripe — subtle gray vertical stripes ─────────────────────────────────
wallpapers["Pinstripe"] = (() => {
  const S = 8;
  return [S, (x) => {
    const m = x % 4;
    if (m === 0) return [214, 214, 214];
    if (m === 1) return [190, 190, 190];
    return [200, 200, 200];
  }];
})();

// ── Straw Mat — woven tan bands ──────────────────────────────────────────────
wallpapers["Straw Mat"] = (() => {
  const S = 32;
  return [S, (x, y) => {
    const bx = Math.floor(x / 8) % 2;
    const by = Math.floor(y / 8) % 2;
    const horizontal = (bx + by) % 2 === 0;
    const ph = horizontal ? y % 8 : x % 8;
    const shade = ph === 0 || ph === 7 ? 0.15 : ph === 1 || ph === 6 ? 0.55 : 1;
    const grain = ((horizontal ? x : y) % 3) * 0.06;
    return mix([96, 70, 34], [204, 168, 104], shade - grain);
  }];
})();

// ── Tiles — glazed square tiles with grout ───────────────────────────────────
wallpapers["Tiles"] = (() => {
  const S = 32;
  const noise = makeNoise(S, 4, 71);
  return [S, (x, y) => {
    const mx = x % 16;
    const my = y % 16;
    if (mx === 0 || my === 0) return [120, 120, 130];
    if (mx === 1 || my === 1) return [235, 235, 240];
    const t = noise(x, y);
    return mix([155, 175, 200], [200, 215, 235], t + (mx + my) / 64);
  }];
})();

// ── Waves — classic teal ripple ──────────────────────────────────────────────
wallpapers["Waves"] = (() => {
  const S = 16;
  return [S, (x, y) => {
    const v = Math.sin(((x + ((y % 8) < 4 ? y : -y)) / 16) * Math.PI * 2);
    const on = Math.abs((y % 8) - 4 - Math.sin((x / 16) * Math.PI * 2) * 2) < 1;
    return on ? [0, 60, 60] : mix([0, 128, 128], [0, 110, 110], v * 0.5 + 0.5);
  }];
})();

// ── Santa Fe Stucco — warm plaster ───────────────────────────────────────────
wallpapers["Santa Fe Stucco"] = (() => {
  const S = 96;
  const noise = makeNoise(S, 9, 81);
  const fine = makeNoise(S, 28, 82);
  return [S, (x, y) => {
    const h = noise(x, y) * 0.6 + fine(x, y) * 0.4;
    const hx = noise(x + 1, y) * 0.6 + fine(x + 1, y) * 0.4;
    const lit = (h - hx) * 3;
    return mix([196, 162, 132], [238, 214, 186], Math.max(0, Math.min(1, h + lit)));
  }];
})();

for (const [name, [size, fn]] of Object.entries(wallpapers)) {
  const out = join(OUT, `${name}.bmp`);
  writeFileSync(out, bmp(size, size, (x, y) => fn(x, y).map((v) => Math.max(0, Math.min(255, v)))));
  console.log("wrote", out);
}
