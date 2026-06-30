import { useEffect } from 'react';
import styled from 'styled-components';
import { Button } from 'react95';
import { useWindowStore } from '../../store/windowStore';

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: #1a1a1a;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-family: 'ms_sans_serif', sans-serif;
  text-align: center;
  padding: 24px;
`;

export function ShutdownScreen() {
  const powerState = useWindowStore((s) => s.powerState);
  const setPowerState = useWindowStore((s) => s.setPowerState);
  const closeAll = useWindowStore((s) => s.closeAll);

  useEffect(() => {
    if (powerState === 'shutting-down') {
      const t = window.setTimeout(() => {
        closeAll();
        setPowerState('off');
      }, 1600);
      return () => window.clearTimeout(t);
    }
  }, [powerState, setPowerState, closeAll]);

  if (powerState === 'shutting-down') {
    return (
      <Screen>
        <p style={{ fontSize: 16 }}>RSNRA 95 is shutting down...</p>
      </Screen>
    );
  }

  if (powerState === 'off') {
    return (
      <Screen>
        <p style={{ fontSize: 18, fontWeight: 'bold' }}>
          It's now safe to close this tab.
        </p>
        <p style={{ fontSize: 12, maxWidth: 360 }}>
          Or jump right back in — RSNRA 95 boots fast, no floppy disks required.
        </p>
        <Button onClick={() => setPowerState('on')}>Restart RSNRA 95</Button>
      </Screen>
    );
  }

  return null;
}
