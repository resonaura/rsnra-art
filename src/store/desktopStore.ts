import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Wallpaper {
  id: string;
  label: string;
  background: string;
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'teal', label: 'Classic Teal', background: '#008080' },
  { id: 'stage-purple', label: 'Stage Purple', background: '#2d1b4e' },
  { id: 'amp-red', label: 'Amp Red', background: '#3a0d0d' },
  { id: 'midnight', label: 'Midnight Show', background: '#0a0a18' },
  { id: 'mono', label: 'Black & White', background: '#000000' },
];

export interface IconPos {
  x: number;
  y: number;
}

interface DesktopStoreState {
  wallpaperId: string;
  autoArrange: boolean;
  sortBy: "name" | "type" | "size" | "date" | null;
  iconPositions: Record<string, IconPos>;
  setWallpaper: (id: string) => void;
  setAutoArrange: (auto: boolean) => void;
  setSortBy: (by: "name" | "type" | "size" | "date" | null) => void;
  setIconPosition: (name: string, x: number, y: number) => void;
  clearIconPositions: () => void;
  lineUpIcons: () => void;
}

export const useDesktopStore = create<DesktopStoreState>()(
  persist(
    (set) => ({
      wallpaperId: 'stage-purple',
      autoArrange: true, // Default to true as in classical setups, can be disabled
      sortBy: null,
      iconPositions: {},
      setWallpaper: (id) => set({ wallpaperId: id }),
      setAutoArrange: (auto) => set({ autoArrange: auto }),
      setSortBy: (by) => set({ sortBy: by }),
      setIconPosition: (name, x, y) =>
        set((state) => ({
          iconPositions: {
            ...state.iconPositions,
            [name]: { x, y },
          },
        })),
      clearIconPositions: () => set({ iconPositions: {} }),
      lineUpIcons: () =>
        set((state) => {
          const snapped = { ...state.iconPositions };
          Object.keys(snapped).forEach((key) => {
            const pos = snapped[key];
            const col = Math.round((pos.x - 12) / 90);
            const row = Math.round((pos.y - 12) / 82);
            snapped[key] = {
              x: 12 + col * 90,
              y: 12 + Math.max(0, row) * 82,
            };
          });
          return { iconPositions: snapped };
        }),
    }),
    {
      name: 'rsnra-desktop-prefs',
    }
  )
);
