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

const IconItem = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 88px;
  padding: 6px 2px;
  background: transparent;
  border: 1px dotted transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  color: ${({ theme }) => theme.canvasText};
  text-align: center;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }

  &:hover {
    border-color: #00000000;
  }
  &:focus {
    outline: none;
    background: ${({ theme }) => theme.hoverBackground};
    color: ${({ theme }) => theme.headerText};
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

interface Item {
  label: string;
  icon: string;
  onOpen: () => void;
}

const ITEMS: Item[] = [
  {
    label: 'Music (C:)',
    icon: '/icons/music-cd.png',
    onOpen: () => openApp('music'),
  },
  {
    label: 'bio.txt',
    icon: '/icons/notepad-file.png',
    onOpen: () => openApp('notepad', { title: 'bio.txt - Notepad', data: { docId: 'bio' } }),
  },
  {
    label: 'press-kit.txt',
    icon: '/icons/notepad-file.png',
    onOpen: () =>
      openApp('notepad', {
        title: 'press-kit.txt - Notepad',
        data: { docId: 'press' },
      }),
  },
  {
    label: 'Social Links',
    icon: '/icons/globe.png',
    onOpen: () => openApp('social'),
  },
  {
    label: 'Contact',
    icon: '/icons/contact-card.png',
    onOpen: () => openApp('contact'),
  },
  {
    label: 'Games',
    icon: '/icons/joystick.png',
    onOpen: () => openApp('games-folder'),
  },
  {
    label: 'Control Panel',
    icon: '/icons/control-panel.png',
    onOpen: () => openApp('control-panel'),
  },
  {
    label: 'Recycle Bin',
    icon: '/icons/recycle-bin-empty.png',
    onOpen: () => openApp('recycle-bin'),
  },
];

export function MyComputer() {
  return (
    <Layout>
      <IconGrid>
        {ITEMS.map((item) => (
          <IconItem key={item.label} tabIndex={0} onDoubleClick={item.onOpen}>
            <img src={item.icon} alt="" draggable={false} />
            {item.label}
          </IconItem>
        ))}
      </IconGrid>
      <StatusBar>{ITEMS.length} object(s)</StatusBar>
    </Layout>
  );
}
