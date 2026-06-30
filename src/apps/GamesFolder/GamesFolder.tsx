import styled from 'styled-components';
import { openApp } from '../../data/apps';

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const IconGrid = styled.div`
  flex: 1;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
  overflow: auto;
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
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
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

  &:focus {
    outline: none;
    background: ${({ theme, $disabled }) => ($disabled ? 'transparent' : theme.hoverBackground)};
    color: ${({ theme, $disabled }) => ($disabled ? theme.materialTextDisabled : theme.headerText)};
  }
`;

const StatusBar = styled.div`
  flex-shrink: 0;
  margin-top: 6px;
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid;
  border-color: ${({ theme }) => theme.borderDark} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDark};
`;

interface GameItem {
  label: string;
  icon: string;
  onOpen?: () => void;
  disabled?: boolean;
}

const GAMES: GameItem[] = [
  { label: 'Minesweeper', icon: '/icons/minesweeper.png', onOpen: () => openApp('minesweeper') },
  { label: 'RSNRA Snake', icon: '/icons/joystick.png', onOpen: () => openApp('snake') },
  { label: 'Solitaire', icon: '/icons/solitaire.png', disabled: true },
  { label: 'Hearts', icon: '/icons/hearts.png', disabled: true },
  { label: 'FreeCell', icon: '/icons/freecell.png', disabled: true },
  { label: 'Spider', icon: '/icons/spider.png', disabled: true },
];

export function GamesFolder() {
  return (
    <Layout>
      <IconGrid>
        {GAMES.map((game) => (
          <IconItem
            key={game.label}
            tabIndex={0}
            $disabled={game.disabled}
            onDoubleClick={game.disabled ? undefined : game.onOpen}
            title={game.disabled ? 'Coming soon' : undefined}
          >
            <img src={game.icon} alt="" draggable={false} />
            {game.label}
            {game.disabled && <span>(soon)</span>}
          </IconItem>
        ))}
      </IconGrid>
      <StatusBar>{GAMES.length} object(s)</StatusBar>
    </Layout>
  );
}
