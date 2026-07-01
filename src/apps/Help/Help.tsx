import { Frame, GroupBox } from "react95";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { ScrollArea } from "../../components/ScrollArea";
import { BAND_LOCATION, BAND_NAME } from "../../data/content";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

// ScrollArea imported from ../../components/ScrollArea

const InfoFrame = styled(Frame)`
  background: ${({ theme }) => theme.canvas};
  color: ${({ theme }) => theme.canvasText};
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
`;

export function Help({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);

  const menus = [
    {
      label: "File",
      items: [{ label: "Close", action: () => closeWindow(windowId) }],
    },
    {
      label: "Options",
      items: [
        { label: "Annotate...", disabled: true },
        { label: "", divider: true },
        { label: "Print Topic...", disabled: true },
        { label: "Font", disabled: true },
        { label: "", divider: true },
        { label: "Keep Help on Top", disabled: true },
        { label: "Use System Colors", disabled: true },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About Help", disabled: true }],
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
        <InfoFrame variant="field">
          <img
            src="/icons/computer.png"
            alt=""
            width={48}
            height={48}
            style={{ imageRendering: "pixelated" }}
          />
          <div>
            <h3 style={{ margin: "0 0 4px" }}>RSNRA 95</h3>
            <p style={{ margin: 0, fontSize: 12 }}>
              The official desktop of {BAND_NAME}, {BAND_LOCATION}.
            </p>
          </div>
        </InfoFrame>

        <GroupBox label="About this site">
          <p style={{ fontSize: 12, lineHeight: 1.5 }}>
            This site is a fully clickable homage to Windows 95 — open windows,
            drag them around, minimize, maximize, and explore the Start Menu.
            Built with React, TypeScript, and React95.
          </p>
        </GroupBox>

        <GroupBox label="Tips">
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <li>Double-click desktop icons to open them.</li>
            <li>Drag windows by their title bar, resize from the edges.</li>
            <li>Open RSNRA Terminal and type "help" for hidden commands.</li>
            <li>Try Ctrl+Alt+Delete for a blast from the past.</li>
            <li>Right-click the desktop for display options.</li>
            <li>In My Computer, right-click files to rename or delete.</li>
          </ul>
        </GroupBox>
      </ScrollArea>
    </Layout>
  );
}
