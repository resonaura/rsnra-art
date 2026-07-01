import { Frame, GroupBox } from "react95";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { ScrollArea } from "../../components/ScrollArea";
import { BAND_LOCATION, BAND_NAME } from "../../data/content";
import { useDesktopStore, WALLPAPERS } from "../../store/desktopStore";
import { THEMES, useThemeStore } from "../../store/themeStore";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

// ScrollArea imported from ../../components/ScrollArea

const Preview = styled(Frame)<{ $bg: string }>`
  width: 100%;
  height: 90px;
  background: ${({ $bg }) => $bg};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
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

export function ControlPanel({ windowId }: { windowId: string }) {
  const wallpaperId = useDesktopStore((s) => s.wallpaperId);
  const setWallpaper = useDesktopStore((s) => s.setWallpaper);
  const themeId = useThemeStore((s) => s.themeId);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const current = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];
  const currentScheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  const menus = [
    {
      label: "File",
      items: [{ label: "Close", action: () => closeWindow(windowId) }],
    },
    {
      label: "View",
      items: [
        { label: "Large Icons", disabled: true },
        { label: "Small Icons", disabled: true },
        { label: "List", disabled: true },
        { label: "Details", disabled: true },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Help Topics", disabled: true },
        { label: "", divider: true },
        { label: "About Control Panel", disabled: true },
      ],
    },
  ];

  return (
    <Layout>
      <AppMenuBar menus={menus} />
      <ScrollArea
        style={{ flex: 1 }}
        contentStyle={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 12,
        }}
      >
        <GroupBox label="Display Properties — Appearance">
          <p style={{ fontSize: 12, margin: "0 0 8px" }}>
            Scheme: <b>{currentScheme.label}</b>
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

        <GroupBox label="Display Properties — Background">
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

        <GroupBox label="System">
          <p style={{ fontSize: 12, margin: "0 0 4px" }}>
            <b>Computer:</b> RSNRA 95
          </p>
          <p style={{ fontSize: 12, margin: "0 0 4px" }}>
            <b>Registered to:</b> {BAND_NAME}
          </p>
          <p style={{ fontSize: 12, margin: 0 }}>
            <b>Location:</b> {BAND_LOCATION}
          </p>
        </GroupBox>
      </ScrollArea>
    </Layout>
  );
}
