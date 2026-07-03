import { useMemo, useState } from "react";
import styled from "styled-components";
import { openApp } from "../../data/apps";
import { iconForNode } from "../../data/fileIcons";
import { getPreferredApp } from "../../data/fileOpen";
import { playSound } from "../../lib/audio";
import { openVfsAudio, openWebamp } from "../../lib/webamp";
import { useDesktopStore, WALLPAPERS } from "../../store/desktopStore";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
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

const IconColumn = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

// The desktop folder lives at C:\Windows\Desktop (the classic Win95 location).
const DESKTOP_PATH = "C:\\Windows\\Desktop";

interface LnkData {
  type: "app" | "url";
  target: string;
  icon: string;
  shortcut?: boolean;
}

function parseLnk(node: VfsNode): LnkData | null {
  try {
    return JSON.parse(node.content ?? "") as LnkData;
  } catch {
    return null;
  }
}

function openLnk(lnk: LnkData) {
  if (lnk.type === "app") openApp(lnk.target as AppId);
  else window.open(lnk.target, "_blank", "noopener,noreferrer");
}

// Open a non-shortcut desktop node in the matching app. Folders open an
// Explorer window rooted at that folder.
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
      // Not a built-in system sound (e.g. a .wav saved from Sound Recorder
      // elsewhere in the VFS) — open it for playback/editing there instead.
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

// Stable empty array — avoids creating a new reference on every render.
const EMPTY: VfsNode[] = [];

type IconCtx =
  | { kind: "recycle"; x: number; y: number }
  | { kind: "node"; x: number; y: number; node: VfsNode };

export function Desktop() {
  const wallpaperId = useDesktopStore((s) => s.wallpaperId);
  const background =
    WALLPAPERS.find((w) => w.id === wallpaperId)?.background ??
    WALLPAPERS[0].background;

  const showHidden = useFilePrefsStore((s) => s.showHidden);
  const recycledCount = useVfsStore((s) => s.recycled.length);
  const emptyRecycleBin = useVfsStore((s) => s.emptyRecycleBin);
  const vfsRoot = useVfsStore((s) => s.root);
  const renameFile = useVfsStore((s) => s.rename);
  const mkdir = useVfsStore((s) => s.mkdir);
  const writeFile = useVfsStore((s) => s.writeFile);
  const moveToRecycleBin = useVfsStore((s) => s.moveToRecycleBin);

  const desktopNodes = useMemo(() => {
    const windows = vfsRoot.children?.find(
      (c) => c.name.toLowerCase() === "windows" && c.type === "dir",
    );
    const desktop = windows?.children?.find(
      (c) => c.name.toLowerCase() === "desktop" && c.type === "dir",
    );
    return desktop?.children ?? EMPTY;
  }, [vfsRoot]);

  // System .lnk shortcuts render first (My Computer, etc.), then the Recycle
  // Bin, then everything else the user has put on the desktop — folders,
  // documents, user shortcuts — just like real Windows.
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
    // Keep the .lnk extension on shortcuts when renaming.
    if (
      node?.name.toLowerCase().endsWith(".lnk") &&
      !newName.toLowerCase().endsWith(".lnk")
    ) {
      newName += ".lnk";
    }
    renameFile(`${DESKTOP_PATH}\\${renaming}`, newName);
    setRenaming(null);
    if (selected === renaming) setSelected(newName);
  };

  const newFolder = () => {
    let name = "New Folder";
    let i = 1;
    while (vfsExists(desktopNodes, name)) name = `New Folder (${++i})`;
    mkdir(`${DESKTOP_PATH}\\${name}`);
    setSelected(name);
    setRenaming(name);
    setRenameVal(name);
  };

  const newTextFile = () => {
    let name = "New Text Document.txt";
    let i = 1;
    while (vfsExists(desktopNodes, name))
      name = `New Text Document (${++i}).txt`;
    writeFile(`${DESKTOP_PATH}\\${name}`, "");
    setSelected(name);
    setRenaming(name);
    setRenameVal(name);
  };

  const renderLnk = (node: VfsNode) => {
    const lnk = parseLnk(node);
    if (!lnk) return null;
    const label = node.name.replace(/\.lnk$/i, "");
    return (
      <DesktopIcon
        key={node.name}
        label={label}
        icon={lnk.icon}
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
      />
    );
  };

  // Render a non-shortcut desktop item (folder or file) with the proper icon.
  const renderNode = (node: VfsNode) => {
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
      />
    );
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
    >
      <IconColumn>
        {systemLnks.map(renderLnk)}

        {/* Recycle Bin — virtual system item, always after My Computer */}
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
        />

        {rest.map((node) => (
          <div
            key={node.name}
            style={{
              opacity: node.hidden ? 0.5 : 1,
            }}
          >
            {renderNode(node)}
          </div>
        ))}
      </IconColumn>

      {/* Background context menu */}
      {bgMenu && (
        <DesktopContextMenu
          x={bgMenu.x}
          y={bgMenu.y}
          onClose={() => setBgMenu(null)}
          onNewFolder={newFolder}
          onNewTextFile={newTextFile}
        />
      )}

      {/* Recycle Bin icon context menu */}
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

      {/* Generic icon context menu (shortcuts, folders, files) */}
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
                      moveToRecycleBin(abs);
                      if (selected === node.name) setSelected(null);
                      setIconCtx(null);
                    }}
                  >
                    Delete
                  </CtxItem>
                </>
              )}
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

// Case-insensitive "does this name already exist in the desktop listing".
function vfsExists(nodes: VfsNode[], name: string): boolean {
  return nodes.some((n) => n.name.toLowerCase() === name.toLowerCase());
}
