import { create } from 'zustand';

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

interface DesktopStoreState {
  wallpaperId: string;
  setWallpaper: (id: string) => void;
}

export const useDesktopStore = create<DesktopStoreState>((set) => ({
  wallpaperId: 'stage-purple',
  setWallpaper: (id) => set({ wallpaperId: id }),
}));
