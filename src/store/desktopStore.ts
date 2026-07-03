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
          const taken = new Set<string>();
          
          // Sort keys by their current coordinates (left-to-right, top-to-bottom)
          // so icons already further left/top snap to their closest cells first
          const sortedKeys = Object.keys(snapped).sort((a, b) => {
            const posA = snapped[a];
            const posB = snapped[b];
            if (posA.x !== posB.x) return posA.x - posB.x;
            return posA.y - posB.y;
          });
          
          sortedKeys.forEach((key) => {
            const pos = snapped[key];
            let col = Math.round((pos.x - 12) / 90);
            let row = Math.round((pos.y - 12) / 82);
            if (col < 0) col = 0;
            if (row < 0) row = 0;
            
            // Collision resolution: slide down or wrap to next column if slot is taken
            let c = col;
            let r = row;
            while (taken.has(`${c},${r}`)) {
              r++;
              if (r >= 8) { // wrap after 8 rows
                r = 0;
                c++;
              }
            }
            
            taken.add(`${c},${r}`);
            snapped[key] = {
              x: 12 + c * 90,
              y: 12 + r * 82,
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
