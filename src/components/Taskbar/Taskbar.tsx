import { AppBar, Button, Toolbar } from "react95";
import styled from "styled-components";
import { TASKBAR_HEIGHT } from "../../constants";
import { LINKS } from "../../data/content";
import { useWindowStore } from "../../store/windowStore";
import { TaskbarClock } from "./TaskbarClock";

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

const WindowList = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
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

const TrayIcon = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
  }
`;

export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const startMenuOpen = useWindowStore((s) => s.startMenuOpen);
  const toggleStartMenu = useWindowStore((s) => s.toggleStartMenu);
  const toggleMinimizeFromTaskbar = useWindowStore(
    (s) => s.toggleMinimizeFromTaskbar,
  );

  return (
    <Bar>
      <StyledToolbar>
        <StartButton
          id="start-button"
          active={startMenuOpen}
          onClick={() => toggleStartMenu()}
        >
          <img src="/icons/computer.png" alt="" draggable={false} />
          Start
        </StartButton>
        <Divider />
        <WindowList>
          {windows
            .filter((w) => w.appId !== "paint-fonts")
            .map((w) => (
              <WindowButton
                key={w.id}
                active={w.isFocused && !w.isMinimized}
                onClick={() => toggleMinimizeFromTaskbar(w.id)}
              >
                <img src={w.icon} alt="" draggable={false} />
                <span>{w.title}</span>
              </WindowButton>
            ))}
        </WindowList>
        <Tray>
          <TrayIcon
            title="TikTok @resonaura"
            onClick={() =>
              window.open(LINKS.tiktok, "_blank", "noopener,noreferrer")
            }
          >
            <img src="/icons/globe.png" alt="TikTok" />
          </TrayIcon>
          <TrayIcon
            title="Instagram @resonaura"
            onClick={() =>
              window.open(LINKS.instagram, "_blank", "noopener,noreferrer")
            }
          >
            <img src="/icons/globe-map.png" alt="Instagram" />
          </TrayIcon>
          <TaskbarClock />
        </Tray>
      </StyledToolbar>
    </Bar>
  );
}
