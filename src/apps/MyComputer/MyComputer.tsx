import { useEffect, useState, type ReactNode } from "react";
import { Button, Frame, Separator, Toolbar } from "react95";
import styled, { css } from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { AppMenuBar, type MenuDef } from "../../components/AppMenuBar";
import {
  ContextMenu,
  CtxDivider,
  CtxItem,
  CtxSubmenu,
} from "../../components/ContextMenu";
import { FileIcon } from "../../components/FileIcon/FileIcon";
import { Icon } from "../../components/Icon/Icon";
import { OpenWithDialog } from "../../components/OpenWithDialog/OpenWithDialog";
import { ScrollArea } from "../../components/ScrollArea";
import { APPS, openApp } from "../../data/apps";
import { displayName, iconForNode } from "../../data/fileIcons";
import { getPreferredApp } from "../../data/fileOpen";
import { GAMES } from "../../data/games";
import { playSound } from "../../lib/audio";
import { contentByteSize } from "../../lib/vfsSize";
import { openVfsAudio, openWebamp } from "../../lib/webamp";
import { showMissingFileAlert } from "../../lib/systemDialogs";
import { useClipboardStore } from "../../store/clipboardStore";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowData, useWindowStore } from "../../store/windowStore";

const MY_COMPUTER = "My Computer";

// Custom MIME type used to identify our own drag payloads (a VFS absolute
// path) so drops from outside the app are ignored.
const VFS_DND_TYPE = "application/x-rsnra-vfs-path";

function describeType(node: VfsNode): string {
  if (node.type === "dir") return "File Folder";
  if (node.appId) return "Application";
  const ext = node.name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "txt":
    case "log":
      return "Text Document";
    case "ini":
    case "inf":
      return "Configuration Settings";
    case "bmp":
    case "png":
      return "Bitmap Image";
    case "jpg":
    case "jpeg":
    case "gif":
      return "Image";
    case "bat":
      return "MS-DOS Batch File";
    case "dll":
      return "Application Extension";
    case "com":
      return "MS-DOS Application";
    case "hlp":
      return "Help File";
    case "fon":
      return "Font File";
    case "lnk":
      return "Shortcut";
    default:
      return ext ? `${ext.toUpperCase()} File` : "File";
  }
}

function formatSize(node: VfsNode): string {
  if (node.type === "dir") return "";
  const bytes = node.content
    ? contentByteSize(node.content)
    : node.appId
      ? 32768
      : 0;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

function formatDate(node: VfsNode): string {
  const d = new Date(node.created);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours() % 12 || 12).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${mm}/${dd}/${yy} ${hh}:${mi} ${ampm}`;
}

/** Last path segment of a `C:\Windows\Desktop`-style absolute path. */
function leafName(path: string): string {
  const trimmed = path.replace(/\\+$/, "");
  const idx = trimmed.lastIndexOf("\\");
  return idx >= 0 ? trimmed.slice(idx + 1) : path;
}

/** Is `descendantAbs` the same path as, or nested inside, `ancestorAbs`? */
function isSameOrDescendant(
  descendantAbs: string,
  ancestorAbs: string,
): boolean {
  const a = descendantAbs.toLowerCase();
  const b = ancestorAbs.toLowerCase();
  return a === b || a.startsWith(b.replace(/\\+$/, "") + "\\");
}

// Audio extensions Webamp can play when opened from the Explorer.
function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["wav", "mp3", "mid", "midi", "rmi", "ogg"].includes(ext);
}

const Layout = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: ${({ theme }) => theme.material};
`;

const NavToolbar = styled(Toolbar)`
  flex-shrink: 0;
  padding: 4px 6px;
  gap: 6px;
`;

const NavBtn = styled(Button)`
  width: 28px;
  height: 26px;
  min-width: 28px;
  padding: 0;
  font-size: 15px;
`;

const AddressRow = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px 6px;
`;

const AddressField = styled(Frame)`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  min-height: 22px;
  font-size: 12px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const IconGrid = styled(ScrollArea)`
  flex: 1;
  background: ${({ theme }) => theme.canvas};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  margin: 0 8px 8px;
`;

const underlineCss = css<{ $underline?: "always" | "hover" | "none" }>`
  text-decoration: ${({ $underline }) =>
    $underline === "always" ? "underline" : "none"};
  &:hover {
    text-decoration: ${({ $underline }) =>
      $underline === "hover" || $underline === "always" ? "underline" : "none"};
  }
`;

const IconItem = styled.button<{
  $selected?: boolean;
  $underline?: "always" | "hover" | "none";
}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 88px;
  padding: 6px 2px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  border: 1px dotted ${({ $selected }) => ($selected ? "white" : "transparent")};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};
  cursor: default;
  font-family: inherit;
  font-size: 11px;
  text-align: center;
  ${underlineCss}

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
  &:focus {
    outline: none;
  }
`;

const RenameInput = styled.input`
  width: 80px;
  font-size: 11px;
  text-align: center;
  padding: 0 2px;
`;

const StatusBarEl = styled(Frame)`
  flex-shrink: 0;
  margin: 0 8px 6px;
  padding: 3px 8px;
  font-size: 11px;
`;

// ── view-mode rendering ──────────────────────────────────────────────────

type ViewMode = "large" | "small" | "list" | "details";

const rowBase = css`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border: 1px dotted transparent;
  cursor: default;
  font-family: inherit;
  font-size: 11px;
  text-align: left;
  width: 100%;
`;

const SmallGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 2px;
`;

const SmallRow = styled.button<{
  $selected?: boolean;
  $dragOver?: boolean;
  $underline?: "always" | "hover" | "none";
}>`
  ${rowBase}
  width: 190px;
  background: ${({ $selected, $dragOver, theme }) =>
    $dragOver
      ? theme.hoverBackground
      : $selected
        ? theme.hoverBackground
        : "transparent"};
  border: 1px dotted
    ${({ $selected, $dragOver }) =>
      $selected || $dragOver ? "white" : "transparent"};
  outline: ${({ $dragOver, theme }) =>
    $dragOver ? `1px solid ${theme.headerBackground}` : "none"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};
  ${underlineCss}
  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const ListColumns = styled.div`
  columns: 220px;
  column-gap: 0;
  width: 100%;
`;

const DetailsTable = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  font-size: 11px;
`;

const DetailsHeaderRow = styled.div`
  display: flex;
  position: sticky;
  top: 0;
  z-index: 1;
  background: ${({ theme }) => theme.material};
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
  padding: 3px 6px;
  font-weight: bold;
`;

const DetailsRow = styled.button<{ $selected?: boolean; $dragOver?: boolean }>`
  ${rowBase}
  background: ${({ $selected, $dragOver, theme }) =>
    $dragOver
      ? theme.hoverBackground
      : $selected
        ? theme.hoverBackground
        : "transparent"};
  outline: ${({ $dragOver, theme }) =>
    $dragOver ? `1px solid ${theme.headerBackground}` : "none"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};
  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const ColName = styled.span`
  flex: 2.2;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const ColSize = styled.span`
  flex: 1;
  text-align: right;
  padding-right: 10px;
  white-space: nowrap;
`;
const ColType = styled.span`
  flex: 1.2;
  white-space: nowrap;
`;
const ColDate = styled.span`
  flex: 1.6;
  white-space: nowrap;
`;

const LockBadge = styled.svg`
  position: absolute;
  right: -2px;
  bottom: -2px;
  pointer-events: none;
`;

function LockGlyph() {
  return (
    <LockBadge
      width="10"
      height="10"
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path
        d="M2 4 L2 9 L8 9 L8 4 Z M3 4 L3 2 A2 2 0 0 1 7 2 L7 4"
        fill="#ffe680"
        stroke="#000"
        strokeWidth="1"
      />
    </LockBadge>
  );
}

interface Drive {
  label: string;
  icon: string;
  target: string;
  kind: "drive" | "app";
  appId?: string;
  notReady?: boolean;
}
const DRIVES: Drive[] = [
  {
    label: "3½ Floppy (A:)",
    icon: "/icons/w2k_floppy_2.ico",
    target: "A:\\",
    kind: "drive",
    notReady: true,
  },
  {
    label: "Local Disk (C:)",
    icon: "/icons/w2k_hard_drive.ico",
    target: "C:\\",
    kind: "drive",
  },
  {
    label: "Audio CD (D:)",
    icon: "/icons/w2k_cd_audio.ico",
    target: "D:\\",
    kind: "drive",
    notReady: true,
  },
  {
    label: "Control Panel",
    icon: "/icons/w2k_control_panel.ico",
    target: "Control Panel",
    kind: "drive",
  },
  {
    label: "Printers",
    icon: "/icons/w2k_printers.ico",
    target: "",
    kind: "app",
  },
  {
    label: "Dial-Up Networking",
    icon: "/icons/w2k_folder_open.ico",
    target: "",
    kind: "app",
  },
];

interface AppletItem {
  label: string;
  icon: string;
  onOpen?: () => void;
  // 8.3-style .cpl filename shown in the "file not found" alert for applets
  // that aren't implemented yet.
  file: string;
}
const APPLETS: AppletItem[] = [
  {
    label: "Accessibility Options",
    icon: "/icons/w98_access_wheelchair_big.ico",
    file: "access.cpl",
  },
  {
    label: "Add New Hardware",
    icon: "/icons/w98_hardware.ico",
    file: "sysdm.cpl",
  },
  {
    label: "Add/Remove Programs",
    icon: "/icons/w98_program_manager.ico",
    file: "appwiz.cpl",
  },
  {
    label: "Automatic Updates",
    icon: "/icons/w98_windows_update_large.ico",
    file: "wuaucpl.cpl",
  },
  {
    label: "Date/Time",
    icon: "/icons/w98_time_and_date.ico",
    onOpen: () => openApp("datetime"),
    file: "timedate.cpl",
  },
  {
    label: "Dial-Up Networking",
    icon: "/icons/w98_conn_dialup.ico",
    file: "rnaui.dll",
  },
  {
    label: "Display",
    icon: "/icons/w98_display_properties.ico",
    onOpen: () => openApp("display-properties"),
    file: "desk.cpl",
  },
  {
    label: "Folder Options",
    icon: "/icons/w98_directory_open.ico",
    onOpen: () => openApp("folder-options"),
    file: "shell32.dll",
  },
  { label: "Fonts", icon: "/icons/w98_font_tt.ico", file: "fontext.dll" },
  { label: "Gaming Options", icon: "/icons/w98_joystick.ico", file: "joy.cpl" },
  {
    label: "Internet Options",
    icon: "/icons/w98_internet_options.ico",
    file: "inetcpl.cpl",
  },
  { label: "Keyboard", icon: "/icons/w98_keyboard.ico", file: "main.cpl" },
  {
    label: "Modems",
    icon: "/icons/w98_conn_dialup_alt.ico",
    file: "modem.cpl",
  },
  {
    label: "Mouse",
    icon: "/icons/w98_mouse.ico",
    onOpen: () => openApp("mouse-properties"),
    file: "main.cpl",
  },
  { label: "Network", icon: "/icons/w98_network.ico", file: "netcpl.cpl" },
  {
    label: "ODBC Data Sources (32bit)",
    icon: "/icons/w98_odbc.ico",
    file: "odbccp32.cpl",
  },
  {
    label: "Passwords",
    icon: "/icons/w98_users_key.ico",
    file: "password.cpl",
  },
  {
    label: "Power Options",
    icon: "/icons/w98_power_management.ico",
    file: "powercfg.cpl",
  },
  {
    label: "Printers",
    icon: "/icons/w98_printer_big.ico",
    file: "printers.dll",
  },
  {
    label: "Regional Settings",
    icon: "/icons/w98_entire_network_globe.ico",
    file: "intl.cpl",
  },
  {
    label: "Scanners and Cameras",
    icon: "/icons/w98_scanner_camera.ico",
    file: "sticpl.cpl",
  },
  {
    label: "Scheduled Tasks",
    icon: "/icons/w2k_scheduled_tasks.ico",
    file: "mstask.dll",
  },
  {
    label: "Sounds and Multimedia",
    icon: "/icons/w98_mixer_sound.ico",
    file: "mmsys.cpl",
  },
  {
    label: "System",
    icon: "/icons/w2k_computer.ico",
    onOpen: () => openApp("system-properties"),
    file: "sysdm.cpl",
  },
  {
    label: "Telephony",
    icon: "/icons/w98_telephony.ico",
    file: "telephon.cpl",
  },
  { label: "Users", icon: "/icons/w98_users.ico", file: "nwc.cpl" },
];

interface CtxState {
  x: number;
  y: number;
  node: VfsNode | null; // null = background
}

export function MyComputer({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const updateTitle = useWindowStore((s) => s.updateTitle);
  const updateIcon = useWindowStore((s) => s.updateIcon);
  const isFocused = useWindowStore(
    (s) => s.windows.find((w) => w.id === windowId)?.isFocused ?? false,
  );
  const vfs = useVfsStore(
    useShallow((s) => ({
      root: s.root,
      list: s.list,
      resolvePath: s.resolvePath,
      resolve: s.resolve,
      exists: s.exists,
      mkdir: s.mkdir,
      writeFile: s.writeFile,
      moveToRecycleBin: s.moveToRecycleBin,
      rename: s.rename,
      copyTo: s.copyTo,
      moveTo: s.moveTo,
      move: s.move,
    })),
  );
  const clipboard = useClipboardStore(
    useShallow((s) => ({
      mode: s.mode,
      sourcePath: s.sourcePath,
      set: s.set,
      clear: s.clear,
    })),
  );
  const winData = useWindowData(windowId);
  const [path, setPath] = useState<string>(
    (winData.path as string) ?? MY_COMPUTER,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [openWithTarget, setOpenWithTarget] = useState<{
    node: VfsNode;
    abs: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [view, setView] = useState<ViewMode>("large");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "size" | "type" | "date">(
    "name",
  );
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) setSortDir((d) => (d * -1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };
  const sortArrow = (key: typeof sortKey) =>
    sortKey === key ? (sortDir === 1 ? " ▲" : " ▼") : "";

  const isRoot = path === MY_COMPUTER;
  const isDriveRoot = /^([A-Za-z]):\\$/.test(path);
  const driveNotReady = /^[AD]:\\$/.test(path);
  const showHidden = useFilePrefsStore((s) => s.showHidden);
  const singleClickOpen = useFilePrefsStore((s) => s.singleClickOpen);
  const underlineMode = useFilePrefsStore((s) => s.underlineMode);
  const hideKnownExtensions = useFilePrefsStore((s) => s.hideKnownExtensions);
  const hideProtectedSystemFiles = useFilePrefsStore(
    (s) => s.hideProtectedSystemFiles,
  );
  const showPopupDescriptions = useFilePrefsStore(
    (s) => s.showPopupDescriptions,
  );
  const fullPathInTitleBar = useFilePrefsStore((s) => s.fullPathInTitleBar);
  const fullPathInAddressBar = useFilePrefsStore((s) => s.fullPathInAddressBar);
  const browseFoldersMode = useFilePrefsStore((s) => s.browseFoldersMode);
  const underline: "always" | "hover" | "none" = singleClickOpen
    ? underlineMode === "browser"
      ? "always"
      : "hover"
    : "none";
  const controlPanelNodes: VfsNode[] = APPLETS.map(
    (applet) =>
      ({
        name: applet.label,
        type: "file",
        created: Date.now(),
        icon: applet.icon,
        onOpen: applet.onOpen,
        disabled: !applet.onOpen,
        file: applet.file,
      }) as any,
  );

  const gamesNodes: VfsNode[] = GAMES.map(
    (game) =>
      ({
        name: game.label,
        type: "file",
        created: Date.now(),
        icon: game.icon,
        onOpen: game.onOpen,
        disabled: game.disabled,
        file: game.file,
      }) as any,
  );

  const describeTypeLocal = (node: VfsNode): string => {
    if (path === "Control Panel") return "Control Panel Extension";
    if (path === "Games") return "Shortcut";
    return describeType(node);
  };

  const formatSizeLocal = (node: VfsNode): string => {
    if (path === "Control Panel" || path === "Games") return "";
    return formatSize(node);
  };

  const formatDateLocal = (node: VfsNode): string => {
    if (path === "Control Panel" || path === "Games") return "";
    return formatDate(node);
  };

  let allEntries: VfsNode[] =
    isRoot || driveNotReady || path === "Control Panel" || path === "Games"
      ? []
      : (vfs.list(path) ?? []);

  if (path.toLowerCase() === "c:\\windows\\desktop") {
    allEntries = allEntries.filter(
      (n) => n.name.toLowerCase() !== "my computer.lnk",
    );
  }
  const entries = allEntries.filter(
    (n) =>
      (showHidden || !n.hidden) && (!hideProtectedSystemFiles || !n.system),
  );

  const sortValue = (n: VfsNode): string | number => {
    switch (sortKey) {
      case "size":
        return n.type === "dir"
          ? -1
          : n.content
            ? contentByteSize(n.content)
            : n.appId
              ? 32768
              : 0;
      case "type":
        return describeTypeLocal(n);
      case "date":
        return n.created;
      default:
        return n.name.toLowerCase();
    }
  };

  const sorted =
    path === "Control Panel"
      ? controlPanelNodes
      : path === "Games"
        ? gamesNodes
        : [...entries].sort((a, b) => {
            if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
            const av = sortValue(a);
            const bv = sortValue(b);
            const base =
              typeof av === "number" && typeof bv === "number"
                ? av - bv
                : String(av).localeCompare(String(bv));
            return base * sortDir;
          });

  // Sync the window title + icon to the current path — just like real Win95 Explorer
  useEffect(() => {
    updateTitle(
      windowId,
      isRoot ? MY_COMPUTER : fullPathInTitleBar ? path : leafName(path),
    );
    let icon = "/icons/w98_directory_open.ico";
    if (isRoot) {
      icon = "/icons/explorer.exe/000.ico";
    } else if (path === "Control Panel") {
      icon = "/icons/w2k_control_panel.ico";
    } else if (path === "Games") {
      icon = "/icons/w98_joystick.ico";
    } else if (isDriveRoot) {
      icon =
        DRIVES.find((d) => d.target === path)?.icon ??
        "/icons/shell32.dll/105.ico";
    }
    updateIcon(windowId, icon);
  }, [
    path,
    isRoot,
    isDriveRoot,
    windowId,
    updateTitle,
    updateIcon,
    fullPathInTitleBar,
  ]);

  const refresh = () => setPath((p) => p); // no-op; VFS mutations re-render via root swap
  void refresh;

  const enter = (d: Drive) => {
    if (d.kind === "app") {
      if (d.appId) openApp(d.appId as never);
      return;
    }
    setPath(d.target);
    setSelected(null);
  };

  const openNode = (node: VfsNode) => {
    if (path === "Control Panel" || path === "Games") {
      const vNode = node as any;
      if (!vNode.disabled && vNode.onOpen) {
        vNode.onOpen();
      } else {
        showMissingFileAlert(node.name, vNode.file ?? `${node.name}.exe`);
      }
      return;
    }
    if (node.name.toLowerCase().endsWith(".lnk")) {
      try {
        const lnk = JSON.parse(node.content ?? "");
        if (lnk.type === "app") {
          if (lnk.target === "winamp") {
            void openWebamp();
          } else {
            openApp(lnk.target as any, {
              title: lnk.title || node.name.replace(/\.lnk$/i, ""),
              data: lnk.data,
            });
          }
        } else if (lnk.type === "url") {
          window.open(lnk.target, "_blank", "noopener,noreferrer");
        }
      } catch {}
      return;
    }
    const abs = vfs.resolvePath(node.name, path);
    if (!abs) return;
    const preferred = node.type === "file" ? getPreferredApp(node.name) : null;
    if (preferred) {
      preferred.open(abs, node.name);
    } else if (node.type === "dir") {
      if (browseFoldersMode === "own") {
        openApp("my-computer", { title: node.name, data: { path: abs } });
      } else {
        setPath(abs);
        setSelected(null);
      }
    } else if (node.appId && APPS[node.appId as keyof typeof APPS]) {
      const id = node.appId as keyof typeof APPS;
      if (id === "winamp") {
        void openWebamp();
      } else if (id === "notepad")
        openApp("notepad", {
          title: `${node.name} - Notepad`,
          data: { path: abs },
        });
      else openApp(id);
    } else if (isAudioFile(node.name)) {
      void openVfsAudio(abs).then((played) => {
        if (!played && node.name.toLowerCase().endsWith(".wav")) {
          openApp("sound-recorder", {
            title: `${node.name} - Sound Recorder`,
            data: { path: abs },
          });
        }
      });
    } else if (
      node.name.toLowerCase().endsWith(".png") ||
      node.name.toLowerCase().endsWith(".bmp")
    ) {
      openApp("paint", { title: `${node.name} - Paint`, data: { path: abs } });
    } else {
      // Every remaining file type (txt/log/ini, but also bat/sys/reg/dll/
      // unknown extensions, …) opens as text in Notepad — real Windows
      // always has some default handler, and Notepad can display any
      // content as a last resort.
      openApp("notepad", {
        title: `${node.name} - Notepad`,
        data: { path: abs },
      });
    }
  };

  const goUp = () => {
    if (isRoot) return;
    if (isDriveRoot || path === "Control Panel" || path === "Games") {
      setPath(MY_COMPUTER);
      setSelected(null);
      return;
    }
    const up = vfs.resolvePath("..", path);
    if (up) {
      setPath(up);
      setSelected(null);
    }
  };

  // ── mutations ──────────────────────────────────────────────────────────
  const newFolder = () => {
    if (isRoot || driveNotReady) return;
    let name = "New Folder";
    let i = 1;
    while (vfs.exists(vfs.resolvePath(name, path)!))
      name = `New Folder (${++i})`;
    vfs.mkdir(vfs.resolvePath(name, path)!);
    refresh();
    setSelected(name);
    setRenaming(name);
    setRenameVal(name);
  };

  const newTextFile = () => {
    if (isRoot || driveNotReady) return;
    let name = "New Text Document.txt";
    let i = 1;
    while (vfs.exists(vfs.resolvePath(name, path)!))
      name = `New Text Document (${++i}).txt`;
    const abs = vfs.resolvePath(name, path)!;
    vfs.writeFile(abs, "");
    refresh();
    setSelected(name);
    setRenaming(name);
    setRenameVal(name);
  };

  const deleteNode = (node: VfsNode) => {
    const abs = vfs.resolvePath(node.name, path);
    if (abs && vfs.moveToRecycleBin(abs)) {
      refresh();
      setSelected(null);
    } else {
      playSound("error");
    }
  };

  const commitRename = () => {
    if (renaming && renameVal.trim()) {
      const abs = vfs.resolvePath(renaming, path);
      if (abs && !vfs.rename(abs, renameVal.trim())) playSound("error");
    }
    setRenaming(null);
    refresh();
  };

  // ── clipboard: copy / cut / paste ───────────────────────────────────────
  // The clipboard stores an absolute source path + mode; paste re-resolves it
  // against the live VFS so it stays valid across navigation and windows.
  const copySelected = (node: VfsNode) => {
    if (node.system) return;
    const abs = vfs.resolvePath(node.name, path);
    if (abs) clipboard.set("copy", abs);
  };

  const cutSelected = (node: VfsNode) => {
    if (node.system) return;
    const abs = vfs.resolvePath(node.name, path);
    if (abs) clipboard.set("cut", abs);
  };

  const paste = () => {
    if (isRoot || driveNotReady) return;
    if (!clipboard.mode || !clipboard.sourcePath) return;
    const src = clipboard.sourcePath;
    if (clipboard.mode === "copy") {
      if (vfs.copyTo(src, path) === null) return;
    } else {
      // cut → move; a successful move consumes the clipboard.
      if (vfs.moveTo(src, path) === null) return;
      clipboard.clear();
    }
    refresh();
  };

  // A cut source is dimmed until it is pasted elsewhere or the clipboard is
  // cleared (e.g. by copying something new).
  const isCutSource = (node: VfsNode): boolean => {
    if (clipboard.mode !== "cut" || !clipboard.sourcePath) return false;
    const abs = vfs.resolvePath(node.name, path);
    return !!abs && abs.toLowerCase() === clipboard.sourcePath.toLowerCase();
  };

  // Opacity for an icon: system items slightly dimmed, hidden + cut items
  // half-transparent (only seen when "Show Hidden Files" is on).
  const nodeOpacity = (node: VfsNode): number =>
    node.system ? 0.85 : node.hidden || isCutSource(node) ? 0.5 : 1;

  // Open the Properties window for a node (right-click → Properties, or the
  // File menu). Works for both files and folders, including system items.
  const propertiesOf = (node: VfsNode) => {
    const abs = vfs.resolvePath(node.name, path);
    if (abs)
      openApp("properties", {
        title: `${node.name} Properties`,
        data: { path: abs },
      });
  };

  // ── drag & drop ────────────────────────────────────────────────────────
  // System items (and anything else the user didn't create) are protected:
  // not draggable, and vfs.move()/rename()/remove() already refuse to touch
  // them, so a drop targeting one is a guaranteed no-op we short-circuit here.
  const handleDragStart = (node: VfsNode) => (e: React.DragEvent) => {
    if (node.system) {
      e.preventDefault();
      return;
    }
    const abs = vfs.resolvePath(node.name, path);
    if (!abs) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(VFS_DND_TYPE, abs);
    e.dataTransfer.setData("text/plain", abs);
  };

  const acceptsDrop = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types || []).includes(VFS_DND_TYPE);

  const handleDropOnDir = (destAbs: string) => (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
    const srcAbs = e.dataTransfer.getData(VFS_DND_TYPE);
    if (!srcAbs || isSameOrDescendant(destAbs, srcAbs)) return;
    if (vfs.move(srcAbs, destAbs)) {
      refresh();
      setSelected(null);
    }
  };

  const handleDragOverDir = (key: string) => (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== key) setDragOverKey(key);
  };

  const handleDragLeaveDir = (key: string) => () => {
    setDragOverKey((k) => (k === key ? null : k));
  };

  // Dropping on the folder's own background moves the item into the
  // currently-open folder (useful when the source is a different subfolder).
  const handleDropOnBackground = (e: React.DragEvent) => {
    if (isRoot || driveNotReady || !acceptsDrop(e)) return;
    e.preventDefault();
    const srcAbs = e.dataTransfer.getData(VFS_DND_TYPE);
    if (!srcAbs) return;
    const parent = srcAbs.slice(0, srcAbs.lastIndexOf("\\")) || "C:\\";
    if (parent.toLowerCase() === path.toLowerCase()) return;
    if (vfs.move(srcAbs, path)) {
      refresh();
      setSelected(null);
    }
  };

  const objectCount = isRoot
    ? DRIVES.length
    : path === "Control Panel"
      ? APPLETS.length
      : path === "Games"
        ? GAMES.length
        : sorted.length;

  // ── context menu ───────────────────────────────────────────────────────
  const openCtx = (e: React.MouseEvent, node: VfsNode | null) => {
    if (path === "Control Panel" || path === "Games") return;
    e.preventDefault();
    e.stopPropagation();
    if (node) setSelected(node.name);
    setCtx({ x: e.clientX, y: e.clientY, node });
  };

  const closeCtx = () => setCtx(null);

  const runCtx = (action: () => void) => {
    closeCtx();
    action();
  };

  const selectedNode = sorted.find((n) => n.name === selected) ?? null;

  // Explorer keyboard shortcuts: Ctrl+C / Ctrl+X copy/cut the selected node,
  // Ctrl+V pastes the clipboard into the open folder. Only active while this
  // Explorer window is the focused one, so they never collide with Notepad,
  // Terminal, etc. Ignored while renaming so the keys edit the filename.
  useEffect(() => {
    if (!isFocused) return;
    const onKey = (e: KeyboardEvent) => {
      if (renaming || path === "Control Panel" || path === "Games") return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "c" && selectedNode && !selectedNode.system) {
        e.preventDefault();
        copySelected(selectedNode);
      } else if (key === "x" && selectedNode && !selectedNode.system) {
        e.preventDefault();
        cutSelected(selectedNode);
      } else if (key === "v") {
        e.preventDefault();
        paste();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, renaming, selectedNode, path, isRoot, driveNotReady]);

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        {
          label: "New Folder",
          action: newFolder,
          disabled:
            isRoot ||
            path === "Control Panel" ||
            path === "Games" ||
            driveNotReady,
        },
        {
          label: "New Text Document",
          action: newTextFile,
          disabled:
            isRoot ||
            path === "Control Panel" ||
            path === "Games" ||
            driveNotReady,
        },
        { label: "", divider: true },
        {
          label: "Open",
          action: () => {
            if (path === "Control Panel" || path === "Games") {
              const vNode = sorted.find((n) => n.name === selected);
              if (vNode) openNode(vNode);
            } else if (selectedNode) {
              openNode(selectedNode);
            }
          },
          disabled: !selected && !selectedNode,
        },
        {
          label: "Delete",
          action: () => selectedNode && deleteNode(selectedNode),
          disabled:
            !selectedNode || path === "Control Panel" || path === "Games",
        },
        {
          label: "Rename",
          action: () => {
            if (selectedNode) {
              setRenaming(selectedNode.name);
              setRenameVal(selectedNode.name);
            }
          },
          disabled:
            !selectedNode || path === "Control Panel" || path === "Games",
        },
        {
          label: "Properties",
          action: () => selectedNode && propertiesOf(selectedNode),
          disabled:
            !selectedNode || path === "Control Panel" || path === "Games",
        },
        { label: "", divider: true },
        { label: "Close", action: () => closeWindow(windowId) },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", disabled: true },
        { label: "", divider: true },
        {
          label: "Cut",
          action: () => selectedNode && cutSelected(selectedNode),
          disabled:
            !selectedNode ||
            !!selectedNode?.system ||
            path === "Control Panel" ||
            path === "Games",
        },
        {
          label: "Copy",
          action: () => selectedNode && copySelected(selectedNode),
          disabled:
            !selectedNode ||
            !!selectedNode?.system ||
            path === "Control Panel" ||
            path === "Games",
        },
        {
          label: "Paste",
          action: paste,
          disabled:
            isRoot ||
            path === "Control Panel" ||
            path === "Games" ||
            driveNotReady ||
            !clipboard.mode ||
            !clipboard.sourcePath,
        },
        { label: "", divider: true },
        {
          label: "Select All",
          action: () => {
            if (path === "Control Panel") {
              setSelected(
                APPLETS.length ? APPLETS[APPLETS.length - 1].label : null,
              );
            } else if (path === "Games") {
              setSelected(GAMES.length ? GAMES[GAMES.length - 1].label : null);
            } else {
              setSelected(
                sorted.length ? sorted[sorted.length - 1].name : null,
              );
            }
          },
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Large Icons",
          action: () => setView("large"),
          checked: view === "large",
          radio: true,
        },
        {
          label: "Small Icons",
          action: () => setView("small"),
          checked: view === "small",
          radio: true,
        },
        {
          label: "List",
          action: () => setView("list"),
          checked: view === "list",
          radio: true,
        },
        {
          label: "Details",
          action: () => setView("details"),
          checked: view === "details",
          radio: true,
        },
        { label: "", divider: true },
        { label: "Refresh", action: refresh },
        { label: "", divider: true },
        {
          label: "Show Hidden Files",
          action: () => useFilePrefsStore.getState().setShowHidden(!showHidden),
          checked: showHidden,
        },
        { label: "", divider: true },
        {
          label: "Folder Options...",
          action: () => openApp("folder-options"),
        },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About RSNRA.ART", disabled: true }],
    },
  ];

  /** Shared drag/drop + selection wiring for one real VFS entry, regardless
   *  of which view mode renders it. */
  const nodeHandlers = (node: VfsNode) => {
    const abs = vfs.resolvePath(node.name, path);
    const isDropTarget = node.type === "dir" && !!abs;
    return {
      draggable: !node.system,
      onDragStart: handleDragStart(node),
      onDragOver: isDropTarget ? handleDragOverDir(node.name) : undefined,
      onDragLeave: isDropTarget ? handleDragLeaveDir(node.name) : undefined,
      onDrop: isDropTarget ? handleDropOnDir(abs!) : undefined,
      title: node.system
        ? "System item — protected, cannot be moved, renamed, or deleted"
        : showPopupDescriptions
          ? describeTypeLocal(node)
          : undefined,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelected(node.name);
        if (singleClickOpen && renaming !== node.name) openNode(node);
      },
      onDoubleClick: () => {
        if (renaming === node.name || singleClickOpen) return;
        openNode(node);
      },
      onContextMenu: (e: React.MouseEvent) => openCtx(e, node),
    };
  };

  const renameBox = (width?: number) => (
    <RenameInput
      autoFocus
      style={width ? { width } : undefined}
      value={renameVal}
      onChange={(e) => setRenameVal(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") setRenaming(null);
      }}
    />
  );

  const nodeLabel = (node: VfsNode): string =>
    node.name.toLowerCase().endsWith(".lnk")
      ? node.name.replace(/\.lnk$/i, "")
      : displayName(node.name, hideKnownExtensions);

  const renderIcon = (node: VfsNode): ReactNode => (
    <IconItem
      key={node.name}
      $selected={selected === node.name}
      $underline={underline}
      tabIndex={0}
      {...nodeHandlers(node)}
      style={{
        opacity: nodeOpacity(node),
        outline: dragOverKey === node.name ? "1px solid #fff" : undefined,
      }}
    >
      <div style={{ position: "relative" }}>
        <FileIcon node={node} />
        {node.system && <LockGlyph />}
      </div>
      {renaming === node.name ? renameBox() : nodeLabel(node)}
    </IconItem>
  );

  const renderSmallRow = (node: VfsNode): ReactNode => (
    <SmallRow
      key={node.name}
      $selected={selected === node.name}
      $dragOver={dragOverKey === node.name}
      $underline={underline}
      tabIndex={0}
      {...nodeHandlers(node)}
      style={{ opacity: nodeOpacity(node) }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FileIcon node={node} size={16} />
        {node.system && <LockGlyph />}
      </div>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {renaming === node.name ? renameBox(140) : nodeLabel(node)}
      </span>
    </SmallRow>
  );

  const renderDetailsRow = (node: VfsNode): ReactNode => (
    <DetailsRow
      key={node.name}
      $selected={selected === node.name}
      $dragOver={dragOverKey === node.name}
      tabIndex={0}
      {...nodeHandlers(node)}
      style={{ opacity: nodeOpacity(node) }}
    >
      <ColName>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <FileIcon node={node} size={16} />
          {node.system && <LockGlyph />}
        </div>
        {renaming === node.name ? (
          renameBox(140)
        ) : (
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              textDecoration: underline === "always" ? "underline" : "none",
            }}
            onMouseEnter={(e) => {
              if (underline === "hover")
                e.currentTarget.style.textDecoration = "underline";
            }}
            onMouseLeave={(e) => {
              if (underline === "hover")
                e.currentTarget.style.textDecoration = "none";
            }}
          >
            {nodeLabel(node)}
          </span>
        )}
      </ColName>
      <ColSize>{formatSizeLocal(node)}</ColSize>
      <ColType>{describeTypeLocal(node)}</ColType>
      <ColDate>{formatDateLocal(node)}</ColDate>
    </DetailsRow>
  );

  return (
    <Layout onClick={closeCtx}>
      <AppMenuBar menus={menus} />
      <Separator />
      <NavToolbar>
        <NavBtn onClick={goUp} disabled={isRoot} title="Up one level">
          ↑
        </NavBtn>
      </NavToolbar>
      <AddressRow>
        <span style={{ fontSize: 12 }}>Address</span>
        <AddressField variant="field">
          {isRoot ||
          path === "Control Panel" ||
          path === "Games" ||
          fullPathInAddressBar
            ? path
            : leafName(path)}
        </AddressField>
      </AddressRow>

      <IconGrid
        onContextMenu={(e) => openCtx(e, null)}
        onClick={() => setSelected(null)}
        onDragOver={(e) => {
          if (isRoot || driveNotReady || !acceptsDrop(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleDropOnBackground}
        contentStyle={
          isRoot || view === "large"
            ? {
                padding: 10,
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-start",
                gap: 4,
              }
            : { padding: 10, width: "100%" }
        }
      >
        {isRoot ? (
          DRIVES.map((d) => (
            <IconItem
              key={d.label}
              $selected={selected === d.label}
              $underline={underline}
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(d.label);
                if (singleClickOpen) enter(d);
              }}
              onDoubleClick={() => {
                if (!singleClickOpen) enter(d);
              }}
              onContextMenu={(e) => openCtx(e, null)}
              onDragOver={
                d.kind === "drive" && !d.notReady
                  ? handleDragOverDir(d.label)
                  : undefined
              }
              onDragLeave={
                d.kind === "drive" && !d.notReady
                  ? handleDragLeaveDir(d.label)
                  : undefined
              }
              onDrop={
                d.kind === "drive" && !d.notReady
                  ? handleDropOnDir(d.target)
                  : undefined
              }
              style={{
                outline: dragOverKey === d.label ? "1px solid #fff" : undefined,
              }}
            >
              <Icon src={d.icon} size={32} />
              {d.label}
            </IconItem>
          ))
        ) : view === "large" ? (
          sorted.map(renderIcon)
        ) : view === "small" ? (
          <SmallGrid>{sorted.map(renderSmallRow)}</SmallGrid>
        ) : view === "list" ? (
          <ListColumns>{sorted.map(renderSmallRow)}</ListColumns>
        ) : (
          <DetailsTable>
            <DetailsHeaderRow>
              <ColName
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("name")}
              >
                Name{sortArrow("name")}
              </ColName>
              <ColSize
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("size")}
              >
                Size{sortArrow("size")}
              </ColSize>
              <ColType
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("type")}
              >
                Type{sortArrow("type")}
              </ColType>
              <ColDate
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("date")}
              >
                Modified{sortArrow("date")}
              </ColDate>
            </DetailsHeaderRow>
            {sorted.map(renderDetailsRow)}
          </DetailsTable>
        )}
        {!isRoot &&
          path !== "Control Panel" &&
          path !== "Games" &&
          sorted.length === 0 && (
            <div style={{ fontSize: 12, padding: 16, color: "#888" }}>
              {driveNotReady
                ? "The device is not ready."
                : "This folder is empty."}
            </div>
          )}
      </IconGrid>

      <StatusBarEl variant="status">
        {objectCount} object(s)
        {selected ? `\u00a0\u00a0\u00a0\u00a0${selected}` : ""}
        {"\u00a0\u00a0\u00a0\u00a0"}
        {path}
      </StatusBarEl>

      {ctx && (
        <ContextMenu x={ctx.x} y={ctx.y} onClose={closeCtx}>
          {ctx.node ? (
            <>
              <CtxItem onClick={() => runCtx(() => openNode(ctx.node!))}>
                Open
              </CtxItem>
              {ctx.node.type === "file" && (
                <CtxItem
                  onClick={() =>
                    runCtx(() => {
                      const abs = vfs.resolvePath(ctx.node!.name, path);
                      if (abs) setOpenWithTarget({ node: ctx.node!, abs });
                    })
                  }
                >
                  Open With...
                </CtxItem>
              )}
              <CtxItem
                onClick={() =>
                  runCtx(() => {
                    const node = ctx.node!;
                    const abs = vfs.resolvePath(node.name, path) || node.name;
                    const isLnk = node.name.toLowerCase().endsWith(".lnk");
                    const label = isLnk
                      ? node.name.replace(/\.lnk$/i, "")
                      : node.name;

                    let lnk: any = null;
                    if (isLnk) {
                      try {
                        lnk = JSON.parse(node.content ?? "");
                      } catch {}
                    }

                    const targetIcon = lnk?.icon ?? iconForNode(node);
                    if (isLnk && lnk) {
                      if (lnk.type === "url") {
                        useWindowStore.getState().addToQuickLaunch({
                          title: label,
                          icon: targetIcon,
                          type: "lnk",
                          lnkPath: lnk.target,
                        });
                      } else {
                        useWindowStore.getState().addToQuickLaunch({
                          title: label,
                          icon: targetIcon,
                          type: "app",
                          appId: lnk.target as any,
                          data: lnk.data,
                        });
                      }
                    } else {
                      const preferred = getPreferredApp(node.name);
                      useWindowStore.getState().addToQuickLaunch({
                        title: label,
                        icon: targetIcon,
                        type: "app",
                        appId: (node.appId ||
                          preferred?.appId ||
                          "notepad") as any,
                        data: { path: abs },
                      });
                    }
                  })
                }
              >
                Add to Quick Launch
              </CtxItem>
              <CtxDivider />
              <CtxItem
                $disabled={!!ctx.node!.system}
                onClick={() =>
                  !ctx.node!.system && runCtx(() => cutSelected(ctx.node!))
                }
              >
                Cut
              </CtxItem>
              <CtxItem
                $disabled={!!ctx.node!.system}
                onClick={() =>
                  !ctx.node!.system && runCtx(() => copySelected(ctx.node!))
                }
              >
                Copy
              </CtxItem>
              <CtxDivider />
              <CtxItem
                onClick={() =>
                  runCtx(() => {
                    setRenaming(ctx.node!.name);
                    setRenameVal(ctx.node!.name);
                  })
                }
              >
                Rename
              </CtxItem>
              <CtxItem onClick={() => runCtx(() => deleteNode(ctx.node!))}>
                Delete
              </CtxItem>
              <CtxDivider />
              <CtxItem onClick={() => runCtx(() => propertiesOf(ctx.node!))}>
                Properties
              </CtxItem>
            </>
          ) : (
            <>
              <CtxSubmenu label="Arrange Icons">
                <CtxItem onClick={() => runCtx(() => toggleSort("name"))}>
                  {sortKey === "name" && "✓ "}by Name
                </CtxItem>
                <CtxItem onClick={() => runCtx(() => toggleSort("type"))}>
                  {sortKey === "type" && "✓ "}by Type
                </CtxItem>
                <CtxItem onClick={() => runCtx(() => toggleSort("size"))}>
                  {sortKey === "size" && "✓ "}by Size
                </CtxItem>
                <CtxItem onClick={() => runCtx(() => toggleSort("date"))}>
                  {sortKey === "date" && "✓ "}by Date
                </CtxItem>
                <CtxDivider />
                <CtxItem $disabled>Auto Arrange</CtxItem>
              </CtxSubmenu>
              <CtxItem $disabled>Line up Icons</CtxItem>
              <CtxDivider />
              <CtxItem
                $disabled={
                  isRoot ||
                  path === "Control Panel" ||
                  path === "Games" ||
                  driveNotReady ||
                  !clipboard.mode ||
                  !clipboard.sourcePath
                }
                onClick={() => runCtx(paste)}
              >
                Paste
              </CtxItem>
              <CtxDivider />
              <CtxSubmenu label="New">
                <CtxItem
                  $disabled={
                    isRoot ||
                    path === "Control Panel" ||
                    path === "Games" ||
                    driveNotReady
                  }
                  onClick={() => runCtx(newFolder)}
                >
                  Folder
                </CtxItem>
                <CtxItem
                  $disabled={
                    isRoot ||
                    path === "Control Panel" ||
                    path === "Games" ||
                    driveNotReady
                  }
                  onClick={() => runCtx(newTextFile)}
                >
                  Text Document
                </CtxItem>
              </CtxSubmenu>
              <CtxDivider />
              <CtxItem onClick={() => runCtx(() => openApp("folder-options"))}>
                Folder Options...
              </CtxItem>
              <CtxItem
                $disabled={
                  isRoot || path === "Control Panel" || path === "Games"
                }
                onClick={() =>
                  runCtx(() => {
                    const node = vfs.resolve(path);
                    if (node) propertiesOf(node);
                  })
                }
              >
                Properties
              </CtxItem>
            </>
          )}
        </ContextMenu>
      )}
      {openWithTarget && (
        <OpenWithDialog
          fileName={openWithTarget.node.name}
          filePath={openWithTarget.abs}
          onClose={() => setOpenWithTarget(null)}
        />
      )}
    </Layout>
  );
}
