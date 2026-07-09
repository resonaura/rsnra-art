import { openApp } from "./apps";

export interface GameItem {
  label: string;
  icon: string;
  onOpen?: () => void;
  disabled?: boolean;
  // .exe shown in the "file not found" alert for games that aren't installed.
  file: string;
}

// Single source of truth for "what's in C:\...\Games" — the MyComputer
// virtual Games folder and the Start Menu's Programs > Games submenu both
// render this same list, so they can never drift out of sync.
export const GAMES: GameItem[] = [
  {
    label: "Minesweeper",
    icon: "/icons/winmine.exe/000.ico",
    onOpen: () => openApp("minesweeper"),
    file: "winmine.exe",
  },
  {
    label: "RSNRA Snake",
    icon: "/icons/games.exe/000.ico",
    onOpen: () => openApp("snake"),
    file: "snake.exe",
  },
  {
    label: "Solitaire",
    icon: "/icons/sol.exe/000.ico",
    onOpen: () => openApp("solitaire"),
    file: "sol.exe",
  },
  {
    label: "3D Pinball",
    icon: "/icons/pinball.exe/000.ico",
    onOpen: () => openApp("pinball"),
    file: "pinball.exe",
  },
];
