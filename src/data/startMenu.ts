import { useMemo } from "react";
import { playSound } from "../lib/audio";

import { dirIcon, iconForNode } from "./fileIcons";
import { openVfsAudio, openWebamp } from "../lib/webamp";
import { showMissingFileAlert } from "../store/alertStore";
import type { VfsNode } from "../store/vfsStore";
import { useVfsStore } from "../store/vfsStore";
import { useWindowStore } from "../store/windowStore";
import { openApp } from "./apps";
import { getPreferredApp } from "./fileOpen";
import { lnkIcon, openLnk, parseLnk } from "./shortcuts";


export interface MenuNode {
  id: string;
  label: string;
  icon?: string;
  iconScale?: number;
  action?: () => void;
  children?: MenuNode[];
  disabled?: boolean;
  separator?: boolean; // renders a divider line instead of a menu item
}

function closeStartMenu() {
  useWindowStore.getState().setStartMenuOpen(false);
}

function run(fn: () => void) {
  return () => {
    fn();
    closeStartMenu();
  };
}

export function requestShutdown() {
  useWindowStore.getState().setStartMenuOpen(false);
  playSound("logoff");
  useWindowStore.getState().setPowerState("shutting-down");
}

// ── VFS-backed helpers ────────────────────────────────────────────────────────

/** Strip the .lnk suffix to get the display label */
function lnkLabel(name: string): string {
  return name.toLowerCase().endsWith(".lnk") ? name.slice(0, -4) : name;
}

/**
 * Build a MenuNode subtree from a VFS directory.
 * - Subdirectories become submenus (recursive).
 * - .lnk files become action items via parseLnk / openLnk / lnkIcon.
 * - Other files are ignored (they shouldn't be here, but robustness matters).
 * - Hidden nodes are skipped.
 */
function vfsDirToMenuNodes(
  absPath: string,
  vfs: { list: (path: string) => VfsNode[] | null },
  depth = 0,
): MenuNode[] {
  if (depth > 4) return []; // guard against infinite recursion
  const list = vfs.list(absPath) ?? [];
  const nodes: MenuNode[] = [];

  for (const node of list) {
    if (node.hidden) continue;

    const nodeAbs =
      absPath.replace(/\\+$/, "") + "\\" + node.name;

    if (node.type === "dir") {
      // Subdirectory → submenu — icon resolved via unified dirIcon()
      const children = vfsDirToMenuNodes(nodeAbs, vfs, depth + 1);
      nodes.push({
        id: nodeAbs,
        label: node.name,
        icon: dirIcon(node),
        children,
      });
    } else if (node.name.toLowerCase().endsWith(".lnk")) {
      const lnk = parseLnk(node);
      if (!lnk) continue;
      const disabled = lnk.type === "missing";
      nodes.push({
        id: nodeAbs,
        label: lnkLabel(node.name),
        icon: lnkIcon(lnk),
        disabled,
        action: run(() => {
          if (lnk.type === "missing") {
            showMissingFileAlert(lnkLabel(node.name), lnk.file ?? `${lnkLabel(node.name)}.exe`);
          } else if (lnk.target === "winamp") {
            void openWebamp();
          } else {
            openLnk(lnk, lnkLabel(node.name));
          }
        }),
      });
    }
    // other file types: skip silently
  }

  return nodes;
}

// ── Documents: built from the live C:\My Documents VFS ───────────────────────

function docChildren(
  path: string,
  vfs: { list: (path: string) => VfsNode[] | null },
): MenuNode[] {
  const list = vfs.list(path) ?? [];
  const nodes: MenuNode[] = [];
  for (const node of list) {
    if (node.hidden) continue;
    const abs = path === "C:\\" ? `C:\\${node.name}` : `${path}\\${node.name}`;
    if (node.type === "dir") {
      nodes.push({
        id: abs,
        label: node.name,
        icon: dirIcon(node),
        children: docChildren(abs, vfs),
      });
    } else {
      nodes.push({
        id: abs,
        label: node.name,
        icon: iconForNode(node),
        action: run(() => openFile(abs, node)),
      });
    }
  }
  return nodes;
}

function openFile(abs: string, node: VfsNode) {
  if (node.appId) {
    openApp(node.appId as never);
    return;
  }
  const preferred = getPreferredApp(node.name);
  if (preferred) {
    preferred.open(abs, node.name);
    return;
  }
  const lower = node.name.toLowerCase();
  if (
    lower.endsWith(".wav") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".mid") ||
    lower.endsWith(".midi") ||
    lower.endsWith(".rmi") ||
    lower.endsWith(".ogg")
  ) {
    void openVfsAudio(abs).then((played) => {
      if (!played && lower.endsWith(".wav")) {
        openApp("sound-recorder", {
          title: `${node.name} - Sound Recorder`,
          data: { path: abs },
        });
      }
    });
  } else if (
    lower.endsWith(".txt") ||
    lower.endsWith(".log") ||
    lower.endsWith(".ini")
  ) {
    openApp("notepad", {
      title: `${node.name} - Notepad`,
      data: { path: abs },
    });
  } else if (lower.endsWith(".png") || lower.endsWith(".bmp")) {
    openApp("paint", { title: `${node.name} - Paint`, data: { path: abs } });
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * The full Start menu tree.
 *
 * Programs → read dynamically from C:\Windows\Start Menu\Programs in VFS.
 *   Any .lnk files or subdirectories the user adds/removes there are reflected
 *   immediately — no code changes needed.
 *
 * Subscriptions are scoped to only the VFS nodes we actually render, so an
 * unrelated file write (e.g. saving a Paint canvas) does NOT trigger a
 * Start Menu re-render.
 */
export function useStartMenuTree(): MenuNode[] {
  // With immutable VFS, each mutation creates new node objects along the
  // changed path. Subscribing to the specific folder node means we only
  // re-render when that exact folder's contents change.
  const programsNode = useVfsStore((s) => {
    const win = s.root.children?.find(
      (c) => c.name.toLowerCase() === "windows",
    );
    const sm = win?.children?.find(
      (c) => c.name.toLowerCase() === "start menu",
    );
    return sm?.children?.find(
      (c) => c.name.toLowerCase() === "programs",
    ) ?? null;
  });

  const docsNode = useVfsStore((s) =>
    s.root.children?.find(
      (c) => c.name.toLowerCase() === "my documents",
    ) ?? null,
  );

  // list() reads the store on demand; wrap in getState() so it doesn't create
  // an extra subscription.
  const listFn = useVfsStore.getState().list;

  const programsChildren = useMemo(
    () => vfsDirToMenuNodes("C:\\Windows\\Start Menu\\Programs", { list: listFn }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programsNode],          // recompute only when the Programs folder changes
  );

  const docs = useMemo(
    () => docChildren("C:\\My Documents", { list: listFn }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docsNode],              // recompute only when My Documents changes
  );

  // The static top-level items never change — stable reference via useMemo.
  return useMemo(
    () => [
      {
        id: "programs",
        label: "Programs",
        icon: "/icons/w2k-programs.ico",
        children: programsChildren,
      },
      {
        id: "documents",
        label: "Documents",
        icon: "/icons/w2k_documents.ico",
        iconScale: 1.33,
        children: docs,
      },
      {
        id: "settings",
        label: "Settings",
        icon: "/icons/w2k_settings.ico",
        iconScale: 1.33,
        children: [
          {
            id: "control-panel",
            label: "Control Panel",
            icon: "/icons/w2k_control_panel.ico",
            action: run(() => openApp("control-panel")),
          },
        ],
      },
      {
        id: "find",
        label: "Find",
        icon: "/icons/w2k_search2.ico",
        iconScale: 1.33,
        children: [
          {
            id: "find-files",
            label: "Files or Folders...",
            icon: "/icons/w2k_search2.ico",
            iconScale: 1.33,
            action: run(() => openApp("find")),
          },
        ],
      },
      {
        id: "help",
        label: "Help",
        icon: "/icons/w2k_help.ico",
        iconScale: 1.33,
        action: run(() => openApp("help")),
      },
      {
        id: "run",
        label: "Run...",
        icon: "/icons/w2k_run.ico",
        iconScale: 1.33,
        action: () => {
          useWindowStore.getState().setRunDialogOpen(true);
          closeStartMenu();
        },
      },
      // Separator before Shut Down — just like real Windows 95
      { id: "__sep__", label: "", separator: true },
      {
        id: "shut-down",
        label: "Shut Down...",
        icon: "/icons/w2k_shutdown.ico",
        iconScale: 1.33,
        action: requestShutdown,
      },
    ],
    [programsChildren, docs],
  );
}
