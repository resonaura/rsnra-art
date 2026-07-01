import styled from 'styled-components';
import { GroupBox, Frame } from 'react95';
import { AppMenuBar } from '../../components/AppMenuBar';
import { useDesktopStore, WALLPAPERS } from '../../store/desktopStore';
import { useWindowStore } from '../../store/windowStore';
import { BAND_NAME, BAND_LOCATION } from '../../data/content';

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ScrollArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow: auto;
  padding: 12px;
`;

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
    ${({ $active, theme }) => ($active ? theme.borderLightest : theme.borderDarkest)}
    ${({ $active, theme }) => ($active ? theme.borderLightest : theme.borderDarkest)}
    ${({ $active, theme }) => ($active ? theme.borderDarkest : theme.borderLightest)};
  cursor: pointer;
  outline: ${({ $active }) => ($active ? '1px dotted black' : 'none')};
  outline-offset: -4px;
`;

export function ControlPanel({ windowId }: { windowId: string }) {
  const wallpaperId = useDesktopStore((s) => s.wallpaperId);
  const setWallpaper = useDesktopStore((s) => s.setWallpaper);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const current = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];

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
      <ScrollArea>
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
        <p style={{ fontSize: 12, margin: '0 0 4px' }}>
          <b>Computer:</b> RSNRA 95
        </p>
        <p style={{ fontSize: 12, margin: '0 0 4px' }}>
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
