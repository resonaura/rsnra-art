import { useState } from 'react';
import styled from 'styled-components';
import { Window, WindowHeader, WindowContent, Button, Separator } from 'react95';
import { useWindowStore } from '../../store/windowStore';
import { requestShutdown } from '../../data/startMenu';

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

const ListFrame = styled.div`
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 14px;
`;

const Row = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  background: ${({ $selected, theme }) => ($selected ? theme.hoverBackground : 'transparent')};
  color: ${({ $selected, theme }) => ($selected ? theme.headerText : theme.canvasText)};

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
            RSNRA 95 is not responding to your... actually, it's fine. Here's
            what's currently running:
          </Intro>
          <ListFrame>
            <Row $selected={false}>
              <img src="/icons/computer.png" alt="" />
              RSNRA 95 Desktop (system)
            </Row>
            {windows.map((w) => (
              <Row
                key={w.id}
                $selected={selected === w.id}
                onClick={() => setSelected(w.id)}
                onDoubleClick={() => closeWindow(w.id)}
              >
                <img src={w.icon} alt="" />
                {w.title}
                {w.isMinimized ? ' (minimized)' : ''}
              </Row>
            ))}
            {windows.length === 0 && (
              <Row $selected={false} style={{ color: '#888' }}>
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
