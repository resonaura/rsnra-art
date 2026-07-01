import { openApp } from "../../data/apps";
import { ContextMenu, CtxDivider, CtxItem } from "../ContextMenu";

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onNewFolder?: () => void;
  onNewTextFile?: () => void;
}

export function DesktopContextMenu({
  x,
  y,
  onClose,
  onNewFolder,
  onNewTextFile,
}: Props) {
  const act = (fn: (() => void) | undefined) => () => {
    fn?.();
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      {onNewFolder && <CtxItem onClick={act(onNewFolder)}>New Folder</CtxItem>}
      {onNewTextFile && (
        <CtxItem onClick={act(onNewTextFile)}>New Text Document</CtxItem>
      )}
      {(onNewFolder || onNewTextFile) && <CtxDivider />}
      <CtxItem $disabled>Arrange Icons</CtxItem>
      <CtxItem $disabled>Line up Icons</CtxItem>
      <CtxDivider />
      <CtxItem onClick={act(() => openApp("my-computer"))}>
        Open My Computer
      </CtxItem>
      <CtxItem onClick={act(() => openApp("recycle-bin"))}>
        Open Recycle Bin
      </CtxItem>
      <CtxDivider />
      <CtxItem onClick={act(() => openApp("control-panel"))}>
        Properties
      </CtxItem>
    </ContextMenu>
  );
}
