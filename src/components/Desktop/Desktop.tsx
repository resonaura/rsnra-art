import { useState } from 'react';
import styled from 'styled-components';
import { useDesktopStore, WALLPAPERS } from '../../store/desktopStore';
import { openApp } from '../../data/apps';
import { LINKS } from '../../data/content';
import { DesktopIcon } from './DesktopIcon';
import { DesktopContextMenu } from './DesktopContextMenu';

const Wrapper = styled.div<{ $bg: string }>`
  position: absolute;
  inset: 0;
  background: ${({ $bg }) => $bg};
  background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 4px 4px;
  overflow: hidden;
`;

const IconColumn = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

interface IconEntry {
  id: string;
  label: string;
  icon: string;
  shortcut?: boolean;
  onOpen: () => void;
}

const openExternal = (url: string) => () => window.open(url, '_blank', 'noopener,noreferrer');

const ICONS: IconEntry[] = [
  {
    id: 'my-computer',
    label: 'My Computer',
    icon: '/icons/computer.png',
    onOpen: () => openApp('my-computer'),
  },
  {
    id: 'music',
    label: 'RSNRA Music',
    icon: '/icons/music-cd.png',
    shortcut: true,
    onOpen: openExternal(LINKS.music),
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '/icons/globe.png',
    shortcut: true,
    onOpen: openExternal(LINKS.tiktok),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '/icons/globe-map.png',
    shortcut: true,
    onOpen: openExternal(LINKS.instagram),
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: '/icons/contact-card.png',
    onOpen: () => openApp('contact'),
  },
  {
    id: 'games',
    label: 'Games',
    icon: '/icons/joystick.png',
    onOpen: () => openApp('games-folder'),
  },
  {
    id: 'recycle-bin',
    label: 'Recycle Bin',
    icon: '/icons/recycle-bin-empty.png',
    onOpen: () => openApp('recycle-bin'),
  },
];

export function Desktop() {
  const wallpaperId = useDesktopStore((s) => s.wallpaperId);
  const background =
    WALLPAPERS.find((w) => w.id === wallpaperId)?.background ?? WALLPAPERS[0].background;

  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <Wrapper
      $bg={background}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
        setMenu(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <IconColumn>
        {ICONS.map((icon) => (
          <DesktopIcon
            key={icon.id}
            label={icon.label}
            icon={icon.icon}
            shortcut={icon.shortcut}
            selected={selected === icon.id}
            onSelect={() => setSelected(icon.id)}
            onOpen={icon.onOpen}
          />
        ))}
      </IconColumn>
      {menu && <DesktopContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </Wrapper>
  );
}
