import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { ScrollArea } from "../../components/ScrollArea";
import { openApp } from "../../data/apps";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const IconGrid = styled(ScrollArea)`
  flex: 1;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const IconItem = styled.button<{ $disabled?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 88px;
  padding: 6px 2px;
  background: transparent;
  border: 1px dotted transparent;
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  font-family: inherit;
  font-size: 11px;
  color: ${({ theme, $disabled }) =>
    $disabled ? theme.materialTextDisabled : theme.canvasText};
  text-align: center;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  }

  &:hover:not([disabled]) {
    background: ${({ theme }) => theme.hoverBackground};
    color: ${({ theme }) => theme.headerText};
    border-color: ${({ theme }) => theme.headerText};
  }

  &:focus {
    outline: none;
  }
`;

const StatusBar = styled.div`
  flex-shrink: 0;
  margin-top: 0;
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid;
  border-color: ${({ theme }) => theme.borderDark}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDark};
`;

interface AppletItem {
  label: string;
  icon: string;
  onOpen?: () => void;
}

const APPLETS: AppletItem[] = [
  { label: "Accessibility Options", icon: "/icons/w98_access_wheelchair_big.png" },
  { label: "Add New Hardware", icon: "/icons/w98_hardware.png" },
  { label: "Add/Remove Programs", icon: "/icons/w98_program_manager.png" },
  { label: "Automatic Updates", icon: "/icons/w98_windows_update_large.png" },
  { label: "Date/Time", icon: "/icons/w98_time_and_date.png", onOpen: () => openApp("datetime") },
  { label: "Dial-Up Networking", icon: "/icons/w98_conn_dialup.png" },
  {
    label: "Display",
    icon: "/icons/w98_display_properties.png",
    onOpen: () => openApp("display-properties"),
  },
  { label: "Folder Options", icon: "/icons/folder-open.png" },
  { label: "Fonts", icon: "/icons/w98_font_tt.png" },
  { label: "Gaming Options", icon: "/icons/joystick.png" },
  { label: "Internet Options", icon: "/icons/w98_internet_options.png" },
  { label: "Keyboard", icon: "/icons/w98_keyboard.png" },
  { label: "Modems", icon: "/icons/w98_conn_dialup_alt.png" },
  { label: "Mouse", icon: "/icons/w98_mouse.png", onOpen: () => openApp("mouse-properties") },
  { label: "Network", icon: "/icons/w98_network.png" },
  { label: "ODBC Data Sources (32bit)", icon: "/icons/w98_odbc.png" },
  { label: "Passwords", icon: "/icons/w98_users_key.png" },
  { label: "Power Options", icon: "/icons/w98_power_management.png" },
  { label: "Printers", icon: "/icons/w98_printer_big.png" },
  { label: "Regional Settings", icon: "/icons/globe.png" },
  { label: "Scanners and Cameras", icon: "/icons/w98_scanner_camera.png" },
  { label: "Scheduled Tasks", icon: "/icons/w2k_scheduled_tasks.png" },
  { label: "Sounds and Multimedia", icon: "/icons/w98_mixer_sound.png" },
  { label: "System", icon: "/icons/computer.png", onOpen: () => openApp("system-properties") },
  { label: "Telephony", icon: "/icons/w98_telephony.png" },
  { label: "Users", icon: "/icons/w98_users.png" },
];

export function ControlPanel({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);

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
      <IconGrid
        contentStyle={{
          padding: 10,
          display: "flex",
          flexWrap: "wrap",
          alignContent: "flex-start",
          gap: 4,
        }}
      >
        {APPLETS.map((applet) => (
          <IconItem
            key={applet.label}
            tabIndex={0}
            $disabled={!applet.onOpen}
            onDoubleClick={applet.onOpen}
            title={applet.onOpen ? undefined : "Not available in this build"}
          >
            <img src={applet.icon} alt="" draggable={false} />
            {applet.label}
          </IconItem>
        ))}
      </IconGrid>
      <StatusBar>{APPLETS.length} object(s)</StatusBar>
    </Layout>
  );
}
