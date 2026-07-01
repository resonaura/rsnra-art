import { Button, Frame, GroupBox } from "react95";
import styled from "styled-components";
import { ScrollArea } from "../../components/ScrollArea";
import { openApp } from "../../data/apps";
import {
  BAND_LOCATION,
  BAND_NAME,
  WELCOME_CHANGELOG,
} from "../../data/content";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
`;

const Heading = styled.h2`
  font-size: 20px;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  span {
    font-size: 13px;
    font-weight: normal;
    color: ${({ theme }) => theme.materialTextDisabled};
  }
`;

const Main = styled.div`
  display: flex;
  flex: 1;
  gap: 12px;
  min-height: 0;
`;

const InfoFrame = styled(Frame)`
  flex: 1;
  background: ${({ theme }) => theme.canvas};
  color: ${({ theme }) => theme.canvasText};
  display: flex;
  flex-direction: column;
  overflow: hidden;

  h3 {
    margin: 0 0 4px;
    font-size: 13px;
  }
  p {
    margin: 0;
    line-height: 1.5;
  }
  ul {
    margin: 0;
    padding-left: 18px;
    line-height: 1.5;
  }
`;

const SideButtons = styled.div`
  width: 168px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export function Welcome({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);

  return (
    <Layout>
      <Heading>
        Welcome to{" "}
        <span style={{ color: "#000", fontWeight: "bold" }}>RSNRA</span>
        <span style={{ fontSize: 13 }}>95</span>
      </Heading>
      <Main>
        <InfoFrame variant="field">
          <ScrollArea
            style={{ flex: 1 }}
            contentStyle={{
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <h3>
              {BAND_NAME} — {BAND_LOCATION}
            </h3>
            <p>
              Fuzzed-out guitars, atmospheric synths, and rhythms built for
              basement shows and big rooms alike. This is the official desktop
              of RESONAURA — click around, open some windows, and stay a while.
            </p>
            <h3>Did you know...</h3>
            <p>
              You can open the <b>RSNRA Terminal</b> from the Start Menu and
              type <code>help</code> for a list of commands.
            </p>
            <h3>What's new</h3>
            <ul>
              {WELCOME_CHANGELOG.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </ScrollArea>
        </InfoFrame>
        <SideButtons>
          <Button fullWidth onClick={() => openApp("music")}>
            Listen Now
          </Button>
          <Button fullWidth onClick={() => openApp("social")}>
            Follow Us
          </Button>
          <Button fullWidth onClick={() => openApp("contact")}>
            Get In Touch
          </Button>
          <GroupBox label="Explore">
            <Button
              fullWidth
              size="sm"
              style={{ marginBottom: 6 }}
              onClick={() => openApp("my-computer")}
            >
              My Computer
            </Button>
            <Button fullWidth size="sm" onClick={() => openApp("games-folder")}>
              Games
            </Button>
          </GroupBox>
        </SideButtons>
      </Main>
      <Footer>
        <Button onClick={() => closeWindow(windowId)}>Close</Button>
      </Footer>
    </Layout>
  );
}
