import { useRef } from "react";
import { useSaverCanvas } from "./useSaverCanvas";
import type { ScreenSaverProps } from "./types";

interface Poly {
  // Two "end" polylines whose corners bounce; the shape connects them.
  pts: { x: number; y: number; vx: number; vy: number }[];
  hue: number;
  hueSpeed: number;
  trail: { x: number; y: number }[][];
}

// Mystify Your Mind — bouncing polygon corners with color-cycling trails.
export function Mystify(_props: ScreenSaverProps) {
  const polys = useRef<Poly[] | null>(null);
  const last = useRef(0);

  const ref = useSaverCanvas((ctx, w, h, t) => {
    if (!polys.current) {
      polys.current = Array.from({ length: 2 }, (_, i) => ({
        pts: Array.from({ length: 4 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() * 120 + 60) * (Math.random() > 0.5 ? 1 : -1),
          vy: (Math.random() * 120 + 60) * (Math.random() > 0.5 ? 1 : -1),
        })),
        hue: i * 180,
        hueSpeed: 24 + i * 12,
        trail: [],
      }));
    }
    const dt = Math.min(0.05, (t - last.current) / 1000);
    last.current = t;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    for (const poly of polys.current) {
      for (const p of poly.pts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
        if (p.y > h) { p.y = h; p.vy = -Math.abs(p.vy); }
      }
      poly.hue = (poly.hue + poly.hueSpeed * dt) % 360;
      poly.trail.push(poly.pts.map((p) => ({ x: p.x, y: p.y })));
      if (poly.trail.length > 7) poly.trail.shift();

      poly.trail.forEach((shape, idx) => {
        const alpha = ((idx + 1) / poly.trail.length) * 0.9;
        ctx.strokeStyle = `hsla(${poly.hue}, 100%, 60%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(shape[0].x, shape[0].y);
        for (let i = 1; i < shape.length; i++) ctx.lineTo(shape[i].x, shape[i].y);
        ctx.closePath();
        ctx.stroke();
      });
    }
  });

  return <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />;
}
