import type { WindowInstance } from "../types/window";

// Single source of truth for "what's running" — shared by Task Manager and
// the terminal's tasklist/kill commands so both report the exact same
// image names, PIDs and memory figures instead of diverging fake data.

export interface DecorativeProcess {
  name: string;
  pid: number;
  memK: number;
}

// These aren't real OS processes (a browser tab can't see them) — they're
// fixed set dressing, always present, always 0% CPU, never killable. Real
// app windows (below) get a real PID assigned when they're opened.
export const DECORATIVE_PROCESSES: DecorativeProcess[] = [
  { name: "System Idle Process", pid: 0, memK: 16 },
  { name: "System", pid: 4, memK: 212 },
  { name: "smss.exe", pid: 168, memK: 348 },
  { name: "csrss.exe", pid: 196, memK: 1024 },
  { name: "winlogon.exe", pid: 224, memK: 692 },
  { name: "services.exe", pid: 252, memK: 1188 },
  { name: "explorer.exe", pid: 340, memK: 3072 },
];

// The one row that maps to something real: this browser tab.
export const REAL_PROCESS_NAME = "rsnra-art.exe";
export const REAL_PROCESS_PID = 512;

export interface ProcessRow {
  name: string;
  pid: number;
  memK: number;
  cpuPct: number;
  windowId?: string;
}

/** Read the live JS heap size (KB) directly — 0 if unsupported. */
export function readRealMemK(): number {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } })
    .memory;
  return mem ? Math.round(mem.usedJSHeapSize / 1024) : 0;
}

function getAppBaseMemK(appId: string): number {
  switch (appId) {
    case "notepad": return 1200;
    case "paint": return 8192;
    case "calculator": return 950;
    case "minesweeper": return 1100;
    case "solitaire": return 1500;
    case "pinball": return 12288;
    case "sound-recorder": return 1800;
    case "winamp": return 4500;
    case "terminal": return 2048;
    default: return 2500;
  }
}

export function buildProcessRows(
  windows: WindowInstance[],
  cpuPct: number,
): ProcessRow[] {
  const activeCpu = cpuPct;
  const idleCpu = Math.max(0, 100 - activeCpu);

  // Distribute active CPU
  const explorerCpu = activeCpu > 5 ? Math.round(activeCpu * 0.06) : 0;
  const focusedWin = windows.find((w) => w.isFocused && !w.isMinimized);
  const focusedCpu = focusedWin && activeCpu > 5 ? Math.round(activeCpu * 0.35) : 0;
  const mainProcessCpu = Math.max(0, activeCpu - explorerCpu - focusedCpu);

  const now = Date.now();

  return [
    {
      name: "System Idle Process",
      pid: 0,
      memK: 16,
      cpuPct: idleCpu,
    },
    ...DECORATIVE_PROCESSES.filter((p) => p.name !== "System Idle Process").map((p) => {
      let processCpu = 0;
      let memK = p.memK;

      if (p.name === "explorer.exe") {
        processCpu = explorerCpu;
        // Explorer memory grows with open windows
        const winGrowth = windows.length * 512;
        const jitter = Math.round(Math.sin(340 + now / 20000) * 100);
        memK = p.memK + winGrowth + jitter;
      } else {
        // Add tiny memory fluctuations to system processes
        const jitter = Math.round(Math.sin(p.pid + now / 15000) * 30);
        memK = Math.max(16, p.memK + jitter);
      }

      return {
        ...p,
        memK,
        cpuPct: processCpu,
      };
    }),
    {
      name: REAL_PROCESS_NAME,
      pid: REAL_PROCESS_PID,
      memK: readRealMemK() || (24576 + windows.length * 4096 + Math.round(Math.sin(512 + now / 12000) * 300)),
      cpuPct: mainProcessCpu,
    },
    ...windows.map(
      (w): ProcessRow => {
        const isFocused = w.isFocused && !w.isMinimized;
        const baseMem = getAppBaseMemK(w.appId);
        const dynamicMem = Math.round(Math.abs(Math.sin(w.pid)) * 600);
        const jitter = Math.round(Math.sin(w.pid + now / 15000) * 120);
        const focusBonus = isFocused ? 350 : 0;
        const memK = Math.max(256, baseMem + dynamicMem + jitter + focusBonus);

        const processCpu = w.id === focusedWin?.id ? focusedCpu : 0;

        return {
          name: `${w.appId}.exe`,
          pid: w.pid,
          memK,
          cpuPct: processCpu,
          windowId: w.id,
        };
      },
    ),
  ];
}

/** True for the fixed decorative/self rows — matches taskkill's real
 * behavior of refusing to end protected system processes. */
export function isProtectedPid(pid: number): boolean {
  return (
    pid === REAL_PROCESS_PID || DECORATIVE_PROCESSES.some((p) => p.pid === pid)
  );
}
