import { create } from "zustand";
import type { ScreenSaverSettings } from "../screensavers/types";

/** Runtime-only state: which screen saver is currently on screen (idle
 * kick-in or the dialog's Preview button). Not persisted. */
interface SaverRunState {
  runningId: string | null;
  runningSettings: ScreenSaverSettings | null;
  startedAt: number;
  run: (id: string, settings?: ScreenSaverSettings) => void;
  stop: () => void;
}

export const useSaverRunStore = create<SaverRunState>((set) => ({
  runningId: null,
  runningSettings: null,
  startedAt: 0,
  run: (id, settings) => set({ runningId: id, runningSettings: settings ?? null, startedAt: Date.now() }),
  stop: () => set({ runningId: null, runningSettings: null }),
}));
