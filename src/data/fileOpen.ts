import { openVfsAudio } from "../lib/webamp";
import { useFilePrefsStore } from "../store/filePrefsStore";
import type { AppId } from "../types/window";
import { openApp } from "./apps";

export interface OpenWithApp {
  appId: AppId;
  label: string;
  icon: string;
  extensions: string[]; // lowercase, no dot
  open: (path: string, name: string) => void;
}

const OPEN_WITH_CATALOG: OpenWithApp[] = [
  {
    appId: "notepad",
    label: "Notepad",
    icon: "/icons/notepad.png",
    extensions: ["txt", "log", "ini"],
    open: (path, name) =>
      openApp("notepad", { title: `${name} - Notepad`, data: { path } }),
  },
  {
    appId: "paint",
    label: "Paint",
    icon: "/icons/paint.png",
    extensions: ["png", "bmp"],
    open: (path, name) =>
      openApp("paint", { title: `${name} - Paint`, data: { path } }),
  },
  {
    appId: "sound-recorder",
    label: "Sound Recorder",
    icon: "/icons/sound-recorder.png",
    extensions: ["wav"],
    open: (path, name) =>
      openApp("sound-recorder", {
        title: `${name} - Sound Recorder`,
        data: { path },
      }),
  },
  {
    appId: "winamp",
    label: "Winamp",
    icon: "/icons/winamp.png",
    extensions: ["wav", "mp3", "mid", "midi", "rmi", "ogg"],
    open: (path) => void openVfsAudio(path),
  },
];

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Every app the Open With dialog should offer for this file name. Notepad
 * can always open anything as text, same as real Windows. */
export function candidatesFor(name: string): OpenWithApp[] {
  const ext = extOf(name);
  const matches = OPEN_WITH_CATALOG.filter((a) => a.extensions.includes(ext));
  const notepad = OPEN_WITH_CATALOG.find((a) => a.appId === "notepad")!;
  if (!matches.includes(notepad)) matches.push(notepad);
  return matches;
}

/** The app the user picked via Open With ▸ "Always use this program..." for
 * this file's extension, if any — callers check this before falling back to
 * their own built-in default-app logic. */
export function getPreferredApp(name: string): OpenWithApp | null {
  const ext = extOf(name);
  const preferred = useFilePrefsStore.getState().openWithDefaults[ext];
  if (!preferred) return null;
  return candidatesFor(name).find((a) => a.appId === preferred) ?? null;
}
