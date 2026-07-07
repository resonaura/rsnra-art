import { useRef } from "react";
import { useSaverCanvas } from "./useSaverCanvas";
import type { ScreenSaverProps } from "./types";

// DVD-logo bouncing screensaver — the iconic meme screensaver.
// Bounces a colored "DVD" logo around the screen, changing color when hitting a wall.
// Color change on corner hit is legendary.

const COLORS = [
  "#e50914", // red
  "#1db954", // green
  "#0070f3", // blue
  "#f5a623", // orange
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f59e0b", // yellow
];

interface State {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colorIdx: number;
  lastT: number;
  speed: number;
}

export function DvdBounce({ preview }: ScreenSaverProps) {
  const state = useRef<State | null>(null);
  const logoW = preview ? 32 : 120;
  const logoH = preview ? 16 : 56;

  const ref = useSaverCanvas((ctx, w, h, t) => {
    if (!state.current) {
      const speed = preview ? 40 : 90;
      state.current = {
        x: Math.random() * (w - logoW),
        y: Math.random() * (h - logoH),
        vx: speed * (Math.random() > 0.5 ? 1 : -1),
        vy: speed * (Math.random() > 0.5 ? 1 : -1),
        colorIdx: 0,
        lastT: t,
        speed,
      };
    }

    const s = state.current;
    const dt = Math.min(0.08, (t - s.lastT) / 1000);
    s.lastT = t;

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    let hitCorner = false;
    let bounced = false;

    if (s.x <= 0) {
      s.x = 0;
      s.vx = Math.abs(s.vx);
      bounced = true;
    } else if (s.x + logoW >= w) {
      s.x = w - logoW;
      s.vx = -Math.abs(s.vx);
      bounced = true;
    }

    if (s.y <= 0) {
      s.y = 0;
      s.vy = Math.abs(s.vy);
      if (bounced) hitCorner = true;
      bounced = true;
    } else if (s.y + logoH >= h) {
      s.y = h - logoH;
      s.vy = -Math.abs(s.vy);
      if (bounced) hitCorner = true;
      bounced = true;
    }

    if (bounced) {
      s.colorIdx = (s.colorIdx + 1) % COLORS.length;
    }

    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Draw DVD logo text
    const color = COLORS[s.colorIdx];
    const fontSize = preview ? 10 : 36;
    const smallFontSize = preview ? 5 : 14;

    ctx.save();
    ctx.translate(s.x, s.y);

    // Outer oval / background
    ctx.beginPath();
    ctx.ellipse(
      logoW / 2,
      logoH / 2,
      logoW / 2 - 1,
      logoH / 2 - 1,
      0,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = preview ? 1 : 2;
    ctx.stroke();

    // "DVD" text
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DVD", logoW / 2, logoH / 2 - (preview ? 2 : 6));

    // "VIDEO" small text below
    ctx.font = `${smallFontSize}px 'Arial', sans-serif`;
    ctx.fillText("VIDEO", logoW / 2, logoH / 2 + (preview ? 4 : 16));

    ctx.restore();

    // Corner hit flash effect
    if (hitCorner) {
      ctx.fillStyle = `${color}22`;
      ctx.fillRect(0, 0, w, h);
    }
  });

  return (
    <canvas
      ref={ref}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
