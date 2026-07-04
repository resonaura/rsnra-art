import { useState } from "react";
import { Button, Checkbox, Frame, GroupBox, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { R95_SCALE } from "../../react95.conf";
import { useDesktopStore, WALLPAPERS } from "../../store/desktopStore";
import { THEMES, useThemeStore } from "../../store/themeStore";
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
  height: 100%;
  overflow: auto;
`;

const Preview = styled(Frame)<{ $bg: string }>`
  width: 100%;
  height: 90px;
  background: ${({ $bg }) => $bg};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-shadow: 1px 1px black;
`;

const Swatches = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const Swatch = styled.button<{ $bg: string; $active: boolean }>`
  width: 56px;
  height: 36px;
  background: ${({ $bg }) => $bg};
  border: 2px solid;
  border-color: ${({ $active, theme }) =>
      $active ? theme.borderDarkest : theme.borderLightest}
    ${({ $active, theme }) =>
      $active ? theme.borderLightest : theme.borderDarkest}
    ${({ $active, theme }) =>
      $active ? theme.borderLightest : theme.borderDarkest}
    ${({ $active, theme }) =>
      $active ? theme.borderDarkest : theme.borderLightest};
  cursor: pointer;
  outline: ${({ $active }) => ($active ? "1px dotted black" : "none")};
  outline-offset: -4px;
`;

const SchemeSwatch = styled.button<{ $active: boolean }>`
  width: 64px;
  height: 44px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 2px solid;
  border-color: ${({ $active, theme }) =>
      $active ? theme.borderDarkest : theme.borderLightest}
    ${({ $active, theme }) =>
      $active ? theme.borderLightest : theme.borderDarkest}
    ${({ $active, theme }) =>
      $active ? theme.borderLightest : theme.borderDarkest}
    ${({ $active, theme }) =>
      $active ? theme.borderDarkest : theme.borderLightest};
  cursor: pointer;
  outline: ${({ $active }) => ($active ? "1px dotted black" : "none")};
  outline-offset: -4px;
`;

const SchemeTitleBar = styled.div<{ $bg: string }>`
  height: 14px;
  flex-shrink: 0;
  background: ${({ $bg }) => $bg};
`;

const SchemeBody = styled.div<{ $bg: string }>`
  flex: 1;
  background: ${({ $bg }) => $bg};
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 4px;
  flex-shrink: 0;
`;

const MiniScreen = styled.div`
  width: 100%;
  height: 90px;
  background: #888;
  border: 3px solid #444;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
`;

export function DisplayProperties({ windowId }: { windowId: string }) {
  const wallpaperId = useDesktopStore((s) => s.wallpaperId);
  const setWallpaper = useDesktopStore((s) => s.setWallpaper);
  const themeId = useThemeStore((s) => s.themeId);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const current = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];

  const [tab, setTab] = useState("Background");

  return (
    <Layout style={{ zoom: R95_SCALE }}>
      <Tabs value={tab} onChange={(v: string) => setTab(v)}>
        <Tab value="Background">Background</Tab>
        <Tab value="Screen Saver">Screen Saver</Tab>
        <Tab value="Appearance">Appearance</Tab>
        <Tab value="Effects">Effects</Tab>
        <Tab value="Settings">Settings</Tab>
      </Tabs>
      <Body>
        {tab === "Background" && (
          <GroupBox label="Desktop wallpaper">
            <Preview $bg={current.background}>{current.label}</Preview>
            <Swatches>
              {WALLPAPERS.map((wp) => (
                <Swatch
                  key={wp.id}
                  $bg={wp.background}
                  $active={wp.id === wallpaperId}
                  title={wp.label}
                  onClick={() => setWallpaper(wp.id)}
                />
              ))}
            </Swatches>
          </GroupBox>
        )}

        {tab === "Screen Saver" && (
          <GroupBox
            style={{ display: "flex", flexDirection: "column" }}
            label="Screen Saver"
          >
            <MiniScreen>(None)</MiniScreen>
            <Checkbox
              label="Password protected"
              disabled
              style={{ marginTop: 8 }}
            />
            <Button style={{ width: "fit-content" }} disabled>
              Settings...
            </Button>
          </GroupBox>
        )}

        {tab === "Appearance" && (
          <GroupBox label="Scheme">
            <p style={{ margin: "0 0 8px" }}>
              Current: <b>{THEMES.find((t) => t.id === themeId)?.label}</b>
            </p>
            <Swatches>
              {THEMES.map((t) => (
                <SchemeSwatch
                  key={t.id}
                  $active={t.id === themeId}
                  title={t.label}
                  onClick={() => setThemeId(t.id)}
                >
                  <SchemeTitleBar $bg={t.theme.headerBackground} />
                  <SchemeBody $bg={t.theme.material} />
                </SchemeSwatch>
              ))}
            </Swatches>
          </GroupBox>
        )}

        {tab === "Effects" && (
          <GroupBox
            style={{ display: "flex", flexDirection: "column" }}
            label="Visual effects"
          >
            <Checkbox label="Use large icons" disabled />
            <Checkbox
              label="Show window contents while dragging"
              disabled
              checked
              style={{ marginTop: 4 }}
            />
            <Checkbox
              label="Smooth edges of screen fonts"
              disabled
              checked
              style={{ marginTop: 4 }}
            />
          </GroupBox>
        )}

        {tab === "Settings" && (
          <GroupBox label="Display">
            <p>
              Colors: <b>True Color (32 bit)</b>
            </p>
            <p>
              Screen area: <b>Fits your browser window</b>
            </p>
          </GroupBox>
        )}

        <BtnRow style={{ marginTop: "auto" }}>
          <Button
            style={{ width: "80px" }}
            onClick={() => closeWindow(windowId)}
          >
            OK
          </Button>
          <Button
            style={{ width: "80px" }}
            onClick={() => closeWindow(windowId)}
          >
            Cancel
          </Button>
        </BtnRow>
      </Body>
    </Layout>
  );
}
