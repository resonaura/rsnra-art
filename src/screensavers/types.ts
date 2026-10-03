import type { ComponentType } from "react";

export interface ScreenSaverSettings {
  text?: string;
  mode?: "text" | "time";
  speed?: number;
  size?: number;
  resolution?: number;
  count?: number;
  rotation?: "none" | "spin" | "tumble" | "wobble" | "random";
  surfaceStyle?: "solid" | "textured";
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  palette?: "dvd" | "windows" | "spectrum";
}

export interface ScreenSaverSettingsPanelProps {
  settings: ScreenSaverSettings;
  onApply: (settings: ScreenSaverSettings) => void;
  onCancel: () => void;
}

export interface ScreenSaverProps {
  /** True when rendered inside the small Display Properties monitor preview. */
  preview?: boolean;
  settings?: ScreenSaverSettings;
}

export interface ScreenSaverDef {
  id: string;
  /** Name shown in the Screen Saver dropdown, e.g. "3D Flower Box". */
  label: string;
  /** The .scr file name it represents (seeded into C:\WINNT\System32). */
  file: string;
  Component: ComponentType<ScreenSaverProps>;
  /** Optional settings dialog body; enables the "Settings…" button. */
  Settings?: ComponentType<ScreenSaverSettingsPanelProps>;
}
