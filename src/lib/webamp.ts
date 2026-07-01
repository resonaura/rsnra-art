// Webamp (Winamp 2) integration. A single floating Webamp instance is created
// on demand and rendered via the canonical `renderWhenReady(document.body)` so
// its windows float over the desktop (without blocking it) and can be dragged
// freely. Opening any audio file routes through it via `playUrl`.
//
// Fixes applied:
//  • Position: after render, dispatch UPDATE_WINDOW_POSITIONS (absolute) so the
//    main + playlist windows appear at the bottom-left, just above the taskbar.
//  • Volume: the pseudo-Windows system volume (audioStore) drives Webamp's
//    volume too, via setVolume(0–100).
//  • Open file: a VFS file picker (supplied by the <WebampHost> React wrapper,
//    which owns the useFileDialog hook) is registered as a Webamp filePicker so
//    "Add file" can browse the virtual filesystem instead of the host OS.
//
// Webamp is dynamically imported so its (large) bundle is code-split.

import { useAudioStore } from "../store/audioStore";

export interface VfsFilePickerOpts {
  mode: "open";
  title?: string;
  initialDir?: string;
  filters?: { label: string; extensions: string[] }[];
}
export type VfsFilePicker = (opts: VfsFilePickerOpts) => Promise<string | null>;

const TASKBAR = 36;

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
  store: {
    dispatch: (a: { type: string; [k: string]: unknown }) => void;
    getState: () => unknown;
  };
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
// clickable and visible.
function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  const el = document.createElement("div");
  el.id = CONTAINER_ID;
  el.style.cssText =
    "position:fixed;inset:0;z-index:150000;pointer-events:none;background:transparent;";
  const style = document.createElement("style");
  // Only Webamp's windows (and their contents) should capture pointer events;
  // the container itself stays pass-through so it never blocks the desktop.
  style.textContent = `#${CONTAINER_ID}{pointer-events:none}#${CONTAINER_ID} *{pointer-events:auto}`;
  document.head.appendChild(style);
  document.body.appendChild(el);
  container = el;
  return el;
}

// Place the main + playlist windows at the bottom-left, above the taskbar.
function positionAtBottom(webamp: WebampInstance): void {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 720;
  const mainH = 58; // standard Winamp main-window height
  const mainW = 275;
  const playlistW = 275;
  const margin = 8;
  const bottom = vh - TASKBAR - margin; // bottom edge of usable area
  const y = bottom - mainH;
  const x = margin;
  try {
    webamp.store.dispatch({
      type: "UPDATE_WINDOW_POSITIONS",
      positions: {
        main: { x, y },
        playlist: { x: x + mainW, y },
        equalizer: { x, y: y - mainH - 4 },
        milkdrop: { x: Math.max(margin, (vw - playlistW) / 2), y: margin },
      },
      absolute: true,
    });
  } catch {
    // Positioning is best-effort; if the internal action shape changes we just
    // fall back to Webamp's default centered layout.
  }
  void mainW;
  void playlistW;
}

async function getInstance(): Promise<WebampInstance> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    const mod = await import("webamp");
    const Webamp = mod.default;
    const { volume, muted } = useAudioStore.getState();

    const filePickers = vfsPicker
      ? [
          {
            contextMenuName: "RSNRA 95 File...",
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
      zIndex: 150000,
      ...(filePickers ? { filePickers } : {}),
    } as unknown as ConstructorParameters<typeof Webamp>[0]) as WebampInstance;

    // Render into our own transparent, pass-through container (NOT
    // renderWhenReady(document.body), whose #webamp node paints white over the
    // desktop). Then move the windows to the bottom-left.
    await webamp.renderInto(ensureContainer());
    positionAtBottom(webamp);

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
  } catch (err) {
    console.error("Webamp failed to open track", err);
  }
}

/** Open Webamp with an empty playlist (e.g. launched from the Start menu). */
export async function openWebamp(): Promise<void> {
  try {
    const webamp = await getInstance();
    webamp.reopen();
  } catch (err) {
    console.error("Webamp failed to open", err);
  }
}

/** Open a VFS audio file in Webamp. Returns true if it was playable. */
export async function openVfsAudio(vfsPath: string): Promise<boolean> {
  const url = vfsAudioUrl(vfsPath);
  if (!url) return false;
  const name = vfsPath.split("\\").pop() ?? "audio";
  await playUrl(url, name);
  return true;
}
