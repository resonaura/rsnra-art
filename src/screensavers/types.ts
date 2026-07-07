import type { ComponentType } from "react";

export interface ScreenSaverProps {
  /** True when rendered inside the small Display Properties monitor preview. */
  preview?: boolean;
}

export interface ScreenSaverDef {
  id: string;
  /** Name shown in the Screen Saver dropdown, e.g. "3D Flower Box". */
  label: string;
  /** The .scr file name it pretends to be (seeded into C:\Windows\System). */
  file: string;
  Component: ComponentType<ScreenSaverProps>;
  /** Optional settings dialog body; enables the "Settings…" button. */
  Settings?: ComponentType<{ onClose: () => void }>;
}
