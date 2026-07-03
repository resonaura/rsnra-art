import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { openApp } from "../../data/apps";
import { iconForNode } from "../../data/fileIcons";
import { getPreferredApp } from "../../data/fileOpen";
import { playSound } from "../../lib/audio";
import { openVfsAudio, openWebamp } from "../../lib/webamp";
import { useDesktopStore, WALLPAPERS } from "../../store/desktopStore";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";
import type { AppId } from "../../types/window";
import { ContextMenu, CtxDivider, CtxItem } from "../ContextMenu";
import { OpenWithDialog } from "../OpenWithDialog/OpenWithDialog";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { DesktopIcon } from "./DesktopIcon";

const Wrapper = styled.div<{ $bg: string }>`
  position: absolute;
  inset: 0;
  background: ${({ $bg }) => $bg};
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.04) 1px,
    transparent 1px
  );
  background-size: 4px 4px;
  overflow: hidden;
`;

// The desktop folder lives at C:\Windows\Desktop (the classic Win95 location).
const DESKTOP_PATH = "C:\\Windows\\Desktop";

interface LnkData {
  type: "app" | "url" | "missing";
  target: string;
  icon?: string;
  shortcut?: boolean;
  title?: string;
  data?: Record<string, unknown>;
  file?: string;
}

function parseLnk(node: VfsNode): LnkData | null {
  try {
    return JSON.parse(node.content ?? "") as LnkData;
  } catch {
    return null;
  }
}

function openLnk(lnk: LnkData) {
  if (lnk.type === "app") {
    if (lnk.target === "winamp") void openWebamp();
    else openApp(lnk.target as AppId, { title: lnk.title, data: lnk.data });
  } else if (lnk.type === "url") {
    window.open(lnk.target, "_blank", "noopener,noreferrer");
  }
}

function openNode(node: VfsNode, abs: string) {
  if (node.type === "file" && !node.name.toLowerCase().endsWith(".lnk")) {
    const preferred = getPreferredApp(node.name);
    if (preferred) {
      preferred.open(abs, node.name);
      return;
    }
  }
  if (node.type === "dir") {
    openApp("my-computer", { title: node.name, data: { path: abs } });
    return;
  }
  if (node.appId) {
    if (node.appId === "winamp") {
      void openWebamp();
    } else {
      openApp(node.appId as AppId);
    }
    return;
  }
  const lower = node.name.toLowerCase();
  if (lower.endsWith(".lnk")) {
    const lnk = parseLnk(node);
    if (lnk) openLnk(lnk);
    return;
  }
  if (isAudioExt(lower)) {
    void openVfsAudio(abs).then((played) => {
      if (!played && lower.endsWith(".wav")) {
        openApp("sound-recorder", {
          title: `${node.name} - Sound Recorder`,
          data: { path: abs },
        });
      }
    });
    return;
  }
  if (
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

const AUDIO_EXTS = [".wav", ".mp3", ".mid", ".midi", ".rmi", ".ogg"];
function isAudioExt(lowerName: string): boolean {
  return AUDIO_EXTS.some((e) => lowerName.endsWith(e));
}

const EMPTY: VfsNode[] = [];

type IconCtx =
  | { kind: "recycle"; x: number; y: number }
  | { kind: "node"; x: number; y: number; node: VfsNode };

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
  const wallpaperId = useDesktopStore((s) => s.wallpaperId);
  const background =
    WALLPAPERS.find((w) => w.id === wallpaperId)?.background ??
    WALLPAPERS[0].background;

  const { iconPositions, setIconPosition, autoArrange, sortBy } = useDesktopStore();

  const [winHeight, setWinHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 600);
  useEffect(() => {
    const handleResize = () => setWinHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showHidden = useFilePrefsStore((s) => s.showHidden);
  const recycledCount = useVfsStore((s) => s.recycled.length);
  const emptyRecycleBin = useVfsStore((s) => s.emptyRecycleBin);

  const desktopNode = useVfsStore(
    (s) => {
      const winNode = s.root.children?.find(
        (c) => c.name.toLowerCase() === "windows" && c.type === "dir",
      );
      return winNode?.children?.find(
        (c) => c.name.toLowerCase() === "desktop" && c.type === "dir",
      ) ?? null;
    },
  );

  const desktopNodes = useMemo(
    () => desktopNode?.children ?? EMPTY,
    [desktopNode],
  );

  const systemLnks = desktopNodes.filter(
    (n) =>
      n.type === "file" && n.system && n.name.toLowerCase().endsWith(".lnk"),
  );
  const rest = desktopNodes.filter((n) => {
    if (n.system && n.name.toLowerCase().endsWith(".lnk")) return false;
    if (n.hidden && !showHidden) return false;
    return true;
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);
  const [iconCtx, setIconCtx] = useState<IconCtx | null>(null);
  const [openWithNode, setOpenWithNode] = useState<VfsNode | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const recycleBinIcon =
    recycledCount > 0
      ? "/icons/w2k_recycle_bin_full.ico"
      : "/icons/w2k_recycle_bin_empty.ico";

  const closeAll = () => {
    setBgMenu(null);
    setIconCtx(null);
  };

  const commitRename = () => {
    if (!renaming || !renameVal.trim()) {
      setRenaming(null);
      return;
    }
    const node = desktopNodes.find((n) => n.name === renaming);
    let newName = renameVal.trim();
    if (
      node?.name.toLowerCase().endsWith(".lnk") &&
      !newName.toLowerCase().endsWith(".lnk")
    ) {
      newName += ".lnk";
    }
    useVfsStore.getState().rename(`${DESKTOP_PATH}\\${renaming}`, newName);
    setRenaming(null);
    if (selected === renaming) setSelected(newName);
  };

  const newFolder = () => {
    let name = "New Folder";
    let i = 1;
    while (vfsExists(desktopNodes, name)) name = `New Folder (${++i})`;
    useVfsStore.getState().mkdir(`${DESKTOP_PATH}\\${name}`);
    setSelected(name);
    setRenaming(name);
    setRenameVal(name);
  };

  const newTextFile = () => {
    let name = "New Text Document.txt";
    let i = 1;
    while (vfsExists(desktopNodes, name)) name = `New Text Document (${++i}).txt`;
    useVfsStore.getState().writeFile(`${DESKTOP_PATH}\\${name}`, "");
    setSelected(name);
    setRenaming(name);
    setRenameVal(name.replace(/\.txt$/i, ""));
  };

  const renderLnk = (node: VfsNode, draggable?: boolean, onDragStart?: (e: React.DragEvent) => void) => {
    const lnk = parseLnk(node);
    if (!lnk) return null;
    const label = node.name.replace(/\.lnk$/i, "");
    return (
      <DesktopIcon
        key={node.name}
        label={label}
        icon={lnk.icon || "/icons/w2k_shortcut.ico"}
        shortcut={lnk.shortcut}
        selected={selected === node.name}
        renaming={renaming === node.name}
        renameVal={renameVal}
        onRenameChange={setRenameVal}
        onRenameCommit={commitRename}
        onRenameCancel={() => setRenaming(null)}
        onSelect={() => {
          setSelected(node.name);
          closeAll();
        }}
        onOpen={() => openLnk(lnk)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelected(node.name);
          setBgMenu(null);
          setIconCtx({ kind: "node", x: e.clientX, y: e.clientY, node });
        }}
        draggable={draggable}
        onDragStart={onDragStart}
      />
    );
  };

  const renderNode = (node: VfsNode, draggable?: boolean, onDragStart?: (e: React.DragEvent) => void) => {
    const isLnk = node.name.toLowerCase().endsWith(".lnk");
    const label = isLnk ? node.name.replace(/\.lnk$/i, "") : node.name;
    const lnk = isLnk ? parseLnk(node) : null;
    const icon = lnk?.icon ?? iconForNode(node);
    return (
      <DesktopIcon
        key={node.name}
        label={label}
        icon={icon}
        shortcut={lnk?.shortcut}
        selected={selected === node.name}
        renaming={renaming === node.name}
        renameVal={renameVal}
        onRenameChange={setRenameVal}
        onRenameCommit={commitRename}
        onRenameCancel={() => setRenaming(null)}
        onSelect={() => {
          setSelected(node.name);
          closeAll();
        }}
        onOpen={() => openNode(node, `${DESKTOP_PATH}\\${node.name}`)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelected(node.name);
          setBgMenu(null);
          setIconCtx({ kind: "node", x: e.clientX, y: e.clientY, node });
        }}
        draggable={draggable}
        onDragStart={onDragStart}
      />
    );
  };

  // Combine system links, Recycle Bin, and rest of files/folders
  const allItems = useMemo(() => {
    const res: any[] = [];
    systemLnks.forEach((n) => {
      res.push({
        key: n.name,
        type: "lnk",
        node: n,
        label: n.name.replace(/\.lnk$/i, ""),
      });
    });
    res.push({
      key: "__recycle__",
      type: "recycle",
      label: "Recycle Bin",
    });
    rest.forEach((n) => {
      res.push({
        key: n.name,
        type: "node",
        node: n,
        label: n.name.toLowerCase().endsWith(".lnk") ? n.name.replace(/\.lnk$/i, "") : n.name,
      });
    });
    return res;
  }, [systemLnks, rest]);

  // Sort elements if sortBy is selected
  const sortedItems = useMemo(() => {
    const items = [...allItems];
    if (!sortBy) return items;

    items.sort((a, b) => {
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
    return items;
  }, [allItems, sortBy]);

  // Assign screen positions (either auto-arranged columns or saved dragging coords)
  const positionedItems = useMemo(() => {
    return sortedItems.map((item, index) => {
      let pos: { x: number; y: number };
      if (autoArrange) {
        pos = getAutoArrangedPosition(index, winHeight);
      } else {
        const saved = iconPositions[item.key];
        if (saved) {
          pos = saved;
        } else {
          pos = getAutoArrangedPosition(index, winHeight);
        }
      }
      return { ...item, pos };
    });
  }, [sortedItems, autoArrange, iconPositions, winHeight]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const types = Array.from(e.dataTransfer.types || []);
    e.dataTransfer.dropEffect = types.includes("desktop-icon-name") ? "move" : "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const desktopIconName = e.dataTransfer.getData("desktop-icon-name");
    const srcAbs = e.dataTransfer.getData("application/x-rsnra-vfs-path");
    
    const dropX = e.clientX;
    const dropY = e.clientY;

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

  const handleIconDragStart = (key: string, e: React.DragEvent) => {
    e.dataTransfer.setData("desktop-icon-name", key);
    if (key !== "__recycle__") {
      const abs = `${DESKTOP_PATH}\\${key}`;
      e.dataTransfer.setData("application/x-rsnra-vfs-path", abs);
      e.dataTransfer.setData("text/plain", abs);
    }
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <Wrapper
      $bg={background}
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
              {renderLnk(item.node, true, (e) => handleIconDragStart(item.key, e))}
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
            {renderNode(item.node, true, (e) => handleIconDragStart(item.key, e))}
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
            onClick={() => {
              if (recycledCount === 0) return;
              emptyRecycleBin();
              playSound("recycle");
              setIconCtx(null);
            }}
          >
            Empty Recycle Bin
          </CtxItem>
        </ContextMenu>
      )}

      {iconCtx?.kind === "node" &&
        (() => {
          const { node } = iconCtx;
          const lnk = parseLnk(node);
          const isLnk = node.name.toLowerCase().endsWith(".lnk");
          const label = isLnk ? node.name.replace(/\.lnk$/i, "") : node.name;
          const abs = `${DESKTOP_PATH}\\${node.name}`;
          return (
            <ContextMenu
              x={iconCtx.x}
              y={iconCtx.y}
              onClose={() => setIconCtx(null)}
            >
              <CtxItem
                onClick={() => {
                  if (isLnk && lnk) openLnk(lnk);
                  else openNode(node, abs);
                  setIconCtx(null);
                }}
              >
                Open
              </CtxItem>
              <CtxItem
                onClick={() => {
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
                      appId: (node.appId || preferred?.appId || "notepad") as any,
                      data: { path: abs },
                    });
                  }
                  setIconCtx(null);
                }}
              >
                Add to Quick Launch
              </CtxItem>
              {!isLnk && node.type === "file" && (
                <CtxItem
                  onClick={() => {
                    setOpenWithNode(node);
                    setIconCtx(null);
                  }}
                >
                  Open With...
                </CtxItem>
              )}
              {!node.system && (
                <>
                  <CtxDivider />
                  <CtxItem
                    onClick={() => {
                      setRenaming(node.name);
                      setRenameVal(label);
                      setIconCtx(null);
                    }}
                  >
                    Rename
                  </CtxItem>
                  <CtxItem
                    onClick={() => {
                      useVfsStore.getState().moveToRecycleBin(abs);
                      if (selected === node.name) setSelected(null);
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
      {openWithNode && (
        <OpenWithDialog
          fileName={openWithNode.name}
          filePath={`${DESKTOP_PATH}\\${openWithNode.name}`}
          onClose={() => setOpenWithNode(null)}
        />
      )}
    </Wrapper>
  );
}

function vfsExists(nodes: VfsNode[], name: string): boolean {
  return nodes.some((n) => n.name.toLowerCase() === name.toLowerCase());
}
