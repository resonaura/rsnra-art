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

// Classic Win95 shortcut arrow: a small diagonal arrow pinned to the bottom-left
// of the icon, drawn as crisp SVG (white fill, black outline) — no border box.
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
  onSelect: () => void;
  onOpen: () => void;
}

export function DesktopIcon({
  label,
  icon,
  selected,
  shortcut,
  onSelect,
  onOpen,
}: DesktopIconProps) {
  return (
    <IconButton
      type="button"
      $selected={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
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
      <Label $selected={selected}>{label}</Label>
    </IconButton>
  );
}
