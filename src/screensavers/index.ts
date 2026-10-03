import { DvdBounce, DvdBounceSettings } from "./DvdBounce";
import { FlowerBox } from "./FlowerBox";
import { Marquee } from "./Marquee";
import { Mystify } from "./Mystify";
import { RainyWindow } from "./RainyWindow";
import { Starfield } from "./Starfield";
import { ThreeDText, ThreeDTextSettings } from "./ThreeDText";
import { MarqueeSettings } from "./Marquee";
import { FlowerBoxSettings, MystifySettings, StarfieldSettings } from "./SaverTuningDialog";
import type { ScreenSaverDef } from "./types";

/**
 * Screen saver registry. To add a new saver (e.g. 3D Pipes): create a
 * component in this folder taking ScreenSaverProps and append an entry here —
 * it shows up in Display Properties ▸ Screen Saver and gets a .scr file in
 * C:\WINNT\System32 automatically.
 */
export const SCREENSAVERS: ScreenSaverDef[] = [
  {
    id: "3d-text",
    label: "3D Text",
    file: "3D Text.scr",
    Component: ThreeDText,
    Settings: ThreeDTextSettings,
  },
  {
    id: "rainy-window",
    label: "Rainy Window",
    file: "Rainy Window.scr",
    Component: RainyWindow,
  },
  {
    id: "dvd",
    label: "DVD Bounce",
    file: "DVD Bounce.scr",
    Component: DvdBounce,
    Settings: DvdBounceSettings,
  },
  {
    id: "flowerbox",
    label: "3D Flower Box",
    file: "3D Flower Box.scr",
    Component: FlowerBox,
    Settings: FlowerBoxSettings,
  },
  {
    id: "starfield",
    label: "Starfield Simulation",
    file: "Starfield Simulation.scr",
    Component: Starfield,
    Settings: StarfieldSettings,
  },
  {
    id: "mystify",
    label: "Mystify Your Mind",
    file: "Mystify Your Mind.scr",
    Component: Mystify,
    Settings: MystifySettings,
  },
  {
    id: "marquee",
    label: "Scrolling Marquee",
    file: "Scrolling Marquee.scr",
    Component: Marquee,
    Settings: MarqueeSettings,
  },
];

export function getScreenSaver(id: string): ScreenSaverDef | null {
  return SCREENSAVERS.find((s) => s.id === id) ?? null;
}

export function screenSaverByFile(file: string): ScreenSaverDef | null {
  return (
    SCREENSAVERS.find((s) => s.file.toLowerCase() === file.toLowerCase()) ??
    null
  );
}
