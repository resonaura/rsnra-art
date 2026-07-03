import { useState } from "react";
import { Button, Select, TextInput } from "react95";
import styled from "styled-components";
import { ScrollArea } from "../../components/ScrollArea";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  gap: 8px;
  font-size: 12px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const GridFrame = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(16, 1fr);
`;

const Cell = styled.button<{ $selected: boolean }>`
  aspect-ratio: 1;
  min-width: 26px;
  border: 1px solid ${({ theme }) => theme.borderDark};
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "white"};
  color: ${({ $selected, theme }) => ($selected ? theme.headerText : "#000")};
  cursor: pointer;
  font-size: 16px;
  line-height: 1;

  &:hover {
    outline: 1px solid ${({ theme }) => theme.headerBackground};
    outline-offset: -1px;
  }
`;

const PreviewBox = styled.div`
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
`;

const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FONTS = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Comic Sans MS",
];

// Printable Latin-1 range, skipping the C0/C1 control blocks — the same
// span the real Win98 Character Map shows for a Western font.
const CODES = [
  ...Array.from({ length: 126 - 32 + 1 }, (_, i) => 32 + i),
  ...Array.from({ length: 255 - 160 + 1 }, (_, i) => 160 + i),
];

export function CharMap() {
  const [font, setFont] = useState(FONTS[0]);
  const [selected, setSelected] = useState<number>(65);
  const [toCopy, setToCopy] = useState("");

  const fontOptions = FONTS.map((f) => ({ value: f, label: f }));
  const selectedChar = String.fromCharCode(selected);

  const addToCopy = () => setToCopy((s) => s + selectedChar);

  const copy = () => {
    if (!toCopy) return;
    void navigator.clipboard?.writeText(toCopy).catch(() => {});
  };

  return (
    <Layout>
      <TopRow>
        <span>Font:</span>
        <Select
          style={{ zoom: 0.8, flex: 1 }}
          value={font}
          options={fontOptions}
          width="100%"
          onChange={(opt) => setFont(opt.value as string)}
        />
      </TopRow>

      <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
        <GridFrame orientation="vertical">
          <Grid style={{ fontFamily: font }}>
            {CODES.map((code) => (
              <Cell
                key={code}
                type="button"
                $selected={selected === code}
                title={`U+${code.toString(16).toUpperCase().padStart(4, "0")}`}
                onClick={() => setSelected(code)}
                onDoubleClick={() => {
                  setSelected(code);
                  setToCopy((s) => s + String.fromCharCode(code));
                }}
              >
                {String.fromCharCode(code)}
              </Cell>
            ))}
          </Grid>
        </GridFrame>
        <PreviewBox style={{ fontFamily: font }}>{selectedChar}</PreviewBox>
      </div>

      <div style={{ fontSize: 11 }}>
        Character code: U+
        {selected.toString(16).toUpperCase().padStart(4, "0")}
      </div>

      <BottomRow>
        <span>Characters to copy:</span>
        <TextInput
          style={{ zoom: 0.8, flex: 1 }}
          value={toCopy}
          onChange={(e) => setToCopy(e.target.value)}
        />
      </BottomRow>
      <BottomRow style={{ justifyContent: "flex-end" }}>
        <Button style={{ zoom: 0.8, width: 96 }} onClick={addToCopy}>
          Select
        </Button>
        <Button style={{ zoom: 0.8, width: 96 }} disabled={!toCopy} onClick={copy}>
          Copy
        </Button>
      </BottomRow>
    </Layout>
  );
}
