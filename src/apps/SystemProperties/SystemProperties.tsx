import { useState } from "react";
import { Button, GroupBox, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { BAND_LOCATION, BAND_NAME } from "../../data/content";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Body = styled(TabBody)`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 4px;
`;

const Logo = styled.img`
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
`;

export function SystemProperties({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const [tab, setTab] = useState("General");

  return (
    <Layout>
      <Tabs
        value={tab}
        onChange={(v: string) => setTab(v)}
        style={{ fontSize: 11, zoom: 0.8 }}
      >
        <Tab value="General">General</Tab>
        <Tab value="Device Manager">Device Manager</Tab>
        <Tab value="Performance">Performance</Tab>
      </Tabs>
      <Body>
        {tab === "General" ? (
          <>
            <Header>
              <Logo src="/icons/w2k_my_computer.ico" alt="" draggable={false} />
              <div>
                <div style={{ fontSize: 13, fontWeight: "bold" }}>
                  RSNRA.ART
                </div>
                <div style={{ fontSize: 11 }}>Version 4.00.950</div>
              </div>
            </Header>
            <GroupBox style={{ zoom: 0.8 }} label="Registered to">
              <p style={{ fontSize: 16, margin: "0 0 4px" }}>{BAND_NAME}</p>
              <p style={{ fontSize: 16, margin: 0 }}>{BAND_LOCATION}</p>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Computer">
              <p style={{ fontSize: 16, margin: 0 }}>
                A React 19 desktop, running on your browser's JavaScript engine.
              </p>
            </GroupBox>
          </>
        ) : (
          <GroupBox style={{ zoom: 0.8 }} label={tab}>
            <p style={{ fontSize: 16 }}>This information is not available.</p>
          </GroupBox>
        )}
        <BtnRow style={{ zoom: 0.8, marginTop: "auto" }}>
          <Button
            style={{ width: "80px" }}
            onClick={() => closeWindow(windowId)}
          >
            OK
          </Button>
        </BtnRow>
      </Body>
    </Layout>
  );
}
