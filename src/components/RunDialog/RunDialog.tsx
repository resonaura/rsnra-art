import { useState } from 'react';
import styled from 'styled-components';
import { Window, WindowHeader, WindowContent, Button, TextInput } from 'react95';
import { useWindowStore } from '../../store/windowStore';
import { openApp } from '../../data/apps';
import type { AppId } from '../../types/window';

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
  width: 380px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const ErrorText = styled.p`
  color: #8b0000;
  font-size: 11px;
  margin: -8px 0 12px;
`;

const RUN_MAP: Record<string, AppId> = {
  terminal: 'terminal',
  notepad: 'notepad',
  'my-computer': 'my-computer',
  computer: 'my-computer',
  music: 'music',
  social: 'social',
  contact: 'contact',
  games: 'games-folder',
  minesweeper: 'minesweeper',
  snake: 'snake',
  help: 'help',
  control: 'control-panel',
  'control-panel': 'control-panel',
  'recycle-bin': 'recycle-bin',
  bin: 'recycle-bin',
};

export function RunDialog() {
  const open = useWindowStore((s) => s.runDialogOpen);
  const setOpen = useWindowStore((s) => s.setRunDialogOpen);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setValue('');
    setError(null);
  };

  const submit = () => {
    const key = value.trim().toLowerCase();
    const target = RUN_MAP[key];
    if (!target) {
      setError(`Cannot find "${value}". Try: terminal, notepad, music, games, contact...`);
      return;
    }
    openApp(target);
    close();
  };

  return (
    <Overlay onMouseDown={close}>
      <Dialog onMouseDown={(e) => e.stopPropagation()}>
        <WindowHeader>
          <span>Run</span>
        </WindowHeader>
        <WindowContent>
          <Row>
            <img src="/icons/msdos.png" alt="" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12 }}>
                Type the name of an app, and RSNRA 95 will open it for you.
              </p>
              <TextInput
                fullWidth
                autoFocus
                value={value}
                placeholder="terminal"
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
            </div>
          </Row>
          {error && <ErrorText>{error}</ErrorText>}
          <Footer>
            <Button onClick={submit} primary>
              OK
            </Button>
            <Button onClick={close}>Cancel</Button>
          </Footer>
        </WindowContent>
      </Dialog>
    </Overlay>
  );
}
