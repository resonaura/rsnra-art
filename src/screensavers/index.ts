import { DvdBounce } from "./DvdBounce";
import { FlowerBox } from "./FlowerBox";
import { Marquee } from "./Marquee";
import { Mystify } from "./Mystify";
import { Starfield } from "./Starfield";
import type { ScreenSaverDef } from "./types";

/**
 * Screen saver registry. To add a new saver (e.g. 3D Pipes): create a
 * component in this folder taking ScreenSaverProps and append an entry here —
 * it shows up in Display Properties ▸ Screen Saver and gets a .scr file in
 * C:\Windows\System automatically.
 */
export const SCREENSAVERS: ScreenSaverDef[] = [
  {
    id: "dvd",
    label: "DVD Bounce",
    file: "DVD Bounce.scr",
    Component: DvdBounce,
  },
  {
    id: "flowerbox",
    label: "3D Flower Box",
    file: "3D Flower Box.scr",
    Component: FlowerBox,
  },
  {
    id: "starfield",
    label: "Starfield Simulation",
    file: "Starfield Simulation.scr",
    Component: Starfield,
  },
  {
    id: "mystify",
    label: "Mystify Your Mind",
    file: "Mystify Your Mind.scr",
    Component: Mystify,
  },
  {
    id: "marquee",
    label: "Scrolling Marquee",
    file: "Scrolling Marquee.scr",
    Component: Marquee,
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
