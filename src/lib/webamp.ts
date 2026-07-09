// Webamp (Winamp 2) integration. A single floating Webamp instance is created
// on demand and rendered into a transparent, pass-through full-viewport
// container so its windows float centered over the desktop (without blocking
// it) and can be dragged freely. Opening any audio file routes through it via
// `playUrl`.
//
//   • Position: Webamp centers itself in the viewport (its default).
//   • Taskbar: a virtual window entry is registered in windowStore so Winamp
//     shows up in the taskbar; clicking it restores Winamp. Closing Winamp
//     (via its own X) removes the taskbar button.
//   • Volume: the pseudo-Windows system volume (audioStore) drives Webamp's
//     volume too, via setVolume(0–100).
//   • Open file: a VFS file picker (supplied by <WebampHost>) is registered as
//     a Webamp filePicker so "Add file" can browse the virtual filesystem.
//
// Webamp is dynamically imported so its (large) bundle is code-split.

import { useAudioStore } from "../store/audioStore";
import { useVfsStore } from "../store/vfsStore";
import { useWindowStore } from "../store/windowStore";

export interface VfsFilePickerOpts {
  mode: "open";
  title?: string;
  initialDir?: string;
  filters?: { label: string; extensions: string[] }[];
}
export type VfsFilePicker = (opts: VfsFilePickerOpts) => Promise<string | null>;

// Map a VFS audio file path to a URL Webamp can actually fetch+play. Only the
// real .wav files under C:\Windows\Media have audio data (served from
// /windows/media). Other VFS "audio" files are placeholders with no real audio.
export function vfsAudioUrl(vfsPath: string): string | null {
  const lower = vfsPath.toLowerCase();
  if (!lower.startsWith("c:\\windows\\media\\")) return null;
  const name = vfsPath.split("\\").pop();
  if (!name) return null;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!["wav", "mp3", "mid", "midi", "rmi", "ogg"].includes(ext)) return null;
  return `/windows/media/${name.toLowerCase()}`;
}

type WebampInstance = {
  renderWhenReady: (node: HTMLElement) => Promise<void>;
  setTracksToPlay: (tracks: { url: string; defaultName?: string }[]) => void;
  appendTracks: (tracks: { url: string; defaultName?: string }[]) => void;
  setVolume: (v: number) => void;
  reopen: () => void;
  close: () => void;
  onWillClose: (cb: (cancel: () => void) => void) => () => void;
  onClose: (cb: () => void) => () => void;
  dispose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
};

let instancePromise: Promise<WebampInstance> | null = null;
let volumeUnsub: (() => void) | null = null;
// Set by <WebampHost> so the instance can browse the VFS when adding files.
let vfsPicker: VfsFilePicker | null = null;

/** Register the VFS file picker (called once by the <WebampHost> component). */
export function setVfsFilePicker(picker: VfsFilePicker): void {
  vfsPicker = picker;
}

const CONTAINER_ID = "rsnra-webamp-container";
let container: HTMLElement | null = null;

// A transparent, pass-through full-viewport container. We render Webamp INTO it
// (renderInto) rather than renderWhenReady(document.body) — the latter creates a
// #webamp node with its own background that paints white over the desktop.
// This container is transparent + pointer-events:none; Webamp's own windows
// re-enable pointer events via the injected CSS so the desktop behind stays
// clickable and visible. Webamp centers its windows within this container
// (i.e. the viewport).
function ensureContainer(): HTMLElement {
  if (container && container.parentElement) return container;
  const el = document.createElement("div");
  el.id = CONTAINER_ID;
  // Mount INSIDE #rsnra-desktop-root (not <body>) so Winamp shares the same
  // stacking context as the app windows. Mounting under <body> put it in a
  // separate stacking context above the fixed app root, making it always-on-top.
  // z-index is managed dynamically (syncZIndex) so Winamp participates in the
  // normal window z-order.
  el.style.cssText =
    "position:fixed;inset:0;z-index:10;pointer-events:none;background:transparent;";
  const style = document.createElement("style");
  // Only Webamp's windows (and their contents) should capture pointer events;
  // the container itself stays pass-through so it never blocks the desktop.
  style.textContent = `#${CONTAINER_ID}{pointer-events:none}#${CONTAINER_ID} *{pointer-events:auto}`;
  document.head.appendChild(style);
  const host = document.getElementById("rsnra-desktop-root") ?? document.body;
  host.appendChild(el);
  container = el;
  return el;
}

// The stable id used for Winamp's virtual taskbar window.
const WINAMP_WIN_ID = "app-winamp";

async function getInstance(): Promise<WebampInstance> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    const mod = await import("webamp");
    const Webamp = mod.default;
    const { volume, muted } = useAudioStore.getState();

    const filePickers = vfsPicker
      ? [
          {
            contextMenuName: "RSNRA.ART File...",
            filePicker: async (): Promise<
              { url: string; defaultName?: string }[]
            > => {
              if (!vfsPicker) return [];
              const path = await vfsPicker({
                mode: "open",
                title: "Open Media",
                initialDir: "C:\\Windows\\Media",
                filters: [
                  {
                    label: "Audio (*.wav;*.mp3;*.mid)",
                    extensions: ["wav", "mp3", "mid", "midi", "rmi", "ogg"],
                  },
                  { label: "All Files (*.*)", extensions: [] },
                ],
              });
              if (!path) return [];
              const url = vfsAudioUrl(path);
              if (!url) return [];
              return [{ url, defaultName: path.split("\\").pop() }];
            },
            requiresNetwork: false,
          },
        ]
      : undefined;

    const webamp = new Webamp({
      zIndex: 1,
      ...(filePickers ? { filePickers } : {}),
    } as unknown as ConstructorParameters<typeof Webamp>[0]) as WebampInstance;

    // Render into our own transparent, pass-through container (NOT
    // renderWhenReady(document.body), whose #webamp node paints white over the
    // desktop). Webamp centers its windows within the container (the viewport).
    const el = ensureContainer();
    await webamp.renderInto(el);

    // Make Winamp participate in the normal window z-order: bind the container's
    // z-index to the virtual window's zIndex, and focus that window when the
    // user clicks anywhere on Winamp (so it raises above other windows, and
    // clicking another window lowers it — just like a real window).
    const syncZIndex = () => {
      const w = useWindowStore
        .getState()
        .windows.find((wn) => wn.id === WINAMP_WIN_ID);
      if (w) el.style.zIndex = String(w.zIndex);
    };
    useWindowStore.subscribe(syncZIndex);
    el.addEventListener("mousedown", () => {
      useWindowStore.getState().focusWindow(WINAMP_WIN_ID);
    });

    // Register a virtual taskbar window so Winamp appears in the taskbar. The
    // WindowManager skips rendering a real AppWindow for it (Winamp floats on
    // its own). Closing Winamp via its own X removes the taskbar button.
    showTaskbarWindow();
    syncZIndex();
    webamp.onClose(() => {
      useWindowStore.getState().closeWindow(WINAMP_WIN_ID);
    });

    // Sync the system volume into Webamp now and on every change.
    webamp.setVolume(muted ? 0 : Math.round(volume * 100));
    volumeUnsub?.();
    volumeUnsub = useAudioStore.subscribe((s) => {
      webamp.setVolume(s.muted ? 0 : Math.round(s.volume * 100));
    });

    return webamp;
  })();
  return instancePromise;
}

/** Open Webamp (if not already) and play `url`, replacing the playlist. */
export async function playUrl(url: string, name?: string): Promise<void> {
  try {
    const webamp = await getInstance();
    webamp.reopen();
    webamp.setTracksToPlay([{ url, defaultName: name }]);
    showTaskbarWindow();
  } catch (err) {
    console.error("Webamp failed to open track", err);
  }
}

// Ensure the virtual Winamp taskbar window exists and is focused. Uses the
// stable id "app-winamp" so repeated calls reuse/restore the same button.
function showTaskbarWindow(): void {
  const ws = useWindowStore.getState();
  const existing = ws.windows.find((w) => w.id === WINAMP_WIN_ID);
  if (existing) {
    ws.focusWindow(WINAMP_WIN_ID);
    return;
  }
  ws.openWindow({
    appId: "winamp",
    title: "Winamp",
    icon: "/icons/winamp.exe/000.ico",
    bounds: { x: 0, y: 0, width: 275, height: 116 },
    resizable: false,
    singleInstance: true,
  });
}

/** Restore/raise Winamp (called when its taskbar button is clicked). */
export async function focusWebamp(): Promise<void> {
  try {
    const webamp = await getInstance();
    webamp.reopen();
    showTaskbarWindow();
  } catch (err) {
    console.error("Webamp failed to focus", err);
  }
}

/** Open Webamp with an empty playlist (e.g. launched from the Start menu). */
export async function openWebamp(): Promise<void> {
  try {
    const webamp = await getInstance();
    webamp.reopen();
    showTaskbarWindow();
  } catch (err) {
    console.error("Webamp failed to open", err);
  }
}

/** Open a VFS audio file in Webamp. Returns true if it was playable. */
export async function openVfsAudio(vfsPath: string): Promise<boolean> {
  const name = vfsPath.split("\\").pop() ?? "audio";
  const url = vfsAudioUrl(vfsPath);
  if (url) {
    await playUrl(url, name);
    return true;
  }
  // Not a bundled system sound — but it might be real audio saved elsewhere
  // in the VFS (e.g. a .wav from Sound Recorder), stored as a data: URL.
  // <audio>/Web Audio can play those directly, so hand it to Webamp as-is.
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!["wav", "mp3", "mid", "midi", "rmi", "ogg"].includes(ext)) return false;
  const content = useVfsStore.getState().read(vfsPath);
  if (!content || !content.startsWith("data:audio/")) return false;
  await playUrl(content, name);
  return true;
}
