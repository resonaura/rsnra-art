import { useEffect, useRef, useState } from "react";

// Real, measured browser performance stats — no fabricated numbers.
//
// CPU: the browser gives no per-process CPU%, but the Long Tasks API
// reports every main-thread task over 50ms, and per-frame timing shows
// how far frames overshoot the 16.7ms (60Hz) budget. Both are genuine
// signals of how busy *this tab's* main thread actually is; we take the
// max of the two over a rolling window and report that as CPU load.
//
// Memory: `performance.memory` (Chromium only) reports the real JS heap
// size/limit for this tab. Where it's unsupported (Firefox/Safari), we
// report 0 rather than invent a number.
export interface PerfStats {
  cpuPct: number;
  usedMemMB: number;
  limitMemMB: number;
  memPct: number;
  domNodes: number;
  cpuSupported: boolean;
  memSupported: boolean;
}

const WINDOW_MS = 2000;
const FRAME_BUDGET_MS = 16.7;

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function usePerfStats(intervalMs = 1000): PerfStats {
  const [stats, setStats] = useState<PerfStats>({
    cpuPct: 0,
    usedMemMB: 0,
    limitMemMB: 0,
    memPct: 0,
    domNodes: 0,
    cpuSupported: false,
    memSupported: false,
  });

  const longTaskLoad = useRef<{ t: number; d: number }[]>([]);
  const frameLoad = useRef<{ t: number; d: number }[]>([]);
  const lastFrame = useRef(performance.now());

  useEffect(() => {
    let observer: PerformanceObserver | null = null;
    let cpuSupported = false;
    try {
      observer = new PerformanceObserver((list) => {
        const now = performance.now();
        for (const entry of list.getEntries()) {
          longTaskLoad.current.push({ t: now, d: entry.duration });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
      cpuSupported = true;
    } catch {
      cpuSupported = false;
    }

    let raf = 0;
    const frameLoop = (now: number) => {
      const dt = now - lastFrame.current;
      lastFrame.current = now;
      frameLoad.current.push({ t: now, d: Math.max(0, dt - FRAME_BUDGET_MS) });
      raf = requestAnimationFrame(frameLoop);
    };
    raf = requestAnimationFrame(frameLoop);

    const memApi = (performance as Performance & { memory?: MemoryInfo })
      .memory;
    const memSupported = !!memApi;

    const id = setInterval(() => {
      const now = performance.now();
      longTaskLoad.current = longTaskLoad.current.filter(
        (e) => now - e.t < WINDOW_MS,
      );
      frameLoad.current = frameLoad.current.filter(
        (e) => now - e.t < WINDOW_MS,
      );

      const longTaskBusy = longTaskLoad.current.reduce(
        (sum, e) => sum + e.d,
        0,
      );
      const frameBusy = frameLoad.current.reduce((sum, e) => sum + e.d, 0);
      const cpuPct = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Math.max(longTaskBusy, frameBusy) / (WINDOW_MS / 100),
          ),
        ),
      );

      let usedMemMB = 0;
      let limitMemMB = 0;
      if (memApi) {
        usedMemMB = memApi.usedJSHeapSize / 1048576;
        limitMemMB = memApi.jsHeapSizeLimit / 1048576;
      }
      const memPct =
        limitMemMB > 0 ? Math.round((usedMemMB / limitMemMB) * 100) : 0;

      setStats({
        cpuPct,
        usedMemMB: Math.round(usedMemMB),
        limitMemMB: Math.round(limitMemMB),
        memPct,
        domNodes: document.getElementsByTagName("*").length,
        cpuSupported,
        memSupported,
      });
    }, intervalMs);

    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [intervalMs]);

  return stats;
}
