import { ContextMenu, CtxItem, CtxDivider } from '../ContextMenu';
import { openApp } from '../../data/apps';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
}

export function DesktopContextMenu({ x, y, onClose }: Props) {
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <CtxItem $disabled>Arrange Icons</CtxItem>
      <CtxItem $disabled>Line up Icons</CtxItem>
      <CtxDivider />
      <CtxItem onClick={act(() => openApp('my-computer'))}>Open My Computer</CtxItem>
      <CtxItem onClick={act(() => openApp('recycle-bin'))}>Open Recycle Bin</CtxItem>
      <CtxDivider />
      <CtxItem onClick={act(() => openApp('control-panel'))}>Properties</CtxItem>
    </ContextMenu>
  );
}
