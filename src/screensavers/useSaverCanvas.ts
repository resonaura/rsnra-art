import { useEffect, useRef } from "react";

/**
 * Boilerplate shared by every canvas screensaver: a full-parent canvas that
 * follows resizes and runs a requestAnimationFrame loop until unmount.
 * `draw` receives the 2d context, canvas size and elapsed time (ms).
 */
export function useSaverCanvas(
  draw: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
  ) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth || 1;
      const h = parent.clientHeight || 1;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      drawRef.current(ctx, canvas.width, canvas.height, now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return canvasRef;
}
