import { useState } from "react";
import {
  Button,
  Separator,
  Window,
  WindowContent,
  WindowHeader,
} from "react95";
import styled from "styled-components";
import { ScrollArea } from "../../components/ScrollArea";
import { requestShutdown } from "../../data/startMenu";
import { useWindowStore } from "../../store/windowStore";
import { Icon } from "../Icon/Icon";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 500000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
`;

const Dialog = styled(Window)`
  width: 360px;
`;

const Intro = styled.p`
  font-size: 12px;
  line-height: 1.5;
  margin: 0 0 10px;
`;

const ListFrame = styled(ScrollArea)`
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  max-height: 180px;
  margin-bottom: 14px;
`;

const Row = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};

  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

export function CloseProgramDialog() {
  const open = useWindowStore((s) => s.closeProgramOpen);
  const setOpen = useWindowStore((s) => s.setCloseProgramOpen);
  const windows = useWindowStore((s) => s.windows);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const [selected, setSelected] = useState<string | null>(null);

  if (!open) return null;

  const endTask = () => {
    if (selected) closeWindow(selected);
    setSelected(null);
  };

  return (
    <Overlay onMouseDown={() => setOpen(false)}>
      <Dialog onMouseDown={(e) => e.stopPropagation()}>
        <WindowHeader>
          <span>Close Program</span>
        </WindowHeader>
        <WindowContent>
          <Intro>
            RSNRA.ART is not responding to your... actually, it's fine. Here's
            what's currently running:
          </Intro>
          <ListFrame orientation="vertical">
            <Row $selected={false}>
              <Icon src="/icons/explorer.exe/000.ico" size={16} />
              RSNRA.ART Desktop (system)
            </Row>
            {windows.map((w) => (
              <Row
                key={w.id}
                $selected={selected === w.id}
                onClick={() => setSelected(w.id)}
                onDoubleClick={() => closeWindow(w.id)}
              >
                <Icon src={w.icon} size={16} />
                {w.title}
                {w.isMinimized ? " (minimized)" : ""}
              </Row>
            ))}
            {windows.length === 0 && (
              <Row $selected={false} style={{ color: "#888" }}>
                No other programs are running.
              </Row>
            )}
          </ListFrame>
          <Separator />
          <Footer style={{ marginTop: 12 }}>
            <Button onClick={requestShutdown}>Shut Down</Button>
            <Button onClick={endTask} disabled={!selected} primary>
              End Task
            </Button>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
          </Footer>
        </WindowContent>
      </Dialog>
    </Overlay>
  );
}
