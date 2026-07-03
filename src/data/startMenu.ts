import { useShallow } from "zustand/react/shallow";
import { playSound } from "../lib/audio";
import { openVfsAudio, openWebamp } from "../lib/webamp";
import { showMissingFileAlert } from "../store/alertStore";
import type { VfsNode } from "../store/vfsStore";
import { useVfsStore } from "../store/vfsStore";
import { useWindowStore } from "../store/windowStore";
import { openApp } from "./apps";
import { getPreferredApp } from "./fileOpen";
import { GAMES } from "./games";

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
        icon: "/icons/w2k_directory_open.ico",
        children: docChildren(abs, vfs),
      });
    } else {
      nodes.push({
        id: abs,
        label: node.name,
        icon: "/icons/w2k_text_file.ico",
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
      icon: "/icons/w2k-programs.ico",
      children: [
        {
          id: "accessories",
          label: "Accessories",
          icon: "/icons/w2k_folder_open.ico",
          children: [
            {
              id: "terminal",
              label: "Command Prompt",
              icon: "/icons/w98_console_prompt.ico",
              action: run(() => openApp("terminal")),
            },
            {
              id: "notepad",
              label: "Notepad",
              icon: "/icons/w2k_notepad_2.ico",
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
              icon: "/icons/w2k_paint.ico",
              action: run(() => openApp("paint")),
            },
            {
              id: "calculator",
              label: "Calculator",
              icon: "/icons/w98_calculator.ico",
              action: run(() => openApp("calculator")),
            },
            {
              id: "sound-recorder",
              label: "Sound Recorder",
              icon: "/icons/w98_cassette_tape.ico",
              action: run(() => openApp("sound-recorder")),
            },
            {
              id: "charmap",
              label: "Character Map",
              icon: "/icons/w98_charmap.ico",
              action: run(() => openApp("charmap")),
            },
          ],
        },
        {
          id: "games",
          label: "Games",
          icon: "/icons/w98_joystick.ico",
          // Mirrors the actual C:\...\Games folder (src/data/games.ts) —
          // including entries with nothing installed, which fail with the
          // same "file missing or corrupted" alert as double-clicking them
          // in My Computer, instead of just being grayed out.
          children: GAMES.map((g) => ({
            id: `game-${g.label}`,
            label: g.label,
            icon: g.icon,
            action: run(() =>
              g.onOpen && !g.disabled
                ? g.onOpen()
                : showMissingFileAlert(g.label, g.file),
            ),
          })),
        },
        {
          id: "winamp",
          label: "Winamp",
          icon: "/icons/WinAMP_7.ico",
          action: run(() => openWebamp()),
        },
      ],
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
    {
      id: "shut-down",
      label: "Shut Down...",
      icon: "/icons/w2k_shutdown.ico",
      iconScale: 1.33,
      action: requestShutdown,
    },
  ];
}
