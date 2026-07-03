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
    icon: "/icons/w98_minesweeper.ico",
    onOpen: () => openApp("minesweeper"),
    file: "winmine.exe",
  },
  {
    label: "RSNRA Snake",
    icon: "/icons/w98_joystick.ico",
    onOpen: () => openApp("snake"),
    file: "snake.exe",
  },
  {
    label: "Solitaire",
    icon: "/icons/w98_game_solitaire.ico",
    onOpen: () => openApp("solitaire"),
    file: "sol.exe",
  },
  {
    label: "3D Pinball",
    icon: "/icons/pinball.png",
    onOpen: () => openApp("pinball"),
    file: "pinball.exe",
  },
  { label: "Hearts", icon: "/icons/w98_mshearts.ico", disabled: true, file: "mshearts.exe" },
  { label: "FreeCell", icon: "/icons/w98_game_freecell.ico", disabled: true, file: "freecell.exe" },
  { label: "Spider", icon: "/icons/w98_spider.ico", disabled: true, file: "spider.exe" },
];
