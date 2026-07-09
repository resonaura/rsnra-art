import type { ComponentType } from "react";
import { TASKBAR_HEIGHT } from "../constants";
import { useWindowStore } from "../store/windowStore";
import type { AppId } from "../types/window";

import { Calculator } from "../apps/Calculator/Calculator";
import { CharMap } from "../apps/CharMap/CharMap";
import { Contact } from "../apps/Contact/Contact";
import { DateTime } from "../apps/DateTime/DateTime";
import { DisplayProperties } from "../apps/DisplayProperties/DisplayProperties";
import { Find } from "../apps/Find/Find";
import { FolderOptions } from "../apps/FolderOptions/FolderOptions";
import { Help } from "../apps/Help/Help";
import { Minesweeper } from "../apps/Minesweeper/Minesweeper";
import { MouseProperties } from "../apps/MouseProperties/MouseProperties";
import { Music } from "../apps/Music/Music";
import { MyComputer } from "../apps/MyComputer/MyComputer";
import { Notepad } from "../apps/Notepad/Notepad";
import { Paint } from "../apps/Paint/Paint";
import { PaintFonts } from "../apps/Paint/PaintFonts";
import { Pinball } from "../apps/Pinball/Pinball";
import { Properties } from "../apps/Properties/Properties";
import { RecycleBin } from "../apps/RecycleBin/RecycleBin";
import { Snake } from "../apps/Snake/Snake";
import { Social } from "../apps/Social/Social";
import { Solitaire } from "../apps/Solitaire/Solitaire";
import { SoundRecorder } from "../apps/SoundRecorder/SoundRecorder";
import { SystemProperties } from "../apps/SystemProperties/SystemProperties";
import { TaskManager } from "../apps/TaskManager/TaskManager";
import { TerminalApp } from "../apps/Terminal/Terminal";
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
    icon: "/icons/explorer.exe/000.ico",
    component: asComponent(Welcome),
    width: 620,
    height: 460,
  },
  "my-computer": {
    id: "my-computer",
    title: "My Computer",
    icon: "/icons/explorer.exe/000.ico",
    component: asComponent(MyComputer),
    width: 520,
    height: 420,
    noPadding: true,
    singleInstance: false,
  },
  notepad: {
    id: "notepad",
    title: "Notepad",
    icon: "/icons/notepad.exe/000.ico",
    component: asComponent(Notepad),
    width: 480,
    height: 420,
    noPadding: true,
  },
  music: {
    id: "music",
    title: "RSNRA Music",
    icon: "/icons/mmsys.cpl/005.ico",
    component: asComponent(Music),
    width: 420,
    height: 460,
    resizable: false,
  },
  social: {
    id: "social",
    title: "Follow RSNRA",
    icon: "/icons/intl.cpl/000.ico",
    component: asComponent(Social),
    width: 420,
    height: 320,
    resizable: false,
  },
  contact: {
    id: "contact",
    title: "Contact RSNRA",
    icon: "/icons/wab.exe/000.ico",
    component: asComponent(Contact),
    width: 440,
    height: 300,
  },
  terminal: {
    id: "terminal",
    title: "Command Prompt",
    icon: "/icons/cmd.exe/000.ico",
    component: asComponent(TerminalApp),
    width: 600,
    height: 380,
    minWidth: 360,
    minHeight: 220,
    noPadding: true,
  },
  minesweeper: {
    id: "minesweeper",
    title: "Minesweeper",
    icon: "/icons/winmine.exe/000.ico",
    component: asComponent(Minesweeper),
    width: 280,
    height: 384,
    resizable: false,
    noPadding: true,
  },
  snake: {
    id: "snake",
    title: "RSNRA Snake",
    icon: "/icons/games.exe/000.ico",
    component: asComponent(Snake),
    width: 340,
    height: 400,
    resizable: false,
  },
  "games-folder": {
    id: "games-folder",
    title: "Games",
    icon: "/icons/games.exe/000.ico",
    component: asComponent(MyComputer),
    width: 440,
    height: 360,
    noPadding: true,
  },
  "recycle-bin": {
    id: "recycle-bin",
    title: "Recycle Bin",
    icon: "/icons/shell32.dll/079.ico",
    component: asComponent(RecycleBin),
    width: 380,
    height: 300,
    noPadding: true,
  },
  help: {
    id: "help",
    title: "Help Topics",
    icon: "/icons/winhlp32.exe/000.ico",
    component: asComponent(Help),
    width: 460,
    height: 440,
    noPadding: true,
  },
  "control-panel": {
    id: "control-panel",
    title: "Control Panel",
    icon: "/icons/shell32.dll/112.ico",
    component: asComponent(MyComputer),
    width: 440,
    height: 440,
    noPadding: true,
  },
  "display-properties": {
    id: "display-properties",
    title: "Display Properties",
    icon: "/icons/desk.cpl/000.ico",
    component: asComponent(DisplayProperties),
    width: 480,
    height: 600,
    resizable: false,
    singleInstance: true,
  },
  "mouse-properties": {
    id: "mouse-properties",
    title: "Mouse Properties",
    icon: "/icons/mouse.cpl/000.ico",
    component: asComponent(MouseProperties),
    width: 420,
    height: 480,
    resizable: false,
    singleInstance: true,
  },
  "system-properties": {
    id: "system-properties",
    title: "System Properties",
    icon: "/icons/explorer.exe/000.ico",
    component: asComponent(SystemProperties),
    width: 400,
    height: 420,
    resizable: false,
    singleInstance: true,
  },
  paint: {
    id: "paint",
    title: "untitled - Paint",
    icon: "/icons/mspaint.exe/000.ico",
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
    icon: "/icons/mspaint.exe/000.ico",
    component: asComponent(PaintFonts),
    width: 340,
    height: 78,
    resizable: false,
    singleInstance: false,
  },
  find: {
    id: "find",
    title: "Find: All Files",
    icon: "/icons/shell32.dll/113.ico",
    component: asComponent(Find),
    width: 480,
    height: 360,
    minWidth: 320,
    minHeight: 240,
    noPadding: true,
    singleInstance: false,
  },
  properties: {
    id: "properties",
    title: "Properties",
    icon: "/icons/shell32.dll/116.ico",
    component: asComponent(Properties),
    width: 340,
    height: 490,
    resizable: false,
    singleInstance: false,
  },
  "folder-options": {
    id: "folder-options",
    title: "Folder Options",
    icon: "/icons/shell32.dll/116.ico",
    component: asComponent(FolderOptions),
    width: 380,
    height: 580,
    resizable: false,
  },
  datetime: {
    id: "datetime",
    title: "Date/Time Properties",
    icon: "/icons/timedate.cpl/001.ico",
    component: asComponent(DateTime),
    width: 340,
    height: 460,
    resizable: false,
    singleInstance: true,
  },
  calculator: {
    id: "calculator",
    title: "Calculator",
    icon: "/icons/calc.exe/000.ico",
    component: asComponent(Calculator),
    width: 260,
    height: 360,
    resizable: false,
    noPadding: true,
    singleInstance: false,
  },
  "sound-recorder": {
    id: "sound-recorder",
    title: "Sound Recorder",
    icon: "/icons/mmsys.cpl/004.ico",
    component: asComponent(SoundRecorder),
    width: 380,
    height: 220,
    resizable: false,
    noPadding: true,
    singleInstance: false,
  },
  solitaire: {
    id: "solitaire",
    title: "Solitaire",
    icon: "/icons/sol.exe/000.ico",
    component: asComponent(Solitaire),
    width: 640,
    height: 480,
    minWidth: 480,
    minHeight: 380,
    noPadding: true,
    singleInstance: false,
  },
  pinball: {
    id: "pinball",
    title: "3D Pinball for Windows - Space Cadet",
    icon: "/icons/pinball.png",
    component: asComponent(Pinball),
    width: 616,
    height: 500,
    resizable: false,
    noPadding: true,
    singleInstance: true,
  },
  "task-manager": {
    id: "task-manager",
    title: "Task Manager",
    icon: "/icons/taskmgr.exe/000.ico",
    component: asComponent(TaskManager),
    width: 420,
    height: 420,
    minWidth: 360,
    minHeight: 320,
    noPadding: true,
    singleInstance: true,
  },
  charmap: {
    id: "charmap",
    title: "Character Map",
    icon: "/icons/charmap.exe/000.ico",
    component: asComponent(CharMap),
    width: 420,
    height: 420,
    minWidth: 380,
    minHeight: 340,
    noPadding: true,
    singleInstance: true,
  },
  // Winamp is a floating Webamp overlay (see src/lib/webamp.ts), not a real
  // managed window. This stub only satisfies the Record<AppId, AppDefinition>
  // type; the WindowManager never renders it and openApp("winamp") isn't used.
  winamp: {
    id: "winamp",
    title: "Winamp",
    icon: "/icons/winamp.exe/000.ico",
    component: asComponent(() => null),
    width: 275,
    height: 116,
    resizable: false,
    singleInstance: true,
  },
};

let cascade = 0;

export interface OpenAppOverrides {
  title?: string;
  data?: Record<string, unknown>;
}

export function openApp(appId: AppId, overrides?: OpenAppOverrides): string {
  if (appId === "control-panel") {
    return openApp("my-computer", {
      ...overrides,
      title: overrides?.title ?? "Control Panel",
      data: { ...overrides?.data, path: "Control Panel" },
    });
  }
  if (appId === "games-folder") {
    return openApp("my-computer", {
      ...overrides,
      title: overrides?.title ?? "Games",
      data: {
        ...overrides?.data,
        path: "C:\\Windows\\Start Menu\\Programs\\Games",
      },
    });
  }

  const def = APPS[appId];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 720;

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;

  const workAreaH = viewportH - TASKBAR_HEIGHT;

  const width = Math.min(def.width, viewportW - (isMobile ? 16 : 0));
  const height = Math.min(def.height, workAreaH - (isMobile ? 44 : 0));

  const offset = (cascade % 6) * 24;
  cascade += 1;

  const baseX = Math.min(
    Math.max(0, viewportW - width),
    Math.max(16, Math.round((viewportW - width) / 2) + offset - 60),
  );
  const baseY = Math.min(
    Math.max(0, workAreaH - height),
    Math.max(16, Math.round((workAreaH - height) / 2) + offset - 80),
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
