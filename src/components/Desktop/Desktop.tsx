import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styled from "styled-components";
import { openApp } from "../../data/apps";
import { displayName, iconForNode } from "../../data/fileIcons";
import { getPreferredApp } from "../../data/fileOpen";
import { wallpaperUrl } from "../../data/wallpapers";
import { playSound } from "../../lib/audio";
import {
  openVfsNode,
  parseVfsShortcut,
} from "../../lib/openVfsNode";
import { patternDataUri } from "../../lib/patterns";
import {
  containsReadOnlyFile,
  deleteConfirmationMessage,
  readOnlyFileWarning,
  recycleBinPayloadSizes,
  willRecycleBinEvictOldestItems,
} from "../../lib/recycleBin";
import { isVfsNodeVisible } from "../../lib/fileVisibility";
import { alertError, confirmDialog } from "../../lib/systemDialogs";
import {
  desktopEntryId,
  mergeCommonAndUserEntries,
} from "../../lib/shellFolders";
import {
  COMMON_DESKTOP_PATH,
  USER_DESKTOP_PATH,
  USER_DOCUMENTS_PATH,
} from "../../lib/windowsPaths";
import { useDesktopStore } from "../../store/desktopStore";
import { useDisplayStore } from "../../store/displayStore";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import { useRecycleBinStore } from "../../store/recycleBinStore";
import {
  containsProtectedNode,
  isReadOnlyFile,
  useVfsStore,
  type VfsNode,
} from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";
import {
  ContextMenu,
  CtxDivider,
  CtxItem,
} from "../ContextMenu";
import { OpenWithDialog } from "../OpenWithDialog/OpenWithDialog";
import { SendToSubmenu } from "../SendToSubmenu";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { DesktopIcon } from "./DesktopIcon";

const Wrapper = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  image-rendering: pixelated;
`;

const DESKTOP_PATH = USER_DESKTOP_PATH;

function parseLnk(node: VfsNode) {
  return parseVfsShortcut(node);
}

const EMPTY: VfsNode[] = [];

type IconCtx =
  | { kind: "recycle"; x: number; y: number }
  | { kind: "node"; x: number; y: number; node: VfsNode; path: string };

type DesktopEntry = {
  node: VfsNode;
  path: string;
  id: string;
  positionKey: string;
};

type DesktopItem =
  | {
      key: string;
      positionKey: string;
      type: "lnk";
      node: VfsNode;
      path: string;
      label: string;
    }
  | {
      key: string;
      positionKey: string;
      type: "node";
      node: VfsNode;
      path: string;
      label: string;
    }
  | {
      key: string;
      positionKey: string;
      type: "recycle";
      label: string;
      node?: VfsNode;
      path?: string;
    }
  | {
      key: string;
      positionKey: string;
      type: "mydocs";
      label: string;
      node?: VfsNode;
      path?: string;
    };

function getAutoArrangedPosition(index: number, heightLimit: number) {
  const rowHeight = 82;
  const colWidth = 90;
  const topOffset = 12;
  const leftOffset = 12;
  
  const maxRows = Math.max(1, Math.floor((heightLimit - 40) / rowHeight));
  
  const col = Math.floor(index / maxRows);
  const row = index % maxRows;
  
  return {
    x: leftOffset + col * colWidth,
    y: topOffset + row * rowHeight,
  };
}

export function Desktop() {
  const wallpaperPath = useDisplayStore((s) => s.wallpaperPath);
  const wallpaperMode = useDisplayStore((s) => s.wallpaperMode);
  const pattern = useDisplayStore((s) => s.pattern);
  const desktopColor = useDisplayStore((s) => s.desktopColor);
  const desktopIcons = useDisplayStore((s) => s.desktopIcons);
  const zoom = useDisplayStore((s) => s.zoom);
  const readVfs = useVfsStore((s) => s.read);

  const backgroundStyle = useMemo<CSSProperties>(() => {
    const wpUrl = wallpaperPath ? wallpaperUrl(wallpaperPath, readVfs) : null;
    const patternUri = patternDataUri(pattern);
    const layers: { img: string; repeat: string; size: string; pos: string }[] =
      [];
    if (wpUrl) {
      layers.push({
        img: `url("${wpUrl}")`,
        repeat: wallpaperMode === "tile" ? "repeat" : "no-repeat",
        size: wallpaperMode === "stretch" ? "100% 100%" : "auto",
        pos: wallpaperMode === "center" ? "center" : "0 0",
      });
    }
    if (patternUri) {
      layers.push({
        img: `url("${patternUri}")`,
        repeat: "repeat",
        size: "8px 8px",
        pos: "0 0",
      });
    }
    return {
      backgroundColor: desktopColor,
      backgroundImage: layers.map((l) => l.img).join(", ") || undefined,
      backgroundRepeat: layers.map((l) => l.repeat).join(", ") || undefined,
      backgroundSize: layers.map((l) => l.size).join(", ") || undefined,
      backgroundPosition: layers.map((l) => l.pos).join(", ") || undefined,
    };
  }, [wallpaperPath, wallpaperMode, pattern, desktopColor, readVfs]);

  const { iconPositions, setIconPosition, autoArrange, sortBy } = useDesktopStore();

  const [winHeight, setWinHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 600);
  useEffect(() => {
    const handleResize = () => setWinHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // With a body zoom active, the usable layout height shrinks accordingly.
  const layoutHeight = winHeight / zoom;

  const showHidden = useFilePrefsStore((s) => s.showHidden);
  const hideProtectedSystemFiles = useFilePrefsStore(
    (s) => s.hideProtectedSystemFiles,
  );
  const singleClickOpen = useFilePrefsStore((s) => s.singleClickOpen);
  const underlineMode = useFilePrefsStore((s) => s.underlineMode);
  const hideKnownExtensions = useFilePrefsStore((s) => s.hideKnownExtensions);
  const showMyDocumentsOnDesktop = useFilePrefsStore((s) => s.showMyDocumentsOnDesktop);
  const showPopupDescriptions = useFilePrefsStore((s) => s.showPopupDescriptions);
  const extensionIcons = useFilePrefsStore((s) => s.extensionIcons);
  const underline = singleClickOpen ? (underlineMode === "browser" ? "always" : "hover") : "none";
  const recycledCount = useVfsStore((s) => s.recycled.length);
  const confirmDelete = useRecycleBinStore((s) => s.confirmDelete);
  const emptyRecycleBin = useVfsStore((s) => s.emptyRecycleBin);

  const desktopNode = useVfsStore((s) => s.resolve(DESKTOP_PATH));
  const commonDesktopNode = useVfsStore((s) =>
    s.resolve(COMMON_DESKTOP_PATH),
  );
  const desktopEntries = useMemo<DesktopEntry[]>(() => {
    const userNodes = desktopNode?.children ?? EMPTY;
    const commonNodes = commonDesktopNode?.children ?? EMPTY;
    return mergeCommonAndUserEntries(
      COMMON_DESKTOP_PATH,
      commonNodes,
      DESKTOP_PATH,
      userNodes,
    );
  }, [desktopNode, commonDesktopNode]);
  const desktopNodes = desktopNode?.children ?? EMPTY;

  const systemLnks = desktopEntries.filter(
    ({ node }) =>
      node.type === "file" &&
      node.system &&
      node.name.toLowerCase().endsWith(".lnk") &&
      isVfsNodeVisible(node, showHidden, hideProtectedSystemFiles),
  );
  const rest = desktopEntries.filter(({ node }) => {
    if (node.system && node.name.toLowerCase().endsWith(".lnk")) return false;
    return isVfsNodeVisible(node, showHidden, hideProtectedSystemFiles);
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);
  const [iconCtx, setIconCtx] = useState<IconCtx | null>(null);
  const [openWithEntry, setOpenWithEntry] = useState<
    Pick<DesktopEntry, "node" | "path"> | null
  >(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const recycleBinIcon =
    recycledCount > 0 ? desktopIcons.recycleFull : desktopIcons.recycleEmpty;

  const closeAll = () => {
    setBgMenu(null);
    setIconCtx(null);
  };

  const commitRename = () => {
    if (!renaming || !renameVal.trim()) {
      setRenaming(null);
      return;
    }
    const entry = desktopEntries.find(({ id }) => id === renaming);
    const node = entry?.node;
    let newName = renameVal.trim();
    if (
      node?.name.toLowerCase().endsWith(".lnk") &&
      !newName.toLowerCase().endsWith(".lnk")
    ) {
      newName += ".lnk";
    }
    if (entry) {
      useVfsStore.getState().rename(
        `${entry.path}\\${entry.node.name}`,
        newName,
      );
    }
    setRenaming(null);
    if (selected === renaming && entry) {
      setSelected(desktopEntryId(entry.path, newName));
    }
  };

  const newFolder = () => {
    let name = "New Folder";
    let i = 1;
    while (vfsExists(desktopNodes, name)) name = `New Folder (${++i})`;
    useVfsStore.getState().mkdir(`${DESKTOP_PATH}\\${name}`);
    const id = desktopEntryId(DESKTOP_PATH, name);
    setSelected(id);
    setRenaming(id);
    setRenameVal(name);
  };

  const newTextFile = () => {
    let name = "New Text Document.txt";
    let i = 1;
    while (vfsExists(desktopNodes, name)) name = `New Text Document (${++i}).txt`;
    useVfsStore.getState().writeFile(`${DESKTOP_PATH}\\${name}`, "");
    const id = desktopEntryId(DESKTOP_PATH, name);
    setSelected(id);
    setRenaming(id);
    setRenameVal(name.replace(/\.txt$/i, ""));
  };

  const renderLnk = (node: VfsNode, path: string, id: string, draggable?: boolean, onDragStart?: (e: React.DragEvent) => void) => {
    const lnk = parseLnk(node);
    if (!lnk) return null;
    const label = node.name.replace(/\.lnk$/i, "");
    // Effects ▸ "Change Icon…" override for the My Computer desktop icon.
    const lnkIcon =
      node.name.toLowerCase() === "my computer.lnk"
        ? desktopIcons.myComputer
        : lnk.icon || "/icons/shell32.dll/109.ico";
    return (
      <DesktopIcon
        key={id}
        label={label}
        icon={lnkIcon}
        shortcut={lnk.shortcut}
        selected={selected === id}
        renaming={renaming === id}
        renameVal={renameVal}
        onRenameChange={setRenameVal}
        onRenameCommit={commitRename}
        onRenameCancel={() => setRenaming(null)}
        onSelect={() => {
          setSelected(id);
          closeAll();
        }}
        onOpen={() => openVfsNode(node, `${path}\\${node.name}`)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelected(id);
          setBgMenu(null);
          setIconCtx({ kind: "node", x: e.clientX, y: e.clientY, node, path });
        }}
        draggable={draggable}
        onDragStart={onDragStart}
        singleClickOpen={singleClickOpen}
        underline={underline}
        tooltip={showPopupDescriptions ? label : undefined}
      />
    );
  };

  const renderNode = (node: VfsNode, path: string, id: string, draggable?: boolean, onDragStart?: (e: React.DragEvent) => void) => {
    const isLnk = node.name.toLowerCase().endsWith(".lnk");
    const label = isLnk ? node.name.replace(/\.lnk$/i, "") : displayName(node.name, hideKnownExtensions);
    const lnk = isLnk ? parseLnk(node) : null;
    const icon = lnk?.icon ?? iconForNode(node, extensionIcons);
    return (
      <DesktopIcon
        key={id}
        label={label}
        icon={icon}
        shortcut={lnk?.shortcut}
        selected={selected === id}
        renaming={renaming === id}
        renameVal={renameVal}
        onRenameChange={setRenameVal}
        onRenameCommit={commitRename}
        onRenameCancel={() => setRenaming(null)}
        onSelect={() => {
          setSelected(id);
          closeAll();
        }}
        onOpen={() => openVfsNode(node, `${path}\\${node.name}`)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelected(id);
          setBgMenu(null);
          setIconCtx({ kind: "node", x: e.clientX, y: e.clientY, node, path });
        }}
        draggable={draggable}
        onDragStart={onDragStart}
        singleClickOpen={singleClickOpen}
        underline={underline}
        tooltip={showPopupDescriptions ? node.name : undefined}
      />
    );
  };

  // Combine system links, Recycle Bin, and rest of files/folders
  const allItems = useMemo(() => {
    const res: DesktopItem[] = [];
    systemLnks.forEach(({ node, path, id, positionKey }) => {
      res.push({
        key: id,
        positionKey,
        type: "lnk",
        node,
        path,
        label: node.name.replace(/\.lnk$/i, ""),
      });
    });
    res.push({
      key: "__recycle__",
      positionKey: "__recycle__",
      type: "recycle",
      label: "Recycle Bin",
    });
    if (showMyDocumentsOnDesktop) {
      res.push({
        key: "__mydocs__",
        positionKey: "__mydocs__",
        type: "mydocs",
        label: "My Documents",
      });
    }
    rest.forEach(({ node, path, id, positionKey }) => {
      res.push({
        key: id,
        positionKey,
        type: "node",
        node,
        path,
        label: node.name.toLowerCase().endsWith(".lnk") ? node.name.replace(/\.lnk$/i, "") : node.name,
      });
    });
    return res;
  }, [systemLnks, rest, showMyDocumentsOnDesktop]);

  // Sort elements if sortBy is selected
  const sortedItems = useMemo(() => {
    const systemItems = allItems.filter(
      (item) =>
        item.type === "recycle" ||
        item.node?.name.toLowerCase() === "my computer.lnk",
    );
    const userItems = allItems.filter(
      (item) =>
        item.type !== "recycle" &&
        item.node?.name.toLowerCase() !== "my computer.lnk",
    );
    
    if (!sortBy) return allItems;

    userItems.sort((a, b) => {
      if (sortBy === "name") {
        return a.label.localeCompare(b.label);
      }
      if (sortBy === "date") {
        const tA = a.node?.created ?? 0;
        const tB = b.node?.created ?? 0;
        return tA - tB;
      }
      if (sortBy === "type") {
        const typeA = a.node?.type === "dir" ? "dir" : a.node?.name.split(".").pop() || "";
        const typeB = b.node?.type === "dir" ? "dir" : b.node?.name.split(".").pop() || "";
        if (typeA === "dir" && typeB !== "dir") return -1;
        if (typeA !== "dir" && typeB === "dir") return 1;
        return typeA.localeCompare(typeB);
      }
      if (sortBy === "size") {
        const sizeA = a.node?.content?.length ?? 0;
        const sizeB = b.node?.content?.length ?? 0;
        return sizeA - sizeB;
      }
      return 0;
    });
    return [...systemItems, ...userItems];
  }, [allItems, sortBy]);

  // Assign screen positions (either auto-arranged columns or saved dragging coords)
  const positionedItems = useMemo(() => {
    return sortedItems.map((item, index) => {
      let pos: { x: number; y: number };
      if (autoArrange) {
        pos = getAutoArrangedPosition(index, layoutHeight);
      } else {
        const saved = iconPositions[item.positionKey];
        if (saved) {
          pos = saved;
        } else {
          pos = getAutoArrangedPosition(index, layoutHeight);
        }
      }
      return { ...item, pos };
    });
  }, [sortedItems, autoArrange, iconPositions, layoutHeight]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const types = Array.from(e.dataTransfer.types || []);
    e.dataTransfer.dropEffect = types.includes("desktop-icon-name") ? "move" : "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const desktopIconName = e.dataTransfer.getData("desktop-icon-name");
    const srcAbs = e.dataTransfer.getData("application/x-rsnra-vfs-path");
    
    // clientX/Y are visual-viewport px; layout coords need dividing by zoom.
    const dropX = e.clientX / zoom;
    const dropY = e.clientY / zoom;

    if (desktopIconName) {
      if (!autoArrange) {
        setIconPosition(desktopIconName, Math.max(0, dropX - 42), Math.max(0, dropY - 38));
      }
    } else if (srcAbs) {
      const newName = useVfsStore.getState().copyTo(srcAbs, DESKTOP_PATH);
      if (newName) {
        if (!autoArrange) {
          setIconPosition(newName, Math.max(0, dropX - 42), Math.max(0, dropY - 38));
        }
      }
    }
  };

  const handleIconDragStart = (
    positionKey: string,
    e: React.DragEvent,
    node?: VfsNode,
    path?: string,
  ) => {
    if (node && containsProtectedNode(node)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("desktop-icon-name", positionKey);
    if (node && path) {
      const abs = `${path}\\${node.name}`;
      e.dataTransfer.setData("application/x-rsnra-vfs-path", abs);
      e.dataTransfer.setData("text/plain", abs);
    }
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <Wrapper
      style={backgroundStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setSelected(null);
          closeAll();
          setRenaming(null);
        }
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          setIconCtx(null);
          setBgMenu({ x: e.clientX, y: e.clientY });
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {positionedItems.map((item) => {
        if (item.type === "lnk") {
          return (
            <div
              key={item.key}
              style={{
                position: "absolute",
                left: `${item.pos.x}px`,
                top: `${item.pos.y}px`,
              }}
            >
              {renderLnk(
                item.node,
                item.path,
                item.key,
                !containsProtectedNode(item.node),
                (e) =>
                  handleIconDragStart(
                    item.positionKey,
                    e,
                    item.node,
                    item.path,
                  ),
              )}
            </div>
          );
        }
        if (item.type === "recycle") {
          return (
            <div
              key={item.key}
              style={{
                position: "absolute",
                left: `${item.pos.x}px`,
                top: `${item.pos.y}px`,
              }}
            >
              <DesktopIcon
                label="Recycle Bin"
                icon={recycleBinIcon}
                selected={selected === "__recycle__"}
                onSelect={() => {
                  setSelected("__recycle__");
                  closeAll();
                }}
                onOpen={() => openApp("recycle-bin")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected("__recycle__");
                  setBgMenu(null);
                  setIconCtx({ kind: "recycle", x: e.clientX, y: e.clientY });
                }}
                draggable
                onDragStart={(e) => handleIconDragStart("__recycle__", e)}
                singleClickOpen={singleClickOpen}
                underline={underline}
                tooltip={showPopupDescriptions ? "Recycle Bin" : undefined}
              />
            </div>
          );
        }
        if (item.type === "mydocs") {
          return (
            <div
              key={item.key}
              style={{
                position: "absolute",
                left: `${item.pos.x}px`,
                top: `${item.pos.y}px`,
              }}
            >
              <DesktopIcon
                label="My Documents"
                icon={desktopIcons.myDocuments}
                selected={selected === "__mydocs__"}
                onSelect={() => {
                  setSelected("__mydocs__");
                  closeAll();
                }}
                onOpen={() =>
                  openApp("my-computer", {
                    title: "My Documents",
                    data: { path: USER_DOCUMENTS_PATH },
                  })
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected("__mydocs__");
                  closeAll();
                }}
                draggable
                onDragStart={(e) => handleIconDragStart("__mydocs__", e)}
                singleClickOpen={singleClickOpen}
                underline={underline}
                tooltip={showPopupDescriptions ? "My Documents" : undefined}
              />
            </div>
          );
        }
        return (
          <div
            key={item.key}
            style={{
              position: "absolute",
              left: `${item.pos.x}px`,
              top: `${item.pos.y}px`,
              opacity: item.node.hidden ? 0.5 : 1,
            }}
          >
            {renderNode(
              item.node,
              item.path,
              item.key,
              !containsProtectedNode(item.node),
              (e) =>
                handleIconDragStart(
                  item.positionKey,
                  e,
                  item.node,
                  item.path,
                ),
            )}
          </div>
        );
      })}

      {bgMenu && (
        <DesktopContextMenu
          x={bgMenu.x}
          y={bgMenu.y}
          onClose={() => setBgMenu(null)}
          onNewFolder={newFolder}
          onNewTextFile={newTextFile}
        />
      )}

      {iconCtx?.kind === "recycle" && (
        <ContextMenu
          x={iconCtx.x}
          y={iconCtx.y}
          onClose={() => setIconCtx(null)}
        >
          <CtxItem
            onClick={() => {
              openApp("recycle-bin");
              setIconCtx(null);
            }}
          >
            Open
          </CtxItem>
          <CtxDivider />
          <CtxItem
            $disabled={recycledCount === 0}
            onClick={async () => {
              if (recycledCount === 0) return;
              if (confirmDelete) {
                const result = await confirmDialog(
                  "Confirm Multiple File Delete",
                  "Are you sure you want to permanently delete all items in the Recycle Bin?",
                );
                if (result !== "yes") return;
              }
              emptyRecycleBin();
              playSound("recycle");
              setIconCtx(null);
            }}
          >
            Empty Recycle Bin
          </CtxItem>
          <CtxDivider />
          <CtxItem
            onClick={() => {
              openApp("recycle-bin-properties");
              setIconCtx(null);
            }}
          >
            Properties
          </CtxItem>
        </ContextMenu>
      )}

      {iconCtx?.kind === "node" &&
        (() => {
          const { node, path } = iconCtx;
          const lnk = parseLnk(node);
          const isLnk = node.name.toLowerCase().endsWith(".lnk");
          const label = isLnk ? node.name.replace(/\.lnk$/i, "") : node.name;
          const abs = `${path}\\${node.name}`;
          const targetIcon = lnk?.icon ?? iconForNode(node, extensionIcons);
          return (
            <ContextMenu
              x={iconCtx.x}
              y={iconCtx.y}
              onClose={() => setIconCtx(null)}
            >
              <CtxItem
                onClick={() => {
                  openVfsNode(node, abs);
                  setIconCtx(null);
                }}
              >
                Open
              </CtxItem>
              <CtxItem
                onClick={() => {
                  if (isLnk && lnk) {
                    if (lnk.type === "url") {
                      useWindowStore.getState().addToQuickLaunch({
                        title: label,
                        icon: targetIcon,
                        type: "lnk",
                        lnkPath: lnk.target,
                      });
                    } else if (lnk.type === "file") {
                      useWindowStore.getState().addToQuickLaunch({
                        title: label,
                        icon: targetIcon,
                        type: "file",
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
                      appId: (node.appId || preferred?.appId || "notepad") as any,
                      data: { path: abs },
                    });
                  }
                  setIconCtx(null);
                }}
              >
                Add to Quick Launch
              </CtxItem>
              <SendToSubmenu
                sources={[{ node, path: abs, icon: targetIcon }]}
                onComplete={() => setIconCtx(null)}
              />
              {!isLnk && node.type === "file" && (
                <CtxItem
                  onClick={() => {
                    setOpenWithEntry({ node, path });
                    setIconCtx(null);
                  }}
                >
                  Open With...
                </CtxItem>
              )}
              {!containsProtectedNode(node) && (
                <>
                  <CtxDivider />
                  {!isReadOnlyFile(node) && (
                    <CtxItem
                      onClick={() => {
                        const entryId = desktopEntryId(path, node.name);
                        setRenaming(entryId);
                        setSelected(entryId);
                        setRenameVal(label);
                        setIconCtx(null);
                      }}
                    >
                      Rename
                    </CtxItem>
                  )}
                  <CtxItem
                    onClick={async () => {
                      const containsReadOnly = containsReadOnlyFile(node);
                      const vfs = useVfsStore.getState();
                      const currentPayloadSizes = recycleBinPayloadSizes(
                        vfs.root,
                        vfs.recycled,
                      );
                      if (confirmDelete || containsReadOnly) {
                        const message = confirmDelete
                          ? deleteConfirmationMessage(
                              `'${label}'`,
                              [node],
                              currentPayloadSizes,
                            )
                          : readOnlyFileWarning(
                              [node],
                              false,
                              willRecycleBinEvictOldestItems(
                                [node],
                                currentPayloadSizes,
                              ),
                            );
                        const result = await confirmDialog(
                          "Confirm File Delete",
                          message,
                        );
                        if (result !== "yes") return;
                      }
                      const movedToRecycleBin = useVfsStore
                        .getState()
                        .moveToRecycleBin(abs, { allowReadOnly: true });
                      if (!movedToRecycleBin) {
                        void alertError(
                          "Could Not Delete",
                          "This item could not be moved to the Recycle Bin. It may contain protected Windows files or the disk may be full.",
                        );
                        return;
                      }
                      if (selected === desktopEntryId(path, node.name)) {
                        setSelected(null);
                      }
                      setIconCtx(null);
                    }}
                  >
                    Delete
                  </CtxItem>
                </>
              )}
              <CtxDivider />
              {/* Properties context menu option */}
              <CtxItem
                onClick={() => {
                  if (node.name.toLowerCase() === "my computer.lnk") {
                    openApp("system-properties");
                  } else {
                    openApp("properties", {
                      title: `${node.name} Properties`,
                      data: { path: abs },
                    });
                  }
                  setIconCtx(null);
                }}
              >
                Properties
              </CtxItem>
            </ContextMenu>
          );
        })()}
      {openWithEntry && (
        <OpenWithDialog
          fileName={openWithEntry.node.name}
          filePath={`${openWithEntry.path}\\${openWithEntry.node.name}`}
          onClose={() => setOpenWithEntry(null)}
        />
      )}
    </Wrapper>
  );
}

function vfsExists(nodes: VfsNode[], name: string): boolean {
  return nodes.some((n) => n.name.toLowerCase() === name.toLowerCase());
}
