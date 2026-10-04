import { APPS, openApp } from "../data/apps";
import { useVfsStore, type VfsNode } from "../store/vfsStore";
import type { AppId } from "../types/window";
import { createFileShortcut, parseVfsShortcut } from "./openVfsNode";
import { USER_DESKTOP_PATH, USER_SEND_TO_PATH } from "./windowsPaths";

export interface SendToSource {
  node: VfsNode;
  path: string;
  icon?: string;
}

interface SendToAction {
  kind: "desktop-shortcut" | "folder" | "app";
  path?: string;
  appId?: AppId;
}

function sendToAction(entry: VfsNode): SendToAction | null {
  const name = entry.name.toLowerCase();
  if (entry.type === "file" && name.endsWith(".desklink")) {
    return { kind: "desktop-shortcut" };
  }

  const vfs = useVfsStore.getState();
  if (entry.type === "dir") {
    const path = vfs.resolvePath(`${USER_SEND_TO_PATH}\\${entry.name}`);
    return path ? { kind: "folder", path } : null;
  }

  if (entry.name.toLowerCase().endsWith(".lnk")) {
    const shortcut = parseVfsShortcut(entry);
    if (!shortcut) return null;

    if (
      shortcut.type === "app" &&
      Object.prototype.hasOwnProperty.call(APPS, shortcut.target) &&
      shortcut.target !== "winamp"
    ) {
      return { kind: "app", appId: shortcut.target as AppId };
    }

    if (shortcut.type === "file") {
      const path = vfs.resolvePath(shortcut.target);
      const target = path ? vfs.resolve(path) : null;
      if (path && target?.type === "dir") return { kind: "folder", path };
    }
  }

  if (
    entry.appId &&
    Object.prototype.hasOwnProperty.call(APPS, entry.appId) &&
    entry.appId !== "winamp"
  ) {
    return { kind: "app", appId: entry.appId as AppId };
  }

  return null;
}

export function isSendToMenuEntry(entry: VfsNode): boolean {
  return sendToAction(entry) !== null;
}

export function isSendToMenuEntryEnabled(
  entry: VfsNode,
  sourceCount: number,
): boolean {
  const action = sendToAction(entry);
  return !!action && (action.kind !== "app" || sourceCount === 1);
}

export function sendToMenuLabel(entry: VfsNode): string {
  if (entry.name.toLowerCase().endsWith(".desklink")) {
    return entry.name.slice(0, -".DeskLink".length);
  }
  if (entry.name.toLowerCase().endsWith(".lnk")) {
    return entry.name.replace(/\.lnk$/i, "");
  }
  return entry.name;
}

export function dispatchSendToEntry(
  entry: VfsNode,
  sources: SendToSource[],
): { succeeded: number; failed: number } {
  if (!sources.length) return { succeeded: 0, failed: 0 };
  const action = sendToAction(entry);
  if (!action) return { succeeded: 0, failed: sources.length };

  const vfs = useVfsStore.getState();
  let succeeded = 0;
  let failed = 0;

  if (action.kind === "desktop-shortcut") {
    vfs.transaction("Create desktop shortcuts", () => {
      for (const source of sources) {
        if (createFileShortcut(source.path, USER_DESKTOP_PATH, source.icon)) {
          succeeded++;
        } else {
          failed++;
        }
      }
    });
    return { succeeded, failed };
  }

  if (action.kind === "folder" && action.path) {
    vfs.transaction(`Send to ${sendToMenuLabel(entry)}`, () => {
      for (const source of sources) {
        if (vfs.copyTo(source.path, action.path!)) succeeded++;
        else failed++;
      }
    });
    return { succeeded, failed };
  }

  if (action.kind === "app" && action.appId && sources.length === 1) {
    const source = sources[0];
    vfs.recordRecentDocument(source.path);
    openApp(action.appId, {
      title: `${source.node.name} - ${sendToMenuLabel(entry)}`,
      data: { path: source.path },
    });
    return { succeeded: 1, failed: 0 };
  }

  return { succeeded: 0, failed: sources.length };
}
