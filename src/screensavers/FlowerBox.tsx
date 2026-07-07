import { useRef } from "react";
import { useSaverCanvas } from "./useSaverCanvas";
import type { ScreenSaverProps } from "./types";

// 3D Flower Box — a pulsing, spinning box that drifts around the screen and
// bounces off the edges (the classic DVD-logo trajectory). Face colors match
// the Windows Me default green/magenta look.
const VERTS: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

const FACES: { idx: [number, number, number, number]; color: string }[] = [
  { idx: [0, 1, 2, 3], color: "#c743c7" }, // magenta
  { idx: [5, 4, 7, 6], color: "#3fbf3f" }, // green
  { idx: [4, 0, 3, 7], color: "#8f2fbf" },
  { idx: [1, 5, 6, 2], color: "#2fbf6f" },
  { idx: [4, 5, 1, 0], color: "#d76fd7" },
  { idx: [3, 2, 6, 7], color: "#6fdf6f" },
];

export function FlowerBox({ preview }: ScreenSaverProps) {
  const state = useRef({ x: 0.5, y: 0.5, vx: 0.11, vy: 0.083 });
  const last = useRef(0);

  const ref = useSaverCanvas((ctx, w, h, t) => {
    const dt = Math.min(0.1, (t - last.current) / 1000);
    last.current = t;
    const s = state.current;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Box radius: pulses like the morphing flower box.
    const pulse = 1 + 0.35 * Math.sin(t / 700);
    const size = Math.min(w, h) * (preview ? 0.16 : 0.09) * pulse;
    const margin = size * 1.9;

    // DVD-style drift + bounce (normalized coords).
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const minX = margin / w;
    const minY = margin / h;
    if (s.x < minX) { s.x = minX; s.vx = Math.abs(s.vx); }
    if (s.x > 1 - minX) { s.x = 1 - minX; s.vx = -Math.abs(s.vx); }
    if (s.y < minY) { s.y = minY; s.vy = Math.abs(s.vy); }
    if (s.y > 1 - minY) { s.y = 1 - minY; s.vy = -Math.abs(s.vy); }

    const cx = s.x * w;
    const cy = s.y * h;

    const ax = t / 1300;
    const ay = t / 900;
    const cosX = Math.cos(ax), sinX = Math.sin(ax);
    const cosY = Math.cos(ay), sinY = Math.sin(ay);

    const proj = VERTS.map(([x, y, z]) => {
      // rotate X then Y
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      const x2 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;
      const persp = 3.2 / (3.2 + z2);
      return { x: cx + x2 * size * persp, y: cy + y1 * size * persp, z: z2 };
    });

    const ordered = FACES.map((f) => ({
      ...f,
      z: f.idx.reduce((sum, i) => sum + proj[i].z, 0) / 4,
    })).sort((a, b) => b.z - a.z);

    for (const face of ordered) {
      const pts = face.idx.map((i) => proj[i]);
      // Back-face cull via winding order.
      const cross =
        (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) -
        (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x);
      if (cross <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = face.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke();
    }
  });

  return <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />;
}
