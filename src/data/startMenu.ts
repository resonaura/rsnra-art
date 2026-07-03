import { useShallow } from "zustand/react/shallow";
import { playSound } from "../lib/audio";
import { openVfsAudio, openWebamp } from "../lib/webamp";
import type { VfsNode } from "../store/vfsStore";
import { useVfsStore } from "../store/vfsStore";
import { useWindowStore } from "../store/windowStore";
import { openApp } from "./apps";
import { getPreferredApp } from "./fileOpen";

export interface MenuNode {
  id: string;
  label: string;
  icon?: string;
  iconScale?: number;
  action?: () => void;
  children?: MenuNode[];
  disabled?: boolean;
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

// Build the "Documents" submenu from the *actual* contents of C:\My Documents
// in the live VFS, so the Start menu reflects files the user has created or
// edited (not a hardcoded list). Files open in the app that handles them;
// folders expand into their contents.
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
        icon: "/icons/folder-open.png",
        children: docChildren(abs, vfs),
      });
    } else {
      nodes.push({
        id: abs,
        label: node.name,
        icon: "/icons/notepad-file.png",
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

/** The full Start menu tree, with Documents rebuilt from the live VFS. */
export function useStartMenuTree(): MenuNode[] {
  const vfs = useVfsStore(useShallow((s) => ({ root: s.root, list: s.list })));
  const docs = docChildren("C:\\My Documents", vfs);
  return [
    {
      id: "programs",
      label: "Programs",
      icon: "/icons/w2k-programs.png",
      children: [
        {
          id: "accessories",
          label: "Accessories",
          icon: "/icons/folder-open.png",
          children: [
            {
              id: "terminal",
              label: "Command Prompt",
              icon: "/icons/terminal.png",
              action: run(() => openApp("terminal")),
            },
            {
              id: "notepad",
              label: "Notepad",
              icon: "/icons/notepad.png",
              action: run(() =>
                openApp("notepad", {
                  title: "bio.txt - Notepad",
                  data: { docId: "bio" },
                }),
              ),
            },
            {
              id: "paint",
              label: "Paint",
              icon: "/icons/paint.png",
              action: run(() => openApp("paint")),
            },
            {
              id: "calculator",
              label: "Calculator",
              icon: "/icons/calculator.png",
              action: run(() => openApp("calculator")),
            },
            {
              id: "sound-recorder",
              label: "Sound Recorder",
              icon: "/icons/sound-recorder.png",
              action: run(() => openApp("sound-recorder")),
            },
          ],
        },
        {
          id: "winamp",
          label: "Winamp",
          icon: "/icons/winamp.png",
          action: run(() => openWebamp()),
        },
        {
          id: "games",
          label: "Games",
          icon: "/icons/joystick.png",
          children: [
            {
              id: "minesweeper",
              label: "Minesweeper",
              icon: "/icons/minesweeper.png",
              action: run(() => openApp("minesweeper")),
            },
            {
              id: "snake",
              label: "RSNRA Snake",
              icon: "/icons/joystick.png",
              action: run(() => openApp("snake")),
            },
            {
              id: "solitaire",
              label: "Solitaire",
              icon: "/icons/solitaire.png",
              action: run(() => openApp("solitaire")),
            },
            {
              id: "pinball",
              label: "3D Pinball",
              icon: "/icons/pinball.png",
              action: run(() => openApp("pinball")),
            },
          ],
        },
        {
          id: "my-computer",
          label: "My Computer",
          icon: "/icons/computer.png",
          action: run(() => openApp("my-computer")),
        },
      ],
    },
    {
      id: "documents",
      label: "Documents",
      icon: "/icons/documents.png",
      iconScale: 1.33,
      children: docs,
    },
    {
      id: "settings",
      label: "Settings",
      icon: "/icons/settings.png",
      iconScale: 1.33,
      children: [
        {
          id: "control-panel",
          label: "Control Panel",
          icon: "/icons/control-panel.png",
          action: run(() => openApp("control-panel")),
        },
        {
          id: "taskbar-settings",
          label: "Taskbar...",
          icon: "/icons/settings.png",
          disabled: true,
        },
      ],
    },
    {
      id: "find",
      label: "Find",
      icon: "/icons/find.png",
      iconScale: 1.33,
      children: [
        {
          id: "find-files",
          label: "Files or Folders...",
          icon: "/icons/find.png",
          action: run(() => openApp("find")),
        },
        {
          id: "find-computer",
          label: "Computer...",
          icon: "/icons/computer.png",
          disabled: true,
        },
      ],
    },
    {
      id: "help",
      label: "Help",
      icon: "/icons/help.png",
      iconScale: 1.33,
      action: run(() => openApp("help")),
    },
    {
      id: "run",
      label: "Run...",
      icon: "/icons/msdos.png",
      action: () => {
        useWindowStore.getState().setRunDialogOpen(true);
        closeStartMenu();
      },
    },
    {
      id: "shut-down",
      label: "Shut Down...",
      icon: "/icons/battery.png",
      iconScale: 1.33,
      action: requestShutdown,
    },
  ];
}
