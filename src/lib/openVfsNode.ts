import { APPS, openApp } from "../data/apps";
import { getPreferredApp } from "../data/fileOpen";
import { openVfsAudio, openWebamp } from "./webamp";
import { showMissingFileAlert } from "./systemDialogs";
import { screenSaverByFile } from "../screensavers";
import { useSaverRunStore } from "../store/saverRunStore";
import type { VfsNode } from "../store/vfsStore";
import type { AppId } from "../types/window";
import { useWindowStore } from "../store/windowStore";

export interface VfsShortcut {
  type: "app" | "url" | "missing";
  target: string;
  icon?: string;
  shortcut?: boolean;
  title?: string;
  data?: Record<string, unknown>;
  file?: string;
}

export interface OpenVfsNodeOptions {
  /** Explorer can browse folders in-place or open them in their own window. */
  openDirectory?: (node: VfsNode, absolutePath: string) => void;
}

const AUDIO_EXTENSIONS = new Set(["wav", "mp3", "mid", "midi", "rmi", "ogg"]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function parseVfsShortcut(node: Pick<VfsNode, "content">): VfsShortcut | null {
  try {
    const parsed: unknown = JSON.parse(node.content ?? "");
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("type" in parsed) ||
      !("target" in parsed) ||
      typeof parsed.target !== "string" ||
      (parsed.type !== "app" &&
        parsed.type !== "url" &&
        parsed.type !== "missing")
    ) {
      return null;
    }
    return parsed as VfsShortcut;
  } catch {
    return null;
  }
}

function openShortcut(node: VfsNode, shortcut: VfsShortcut): void {
  const title = shortcut.title ?? node.name.replace(/\.lnk$/i, "");
  if (shortcut.type === "url") {
    if (shortcut.target === "show-desktop") {
      useWindowStore.getState().toggleShowDesktop();
      return;
    }
    try {
      const url = new URL(shortcut.target);
      if (
        url.protocol === "http:" ||
        url.protocol === "https:" ||
        url.protocol === "mailto:"
      ) {
        window.open(url.href, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      // A malformed URL is treated like a broken shortcut below.
    }
    void showMissingFileAlert(title, shortcut.target);
    return;
  }
  if (shortcut.type === "missing") {
    void showMissingFileAlert(title, shortcut.file ?? shortcut.target);
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(APPS, shortcut.target)) {
    void showMissingFileAlert(title, shortcut.target);
    return;
  }
  if (shortcut.target === "winamp") {
    void openWebamp();
  } else {
    openApp(shortcut.target as AppId, { title, data: shortcut.data });
  }
}

/** One shell dispatch path for opening VFS entries from Desktop, Explorer, and Find. */
export function openVfsNode(
  node: VfsNode,
  absolutePath: string,
  options: OpenVfsNodeOptions = {},
): void {
  if (node.type === "dir") {
    if (options.openDirectory) {
      options.openDirectory(node, absolutePath);
    } else {
      openApp("my-computer", { title: node.name, data: { path: absolutePath } });
    }
    return;
  }

  const extension = extensionOf(node.name);
  if (extension === "scr") {
    const saver = screenSaverByFile(node.name);
    if (saver) {
      useSaverRunStore.getState().run(saver.id);
      return;
    }
  }

  if (extension === "lnk") {
    const shortcut = parseVfsShortcut(node);
    if (shortcut) openShortcut(node, shortcut);
    return;
  }

  // Installed executables always run; an Open With preference must not
  // convert a registered program such as WINMINE.EXE into a text document.
  if (
    node.appId &&
    Object.prototype.hasOwnProperty.call(APPS, node.appId)
  ) {
    if (node.appId === "winamp") {
      void openWebamp();
    } else {
      openApp(node.appId as AppId);
    }
    return;
  }

  const preferred = getPreferredApp(node.name);
  if (preferred) {
    preferred.open(absolutePath, node.name);
    return;
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    void openVfsAudio(absolutePath).then((played) => {
      if (!played && extension === "wav") {
        openApp("sound-recorder", {
          title: `${node.name} - Sound Recorder`,
          data: { path: absolutePath },
        });
      }
    });
    return;
  }

  if (extension === "png" || extension === "bmp") {
    openApp("paint", {
      title: `${node.name} - Paint`,
      data: { path: absolutePath },
    });
    return;
  }

  // Like Windows' default text handler, Notepad is the final fallback for
  // formats without an installed application or a registered association.
  openApp("notepad", {
    title: `${node.name} - Notepad`,
    data: { path: absolutePath },
  });
}
