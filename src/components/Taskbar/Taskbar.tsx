import { useEffect, useMemo, useState } from "react";
import { AppBar, Button, Toolbar } from "react95";
import styled from "styled-components";
import { ContextMenu, CtxDivider, CtxItem } from "../../components/ContextMenu";
import { ScrollArea } from "../../components/ScrollArea";
import { TASKBAR_HEIGHT } from "../../constants";
import { openApp } from "../../data/apps";
import { iconForNode } from "../../data/fileIcons";
import { getPreferredApp } from "../../data/fileOpen";
import { focusWebamp, openWebamp } from "../../lib/webamp";
import { useWindowStore } from "../../store/windowStore";
import { useVfsStore } from "../../store/vfsStore";
import { Icon } from "../Icon/Icon";
import { NetworkTray } from "./NetworkTray";
import { TaskbarClock } from "./TaskbarClock";
import { VolumeControl } from "./VolumeControl";

const Bar = styled(AppBar)`
  top: auto !important;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${TASKBAR_HEIGHT}px;
  z-index: 200000;
`;

const StyledToolbar = styled(Toolbar)`
  height: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
`;

const StartButton = styled(Button)`
  font-weight: bold;
  height: 28px;
  padding: 0 10px !important;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;

  img {
    width: 18px;
    height: 18px;
    image-rendering: pixelated;
  }
`;

const Divider = styled.div`
  width: 2px;
  height: 26px;
  border-left: 1px solid ${({ theme }) => theme.borderDark};
  border-right: 1px solid ${({ theme }) => theme.borderLightest};
`;

const QuickLaunchButton = styled.button`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;

  img {
    width: 18px;
    height: 18px;
    image-rendering: pixelated;
  }

  &:hover {
    border-color: ${({ theme }) => theme.borderLightest}
      ${({ theme }) => theme.borderDark} ${({ theme }) => theme.borderDark}
      ${({ theme }) => theme.borderLightest};
  }

  &:active {
    border-color: ${({ theme }) => theme.borderDark}
      ${({ theme }) => theme.borderLightest}
      ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDark};
  }
`;

const QuickLaunchArea = styled.div<{ $dragOver: boolean }>`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: ${({ $dragOver }) => ($dragOver ? "rgba(0,0,0,0.05)" : "transparent")};
  border: 1px dashed ${({ $dragOver }) => ($dragOver ? "rgba(0,0,0,0.2)" : "transparent")};
  border-radius: 2px;
  transition: background 0.15s ease;
`;

const InsertionIndicator = styled.div`
  width: 2px;
  height: 18px;
  background: black;
  position: relative;
  margin: 0 4px;
  align-self: center;
  flex-shrink: 0;

  &::before,
  &::after {
    content: "";
    position: absolute;
    left: -2px;
    width: 6px;
    height: 2px;
    background: black;
  }

  &::before {
    top: 0;
  }

  &::after {
    bottom: 0;
  }
`;

const OverflowButton = styled(QuickLaunchButton)`
  font-weight: bold;
  font-size: 14px;
  line-height: 1;
`;

const OverflowWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const UpwardDropdown = styled.div`
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 210000;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
  box-shadow: 2px -2px 10px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  padding: 2px;
  min-width: 110px; /* Narrow dropdown matching classical Windows */
`;

const DropdownItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  color: ${({ theme }) => theme.materialText};
  user-select: none;

  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    background: ${({ theme }) => theme.hoverBackground};
    color: ${({ theme }) => theme.headerText};
  }
`;

const WindowList = styled(ScrollArea)`
  flex: 1;
  height: 100%;
  min-width: 0;
`;

const WindowButton = styled(Button)`
  height: 28px;
  max-width: 160px;
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  padding: 0 6px !important;
  font-size: 12px;
  flex-shrink: 0;

  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Tray = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid;
  border-color: ${({ theme }) => theme.borderDark}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDark};
  flex-shrink: 0;
`;

export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const startMenuOpen = useWindowStore((s) => s.startMenuOpen);
  const toggleStartMenu = useWindowStore((s) => s.toggleStartMenu);
  const toggleMinimizeFromTaskbar = useWindowStore(
    (s) => s.toggleMinimizeFromTaskbar,
  );
  const toggleShowDesktop = useWindowStore((s) => s.toggleShowDesktop);
  const removeFromQuickLaunch = useWindowStore((s) => s.removeFromQuickLaunch);

  // Subscribe to VFS root but resolve Quick Launch folder manually to track changes
  const quickLaunchVfsItems = useVfsStore((s) => {
    const win = s.root.children?.find((c) => c.name.toLowerCase() === "windows");
    const appData = win?.children?.find((c) => c.name.toLowerCase() === "application data");
    const ms = appData?.children?.find((c) => c.name.toLowerCase() === "microsoft");
    const ie = ms?.children?.find((c) => c.name.toLowerCase() === "internet explorer");
    const ql = ie?.children?.find((c) => c.name.toLowerCase() === "quick launch");
    return ql?.children ?? [];
  });

  const resolvedQlItems = useMemo(() => {
    return quickLaunchVfsItems.map((node) => {
      let lnk: any = null;
      try {
        lnk = JSON.parse(node.content ?? "");
      } catch {}
      return {
        id: node.name, // The filename (e.g. "Notepad.lnk") acts as unique id
        title: lnk?.title ?? node.name.replace(/\.lnk$/i, ""),
        icon: lnk?.icon ?? "/icons/w2k_shortcut.ico",
        type: lnk?.target === "show-desktop" ? "show-desktop" : lnk?.type ?? "app",
        appId: lnk?.target,
        lnkPath: lnk?.target,
        data: lnk?.data,
      };
    });
  }, [quickLaunchVfsItems]);

  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [qlCtx, setQlCtx] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!overflowOpen) return;
    const handleGlobalClick = () => setOverflowOpen(false);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [overflowOpen]);

  const handleQuickLaunchClick = (item: any) => {
    if (item.type === "show-desktop") {
      toggleShowDesktop();
    } else if (item.type === "app" && item.appId) {
      if (item.appId === "winamp") {
        void openWebamp();
      } else {
        openApp(item.appId, { title: item.title, data: item.data });
      }
    } else if (item.type === "lnk" && item.lnkPath) {
      window.open(item.lnkPath, "_blank", "noopener,noreferrer");
    }
  };

  const handleQlContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setQlCtx({ x: e.clientX, y: e.clientY, itemId });
  };

  const handleQlDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-rsnra-vfs-path")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "link";
      if (!isDragOver) setIsDragOver(true);
    }
  };

  const handleQlDragLeave = () => {
    setIsDragOver(false);
  };

  const handleQlDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const srcAbs = e.dataTransfer.getData("application/x-rsnra-vfs-path");
    if (!srcAbs) return;

    const vfs = useVfsStore.getState();
    const node = vfs.resolve(srcAbs);
    if (!node) return;

    const isLnk = node.name.toLowerCase().endsWith(".lnk");
    const label = isLnk ? node.name.replace(/\.lnk$/i, "") : node.name;
    let targetIcon = isLnk ? null : iconForNode(node);
    let lnk: any = null;
    if (isLnk) {
      try {
        lnk = JSON.parse(node.content ?? "");
        targetIcon = lnk?.icon;
      } catch {}
    }

    if (isLnk && lnk) {
      useWindowStore.getState().addToQuickLaunch({
        title: label,
        icon: targetIcon || "/icons/w2k_shortcut.ico",
        type: lnk.type === "url" ? "lnk" : "app",
        appId: lnk.target,
        lnkPath: lnk.target,
        data: lnk.data,
      });
    } else {
      const preferred = getPreferredApp(node.name);
      useWindowStore.getState().addToQuickLaunch({
        title: label,
        icon: targetIcon || "/icons/w2k_shortcut.ico",
        type: "app",
        appId: (node.appId || preferred?.appId || "notepad") as any,
        data: { path: srcAbs },
      });
    }
  };

  const visibleItems = resolvedQlItems.slice(0, 3);
  const overflowItems = resolvedQlItems.slice(3);

  return (
    <Bar
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault();
        setCtxPos({ x: e.clientX, y: e.clientY });
      }}
    >
      <StyledToolbar>
        <StartButton
          id="start-button"
          active={startMenuOpen}
          onClick={() => toggleStartMenu()}
        >
          <Icon src="/icons/w98_windows.ico" size={18} />
          Start
        </StartButton>
        <Divider />
        <QuickLaunchArea
          $dragOver={isDragOver}
          onDragOver={handleQlDragOver}
          onDragLeave={handleQlDragLeave}
          onDrop={handleQlDrop}
        >
          {visibleItems.map((item) => (
            <QuickLaunchButton
              key={item.id}
              title={item.title}
              onClick={() => handleQuickLaunchClick(item)}
              onContextMenu={(e) => handleQlContextMenu(e, item.id)}
            >
              <Icon src={item.icon} size={18} />
            </QuickLaunchButton>
          ))}
          {isDragOver && <InsertionIndicator />}
          {overflowItems.length > 0 && (
            <OverflowWrapper>
              <OverflowButton
                title="More Quick Launch items"
                onClick={(e) => {
                  e.stopPropagation();
                  setOverflowOpen(!overflowOpen);
                }}
              >
                »
              </OverflowButton>
              {overflowOpen && (
                <UpwardDropdown>
                  {overflowItems.map((item) => (
                    <DropdownItem
                      key={item.id}
                      onClick={() => handleQuickLaunchClick(item)}
                      onContextMenu={(e) => handleQlContextMenu(e, item.id)}
                    >
                      <Icon src={item.icon} size={16} />
                      <span>{item.title}</span>
                    </DropdownItem>
                  ))}
                </UpwardDropdown>
              )}
            </OverflowWrapper>
          )}
        </QuickLaunchArea>
        <Divider />
        <WindowList
          orientation="horizontal"
          contentStyle={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            height: "100%",
            minWidth: "max-content",
          }}
        >
          {windows
            .filter((w) => w.appId !== "paint-fonts")
            .map((w) => (
              <WindowButton
                key={w.id}
                active={w.isFocused && !w.isMinimized}
                onClick={() =>
                  w.appId === "winamp"
                    ? focusWebamp()
                    : toggleMinimizeFromTaskbar(w.id)
                }
              >
                <Icon src={w.icon} size={16} />
                <span>{w.title}</span>
              </WindowButton>
            ))}
        </WindowList>
        <Tray>
          <NetworkTray />
          <VolumeControl />
          <TaskbarClock />
        </Tray>
      </StyledToolbar>

      {ctxPos && (
        <ContextMenu x={ctxPos.x} y={ctxPos.y} onClose={() => setCtxPos(null)}>
          <CtxItem $disabled>Toolbars</CtxItem>
          <CtxDivider />
          <CtxItem
            onClick={() => {
              toggleShowDesktop();
              setCtxPos(null);
            }}
          >
            Show Desktop
          </CtxItem>
          <CtxDivider />
          <CtxItem
            onClick={() => {
              openApp("task-manager");
              setCtxPos(null);
            }}
          >
            Task Manager
          </CtxItem>
          <CtxDivider />
          <CtxItem $disabled>Properties</CtxItem>
        </ContextMenu>
      )}

      {qlCtx && (
        <ContextMenu
          x={qlCtx.x}
          y={qlCtx.y}
          onClose={() => setQlCtx(null)}
        >
          <CtxItem
            onClick={() => {
              removeFromQuickLaunch(qlCtx.itemId);
              setQlCtx(null);
            }}
          >
            Remove from Quick Launch
          </CtxItem>
        </ContextMenu>
      )}
    </Bar>
  );
}
