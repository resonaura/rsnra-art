import { useMemo } from "react";
import { playSound } from "../lib/audio";
import {
  ALL_USERS_START_MENU_PATH,
  USER_RECENT_PATH,
  USER_PROGRAMS_PATH,
} from "../lib/windowsPaths";

import { showMissingFileAlert } from "../lib/systemDialogs";
import { openVfsNode, parseVfsShortcut } from "../lib/openVfsNode";
import type { VfsNode } from "../store/vfsStore";
import { useVfsStore } from "../store/vfsStore";
import { useWindowStore } from "../store/windowStore";
import { openApp } from "./apps";
import { dirIcon, iconForNode } from "./fileIcons";
import { lnkIcon, parseLnk } from "./shortcuts";

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
 * - .lnk files become action items through the common virtual Shell dispatcher.
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

    const nodeAbs = absPath.replace(/\\+$/, "") + "\\" + node.name;

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
          openVfsNode(node, nodeAbs);
        }),
      });
    }
    // other file types: skip silently
  }

  return nodes;
}

/** Merge per-user Programs over the common menu, merging same-named groups. */
function mergeProgramMenuNodes(
  common: MenuNode[],
  user: MenuNode[],
): MenuNode[] {
  const merged = [...common];
  for (const userNode of user) {
    const commonIndex = merged.findIndex(
      (node) => node.label.toLowerCase() === userNode.label.toLowerCase(),
    );
    if (commonIndex === -1) {
      merged.push(userNode);
      continue;
    }

    const commonNode = merged[commonIndex];
    if (commonNode.children && userNode.children) {
      merged[commonIndex] = {
        ...userNode,
        children: mergeProgramMenuNodes(commonNode.children, userNode.children),
      };
    } else {
      // A same-named per-user entry takes precedence over the shared entry.
      merged[commonIndex] = userNode;
    }
  }
  return merged;
}

// ── Documents: the Shell's per-user Recent shortcut list ─────────────────────

function recentDocumentChildren(
  path: string,
  vfs: {
    list: (path: string) => VfsNode[] | null;
    resolve: (path: string) => VfsNode | null;
    resolvePath: (path: string) => string | null;
  },
): MenuNode[] {
  return (vfs.list(path) ?? [])
    .filter((node) => !node.hidden && node.type === "file")
    .flatMap((node) => {
      const shortcut = parseVfsShortcut(node);
      if (!shortcut || shortcut.type !== "file") return [];
      const targetPath = vfs.resolvePath(shortcut.target);
      const target = targetPath ? vfs.resolve(targetPath) : null;
      const abs = `${path.replace(/\\+$/, "")}\\${node.name}`;
      const label = shortcut.title ?? lnkLabel(node.name);
      return [{
        id: abs,
        label,
        icon: target ? iconForNode(target) : lnkIcon(shortcut),
        action: run(() => {
          if (!target || !targetPath) {
            void showMissingFileAlert(label, shortcut.target);
            return;
          }
          openVfsNode(target, targetPath);
        }),
      }];
    })
    .sort((left, right) => {
      const leftNode = vfs.resolve(left.id);
      const rightNode = vfs.resolve(right.id);
      return (rightNode?.modified ?? rightNode?.created ?? 0) -
        (leftNode?.modified ?? leftNode?.created ?? 0);
    })
    .slice(0, 15);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * The full Start menu tree.
 *
 * Programs → merge the current user's program groups with All Users groups.
 *   Same-named folders merge recursively; a same-named per-user shortcut wins.
 *   Changes to either physical profile folder are reflected immediately.
 * Documents → the current user's recent-document shortcuts, newest first.
 *   Opening a missing target reports the stored path like a normal broken link.
 *
 * Subscriptions are scoped to only the VFS nodes we actually render, so an
 * unrelated file write (e.g. saving a Paint canvas) does NOT trigger a
 * Start Menu re-render.
 */
export function useStartMenuTree(): MenuNode[] {
  // With immutable VFS, each mutation creates new node objects along the
  // changed path. Subscribing to the specific folder node means we only
  // re-render when that exact folder's contents change.
  const programsNode = useVfsStore((s) =>
    s.resolve(`${ALL_USERS_START_MENU_PATH}\\Programs`),
  );
  const userProgramsNode = useVfsStore((s) => s.resolve(USER_PROGRAMS_PATH));

  const recentNode = useVfsStore((s) => s.resolve(USER_RECENT_PATH));

  // list() reads the store on demand; wrap in getState() so it doesn't create
  // an extra subscription.
  const listFn = useVfsStore.getState().list;
  const resolveFn = useVfsStore.getState().resolve;
  const resolvePathFn = useVfsStore.getState().resolvePath;

  const programsChildren = useMemo(
    () => {
      const common = vfsDirToMenuNodes(
        `${ALL_USERS_START_MENU_PATH}\\Programs`,
        { list: listFn },
      );
      const user = vfsDirToMenuNodes(USER_PROGRAMS_PATH, { list: listFn });
      return mergeProgramMenuNodes(common, user);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programsNode, userProgramsNode],
  );

  const docs = useMemo(
    () =>
      recentDocumentChildren(USER_RECENT_PATH, {
        list: listFn,
        resolve: resolveFn,
        resolvePath: resolvePathFn,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentNode], // recompute only when the profile's Recent folder changes
  );

  // The static top-level items never change — stable reference via useMemo.
  return useMemo(
    () => [
      {
        id: "programs",
        label: "Programs",
        icon: "/icons/shell32.dll/083.ico",
        children: programsChildren,
      },
      {
        id: "documents",
        label: "Documents",
        icon: "/icons/shell32.dll/065.ico",
        iconScale: 32 / 24,
        children: docs.length ? docs : undefined,
        disabled: docs.length === 0,
      },
      {
        id: "settings",
        label: "Settings",
        icon: "/icons/shell32.dll/067.ico",
        iconScale: 32 / 24,
        children: [
          {
            id: "taskbar-properties",
            label: "Taskbar & Start Menu...",
            icon: "/icons/shell32.dll/067.ico",
            action: run(() => openApp("taskbar-properties")),
          },
          {
            id: "control-panel",
            label: "Control Panel",
            icon: "/icons/shell32.dll/082.ico",
            action: run(() => openApp("control-panel")),
          },
        ],
      },
      {
        id: "find",
        label: "Find",
        icon: "/icons/shell32.dll/068.ico",
        iconScale: 32 / 24,
        children: [
          {
            id: "find-files",
            label: "Files or Folders...",
            icon: "/icons/shell32.dll/068.ico",
            iconScale: 32 / 24,
            action: run(() => openApp("find")),
          },
        ],
      },
      {
        id: "help",
        label: "Help",
        icon: "/icons/shell32.dll/069.ico",
        iconScale: 32 / 24,
        action: run(() => openApp("help")),
      },
      {
        id: "run",
        label: "Run...",
        icon: "/icons/shell32.dll/070.ico",
        iconScale: 32 / 24,
        action: () => {
          useWindowStore.getState().setRunDialogOpen(true);
          closeStartMenu();
        },
      },
      // Separator before Shut Down — just like the classic Windows 2000 menu.
      { id: "__sep__", label: "", separator: true },
      {
        id: "shut-down",
        label: "Shut Down...",
        icon: "/icons/shell32.dll/073.ico",
        iconScale: 32 / 24,
        action: requestShutdown,
      },
    ],
    [programsChildren, docs],
  );
}
