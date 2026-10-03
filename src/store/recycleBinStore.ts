import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecycleBinSettings {
  maximumSizePercent: number;
  skipRecycleBin: boolean;
  confirmDelete: boolean;
}

interface RecycleBinState extends RecycleBinSettings {
  setSettings: (settings: Partial<RecycleBinSettings>) => void;
}

export const useRecycleBinStore = create<RecycleBinState>()(
  persist(
    (set) => ({
      maximumSizePercent: 10,
      skipRecycleBin: false,
      confirmDelete: true,
      setSettings: (settings) => set(settings),
    }),
    { name: "rsnra95-recycle-bin", version: 1 },
  ),
);
