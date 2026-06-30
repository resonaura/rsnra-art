import styled from 'styled-components';
import { Button, Frame } from 'react95';
import { LINKS } from '../../data/content';

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
`;

const Card = styled(Frame)`
  background: ${({ theme }) => theme.canvas};
  color: ${({ theme }) => theme.canvasText};
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
`;

const Glyph = styled.div`
  font-size: 32px;
  width: 48px;
  text-align: center;
  flex-shrink: 0;
`;

const CardBody = styled.div`
  flex: 1;
  h4 {
    margin: 0 0 4px;
    font-size: 14px;
  }
  p {
    margin: 0 0 8px;
    font-size: 12px;
    color: ${({ theme }) => theme.materialTextDisabled};
  }
`;

export function Social() {
  return (
    <Layout>
      <Card variant="field">
        <Glyph>♪</Glyph>
        <CardBody>
          <h4>TikTok</h4>
          <p>{LINKS.tiktokHandle} — clips, riffs, and chaos from the road.</p>
          <Button
            onClick={() => window.open(LINKS.tiktok, '_blank', 'noopener,noreferrer')}
          >
            Open TikTok
          </Button>
        </CardBody>
      </Card>
      <Card variant="field">
        <Glyph>◎</Glyph>
        <CardBody>
          <h4>Instagram</h4>
          <p>{LINKS.instagramHandle} — show flyers, photos, and updates.</p>
          <Button
            onClick={() =>
              window.open(LINKS.instagram, '_blank', 'noopener,noreferrer')
            }
          >
            Open Instagram
          </Button>
        </CardBody>
      </Card>
    </Layout>
  );
}
