import { openApp } from "../../data/apps";
import { ContextMenu, CtxDivider, CtxItem, CtxSubmenu } from "../ContextMenu";
import { useDesktopStore } from "../../store/desktopStore";

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

  const { autoArrange, sortBy, setAutoArrange, setSortBy, lineUpIcons } = useDesktopStore();

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <CtxSubmenu label="Arrange Icons">
        <CtxItem onClick={act(() => setSortBy("name"))}>
          {sortBy === "name" && "✓ "}by Name
        </CtxItem>
        <CtxItem onClick={act(() => setSortBy("type"))}>
          {sortBy === "type" && "✓ "}by Type
        </CtxItem>
        <CtxItem onClick={act(() => setSortBy("size"))}>
          {sortBy === "size" && "✓ "}by Size
        </CtxItem>
        <CtxItem onClick={act(() => setSortBy("date"))}>
          {sortBy === "date" && "✓ "}by Date
        </CtxItem>
        <CtxDivider />
        <CtxItem onClick={act(() => setAutoArrange(!autoArrange))}>
          {autoArrange && "✓ "}Auto Arrange
        </CtxItem>
      </CtxSubmenu>
      <CtxItem onClick={act(() => lineUpIcons())}>Line up Icons</CtxItem>
      <CtxDivider />
      <CtxSubmenu label="New">
        {onNewFolder && <CtxItem onClick={act(onNewFolder)}>Folder</CtxItem>}
        {onNewTextFile && (
          <CtxItem onClick={act(onNewTextFile)}>Text Document</CtxItem>
        )}
      </CtxSubmenu>
      <CtxDivider />
      <CtxItem onClick={act(() => openApp("my-computer"))}>
        Open My Computer
      </CtxItem>
      <CtxItem onClick={act(() => openApp("recycle-bin"))}>
        Open Recycle Bin
      </CtxItem>
      <CtxDivider />
      {/* Desktop properties opens Display Properties (desk.cpl) */}
      <CtxItem onClick={act(() => openApp("display-properties"))}>
        Properties
      </CtxItem>
    </ContextMenu>
  );
}
