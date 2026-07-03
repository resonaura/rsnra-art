import { useState } from "react";
import { Button, Window, WindowContent, WindowHeader } from "react95";
import styled from "styled-components";
import { R95_SCALE, R95_SCALE_COMPENSATION } from "../../react95.conf";
import { Icon } from "../Icon/Icon";
import { ScrollArea } from "../ScrollArea";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 500000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
`;

const Dialog = styled(Window)`
  width: 500px;
`;

const Prompt = styled.p`
  margin: 0 0 10px;
`;

const Grid = styled(ScrollArea)`
  height: 300px;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const IconItem = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${44 * R95_SCALE_COMPENSATION}px;
  height: ${44 * R95_SCALE_COMPENSATION}px;
  padding: 4px;
  border: 1px dotted transparent;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  cursor: pointer;

  img {
    width: ${32 * R95_SCALE_COMPENSATION}px;
    height: ${32 * R95_SCALE_COMPENSATION}px;
    image-rendering: pixelated;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
`;

export interface IconPickerDialogProps {
  title: string;
  icons: string[];
  current?: string;
  onPick: (icon: string) => void;
  onClose: () => void;
  isInReact95?: boolean;
}

/** Curated icon grid for Folder Options ▸ File Types ▸ Change Icon. */
export function IconPickerDialog({
  title,
  icons,
  current,
  onPick,
  onClose,
  isInReact95 = false,
}: IconPickerDialogProps) {
  const [selected, setSelected] = useState<string | null>(current ?? null);

  const confirm = () => {
    if (!selected) return;
    onPick(selected);
    onClose();
  };

  return (
    <Overlay
      style={{ zoom: isInReact95 ? R95_SCALE_COMPENSATION : 1 }}
      onMouseDown={onClose}
    >
      <Dialog
        style={{ zoom: R95_SCALE }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <WindowHeader>
          <span>Change Icon</span>
        </WindowHeader>
        <WindowContent>
          <Prompt>{title}</Prompt>
          <Grid
            isInReact95
            orientation="vertical"
            contentStyle={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              padding: 6,
            }}
          >
            {icons.map((src) => (
              <IconItem
                key={src}
                $selected={selected === src}
                onClick={() => setSelected(src)}
                onDoubleClick={confirm}
                title={src}
              >
                <Icon src={src} size={32} isInReact95 />
              </IconItem>
            ))}
          </Grid>
          <Footer>
            <Button
              primary
              disabled={!selected}
              onClick={confirm}
              style={{ width: 75 }}
            >
              OK
            </Button>
            <Button onClick={onClose} style={{ width: 75 }}>
              Cancel
            </Button>
          </Footer>
        </WindowContent>
      </Dialog>
    </Overlay>
  );
}
