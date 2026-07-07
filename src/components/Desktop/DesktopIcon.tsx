import styled from "styled-components";
import { useDisplayStore } from "../../store/displayStore";
import { Icon } from "../Icon/Icon";

const IconButton = styled.button<{ $selected: boolean; $iconSize: number }>`
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
    width: ${({ $iconSize }) => $iconSize}px;
    height: ${({ $iconSize }) => $iconSize}px;
    image-rendering: pixelated;
  }
`;

const Label = styled.span<{ $selected: boolean; $underline?: "always" | "hover" | "none" }>`
  font-size: 12px;
  color: white;
  text-shadow: 1px 1px black;
  text-align: center;
  line-height: 1.2;
  padding: 1px 3px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  text-decoration: ${({ $underline }) => ($underline === "always" ? "underline" : "none")};

  ${IconButton}:hover & {
    text-decoration: ${({ $underline }) =>
      $underline === "hover" || $underline === "always" ? "underline" : "none"};
  }
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

const ShortcutOverlay = styled(Icon)`
  position: absolute;
  inset: 0;
  image-rendering: pixelated;
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
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  /** Folder Options ▸ General ▸ "Click items as follows". */
  singleClickOpen?: boolean;
  /** Folder Options ▸ General ▸ underline sub-choice (only meaningful when singleClickOpen). */
  underline?: "always" | "hover" | "none";
  /** Folder Options ▸ View ▸ "Show pop-up description for folder and desktop items". */
  tooltip?: string;
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
  draggable,
  onDragStart,
  onDragEnd,
  singleClickOpen,
  underline = "none",
  tooltip,
}: DesktopIconProps) {
  // Display Properties ▸ Effects ▸ "Use large icons".
  const largeIcons = useDisplayStore((s) => s.largeIcons);
  const iconSize = largeIcons ? 48 : 32;
  return (
    <IconButton
      type="button"
      $selected={selected}
      $iconSize={iconSize}
      title={tooltip}
      onClick={() => {
        onSelect();
        if (singleClickOpen && !renaming) onOpen();
      }}
      onDoubleClick={() => {
        if (renaming || singleClickOpen) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (renaming) return;
        if (e.key === "Enter") onOpen();
      }}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ position: "relative" }}>
        <Icon src={icon} size={iconSize} />
        {shortcut && (
          <ShortcutOverlay
            src="/icons/w2k_shortcut_overlay.ico"
            alt=""
            draggable={false}
            aria-hidden
          />
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
        <Label $selected={selected} $underline={singleClickOpen ? underline : "none"}>
          {label}
        </Label>
      )}
    </IconButton>
  );
}
