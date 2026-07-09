import { useCallback, useEffect, useRef, useState } from "react";
import { Button, NumberInput, TextInput } from "react95";
import styled from "styled-components";
import { SystemDialog } from "../SystemDialog/SystemDialog";

// ─── color math ───────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** h: 0-360, s/l: 0-100 → [r,g,b] 0-255 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hN = h / 360;
  const sN = s / 100;
  const lN = l / 100;
  if (sN === 0) {
    const v = lN * 255;
    return [v, v, v];
  }
  const q = lN < 0.5 ? lN * (1 + sN) : lN + sN - lN * sN;
  const p = 2 * lN - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [
    hue2rgb(hN + 1 / 3) * 255,
    hue2rgb(hN) * 255,
    hue2rgb(hN - 1 / 3) * 255,
  ];
}

/** [r,g,b] 0-255 → h: 0-360, s/l: 0-100 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      default:
        h = (rN - gN) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  return rgbToHex(...hslToRgb(h, s, l));
}

// Windows 95's "Basic colors" grid is 48 swatches — 5 rows of 8 hues at
// decreasing lightness, plus a bottom grayscale row. Generated rather than
// hand-copied so the math stays checkable.
const BASIC_COLORS: string[] = [
  ...[95, 75, 55, 35, 20].flatMap((l) =>
    [0, 45, 90, 135, 180, 225, 270, 315].map((h) => hslToHex(h, 70, l)),
  ),
  ...Array.from({ length: 8 }, (_, i) => hslToHex(0, 0, Math.round((i / 7) * 100))),
];

const CUSTOM_SLOT_COUNT = 16;
// Persists for the lifetime of the tab (like Windows keeps "recently defined"
// custom colors around for the session) without needing full localStorage
// persistence — a cosmetic nicety, not load-bearing state.
let sharedCustomColors: (string | null)[] = Array(CUSTOM_SLOT_COUNT).fill(null);
let sharedCustomCursor = 0;

// ─── styled shells ────────────────────────────────────────────────────────────

const Layout = styled.div`
  display: flex;
  gap: 14px;
  padding: 12px 14px 10px;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SwatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 20px);
  gap: 2px;
`;

const Swatch = styled.button<{ $color: string | null; $active?: boolean }>`
  width: 20px;
  height: 20px;
  padding: 0;
  cursor: pointer;
  background: ${({ $color, theme }) => $color ?? theme.canvas};
  border: 1px solid
    ${({ $active }) => ($active ? "#fff" : "rgba(0,0,0,0.4)")};
  outline: ${({ $active }) => ($active ? "1px solid #000" : "none")};
  ${({ $color, theme }) =>
    $color === null &&
    `background-image: linear-gradient(45deg, ${theme.borderDark} 25%, transparent 25%, transparent 75%, ${theme.borderDark} 75%), linear-gradient(45deg, ${theme.borderDark} 25%, transparent 25%, transparent 75%, ${theme.borderDark} 75%);
     background-size: 8px 8px;
     background-position: 0 0, 4px 4px;`}
`;

const PreviewSwatch = styled.div<{ $color: string }>`
  width: 60px;
  height: 46px;
  background: ${({ $color }) => $color};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const SunkenBorder = `
  border: 2px solid;
`;

const HueSatSquare = styled.div`
  position: relative;
  width: 160px;
  height: 160px;
  ${SunkenBorder}
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  background:
    linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 100%),
    linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: crosshair;
  touch-action: none;
  flex-shrink: 0;
`;

const SquareMarker = styled.div`
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid #000;
  box-shadow: 0 0 0 1px #fff;
  transform: translate(-50%, -50%);
  pointer-events: none;
`;

const LumBar = styled.div<{ $h: number; $s: number }>`
  position: relative;
  width: 22px;
  height: 160px;
  ${SunkenBorder}
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  background: linear-gradient(
    to top,
    #000 0%,
    ${({ $h, $s }) => hslToHex($h, $s, 50)} 50%,
    #fff 100%
  );
  cursor: pointer;
  touch-action: none;
  flex-shrink: 0;
`;

const LumMarker = styled.div`
  position: absolute;
  left: -8px;
  right: -3px;
  height: 0;
  transform: translateY(-50%);
  pointer-events: none;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid #000;
`;

const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 4px 8px;
  align-items: center;
  font-size: 12px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 0 14px 12px;
`;

export interface ColorPickerDialogProps {
  title?: string;
  color: string;
  onPick: (color: string) => void;
  onClose: () => void;
}

/**
 * Windows 95 "Color" picker: Basic colors + Custom colors grids, plus a
 * "Define Custom Colors" panel with the genuine hue/saturation square and
 * narrow luminosity bar (not a native `<input type="color">` stand-in) —
 * same layout as the real dialog: Hue horizontal, Saturation vertical on the
 * square at a fixed lightness, and the bar to its right sweeps that hue/sat
 * from black through the pure color to white.
 */
export function ColorPickerDialog({
  title = "Color",
  color,
  onPick,
  onClose,
}: ColorPickerDialogProps) {
  const [picked, setPicked] = useState(color);
  const [defineOpen, setDefineOpen] = useState(false);
  const [hsl, setHsl] = useState<[number, number, number]>(() => rgbToHsl(...hexToRgb(color)));
  const [hexInput, setHexInput] = useState(color);
  const [customColors, setCustomColors] = useState(sharedCustomColors);

  const [h, s, l] = hsl;
  const defineColor = hslToHex(h, s, l);

  const squareRef = useRef<HTMLDivElement>(null);
  const lumRef = useRef<HTMLDivElement>(null);
  const draggingSquare = useRef(false);
  const draggingLum = useRef(false);

  const applyHsl = (nh: number, ns: number, nl: number) => {
    const next: [number, number, number] = [nh, ns, nl];
    setHsl(next);
    const hex = hslToHex(nh, ns, nl);
    setHexInput(hex);
    setPicked(hex);
  };

  const applyRgb = (r: number, g: number, b: number) => {
    setHsl(rgbToHsl(r, g, b));
    const hex = rgbToHex(r, g, b);
    setHexInput(hex);
    setPicked(hex);
  };

  const updateFromSquarePoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = squareRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      applyHsl(x * 360, (1 - y) * 100, l);
    },
    [l],
  );

  const updateFromLumPoint = useCallback(
    (clientY: number) => {
      const el = lumRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      applyHsl(h, s, (1 - y) * 100);
    },
    [h, s],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (draggingSquare.current) updateFromSquarePoint(e.clientX, e.clientY);
      else if (draggingLum.current) updateFromLumPoint(e.clientY);
    };
    const up = () => {
      draggingSquare.current = false;
      draggingLum.current = false;
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
  }, [updateFromSquarePoint, updateFromLumPoint]);

  const [r, g, b] = hexToRgb(defineColor);

  const addToCustomColors = () => {
    const next = [...customColors];
    next[sharedCustomCursor] = defineColor;
    sharedCustomCursor = (sharedCustomCursor + 1) % CUSTOM_SLOT_COUNT;
    sharedCustomColors = next;
    setCustomColors(next);
  };

  return (
    <SystemDialog title={title} width={defineOpen ? 580 : 260} onClose={onClose}>
      <Layout>
        <Column>
          <span>Basic colors:</span>
          <SwatchGrid>
            {BASIC_COLORS.map((c, i) => (
              <Swatch
                key={i}
                $color={c}
                $active={picked.toLowerCase() === c.toLowerCase()}
                onClick={() => setPicked(c)}
              />
            ))}
          </SwatchGrid>

          <span>Custom colors:</span>
          <SwatchGrid>
            {customColors.map((c, i) => (
              <Swatch
                key={i}
                $color={c}
                $active={!!c && picked.toLowerCase() === c.toLowerCase()}
                onClick={() => c && setPicked(c)}
              />
            ))}
          </SwatchGrid>

          <div style={{ display: "flex", gap: 6 }}>
            <PreviewSwatch $color={picked} />
            <Button
              style={{ flex: 1 }}
              onClick={() => {
                setHsl(rgbToHsl(...hexToRgb(picked)));
                setHexInput(picked);
                setDefineOpen((o) => !o);
              }}
            >
              Define Custom Colors {defineOpen ? "<<" : ">>"}
            </Button>
          </div>
        </Column>

        {defineOpen && (
          <Column style={{ flex: 1 }}>
            <span>Define Custom Color:</span>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <HueSatSquare
                ref={squareRef}
                onPointerDown={(e) => {
                  draggingSquare.current = true;
                  updateFromSquarePoint(e.clientX, e.clientY);
                }}
              >
                <SquareMarker
                  style={{ left: `${(h / 360) * 100}%`, top: `${(1 - s / 100) * 100}%` }}
                />
              </HueSatSquare>
              <LumBar
                ref={lumRef}
                $h={h}
                $s={s}
                onPointerDown={(e) => {
                  draggingLum.current = true;
                  updateFromLumPoint(e.clientY);
                }}
              >
                <LumMarker style={{ top: `${(1 - l / 100) * 100}%` }} />
              </LumBar>
              <Column style={{ gap: 8, width: 130, flexShrink: 0 }}>
                <PreviewSwatch $color={defineColor} />
                <Button onClick={addToCustomColors}>Add to Custom Colors</Button>
              </Column>
            </div>

            <FieldsGrid>
              <span>Hue:</span>
              <NumberInput
                value={Math.round(h)}
                min={0}
                max={360}
                width={74}
                onChange={(v: number) => applyHsl(v, s, l)}
              />
              <span>Red:</span>
              <NumberInput
                value={r}
                min={0}
                max={255}
                width={74}
                onChange={(v: number) => applyRgb(v, g, b)}
              />

              <span>Sat:</span>
              <NumberInput
                value={Math.round(s)}
                min={0}
                max={100}
                width={74}
                onChange={(v: number) => applyHsl(h, v, l)}
              />
              <span>Green:</span>
              <NumberInput
                value={g}
                min={0}
                max={255}
                width={74}
                onChange={(v: number) => applyRgb(r, v, b)}
              />

              <span>Lum:</span>
              <NumberInput
                value={Math.round(l)}
                min={0}
                max={100}
                width={74}
                onChange={(v: number) => applyHsl(h, s, v)}
              />
              <span>Blue:</span>
              <NumberInput
                value={b}
                min={0}
                max={255}
                width={74}
                onChange={(v: number) => applyRgb(r, g, v)}
              />

              <span>Hex:</span>
              <TextInput
                value={hexInput}
                style={{ gridColumn: "span 3" }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  setHexInput(v);
                  if (isValidHex(v)) {
                    setHsl(rgbToHsl(...hexToRgb(v)));
                    setPicked(v);
                  }
                }}
              />
            </FieldsGrid>
          </Column>
        )}
      </Layout>

      <Footer>
        <Button primary style={{ width: 72 }} onClick={() => onPick(picked)}>
          OK
        </Button>
        <Button style={{ width: 72 }} onClick={onClose}>
          Cancel
        </Button>
      </Footer>
    </SystemDialog>
  );
}
