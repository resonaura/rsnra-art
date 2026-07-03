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

export function buildProcessRows(
  windows: WindowInstance[],
  cpuPct: number,
): ProcessRow[] {
  const idleCpu = Math.max(0, 100 - cpuPct);
  return [
    ...DECORATIVE_PROCESSES.map((p) => ({
      ...p,
      cpuPct: p.name === "System Idle Process" ? idleCpu : 0,
    })),
    {
      name: REAL_PROCESS_NAME,
      pid: REAL_PROCESS_PID,
      memK: readRealMemK(),
      cpuPct,
    },
    ...windows.map(
      (w): ProcessRow => ({
        name: `${w.appId}.exe`,
        pid: w.pid,
        memK: 1800,
        cpuPct: 0,
        windowId: w.id,
      }),
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
