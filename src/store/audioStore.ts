import { create } from "zustand";
import { persist } from "zustand/middleware";

// Global system volume for RSNRA 95. Every sound played through the audio
// engine (src/lib/audio.ts) routes through a master GainNode whose value is
// bound to `volume` (and zeroed when `muted`), so the tray volume control is
// the single source of truth for all in-app audio.

interface AudioStoreState {
  volume: number; // 0..1 master volume
  muted: boolean;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  toggleMuted: () => void;
}

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set) => ({
      volume: 0.7,
      muted: false,
      setVolume: (v) =>
        set({ volume: Math.max(0, Math.min(1, v)), muted: false }),
      setMuted: (m) => set({ muted: m }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: "rsnra95-audio" },
  ),
);
