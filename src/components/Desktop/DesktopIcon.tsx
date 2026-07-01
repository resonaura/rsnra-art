import styled from "styled-components";

const IconButton = styled.button<{ $selected: boolean }>`
  position: relative;
  width: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 2px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  border: 1px dotted ${({ $selected }) => ($selected ? "white" : "transparent")};
  cursor: default;
  font-family: inherit;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
`;

const Label = styled.span<{ $selected: boolean }>`
  font-size: 12px;
  color: white;
  text-shadow: 1px 1px black;
  text-align: center;
  line-height: 1.2;
  padding: 1px 3px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
`;

const RenameInput = styled.input`
  width: 76px;
  font-size: 11px;
  text-align: center;
  padding: 1px 2px;
  color: ${({ theme }) => theme.materialText};
  background: ${({ theme }) => theme.material};
  border: 1px solid ${({ theme }) => theme.borderDarkest};
`;

const ShortcutArrow = styled.svg`
  position: absolute;
  left: -2px;
  bottom: -2px;
  pointer-events: none;
`;

interface DesktopIconProps {
  label: string;
  icon: string;
  selected: boolean;
  shortcut?: boolean;
  renaming?: boolean;
  renameVal?: string;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onRenameChange?: (v: string) => void;
  onRenameCommit?: () => void;
  onRenameCancel?: () => void;
}

export function DesktopIcon({
  label,
  icon,
  selected,
  shortcut,
  renaming,
  renameVal,
  onSelect,
  onOpen,
  onContextMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: DesktopIconProps) {
  return (
    <IconButton
      type="button"
      $selected={selected}
      onClick={onSelect}
      onDoubleClick={() => {
        if (renaming) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (renaming) return;
        if (e.key === "Enter") onOpen();
      }}
      onContextMenu={onContextMenu}
    >
      <div style={{ position: "relative" }}>
        <img src={icon} alt="" draggable={false} />
        {shortcut && (
          <ShortcutArrow
            width="12"
            height="12"
            viewBox="0 0 12 12"
            shapeRendering="crispEdges"
            aria-hidden
          >
            <path
              d="M2 10 L2 6 L4 6 L4 4 L8 4 L8 8 L6 8 L6 10 Z"
              fill="#fff"
              stroke="#000"
              strokeWidth="1"
            />
          </ShortcutArrow>
        )}
      </div>
      {renaming ? (
        <RenameInput
          autoFocus
          value={renameVal ?? ""}
          onChange={(e) => onRenameChange?.(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onBlur={onRenameCommit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") onRenameCommit?.();
            if (e.key === "Escape") onRenameCancel?.();
          }}
        />
      ) : (
        <Label $selected={selected}>{label}</Label>
      )}
    </IconButton>
  );
}
