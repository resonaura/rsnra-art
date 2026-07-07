import { useRef } from "react";
import { useSaverCanvas } from "./useSaverCanvas";
import type { ScreenSaverProps } from "./types";

interface Star {
  x: number;
  y: number;
  z: number;
}

// Starfield Simulation — flying through space, as shipped since Windows 3.1.
export function Starfield({ preview }: ScreenSaverProps) {
  const stars = useRef<Star[] | null>(null);
  const last = useRef(0);

  const ref = useSaverCanvas((ctx, w, h, t) => {
    const count = preview ? 60 : 220;
    if (!stars.current) {
      stars.current = Array.from({ length: count }, () => ({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random(),
      }));
    }
    const dt = Math.min(0.1, (t - last.current) / 1000);
    last.current = t;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";

    for (const s of stars.current) {
      s.z -= dt * 0.35;
      if (s.z <= 0.02) {
        s.x = Math.random() * 2 - 1;
        s.y = Math.random() * 2 - 1;
        s.z = 1;
      }
      const px = w / 2 + (s.x / s.z) * w * 0.5;
      const py = h / 2 + (s.y / s.z) * h * 0.5;
      if (px < 0 || px >= w || py < 0 || py >= h) {
        s.x = Math.random() * 2 - 1;
        s.y = Math.random() * 2 - 1;
        s.z = 1;
        continue;
      }
      const size = s.z < 0.3 ? 2 : 1;
      const bright = Math.min(255, Math.round(80 + (1 - s.z) * 175));
      ctx.fillStyle = `rgb(${bright},${bright},${bright})`;
      ctx.fillRect(px, py, size, size);
    }
  });

  return <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />;
}
