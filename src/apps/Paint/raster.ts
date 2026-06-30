// Pure pixel-plotting helpers. Everything here calls `plot(x, y)` for each
// covered pixel instead of touching a canvas directly, so the caller decides
// how to commit (fillRect, ImageData, etc).

export type Plot = (x: number, y: number) => void;
export type SpanPlot = (x0: number, x1: number, y: number) => void;

export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plot: Plot,
) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    plot(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function stampSquare(cx: number, cy: number, size: number, plot: Plot) {
  const half = Math.max(1, Math.round(size)) / 2;
  const x0 = Math.round(cx - half);
  const y0 = Math.round(cy - half);
  const x1 = Math.round(cx + half);
  const y1 = Math.round(cy + half);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) plot(x, y);
  }
}

export function stampCircle(
  cx: number,
  cy: number,
  radius: number,
  plot: Plot,
) {
  const r = Math.max(0.5, radius);
  const r2 = r * r;
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) plot(x, y);
    }
  }
}

// Diagonal brush stamps (classic MS Paint brush shapes). A diagonal brush is a
// thick line segment drawn across its size x size cell, centered on (cx, cy).
function stampDiagonal(
  cx: number,
  cy: number,
  size: number,
  plot: Plot,
  reverse: boolean,
) {
  const half = Math.max(1, Math.round(size)) / 2;
  const steps = Math.max(1, Math.round(size * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = cx - half + size * t;
    const b = cy - half + (reverse ? size * (1 - t) : size * t);
    // stamp a small square at each point along the diagonal
    stampSquare(a, b, Math.max(1, size * 0.5), plot);
  }
}

export function stampBrush(
  cx: number,
  cy: number,
  size: number,
  shape: BrushShape,
  plot: Plot,
) {
  if (shape === "circle") stampCircle(cx, cy, size / 2, plot);
  else if (shape === "square") stampSquare(cx, cy, size, plot);
  else if (shape === "diagonal") stampDiagonal(cx, cy, size, plot, false);
  else stampDiagonal(cx, cy, size, plot, true);
}

export type BrushShape = "circle" | "square" | "diagonal" | "reverse_diagonal";

export function strokeThickLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
  shape: BrushShape,
  plot: Plot,
) {
  if (thickness <= 1 && (shape === "circle" || shape === "square")) {
    bresenhamLine(x0, y0, x1, y1, plot);
    return;
  }
  const dist = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  const steps = Math.ceil(dist);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stampBrush(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness, shape, plot);
  }
}

export function strokePolyline(
  points: [number, number][],
  thickness: number,
  shape: BrushShape,
  plot: Plot,
) {
  if (points.length === 1) {
    const [x, y] = points[0];
    stampBrush(x, y, thickness, shape, plot);
    return;
  }
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    strokeThickLine(x0, y0, x1, y1, thickness, shape, plot);
  }
}

export function strokeBezier(
  p0: [number, number],
  c1: [number, number],
  c2: [number, number],
  p1: [number, number],
  thickness: number,
  plot: Plot,
) {
  const steps = 64;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0[0] +
      3 * mt * mt * t * c1[0] +
      3 * mt * t * t * c2[0] +
      t * t * t * p1[0];
    const y =
      mt * mt * mt * p0[1] +
      3 * mt * mt * t * c1[1] +
      3 * mt * t * t * c2[1] +
      t * t * t * p1[1];
    strokeThickLine(prev[0], prev[1], x, y, thickness, "circle", plot);
    prev = [x, y];
  }
}

export type ShapeMode = "outline" | "outline-fill" | "fill";

export function ellipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mode: ShapeMode,
  thickness: number,
  outlinePlot: Plot,
  fillSpan: SpanPlot,
) {
  rx = Math.max(rx, 0.5);
  ry = Math.max(ry, 0.5);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);

  if (mode !== "outline") {
    for (let y = y0; y <= y1; y++) {
      const t = (y + 0.5 - cy) / ry;
      const k = 1 - t * t;
      if (k < 0) continue;
      const dx = rx * Math.sqrt(k);
      fillSpan(Math.round(cx - dx), Math.round(cx + dx), y);
    }
  }

  if (mode === "fill") return;

  // Outline: row-based left/right edge points + column-based top/bottom
  // edge points, combined, so there are no gaps near the poles.
  for (let y = y0; y <= y1; y++) {
    const t = (y + 0.5 - cy) / ry;
    const k = 1 - t * t;
    if (k < 0) continue;
    const dx = rx * Math.sqrt(k);
    strokeThickLine(cx - dx, y, cx - dx, y, thickness, "square", outlinePlot);
    strokeThickLine(cx + dx, y, cx + dx, y, thickness, "square", outlinePlot);
  }
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  for (let x = x0; x <= x1; x++) {
    const t = (x + 0.5 - cx) / rx;
    const k = 1 - t * t;
    if (k < 0) continue;
    const dy = ry * Math.sqrt(k);
    strokeThickLine(x, cy - dy, x, cy - dy, thickness, "square", outlinePlot);
    strokeThickLine(x, cy + dy, x, cy + dy, thickness, "square", outlinePlot);
  }
}

export function rectPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  mode: ShapeMode,
  thickness: number,
  outlinePlot: Plot,
  fillSpan: SpanPlot,
) {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);

  if (mode !== "outline") {
    for (let y = top; y <= bottom; y++) fillSpan(left, right, y);
  }
  if (mode === "fill") return;

  for (let t = 0; t < thickness; t++) {
    strokePolyline(
      [
        [left, top + t],
        [right, top + t],
      ],
      1,
      "square",
      outlinePlot,
    );
    strokePolyline(
      [
        [left, bottom - t],
        [right, bottom - t],
      ],
      1,
      "square",
      outlinePlot,
    );
    strokePolyline(
      [
        [left + t, top],
        [left + t, bottom],
      ],
      1,
      "square",
      outlinePlot,
    );
    strokePolyline(
      [
        [right - t, top],
        [right - t, bottom],
      ],
      1,
      "square",
      outlinePlot,
    );
  }
}

export function roundRectPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radiusIn: number,
  mode: ShapeMode,
  thickness: number,
  outlinePlot: Plot,
  fillSpan: SpanPlot,
) {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const radius = Math.max(
    0,
    Math.min(radiusIn, (right - left) / 2, (bottom - top) / 2),
  );

  if (mode !== "outline") {
    for (let y = top; y <= bottom; y++) {
      let l = left;
      let r = right;
      if (y < top + radius || y > bottom - radius) {
        const dy = y < top + radius ? top + radius - y : y - (bottom - radius);
        const k = radius * radius - dy * dy;
        const dx = k > 0 ? radius - Math.sqrt(k) : radius;
        l = left + dx;
        r = right - dx;
      }
      fillSpan(Math.round(l), Math.round(r), y);
    }
  }
  if (mode === "fill") return;

  const pts: [number, number][] = [];
  const steps = 16;
  const corner = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
  };
  pts.push([left + radius, top]);
  pts.push([right - radius, top]);
  corner(right - radius, top + radius, -Math.PI / 2, 0);
  pts.push([right, bottom - radius]);
  corner(right - radius, bottom - radius, 0, Math.PI / 2);
  pts.push([left + radius, bottom]);
  corner(left + radius, bottom - radius, Math.PI / 2, Math.PI);
  pts.push([left, top + radius]);
  corner(left + radius, top + radius, Math.PI, 1.5 * Math.PI);
  strokePolyline(pts, thickness, "square", outlinePlot);
}

export function polygonOutline(
  points: [number, number][],
  thickness: number,
  plot: Plot,
) {
  if (points.length < 2) return;
  strokePolyline([...points, points[0]], thickness, "square", plot);
}

export function polygonFillSpans(
  points: [number, number][],
  fillSpan: SpanPlot,
) {
  if (points.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  minY = Math.floor(minY);
  maxY = Math.ceil(maxY);

  for (let y = minY; y <= maxY; y++) {
    const scanY = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= scanY && y1 > scanY) || (y1 <= scanY && y0 > scanY)) {
        const t = (scanY - y0) / (y1 - y0);
        xs.push(x0 + t * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      fillSpan(Math.round(xs[i]), Math.round(xs[i + 1]), y);
    }
  }
}

export function floodFillImageData(
  imgData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
) {
  const { width, height, data } = imgData;
  startX = Math.floor(startX);
  startY = Math.floor(startY);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return;

  const idx = (x: number, y: number) => (y * width + x) * 4;
  const start = idx(startX, startY);
  const target: [number, number, number, number] = [
    data[start],
    data[start + 1],
    data[start + 2],
    data[start + 3],
  ];
  if (
    target[0] === fillColor[0] &&
    target[1] === fillColor[1] &&
    target[2] === fillColor[2] &&
    target[3] === fillColor[3]
  ) {
    return;
  }

  const matches = (i: number) =>
    data[i] === target[0] &&
    data[i + 1] === target[1] &&
    data[i + 2] === target[2] &&
    data[i + 3] === target[3];

  const stack: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(width * height);

  while (stack.length) {
    const [x, y] = stack.pop()!;
    const pos = y * width + x;
    if (visited[pos]) continue;

    let xl = x;
    while (xl > 0 && matches(idx(xl - 1, y))) xl--;
    let xr = x;
    while (xr < width - 1 && matches(idx(xr + 1, y))) xr++;

    for (let xi = xl; xi <= xr; xi++) {
      const p = y * width + xi;
      if (visited[p]) continue;
      visited[p] = 1;
      const i = idx(xi, y);
      data[i] = fillColor[0];
      data[i + 1] = fillColor[1];
      data[i + 2] = fillColor[2];
      data[i + 3] = fillColor[3];

      if (y > 0 && !visited[p - width] && matches(idx(xi, y - 1)))
        stack.push([xi, y - 1]);
      if (y < height - 1 && !visited[p + width] && matches(idx(xi, y + 1)))
        stack.push([xi, y + 1]);
    }
  }
}

export function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b, 255];
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
