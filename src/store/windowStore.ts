import { create } from 'zustand';
import type { AppId, Bounds, WindowInstance } from '../types/window';

let idCounter = 0;
const genId = () => `win-${++idCounter}-${Date.now().toString(36)}`;

export interface OpenWindowConfig {
  appId: AppId;
  title: string;
  icon: string;
  bounds: Bounds;
  resizable?: boolean;
  singleInstance?: boolean;
  data?: Record<string, unknown>;
}

export type PowerState = 'on' | 'shutting-down' | 'off' | 'restarting';

interface WindowStoreState {
  windows: WindowInstance[];
  topZIndex: number;
  startMenuOpen: boolean;
  closeProgramOpen: boolean;
  runDialogOpen: boolean;
  powerState: PowerState;

  openWindow: (config: OpenWindowConfig) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleMinimizeFromTaskbar: (id: string) => void;
  updateBounds: (id: string, bounds: Partial<Bounds>) => void;
  setStartMenuOpen: (open: boolean) => void;
  toggleStartMenu: () => void;
  setCloseProgramOpen: (open: boolean) => void;
  setRunDialogOpen: (open: boolean) => void;
  closeAll: () => void;
  setPowerState: (state: PowerState) => void;
}

export const useWindowStore = create<WindowStoreState>((set, get) => ({
  windows: [],
  topZIndex: 10,
  startMenuOpen: false,
  closeProgramOpen: false,
  runDialogOpen: false,
  powerState: 'on',

  openWindow: (config) => {
    const { windows, topZIndex } = get();
    const existingId = config.singleInstance === false ? undefined : `app-${config.appId}`;

    if (existingId) {
      const existing = windows.find((w) => w.id === existingId);
      if (existing) {
        const nextZ = topZIndex + 1;
        set({
          topZIndex: nextZ,
          windows: windows.map((w) =>
            w.id === existingId
              ? {
                  ...w,
                  isMinimized: false,
                  isFocused: true,
                  zIndex: nextZ,
                  data: config.data ?? w.data,
                  title: config.title,
                }
              : { ...w, isFocused: false },
          ),
        });
        return existingId;
      }
    }

    const id = existingId ?? genId();
    const nextZ = topZIndex + 1;
    const instance: WindowInstance = {
      id,
      appId: config.appId,
      title: config.title,
      icon: config.icon,
      bounds: config.bounds,
      prevBounds: null,
      zIndex: nextZ,
      isMinimized: false,
      isMaximized: false,
      isFocused: true,
      resizable: config.resizable ?? true,
      data: config.data,
    };
    set({
      topZIndex: nextZ,
      windows: [...windows.map((w) => ({ ...w, isFocused: false })), instance],
    });
    return id;
  },

  closeWindow: (id) => {
    set((state) => ({ windows: state.windows.filter((w) => w.id !== id) }));
  },

  minimizeWindow: (id) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: true, isFocused: false } : w,
      ),
    }));
  },

  toggleMaximize: (id) => {
    set((state) => {
      const nextZ = state.topZIndex + 1;
      return {
        topZIndex: nextZ,
        windows: state.windows.map((w) => {
          if (w.id !== id) return { ...w, isFocused: false };
          if (w.isMaximized) {
            return {
              ...w,
              isMaximized: false,
              bounds: w.prevBounds ?? w.bounds,
              prevBounds: null,
              zIndex: nextZ,
              isFocused: true,
            };
          }
          return {
            ...w,
            isMaximized: true,
            prevBounds: w.bounds,
            zIndex: nextZ,
            isFocused: true,
          };
        }),
      };
    });
  },

  focusWindow: (id) => {
    set((state) => {
      const target = state.windows.find((w) => w.id === id);
      if (!target) return state;
      if (target.isFocused && !target.isMinimized && target.zIndex === state.topZIndex) {
        return state;
      }
      const nextZ = state.topZIndex + 1;
      return {
        topZIndex: nextZ,
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, isFocused: true, isMinimized: false, zIndex: nextZ }
            : { ...w, isFocused: false },
        ),
      };
    });
  },

  toggleMinimizeFromTaskbar: (id) => {
    const state = get();
    const target = state.windows.find((w) => w.id === id);
    if (!target) return;
    if (target.isMinimized) {
      state.focusWindow(id);
    } else if (target.isFocused) {
      state.minimizeWindow(id);
    } else {
      state.focusWindow(id);
    }
  },

  updateBounds: (id, bounds) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, bounds: { ...w.bounds, ...bounds } } : w,
      ),
    }));
  },

  setStartMenuOpen: (open) => set({ startMenuOpen: open }),
  toggleStartMenu: () => set((state) => ({ startMenuOpen: !state.startMenuOpen })),
  setCloseProgramOpen: (open) => set({ closeProgramOpen: open }),
  setRunDialogOpen: (open) => set({ runDialogOpen: open }),
  closeAll: () => set({ windows: [] }),
  setPowerState: (powerState) => set({ powerState }),
}));

export function useWindowData(windowId: string): Record<string, unknown> {
  return useWindowStore((s) => s.windows.find((w) => w.id === windowId)?.data ?? {});
}
