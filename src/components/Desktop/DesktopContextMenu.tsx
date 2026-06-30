import type { MouseEvent } from 'react';
import { MenuList, MenuListItem, Separator } from 'react95';
import styled from 'styled-components';
import { openApp } from '../../data/apps';
import { useWindowStore } from '../../store/windowStore';

const Positioned = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  top: ${({ $y }) => $y}px;
  left: ${({ $x }) => $x}px;
  z-index: 999999;
`;

interface DesktopContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function DesktopContextMenu({ x, y, onClose }: DesktopContextMenuProps) {
  const setCloseProgramOpen = useWindowStore((s) => s.setCloseProgramOpen);

  const action = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <Positioned $x={x} $y={y}>
      <MenuList onClick={(e: MouseEvent) => e.stopPropagation()}>
        <MenuListItem disabled>Arrange Icons</MenuListItem>
        <MenuListItem disabled>Line up Icons</MenuListItem>
        <Separator />
        <MenuListItem onClick={action(() => window.location.reload())}>Refresh</MenuListItem>
        <Separator />
        <MenuListItem onClick={action(() => openApp('control-panel'))}>
          Properties
        </MenuListItem>
        <Separator />
        <MenuListItem onClick={action(() => setCloseProgramOpen(true))}>
          Close Program...
        </MenuListItem>
      </MenuList>
    </Positioned>
  );
}
