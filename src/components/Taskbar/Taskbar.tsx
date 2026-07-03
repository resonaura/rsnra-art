import { useEffect, useState } from "react";
import { AppBar, Button, Toolbar } from "react95";
import styled from "styled-components";
import { ContextMenu, CtxDivider, CtxItem } from "../../components/ContextMenu";
import { ScrollArea } from "../../components/ScrollArea";
import { TASKBAR_HEIGHT } from "../../constants";
import { openApp } from "../../data/apps";
import { focusWebamp, openWebamp } from "../../lib/webamp";
import { useWindowStore } from "../../store/windowStore";
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

const QuickLaunchArea = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
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
  min-width: 150px;
`;

const DropdownItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
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
  const quickLaunchItems = useWindowStore((s) => s.quickLaunchItems);
  const removeFromQuickLaunch = useWindowStore((s) => s.removeFromQuickLaunch);

  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [qlCtx, setQlCtx] = useState<{ x: number; y: number; itemId: string } | null>(null);

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

  const visibleItems = quickLaunchItems.slice(0, 3);
  const overflowItems = quickLaunchItems.slice(3);

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
        <QuickLaunchArea>
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
