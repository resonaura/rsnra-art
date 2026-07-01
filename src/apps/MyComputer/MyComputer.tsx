import { useEffect, useState, type ReactNode } from "react";
import { Button, Frame, Separator, Toolbar } from "react95";
import styled, { css } from "styled-components";
import { ContextMenu, CtxDivider, CtxItem } from "../../components/ContextMenu";
import { ScrollArea } from "../../components/ScrollArea";
import { APPS, openApp } from "../../data/apps";
import { iconForNode } from "../../data/fileIcons";
import { useClipboardStore } from "../../store/clipboardStore";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

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
  const bytes = node.content?.length ?? (node.appId ? 32768 : 0);
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

/** Is `descendantAbs` the same path as, or nested inside, `ancestorAbs`? */
function isSameOrDescendant(
  descendantAbs: string,
  ancestorAbs: string,
): boolean {
  const a = descendantAbs.toLowerCase();
  const b = ancestorAbs.toLowerCase();
  return a === b || a.startsWith(b.replace(/\\+$/, "") + "\\");
}

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const MenuBarRow = styled.div`
  position: relative;
  display: flex;
  height: 22px;
  flex-shrink: 0;
  font-size: 12px;
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
`;
const MenuTopItem = styled.button<{ $open: boolean }>`
  background: ${({ $open, theme }) =>
    $open ? theme.hoverBackground : "transparent"};
  color: ${({ $open, theme }) =>
    $open ? theme.headerText : theme.materialText};
  border: none;
  padding: 2px 8px;
  font-size: 12px;
  cursor: default;
`;
const Dropdown = styled.div`
  position: absolute;
  top: 22px;
  z-index: 50;
  ${raised}
  background: ${({ theme }) => theme.material};
  min-width: 180px;
  padding: 2px;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.4);
`;
const DropdownItem = styled.div<{ $disabled?: boolean }>`
  padding: 4px 10px;
  font-size: 12px;
  white-space: pre;
  color: ${({ $disabled, theme }) =>
    $disabled ? theme.materialTextDisabled : theme.materialText};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  &:hover {
    background: ${({ $disabled, theme }) =>
      $disabled ? "none" : theme.hoverBackground};
    color: ${({ $disabled, theme }) =>
      $disabled ? theme.materialTextDisabled : theme.headerText};
  }
`;
const DropdownDivider = styled.div`
  height: 1px;
  margin: 3px 2px;
  background: ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
`;

interface MenuItemDef {
  label: string;
  action?: () => void;
  disabled?: boolean;
  divider?: boolean;
}
interface MenuDef {
  label: string;
  items: MenuItemDef[];
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
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  margin: 0 8px 8px;
`;

const IconItem = styled.button<{ $selected?: boolean }>`
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

const SmallRow = styled.button<{ $selected?: boolean; $dragOver?: boolean }>`
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
    icon: "/icons/floppy.png",
    target: "A:\\",
    kind: "drive",
    notReady: true,
  },
  {
    label: "Local Disk (C:)",
    icon: "/icons/disk-drive.png",
    target: "C:\\",
    kind: "drive",
  },
  {
    label: "Audio CD (D:)",
    icon: "/icons/music-cd.png",
    target: "D:\\",
    kind: "drive",
    notReady: true,
  },
  {
    label: "Control Panel",
    icon: "/icons/control-panel.png",
    target: "",
    kind: "app",
    appId: "control-panel",
  },
  { label: "Printers", icon: "/icons/printers.png", target: "", kind: "app" },
  {
    label: "Dial-Up Networking",
    icon: "/icons/folder-open.png",
    target: "",
    kind: "app",
  },
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
  const vfs = useVfsStore();
  const clipboard = useClipboardStore();
  const [path, setPath] = useState<string>(MY_COMPUTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("large");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const isRoot = path === MY_COMPUTER;
  const isDriveRoot = /^([A-Za-z]):\\$/.test(path);
  const driveNotReady = /^[AD]:\\$/.test(path);
  const entries: VfsNode[] =
    isRoot || driveNotReady ? [] : (vfs.list(path) ?? []);
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Sync the window title + icon to the current path — just like real Win95 Explorer
  useEffect(() => {
    updateTitle(windowId, isRoot ? MY_COMPUTER : path);
    const icon = isRoot
      ? "/icons/computer.png"
      : isDriveRoot
        ? (DRIVES.find((d) => d.target === path)?.icon ??
          "/icons/disk-drive.png")
        : "/icons/folder-open.png";
    updateIcon(windowId, icon);
  }, [path, isRoot, isDriveRoot, windowId, updateTitle, updateIcon]);

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
    const abs = vfs.resolvePath(node.name, path);
    if (!abs) return;
    if (node.type === "dir") {
      setPath(abs);
      setSelected(null);
    } else if (node.appId && APPS[node.appId as keyof typeof APPS]) {
      const id = node.appId as keyof typeof APPS;
      if (id === "notepad")
        openApp("notepad", {
          title: `${node.name} - Notepad`,
          data: { path: abs },
        });
      else openApp(id);
    } else if (node.name.toLowerCase().endsWith(".txt")) {
      openApp("notepad", {
        title: `${node.name} - Notepad`,
        data: { path: abs },
      });
    } else if (
      node.name.toLowerCase().endsWith(".png") ||
      node.name.toLowerCase().endsWith(".bmp")
    ) {
      openApp("paint", { title: `${node.name} - Paint`, data: { path: abs } });
    }
  };

  const goUp = () => {
    if (isRoot) return;
    if (isDriveRoot) {
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
    }
  };

  const commitRename = () => {
    if (renaming && renameVal.trim()) {
      const abs = vfs.resolvePath(renaming, path);
      if (abs) vfs.rename(abs, renameVal.trim());
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
    e.dataTransfer.types.includes(VFS_DND_TYPE);

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

  const objectCount = isRoot ? DRIVES.length : sorted.length;

  // ── context menu ───────────────────────────────────────────────────────
  const openCtx = (e: React.MouseEvent, node: VfsNode | null) => {
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

  const ctxItems: {
    label: string;
    action: () => void;
    disabled?: boolean;
    divider?: boolean;
  }[] = ctx?.node
    ? [
        { label: "Open", action: () => openNode(ctx.node!) },
        { label: "", action: () => {}, divider: true },
        {
          label: "Cut",
          action: () => cutSelected(ctx.node!),
          disabled: !!ctx.node!.system,
        },
        {
          label: "Copy",
          action: () => copySelected(ctx.node!),
          disabled: !!ctx.node!.system,
        },
        { label: "", action: () => {}, divider: true },
        {
          label: "Rename",
          action: () => {
            setRenaming(ctx.node!.name);
            setRenameVal(ctx.node!.name);
          },
        },
        { label: "Delete", action: () => deleteNode(ctx.node!) },
        { label: "", action: () => {}, divider: true },
        { label: "Properties", action: () => propertiesOf(ctx.node!) },
      ]
    : [
        {
          label: "Paste",
          action: paste,
          disabled:
            isRoot || driveNotReady || !clipboard.mode || !clipboard.sourcePath,
        },
        { label: "", action: () => {}, divider: true },
        {
          label: "New Folder",
          action: newFolder,
          disabled: isRoot || driveNotReady,
        },
        {
          label: "New Text Document",
          action: newTextFile,
          disabled: isRoot || driveNotReady,
        },
      ];

  const selectedNode = sorted.find((n) => n.name === selected) ?? null;

  // Explorer keyboard shortcuts: Ctrl+C / Ctrl+X copy/cut the selected node,
  // Ctrl+V pastes the clipboard into the open folder. Only active while this
  // Explorer window is the focused one, so they never collide with Notepad,
  // Terminal, etc. Ignored while renaming so the keys edit the filename.
  useEffect(() => {
    if (!isFocused) return;
    const onKey = (e: KeyboardEvent) => {
      if (renaming) return;
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
          disabled: isRoot || driveNotReady,
        },
        {
          label: "New Text Document",
          action: newTextFile,
          disabled: isRoot || driveNotReady,
        },
        { label: "", divider: true },
        {
          label: "Open",
          action: () => selectedNode && openNode(selectedNode),
          disabled: !selectedNode,
        },
        {
          label: "Delete",
          action: () => selectedNode && deleteNode(selectedNode),
          disabled: !selectedNode,
        },
        {
          label: "Rename",
          action: () => {
            if (selectedNode) {
              setRenaming(selectedNode.name);
              setRenameVal(selectedNode.name);
            }
          },
          disabled: !selectedNode,
        },
        {
          label: "Properties",
          action: () => selectedNode && propertiesOf(selectedNode),
          disabled: !selectedNode,
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
          disabled: !selectedNode || !!selectedNode?.system,
        },
        {
          label: "Copy",
          action: () => selectedNode && copySelected(selectedNode),
          disabled: !selectedNode || !!selectedNode?.system,
        },
        {
          label: "Paste",
          action: paste,
          disabled:
            isRoot || driveNotReady || !clipboard.mode || !clipboard.sourcePath,
        },
        { label: "", divider: true },
        {
          label: "Select All",
          action: () =>
            setSelected(sorted.length ? sorted[sorted.length - 1].name : null),
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: `${view === "large" ? "✓" : " "} Large Icons`,
          action: () => setView("large"),
        },
        {
          label: `${view === "small" ? "✓" : " "} Small Icons`,
          action: () => setView("small"),
        },
        {
          label: `${view === "list" ? "✓" : " "} List`,
          action: () => setView("list"),
        },
        {
          label: `${view === "details" ? "✓" : " "} Details`,
          action: () => setView("details"),
        },
        { label: "", divider: true },
        { label: "Refresh", action: refresh },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About RSNRA 95", disabled: true }],
    },
  ];

  const menuRow = (
    <MenuBarRow
      onMouseLeave={() => setOpenMenu(null)}
      onClick={(e) => e.stopPropagation()}
    >
      {menus.map((menu) => (
        <div key={menu.label} style={{ position: "relative" }}>
          <MenuTopItem
            $open={openMenu === menu.label}
            onClick={() =>
              setOpenMenu((m) => (m === menu.label ? null : menu.label))
            }
            onMouseEnter={() => setOpenMenu((m) => (m ? menu.label : m))}
          >
            {menu.label}
          </MenuTopItem>
          {openMenu === menu.label && (
            <Dropdown>
              {menu.items.map((item, i) =>
                item.divider ? (
                  <DropdownDivider key={i} />
                ) : (
                  <DropdownItem
                    key={item.label}
                    $disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return;
                      item.action?.();
                      setOpenMenu(null);
                    }}
                  >
                    {item.label}
                  </DropdownItem>
                ),
              )}
            </Dropdown>
          )}
        </div>
      ))}
    </MenuBarRow>
  );

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
        : undefined,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelected(node.name);
      },
      onDoubleClick: () => {
        if (renaming === node.name) return;
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

  const renderIcon = (node: VfsNode): ReactNode => (
    <IconItem
      key={node.name}
      $selected={selected === node.name}
      tabIndex={0}
      {...nodeHandlers(node)}
      style={{
        opacity: node.system ? 0.85 : isCutSource(node) ? 0.5 : 1,
        outline: dragOverKey === node.name ? "1px solid #fff" : undefined,
      }}
    >
      <div style={{ position: "relative" }}>
        <img src={iconForNode(node)} alt="" draggable={false} />
        {node.system && <LockGlyph />}
      </div>
      {renaming === node.name ? renameBox() : node.name}
    </IconItem>
  );

  const renderSmallRow = (node: VfsNode): ReactNode => (
    <SmallRow
      key={node.name}
      $selected={selected === node.name}
      $dragOver={dragOverKey === node.name}
      tabIndex={0}
      {...nodeHandlers(node)}
      style={{ opacity: node.system ? 0.85 : isCutSource(node) ? 0.5 : 1 }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <img src={iconForNode(node)} alt="" draggable={false} />
        {node.system && <LockGlyph />}
      </div>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {renaming === node.name ? renameBox(140) : node.name}
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
      style={{ opacity: node.system ? 0.85 : isCutSource(node) ? 0.5 : 1 }}
    >
      <ColName>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <img src={iconForNode(node)} alt="" draggable={false} />
          {node.system && <LockGlyph />}
        </div>
        {renaming === node.name ? (
          renameBox(140)
        ) : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {node.name}
          </span>
        )}
      </ColName>
      <ColSize>{formatSize(node)}</ColSize>
      <ColType>{describeType(node)}</ColType>
      <ColDate>{formatDate(node)}</ColDate>
    </DetailsRow>
  );

  return (
    <Layout
      onClick={() => {
        closeCtx();
        setOpenMenu(null);
      }}
    >
      {menuRow}
      <Separator />
      <NavToolbar>
        <NavBtn onClick={goUp} disabled={isRoot} title="Up one level">
          ↑
        </NavBtn>
      </NavToolbar>
      <AddressRow>
        <span style={{ fontSize: 12 }}>Address</span>
        <AddressField variant="field">{path}</AddressField>
      </AddressRow>

      <IconGrid
        onContextMenu={(e) => openCtx(e, null)}
        onClick={() => {
          setSelected(null);
          setOpenMenu(null);
        }}
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
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(d.label);
              }}
              onDoubleClick={() => enter(d)}
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
              <img src={d.icon} alt="" draggable={false} />
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
              <ColName>Name</ColName>
              <ColSize>Size</ColSize>
              <ColType>Type</ColType>
              <ColDate>Modified</ColDate>
            </DetailsHeaderRow>
            {sorted.map(renderDetailsRow)}
          </DetailsTable>
        )}
        {!isRoot && sorted.length === 0 && (
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
          {ctxItems.map((it, i) =>
            it.divider ? (
              <CtxDivider key={i} />
            ) : (
              <CtxItem
                key={i}
                $disabled={it.disabled}
                onClick={() => !it.disabled && runCtx(it.action)}
              >
                {it.label}
              </CtxItem>
            ),
          )}
        </ContextMenu>
      )}
    </Layout>
  );
}
