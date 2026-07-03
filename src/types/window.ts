export type AppId =
  | "welcome"
  | "my-computer"
  | "notepad"
  | "music"
  | "contact"
  | "terminal"
  | "minesweeper"
  | "snake"
  | "games-folder"
  | "recycle-bin"
  | "help"
  | "control-panel"
  | "display-properties"
  | "mouse-properties"
  | "system-properties"
  | "social"
  | "paint"
  | "paint-fonts"
  | "find"
  | "properties"
  | "datetime"
  | "winamp"
  | "calculator"
  | "sound-recorder"
  | "solitaire"
  | "pinball"
  | "task-manager"
  | "folder-options"
  | "charmap";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInstance {
  id: string;
  pid: number;
  appId: AppId;
  title: string;
  icon: string;
  bounds: Bounds;
  prevBounds: Bounds | null;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  resizable: boolean;
  data?: Record<string, unknown>;
}

export interface OpenAppOptions {
  title?: string;
  data?: Record<string, unknown>;
}
