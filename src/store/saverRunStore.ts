import { create } from "zustand";

/** Runtime-only state: which screen saver is currently on screen (idle
 * kick-in or the dialog's Preview button). Not persisted. */
interface SaverRunState {
  runningId: string | null;
  startedAt: number;
  run: (id: string) => void;
  stop: () => void;
}

export const useSaverRunStore = create<SaverRunState>((set) => ({
  runningId: null,
  startedAt: 0,
  run: (id) => set({ runningId: id, startedAt: Date.now() }),
  stop: () => set({ runningId: null }),
}));
