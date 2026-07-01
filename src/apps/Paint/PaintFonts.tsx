import { SelectNative, TextInput } from "react95";
import styled, { css } from "styled-components";
import { useWindowData } from "../../store/windowStore";
import { usePaintFontStore } from "./fontStore";

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;
const sunken = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const Body = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
`;

const Toggle = styled.button<{ $active: boolean; $icon: number }>`
  width: 24px;
  height: 22px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.material};
  ${({ $active }) => ($active ? sunken : raised)}
  span.i {
    display: block;
    width: 16px;
    height: 15px;
    background-image: url(/paint-tools/text-tools.png);
    background-repeat: no-repeat;
    background-position: ${({ $icon }) => `-${$icon * 16}px 0`};
    image-rendering: pixelated;
    filter: ${({ $active }) => ($active ? "invert(1)" : "none")};
  }
`;

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Georgia",
  "Trebuchet MS",
  "Comic Sans MS",
  "Impact",
  "Tahoma",
  "Lucida Console",
];

/**
 * The Fonts tool-window (jspaint $FontBox), here a real OS window so it can be
 * dragged outside the Paint window. It shares font settings with its Paint
 * instance via the paint font store, keyed by `data.paintWindowId`. Uses
 * SelectNative (a styled native <select>) so no unknown props leak to the DOM.
 */
export function PaintFonts({ windowId }: { windowId: string }) {
  const data = useWindowData(windowId);
  const paintWindowId = (data.paintWindowId as string) ?? "";
  const font = usePaintFontStore((s) => s.fonts[paintWindowId]);
  const setFont = usePaintFontStore((s) => s.setFont);

  return (
    <Body>
      <SelectNative
        width={150}
        value={font?.family ?? "Arial"}
        options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))}
        onChange={(opt) => setFont(paintWindowId, { family: opt.value })}
        aria-label="Font Family"
        style={{ zoom: 0.65 }}
      />
      <TextInput
        type="number"
        min={8}
        max={72}
        width={48}
        value={font?.size ?? 12}
        onChange={(e) =>
          setFont(paintWindowId, {
            size: Math.max(8, Math.min(72, Number(e.target.value) || 12)),
          })
        }
        aria-label="Font Size"
        style={{ zoom: 0.65 }}
      />
      <Toggle
        $active={!!font?.bold}
        $icon={0}
        onClick={() => setFont(paintWindowId, { bold: !font?.bold })}
        title="Bold"
      >
        <span className="i" />
      </Toggle>
      <Toggle
        $active={!!font?.italic}
        $icon={1}
        onClick={() => setFont(paintWindowId, { italic: !font?.italic })}
        title="Italic"
      >
        <span className="i" />
      </Toggle>
      <Toggle
        $active={!!font?.underline}
        $icon={2}
        onClick={() => setFont(paintWindowId, { underline: !font?.underline })}
        title="Underline"
      >
        <span className="i" />
      </Toggle>
    </Body>
  );
}
