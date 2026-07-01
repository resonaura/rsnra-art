import type { ComponentType } from "react";
import { useWindowStore } from "../store/windowStore";
import type { AppId } from "../types/window";

import { Contact } from "../apps/Contact/Contact";
import { ControlPanel } from "../apps/ControlPanel/ControlPanel";
import { GamesFolder } from "../apps/GamesFolder/GamesFolder";
import { Help } from "../apps/Help/Help";
import { Minesweeper } from "../apps/Minesweeper/Minesweeper";
import { Music } from "../apps/Music/Music";
import { MyComputer } from "../apps/MyComputer/MyComputer";
import { Notepad } from "../apps/Notepad/Notepad";
import { Paint } from "../apps/Paint/Paint";
import { PaintFonts } from "../apps/Paint/PaintFonts";
import { RecycleBin } from "../apps/RecycleBin/RecycleBin";
import { Snake } from "../apps/Snake/Snake";
import { Social } from "../apps/Social/Social";
import { Terminal } from "../apps/Terminal/Terminal";
import { Welcome } from "../apps/Welcome/Welcome";

export interface AppDefinition {
  id: AppId;
  title: string;
  icon: string;
  component: ComponentType<{ windowId: string }>;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  singleInstance?: boolean;
  noPadding?: boolean;
}

const asComponent = <P,>(C: ComponentType<P>) =>
  C as ComponentType<{ windowId: string }>;

export const APPS: Record<AppId, AppDefinition> = {
  welcome: {
    id: "welcome",
    title: "Welcome",
    icon: "/icons/computer.png",
    component: asComponent(Welcome),
    width: 620,
    height: 460,
  },
  "my-computer": {
    id: "my-computer",
    title: "My Computer",
    icon: "/icons/computer.png",
    component: asComponent(MyComputer),
    width: 520,
    height: 420,
    noPadding: true,
  },
  notepad: {
    id: "notepad",
    title: "bio.txt - Notepad",
    icon: "/icons/notepad.png",
    component: asComponent(Notepad),
    width: 480,
    height: 420,
    noPadding: true,
  },
  music: {
    id: "music",
    title: "RSNRA Music",
    icon: "/icons/music-cd.png",
    component: asComponent(Music),
    width: 420,
    height: 460,
    resizable: false,
  },
  social: {
    id: "social",
    title: "Follow RSNRA",
    icon: "/icons/globe.png",
    component: asComponent(Social),
    width: 420,
    height: 320,
    resizable: false,
  },
  contact: {
    id: "contact",
    title: "Contact RSNRA",
    icon: "/icons/contact-card.png",
    component: asComponent(Contact),
    width: 440,
    height: 480,
  },
  terminal: {
    id: "terminal",
    title: "MS-DOS Prompt",
    icon: "/icons/terminal.png",
    component: asComponent(Terminal),
    width: 600,
    height: 380,
    minWidth: 360,
    minHeight: 220,
    noPadding: true,
  },
  minesweeper: {
    id: "minesweeper",
    title: "Minesweeper",
    icon: "/icons/minesweeper.png",
    component: asComponent(Minesweeper),
    width: 280,
    height: 360,
    resizable: false,
  },
  snake: {
    id: "snake",
    title: "RSNRA Snake",
    icon: "/icons/joystick.png",
    component: asComponent(Snake),
    width: 340,
    height: 400,
    resizable: false,
  },
  "games-folder": {
    id: "games-folder",
    title: "Games",
    icon: "/icons/joystick.png",
    component: asComponent(GamesFolder),
    width: 440,
    height: 360,
    noPadding: true,
  },
  "recycle-bin": {
    id: "recycle-bin",
    title: "Recycle Bin",
    icon: "/icons/recycle-bin-empty.png",
    component: asComponent(RecycleBin),
    width: 380,
    height: 300,
  },
  help: {
    id: "help",
    title: "Help Topics",
    icon: "/icons/help.png",
    component: asComponent(Help),
    width: 460,
    height: 440,
  },
  "control-panel": {
    id: "control-panel",
    title: "Control Panel",
    icon: "/icons/control-panel.png",
    component: asComponent(ControlPanel),
    width: 440,
    height: 440,
  },
  paint: {
    id: "paint",
    title: "untitled - Paint",
    icon: "/icons/paint.png",
    component: asComponent(Paint),
    width: 720,
    height: 540,
    minWidth: 520,
    minHeight: 400,
    noPadding: true,
  },
  "paint-fonts": {
    id: "paint-fonts",
    title: "Fonts",
    icon: "/icons/paint.png",
    component: asComponent(PaintFonts),
    width: 340,
    height: 78,
    resizable: false,
    singleInstance: false,
  },
};

let cascade = 0;

export interface OpenAppOverrides {
  title?: string;
  data?: Record<string, unknown>;
}

export function openApp(appId: AppId, overrides?: OpenAppOverrides): string {
  const def = APPS[appId];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 720;

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;

  const width = isMobile ? Math.min(def.width, viewportW - 16) : def.width;
  const height = isMobile ? Math.min(def.height, viewportH - 80) : def.height;

  const offset = (cascade % 6) * 24;
  cascade += 1;

  const baseX = Math.max(16, Math.round((viewportW - width) / 2) + offset - 60);
  const baseY = Math.max(
    16,
    Math.round((viewportH - height) / 2) + offset - 80,
  );

  return useWindowStore.getState().openWindow({
    appId,
    title: overrides?.title ?? def.title,
    icon: def.icon,
    bounds: { x: baseX, y: baseY, width, height },
    resizable: def.resizable ?? true,
    singleInstance: def.singleInstance ?? true,
    data: overrides?.data,
  });
}
