import { useMemo, useState } from "react";
import styled from "styled-components";
import { openApp } from "../../data/apps";
import { useDesktopStore, WALLPAPERS } from "../../store/desktopStore";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import type { AppId } from "../../types/window";
import { ContextMenu, CtxDivider, CtxItem } from "../ContextMenu";
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

// Stable empty array — avoids creating a new reference on every render.
const EMPTY: VfsNode[] = [];

type IconCtx =
  | { kind: "recycle"; x: number; y: number }
  | { kind: "lnk"; x: number; y: number; node: VfsNode };

export function Desktop() {
  const wallpaperId = useDesktopStore((s) => s.wallpaperId);
  const background =
    WALLPAPERS.find((w) => w.id === wallpaperId)?.background ??
    WALLPAPERS[0].background;

  const recycledCount = useVfsStore((s) => s.recycled.length);
  const emptyRecycleBin = useVfsStore((s) => s.emptyRecycleBin);
  // Subscribe to root (stable reference — only changes on real VFS mutations).
  // Deriving desktopNodes via useMemo avoids the infinite loop caused by
  // s.list(...) returning a new array on every getSnapshot call.
  const vfsRoot = useVfsStore((s) => s.root);
  const removeFile = useVfsStore((s) => s.remove);
  const renameFile = useVfsStore((s) => s.rename);

  const desktopNodes = useMemo(() => {
    const windows = vfsRoot.children?.find(
      (c) => c.name.toLowerCase() === "windows" && c.type === "dir",
    );
    const desktop = windows?.children?.find(
      (c) => c.name.toLowerCase() === "desktop" && c.type === "dir",
    );
    return desktop?.children ?? EMPTY;
  }, [vfsRoot]);

  const [selected, setSelected] = useState<string | null>(null);
  const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);
  const [iconCtx, setIconCtx] = useState<IconCtx | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const recycleBinIcon =
    recycledCount > 0
      ? "/icons/recycle-bin-full.png"
      : "/icons/recycle-bin-empty.png";

  const lnkNodes = desktopNodes.filter(
    (n) => n.type === "file" && n.name.toLowerCase().endsWith(".lnk"),
  );
  const systemLnks = lnkNodes.filter((n) => n.system);
  const userLnks = lnkNodes.filter((n) => !n.system);

  const closeAll = () => {
    setBgMenu(null);
    setIconCtx(null);
  };

  const commitRename = () => {
    if (!renaming || !renameVal.trim()) {
      setRenaming(null);
      return;
    }
    const newName = renameVal.trim().endsWith(".lnk")
      ? renameVal.trim()
      : renameVal.trim() + ".lnk";
    renameFile(`C:\\Windows\\Desktop\\${renaming}`, newName);
    setRenaming(null);
    if (selected === renaming) setSelected(newName);
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
          setIconCtx({ kind: "lnk", x: e.clientX, y: e.clientY, node });
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

        {userLnks.map(renderLnk)}
      </IconColumn>

      {/* Background context menu */}
      {bgMenu && (
        <DesktopContextMenu
          x={bgMenu.x}
          y={bgMenu.y}
          onClose={() => setBgMenu(null)}
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
              setIconCtx(null);
            }}
          >
            Empty Recycle Bin
          </CtxItem>
        </ContextMenu>
      )}

      {/* .lnk icon context menu */}
      {iconCtx?.kind === "lnk" &&
        (() => {
          const { node } = iconCtx;
          const lnk = parseLnk(node);
          const label = node.name.replace(/\.lnk$/i, "");
          return (
            <ContextMenu
              x={iconCtx.x}
              y={iconCtx.y}
              onClose={() => setIconCtx(null)}
            >
              <CtxItem
                onClick={() => {
                  if (lnk) openLnk(lnk);
                  setIconCtx(null);
                }}
              >
                Open
              </CtxItem>
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
                      removeFile(`C:\\Windows\\Desktop\\${node.name}`);
                      if (selected === node.name) setSelected(null);
                      setIconCtx(null);
                    }}
                  >
                    Delete Shortcut
                  </CtxItem>
                </>
              )}
            </ContextMenu>
          );
        })()}
    </Wrapper>
  );
}
