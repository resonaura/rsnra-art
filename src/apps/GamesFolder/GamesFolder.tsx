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

interface GameItem {
  label: string;
  icon: string;
  onOpen?: () => void;
  disabled?: boolean;
}

const GAMES: GameItem[] = [
  {
    label: "Minesweeper",
    icon: "/icons/minesweeper.png",
    onOpen: () => openApp("minesweeper"),
  },
  {
    label: "RSNRA Snake",
    icon: "/icons/joystick.png",
    onOpen: () => openApp("snake"),
  },
  { label: "Solitaire", icon: "/icons/solitaire.png", disabled: true },
  { label: "Hearts", icon: "/icons/hearts.png", disabled: true },
  { label: "FreeCell", icon: "/icons/freecell.png", disabled: true },
  { label: "Spider", icon: "/icons/spider.png", disabled: true },
];

export function GamesFolder({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);

  const menus = [
    {
      label: "File",
      items: [
        { label: "New Shortcut...", disabled: true },
        { label: "", divider: true },
        { label: "Close", action: () => closeWindow(windowId) },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Large Icons", disabled: true },
        { label: "Small Icons", disabled: true },
        { label: "List", disabled: true },
        { label: "Details", disabled: true },
        { label: "", divider: true },
        { label: "Arrange Icons", disabled: true },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About Games", disabled: true }],
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
        {GAMES.map((game) => (
          <IconItem
            key={game.label}
            tabIndex={0}
            $disabled={game.disabled}
            onDoubleClick={game.disabled ? undefined : game.onOpen}
            title={game.disabled ? "Coming soon" : undefined}
          >
            <img src={game.icon} alt="" draggable={false} />
            {game.label}
            {game.disabled && <span style={{ fontSize: 10 }}>(soon)</span>}
          </IconItem>
        ))}
      </IconGrid>
      <StatusBar>{GAMES.length} object(s)</StatusBar>
    </Layout>
  );
}
