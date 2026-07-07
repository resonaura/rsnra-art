import { useRef } from "react";
import { useSaverCanvas } from "./useSaverCanvas";
import type { ScreenSaverProps } from "./types";

export const MARQUEE_DEFAULT_TEXT = "RSNRA — Windows Millennium Edition";

// Scrolling Marquee — text drifting right-to-left across a black screen.
export function Marquee({ preview }: ScreenSaverProps) {
  const offset = useRef<number | null>(null);
  const last = useRef(0);

  const ref = useSaverCanvas((ctx, w, h, t) => {
    const dt = Math.min(0.1, (t - last.current) / 1000);
    last.current = t;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const size = preview ? 14 : Math.round(h * 0.09);
    ctx.font = `bold ${size}px 'ms_sans_serif', sans-serif`;
    ctx.textBaseline = "middle";
    const text = MARQUEE_DEFAULT_TEXT;
    const tw = ctx.measureText(text).width;

    if (offset.current === null) offset.current = w;
    offset.current -= dt * (preview ? 30 : 120);
    if (offset.current < -tw) offset.current = w;

    ctx.fillStyle = "#ff00ff";
    ctx.fillText(text, offset.current, h / 2);
  });

  return <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />;
}
