import styled from 'styled-components';
import { Button, Frame, GroupBox } from 'react95';
import { LINKS, BAND_NAME } from '../../data/content';

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
`;

const Player = styled(Frame)`
  background: ${({ theme }) => theme.material};
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
`;

const Screen = styled(Frame)`
  width: 100%;
  background: #0a2a1a;
  color: #6dff8f;
  font-family: 'Courier New', monospace;
  padding: 12px;
  font-size: 13px;
  letter-spacing: 0.5px;
`;

const Controls = styled.div`
  display: flex;
  gap: 6px;
`;

const PlatformGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

function openMusic() {
  window.open(LINKS.music, '_blank', 'noopener,noreferrer');
}

export function Music() {
  return (
    <Layout>
      <Player variant="window">
        <Screen variant="field">
          ▶ NOW STREAMING
          <br />
          {BAND_NAME} — All Releases
          <br />
          rsnra.link/resonaura
        </Screen>
        <Controls>
          <Button onClick={openMusic} title="Play">
            ▶
          </Button>
          <Button disabled title="Pause">
            ⏸
          </Button>
          <Button disabled title="Stop">
            ⏹
          </Button>
          <Button disabled title="Previous">
            ⏮
          </Button>
          <Button disabled title="Next">
            ⏭
          </Button>
        </Controls>
        <Button primary size="lg" onClick={openMusic} style={{ width: '100%' }}>
          🎧 Listen on rsnra.link/resonaura
        </Button>
      </Player>

      <GroupBox label="Streaming Platforms" style={{ flex: 1 }}>
        <p style={{ marginTop: 0, fontSize: 12 }}>
          One link, every platform — rsnra.link routes you straight to your
          player of choice.
        </p>
        <PlatformGrid>
          <Button onClick={openMusic}>Spotify</Button>
          <Button onClick={openMusic}>Apple Music</Button>
          <Button onClick={openMusic}>YouTube Music</Button>
          <Button onClick={openMusic}>Bandcamp</Button>
        </PlatformGrid>
      </GroupBox>
    </Layout>
  );
}
