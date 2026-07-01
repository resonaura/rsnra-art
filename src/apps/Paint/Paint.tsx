import { useCallback, useEffect, useRef, useState } from "react";
import { Button, TextInput } from "react95";
import styled, { css } from "styled-components";
import { openApp } from "../../data/apps";
import { useVfsStore } from "../../store/vfsStore";
import { useWindowData, useWindowStore } from "../../store/windowStore";
import { DEFAULT_FONT, usePaintFontStore } from "./fontStore";
import { TOOL_GRID, TOOL_LABELS, ToolIcon, type ToolId } from "./icons";
import { PAINT_PALETTE } from "./palette";
import {
  bresenhamLine,
  ellipsePoints,
  floodFillImageData,
  hexToRgba,
  polygonFillSpans,
  polygonOutline,
  rectPoints,
  rgbaToHex,
  roundRectPoints,
  stampSquare,
  strokeBezier,
  strokePolyline,
  type BrushShape,
  type Plot,
  type ShapeMode,
  type SpanPlot,
} from "./raster";

const CANVAS_W = 580;
const CANVAS_H = 380;
const MAGNIFICATIONS = [1, 2, 4, 8] as const;
const LINE_WIDTHS = [1, 2, 3, 4, 5];
const ERASER_SIZES = [4, 6, 8, 10];

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

// Classic Win98 transparency checkerboard (2x2 grayscale PNG), identical to
// jspaint's os-gui --checker. Applied to the selected tool, current colors and
// the canvas area background, exactly like jspaint's classic.css.
const CHECKER =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVQYV2P8/////4MHDzIwHjhw4L+9vT0DAHAFCj6esq3FAAAAAElFTkSuQmCC")';

const Root = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: ${({ theme }) => theme.material};
  user-select: none;
`;

const MenuBarRow = styled.div`
  position: relative;
  display: flex;
  height: 22px;
  flex-shrink: 0;
  font-size: 12px;
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
`;

const MenuTopItem = styled.button<{ $open: boolean }>`
  background: ${({ $open, theme }) =>
    $open ? theme.hoverBackground : "transparent"};
  color: ${({ $open, theme }) =>
    $open ? theme.headerText : theme.materialText};
  border: none;
  padding: 2px 8px;
  font-size: 12px;
  cursor: default;
`;

const Dropdown = styled.div`
  position: absolute;
  top: 22px;
  z-index: 50;
  ${raised}
  background: ${({ theme }) => theme.material};
  min-width: 170px;
  padding: 2px;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.4);
`;

const DropdownItem = styled.div<{ $disabled?: boolean }>`
  padding: 4px 10px;
  font-size: 12px;
  white-space: pre;
  color: ${({ $disabled, theme }) =>
    $disabled ? theme.materialTextDisabled : theme.materialText};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  &:hover {
    background: ${({ $disabled, theme }) =>
      $disabled ? "none" : theme.hoverBackground};
    color: ${({ $disabled, theme }) =>
      $disabled ? theme.materialTextDisabled : theme.headerText};
  }
`;

const DropdownDivider = styled.div`
  height: 1px;
  margin: 3px 2px;
  background: ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
`;

const Workspace = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`;

// Matches jspaint's classic toolbox: a 50x200 tool grid + a 41x66 options box.
const ToolboxCol = styled.div`
  width: 58px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${({ theme }) => theme.material};
  border-right: 1px solid ${({ theme }) => theme.borderDark};
  padding: 4px 2px 2px 4px;
`;

const ToolGrid = styled.div`
  display: flex;
  flex-flow: row wrap;
  width: 50px;
  height: 200px;
`;

// jspaint .tool: 25x25, 1px bevel (not the 2px raised/sunken). Unpressed shows
// a raised inner bevel + a 1px ButtonDkShadow separator on right/bottom;
// pressed/selected shows a sunken bevel + the checker background.
const ToolBtn = styled.button<{ $active: boolean }>`
  width: 25px;
  height: 25px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $active }) => ($active ? CHECKER : "transparent")};
  padding: 0;
  border: 1px solid;
  border-color: ${({ $active, theme }) =>
    $active
      ? `${theme.borderDarkest} ${theme.borderLightest} ${theme.borderLightest} ${theme.borderDarkest}`
      : `${theme.borderLightest} ${theme.borderDark} ${theme.borderDark} ${theme.borderLightest}`};
  outline: 0;
`;

// jspaint .tool-options: 41x66, 1px sunken border (ButtonShadow top/left,
// ButtonHilight right/bottom), NO padding — the chooser fills it edge to edge.
const OptionsBox = styled.div`
  margin-top: 3px;
  width: 41px;
  height: 66px;
  box-sizing: border-box;
  border: 1px solid;
  border-color: ${({ theme }) => theme.borderDark}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDark};
  background: ${({ theme }) => theme.material};
  display: flex;
  & > * {
    flex: 1;
  }
`;

// jspaint-style tool option choosers. jspaint renders some options onto a
// <canvas> (stroke width, eraser size, shape style, brush) and some from a PNG
// sprite (transparent mode, airbrush size, magnification). The chosen option
// sits on classic blue (#000080); unselected ones sit on gray (#c0c0c0) when
// the chooser uses gray_background_for_unselected (stroke/eraser/airbrush/
// transparent), otherwise on the material background. Canvas-drawn content is
// white when chosen, black otherwise — matching jspaint's HilightText/WindowText.
const SELECT_BLUE = "#000080";
const SELECT_GRAY = "#c0c0c0";

const Chooser = styled.div`
  display: flex;
  flex-flow: column;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  height: 100%;
`;
const ChooserWrap = styled.div`
  display: flex;
  flex-flow: row wrap;
  justify-content: space-around;
  align-content: space-around;
  width: 100%;
  height: 100%;
`;
// jspaint .chooser-option: a flush cell (no border/gap) whose background flips to
// the selection blue when chosen. The option graphic sits centered inside.
const ChooserCell = styled.button<{ $chosen: boolean; $gray?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $chosen, $gray, theme }) =>
    $chosen ? SELECT_BLUE : $gray ? SELECT_GRAY : theme.material};
  border: 0;
  padding: 0;
  margin: 0;
  cursor: default;
`;
// Sprite cell: shows a region of a PNG sprite via background-position, optionally
// inverted (for magnification/airbrush, jspaint inverts the image when chosen).

const CanvasScroll = styled.div`
  flex: 1;
  overflow: auto;
  background: ${CHECKER} repeat;
  background-size: 8px;
  padding: 8px;
`;

const CanvasStack = styled.div`
  position: relative;
  flex-shrink: 0;
  box-shadow: 1px 1px 0 1px rgba(0, 0, 0, 0.5);
`;

const PixelCanvas = styled.canvas`
  display: block;
  image-rendering: pixelated;
  background: white;
`;

const OverlayCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  image-rendering: pixelated;
  pointer-events: auto;
`;

const TextEditOverlay = styled.textarea<{
  $x: number;
  $y: number;
  $zoom: number;
  $font: string;
  $size: number;
  $bold: boolean;
  $italic: boolean;
  $underline: boolean;
}>`
  position: absolute;
  left: ${({ $x, $zoom }) => $x * $zoom}px;
  top: ${({ $y, $zoom }) => $y * $zoom}px;
  min-width: 60px;
  min-height: 20px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed #000;
  outline: none;
  resize: none;
  padding: 0;
  font-family: ${({ $font }) => $font}, sans-serif;
  font-size: ${({ $size, $zoom }) => $size * $zoom}px;
  font-weight: ${({ $bold }) => ($bold ? "bold" : "normal")};
  font-style: ${({ $italic }) => ($italic ? "italic" : "normal")};
  text-decoration: ${({ $underline }) => ($underline ? "underline" : "none")};
  line-height: 1.15;
  color: ${({ color }) => color};
`;

const PaletteRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 47px;
  flex-shrink: 0;
  padding: 6px 8px;
  border-top: 1px solid ${({ theme }) => theme.borderLightest};
`;

// jspaint colors-component.tall: current-colors is 31x32; the foreground color
// square sits on top of the background one (offset 4,3 / 3,3).
const CurrentColors = styled.div`
  position: relative;
  width: 31px;
  height: 32px;
  flex-shrink: 0;
  cursor: pointer;
  background: ${CHECKER};
`;

const ColorSquare = styled.button<{ $color: string; $back?: boolean }>`
  position: absolute;
  width: 15px;
  height: 15px;
  background: ${({ $color }) => $color};
  padding: 0;
  border: 0;
  box-shadow:
    inset 1px 1px 0 ${({ theme }) => theme.borderDarkest},
    inset -1px -1px 0 #fff;
  ${({ $back }) =>
    $back
      ? css`
          right: 3px;
          bottom: 3px;
        `
      : css`
          left: 4px;
          top: 3px;
          z-index: 1;
        `}
`;

// jspaint swatches: 15x15, sunken border (dark top/left, light bottom/right)
// on a darker outer frame — a single inset box-shadow gives the classic look.
const SwatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(14, 15px);
  grid-template-rows: repeat(2, 15px);
  gap: 1px;
  flex-shrink: 0;
`;

const Swatch = styled.button<{ $color: string }>`
  width: 15px;
  height: 15px;
  background: ${({ $color }) => $color};
  padding: 0;
  border: 1px solid ${({ theme }) => theme.borderDarkest};
  box-shadow: inset 1px 1px 0 ${({ theme }) => theme.borderDarkest};
`;

const StatusBarRow = styled.div`
  display: flex;
  height: 20px;
  flex-shrink: 0;
  font-size: 11px;
  ${sunken}
  margin: 1px;
`;

const StatusSeg = styled.div<{ $w?: number }>`
  display: flex;
  align-items: center;
  padding: 0 6px;
  border-right: 1px solid ${({ theme }) => theme.borderDark};
  width: ${({ $w }) => ($w ? `${$w}px` : "auto")};
  flex: ${({ $w }) => ($w ? "none" : 1)};
  overflow: hidden;
  white-space: nowrap;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 500000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
`;

const DialogBox = styled.div`
  ${raised}
  background: ${({ theme }) => theme.material};
  width: 320px;
`;

const DialogHeader = styled.div`
  background: ${({ theme }) => theme.headerBackground};
  color: ${({ theme }) => theme.headerText};
  padding: 4px 8px;
  font-weight: bold;
  font-size: 13px;
`;

const DialogBody = styled.div`
  padding: 14px;
  font-size: 12px;
`;

const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 14px 14px;
`;

const RgbRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  label {
    width: 16px;
  }
`;

interface MenuItemDef {
  label: string;
  action?: () => void;
  disabled?: boolean;
  divider?: boolean;
}
interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

type SelMode = "select" | "lasso";
type SelStage = "idle" | "drawing" | "selected" | "dragging";

interface SelState {
  stage: SelStage;
  points: [number, number][];
  bounds: { x: number; y: number; w: number; h: number };
  floating: HTMLCanvasElement | null;
  dragStart: [number, number];
  floatingOrigin: [number, number];
}

const emptySel = (): SelState => ({
  stage: "idle",
  points: [],
  bounds: { x: 0, y: 0, w: 0, h: 0 },
  floating: null,
  dragStart: [0, 0],
  floatingOrigin: [0, 0],
});

interface CurveState {
  stage: 0 | 1 | 2;
  p0: [number, number];
  p1: [number, number];
  c1: [number, number];
  c2: [number, number];
}

const emptyCurve = (): CurveState => ({
  stage: 0,
  p0: [0, 0],
  p1: [0, 0],
  c1: [0, 0],
  c2: [0, 0],
});

const midpoint = (
  a: [number, number],
  b: [number, number],
): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// Render an option graphic onto a <canvas>, exactly like jspaint's tool-options.js
// (which draws onto a canvas with currentColor = HilightText when chosen, else
// WindowText). `draw(ctx, color)` does the actual painting; the canvas is sized
// to (w, h) and redrawn whenever `chosen` changes.
function OptionCanvas({
  w,
  h,
  chosen,
  draw,
}: {
  w: number;
  h: number;
  chosen: boolean;
  draw: (ctx: CanvasRenderingContext2D, color: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, chosen ? "#ffffff" : "#000000");
  }, [w, h, chosen, draw]);
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ imageRendering: "pixelated", pointerEvents: "none" }}
    />
  );
}

// jspaint render_brush: a centered square/circle/diagonal brush stamp.
const renderBrushShape = (
  ctx: CanvasRenderingContext2D,
  shape: "circle" | "square" | "diagonal" | "reverse_diagonal",
  size: number,
) => {
  const midX = Math.round(ctx.canvas.width / 2);
  const left = Math.round(midX - size / 2);
  const right = Math.round(midX + size / 2);
  const midY = Math.round(ctx.canvas.height / 2);
  const top = Math.round(midY - size / 2);
  const bottom = Math.round(midY + size / 2);
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(midX, midY, size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "square") {
    ctx.fillRect(left, top, Math.floor(size), Math.floor(size));
  } else if (shape === "diagonal") {
    ctx.save();
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, top);
    ctx.stroke();
    ctx.restore();
  }
};

export function Paint({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const isFocused = useWindowStore(
    (s) => s.windows.find((w) => w.id === windowId)?.isFocused ?? false,
  );
  const windowData = useWindowData(windowId);
  const vfs = useVfsStore();
  const [filePath, setFilePath] = useState<string | null>(
    (windowData.path as string) ?? null,
  );

  const mountedRef = useRef(true);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyPosRef = useRef(-1);
  const dirtyRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);

  const [tool, setTool] = useState<ToolId>("pencil");
  const prevToolRef = useRef<ToolId>("pencil");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [lineWidth, setLineWidth] = useState(2);
  const [shapeStyle, setShapeStyle] = useState<ShapeMode>("outline");
  const [brushShape, setBrushShape] = useState<BrushShape>("circle");
  const [brushSize, setBrushSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(8);
  const [airbrushSize, setAirbrushSize] = useState(5);
  const [zoom, setZoom] = useState<number>(1);
  const [transparentSelection, setTransparentSelection] = useState(false);
  // Font settings live in the shared paint font store so the (separate OS-window)
  // Fonts box and this Paint instance stay in sync.
  const paintFont = usePaintFontStore((s) => s.fonts[windowId] ?? DEFAULT_FONT);
  const fontFamily = paintFont.family;
  const fontSize = paintFont.size;
  const fontBold = paintFont.bold;
  const fontItalic = paintFont.italic;
  const fontUnderline = paintFont.underline;
  const [fontsWindowId, setFontsWindowId] = useState<string | null>(null);
  const fontsWindowIdRef = useRef<string | null>(null);
  fontsWindowIdRef.current = fontsWindowId;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [cursorLabel, setCursorLabel] = useState("");
  const [textEditing, setTextEditing] = useState<{
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const textEditingRef = useRef<{ x: number; y: number; value: string } | null>(
    null,
  );
  textEditingRef.current = textEditing;
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [colorEditor, setColorEditor] = useState<{
    target: "fg" | "bg";
    r: number;
    g: number;
    b: number;
  } | null>(null);

  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<[number, number] | null>(null);
  const activeColorRef = useRef("#000000");
  const shapeStartRef = useRef<[number, number] | null>(null);
  const shiftHeldRef = useRef(false);
  const airbrushPosRef = useRef<[number, number] | null>(null);
  const airbrushTimerRef = useRef<number | null>(null);
  const curveRef = useRef<CurveState>(emptyCurve());
  const bendAnchorRef = useRef<[number, number] | null>(null);
  const polygonRef = useRef<{ active: boolean; points: [number, number][] }>({
    active: false,
    points: [],
  });
  const selRef = useRef<SelState>(emptySel());
  const commitTextRef = useRef<() => void>(() => {});
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const getBaseCtx = useCallback(
    () =>
      baseCanvasRef.current?.getContext("2d", { willReadFrequently: true }) ??
      null,
    [],
  );
  const getOverlayCtx = useCallback(
    () => overlayCanvasRef.current?.getContext("2d") ?? null,
    [],
  );

  const clearOverlay = useCallback(() => {
    getOverlayCtx()?.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }, [getOverlayCtx]);

  const makePlot =
    (ctx: CanvasRenderingContext2D | null, color: string): Plot =>
    (x, y) => {
      if (!ctx) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    };
  const makeSpan =
    (ctx: CanvasRenderingContext2D | null, color: string): SpanPlot =>
    (x0, x1, y) => {
      if (!ctx) return;
      ctx.fillStyle = color;
      ctx.fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1);
    };

  const pushHistory = useCallback(() => {
    const ctx = getBaseCtx();
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const stack = historyRef.current;
    stack.length = historyPosRef.current + 1;
    stack.push(snap);
    if (stack.length > 30) stack.shift();
    historyPosRef.current = stack.length - 1;
    dirtyRef.current = true;
    setHistoryTick((t) => t + 1);
  }, [getBaseCtx]);

  const restoreHistory = useCallback(() => {
    const snap = historyRef.current[historyPosRef.current];
    if (snap) getBaseCtx()?.putImageData(snap, 0, 0);
    setHistoryTick((t) => t + 1);
  }, [getBaseCtx]);

  const undo = useCallback(() => {
    if (historyPosRef.current <= 0) return;
    historyPosRef.current -= 1;
    restoreHistory();
  }, [restoreHistory]);

  const redo = useCallback(() => {
    if (historyPosRef.current >= historyRef.current.length - 1) return;
    historyPosRef.current += 1;
    restoreHistory();
  }, [restoreHistory]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Strict Mode mounts effects twice in dev; guard so we don't double-push
    // the blank canvas as two separate (identical) history entries.
    if (historyRef.current.length > 0) return;
    const ctx = getBaseCtx();
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    pushHistory();
    // If opened from a VFS image file, load its contents onto the canvas.
    const loadPath = filePath;
    if (loadPath) {
      const content = vfs.read(loadPath);
      if (content && content.startsWith("data:image/")) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
          ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
          historyRef.current = [ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)];
          historyPosRef.current = 0;
          setHistoryTick((t) => t + 1);
        };
        img.src = content;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (airbrushTimerRef.current)
        window.clearInterval(airbrushTimerRef.current);
    };
  }, []);

  // Cancel/commit whatever the previous tool had in progress when switching tools.
  useEffect(() => {
    const prev = prevToolRef.current;
    if (prev === tool) return;
    if (prev === "curve" && curveRef.current.stage !== 0) {
      curveRef.current = emptyCurve();
      clearOverlay();
    }
    if (prev === "polygon" && polygonRef.current.active) {
      polygonRef.current = { active: false, points: [] };
      clearOverlay();
    }
    if (
      (prev === "select" || prev === "lasso") &&
      selRef.current.stage === "selected"
    ) {
      selRef.current = emptySel();
      clearOverlay();
    }
    if (prev === "text" && textEditing) {
      commitTextRef.current();
    }
    prevToolRef.current = tool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const getLogicalPos = (e: {
    clientX: number;
    clientY: number;
  }): [number, number] => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    return [
      Math.max(0, Math.min(CANVAS_W - 1, x)),
      Math.max(0, Math.min(CANVAS_H - 1, y)),
    ];
  };

  const roundRectPath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const previewLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    shift: boolean,
  ) => {
    clearOverlay();
    const ctx = getOverlayCtx();
    if (!ctx) return [x1, y1] as [number, number];
    let ex = x1;
    let ey = y1;
    if (shift) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const angle =
        Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.hypot(dx, dy);
      ex = x0 + Math.cos(angle) * dist;
      ey = y0 + Math.sin(angle) * dist;
    }
    ctx.strokeStyle = activeColorRef.current;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, y0 + 0.5);
    ctx.lineTo(ex + 0.5, ey + 0.5);
    ctx.stroke();
    return [ex, ey] as [number, number];
  };

  const previewShape = (
    kind: "rect" | "ellipse" | "roundrect",
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    shift: boolean,
  ) => {
    clearOverlay();
    const ctx = getOverlayCtx();
    if (!ctx) return [x1, y1] as [number, number];
    let ex = x1;
    let ey = y1;
    if (shift) {
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      const s = Math.max(w, h);
      ex = x0 + (x1 < x0 ? -s : s);
      ey = y0 + (y1 < y0 ? -s : s);
    }
    const left = Math.min(x0, ex);
    const top = Math.min(y0, ey);
    const w = Math.abs(ex - x0);
    const h = Math.abs(ey - y0);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = fgColor;
    ctx.fillStyle = shapeStyle === "outline-fill" ? bgColor : fgColor;
    if (kind === "rect") {
      if (shapeStyle !== "outline") ctx.fillRect(left, top, w, h);
      if (shapeStyle !== "fill") ctx.strokeRect(left + 0.5, top + 0.5, w, h);
    } else if (kind === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (shapeStyle !== "outline") ctx.fill();
      if (shapeStyle !== "fill") ctx.stroke();
    } else {
      roundRectPath(ctx, left, top, w, h, 12);
      if (shapeStyle !== "outline") ctx.fill();
      if (shapeStyle !== "fill") ctx.stroke();
    }
    return [ex, ey] as [number, number];
  };

  const commitLine = (x0: number, y0: number, x1: number, y1: number) => {
    const ctx = getBaseCtx();
    if (!ctx) return;
    const plot = makePlot(ctx, activeColorRef.current);
    bresenhamLine(x0, y0, x1, y1, (px, py) =>
      stampSquare(px, py, lineWidth, plot),
    );
    clearOverlay();
    pushHistory();
  };

  const commitShape = (
    kind: "rect" | "ellipse" | "roundrect",
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => {
    const ctx = getBaseCtx();
    if (!ctx) return;
    const outlinePlot = makePlot(ctx, fgColor);
    const fillColor = shapeStyle === "outline-fill" ? bgColor : fgColor;
    const fillSpan = makeSpan(ctx, fillColor);
    if (kind === "rect") {
      rectPoints(x0, y0, x1, y1, shapeStyle, lineWidth, outlinePlot, fillSpan);
    } else if (kind === "ellipse") {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2;
      const ry = Math.abs(y1 - y0) / 2;
      ellipsePoints(
        cx,
        cy,
        rx,
        ry,
        shapeStyle,
        lineWidth,
        outlinePlot,
        fillSpan,
      );
    } else {
      const r = Math.min(12, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2);
      roundRectPoints(
        x0,
        y0,
        x1,
        y1,
        r,
        shapeStyle,
        lineWidth,
        outlinePlot,
        fillSpan,
      );
    }
    clearOverlay();
    pushHistory();
  };

  // ---- Curve tool: drag a straight line, then bend it twice. ----
  const drawCurvePreview = () => {
    clearOverlay();
    const ctx = getOverlayCtx();
    if (!ctx) return;
    const c = curveRef.current;
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(c.p0[0] + 0.5, c.p0[1] + 0.5);
    ctx.bezierCurveTo(
      c.c1[0] + 0.5,
      c.c1[1] + 0.5,
      c.c2[0] + 0.5,
      c.c2[1] + 0.5,
      c.p1[0] + 0.5,
      c.p1[1] + 0.5,
    );
    ctx.stroke();
  };

  const handleCurveDown = (x: number, y: number) => {
    const c = curveRef.current;
    if (c.stage === 0) {
      c.p0 = [x, y];
      c.p1 = [x, y];
    } else {
      bendAnchorRef.current = [x, y];
    }
    isDrawingRef.current = true;
  };

  const handleCurveMove = (x: number, y: number) => {
    if (!isDrawingRef.current) return;
    const c = curveRef.current;
    if (c.stage === 0) {
      c.p1 = [x, y];
      previewLine(c.p0[0], c.p0[1], x, y, false);
    } else if (c.stage === 1) {
      const anchor = bendAnchorRef.current!;
      const mid = midpoint(c.p0, c.p1);
      c.c1 = [mid[0] + (x - anchor[0]), mid[1] + (y - anchor[1])];
      c.c2 = c.c1;
      drawCurvePreview();
    } else {
      const anchor = bendAnchorRef.current!;
      const mid = midpoint(c.p0, c.p1);
      c.c2 = [mid[0] + (x - anchor[0]), mid[1] + (y - anchor[1])];
      drawCurvePreview();
    }
  };

  const handleCurveUp = () => {
    isDrawingRef.current = false;
    const c = curveRef.current;
    if (c.stage === 0) {
      if (c.p0[0] === c.p1[0] && c.p0[1] === c.p1[1]) {
        clearOverlay();
        return;
      }
      c.c1 = midpoint(c.p0, c.p1);
      c.c2 = midpoint(c.p0, c.p1);
      c.stage = 1;
    } else if (c.stage === 1) {
      c.stage = 2;
    } else {
      const ctx = getBaseCtx();
      const plot = makePlot(ctx, fgColor);
      strokeBezier(c.p0, c.c1, c.c2, c.p1, lineWidth, plot);
      clearOverlay();
      pushHistory();
      curveRef.current = emptyCurve();
    }
  };

  // ---- Polygon tool: click to add vertices, double/right-click to close. ----
  const drawPolygonPreview = (curX: number, curY: number) => {
    clearOverlay();
    const ctx = getOverlayCtx();
    if (!ctx) return;
    const pts = polygonRef.current.points;
    if (pts.length === 0) return;
    ctx.strokeStyle = fgColor;
    ctx.fillStyle = shapeStyle === "outline-fill" ? bgColor : fgColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + 0.5, pts[0][1] + 0.5);
    for (let i = 1; i < pts.length; i++)
      ctx.lineTo(pts[i][0] + 0.5, pts[i][1] + 0.5);
    ctx.lineTo(curX + 0.5, curY + 0.5);
    if (shapeStyle !== "outline") {
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();
  };

  const handlePolygonDown = (x: number, y: number) => {
    const p = polygonRef.current;
    if (!p.active) {
      p.active = true;
      p.points = [[x, y]];
    } else {
      p.points.push([x, y]);
    }
    drawPolygonPreview(x, y);
  };

  const finishPolygon = () => {
    const p = polygonRef.current;
    if (!p.active || p.points.length < 2) {
      polygonRef.current = { active: false, points: [] };
      clearOverlay();
      return;
    }
    const ctx = getBaseCtx();
    if (!ctx) return;
    if (shapeStyle !== "outline") {
      const fillColor = shapeStyle === "outline-fill" ? bgColor : fgColor;
      polygonFillSpans(p.points, makeSpan(ctx, fillColor));
    }
    if (shapeStyle !== "fill") {
      polygonOutline(p.points, lineWidth, makePlot(ctx, fgColor));
    }
    polygonRef.current = { active: false, points: [] };
    clearOverlay();
    pushHistory();
  };

  // ---- Select / lasso: lift pixels into a floating buffer, drag, drop. ----
  const pointInBounds = (x: number, y: number, b: SelState["bounds"]) =>
    x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

  const clipToPath = (
    ctx: CanvasRenderingContext2D,
    points: [number, number][],
    ox = 0,
    oy = 0,
  ) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0] - ox, points[0][1] - oy);
    for (let i = 1; i < points.length; i++)
      ctx.lineTo(points[i][0] - ox, points[i][1] - oy);
    ctx.closePath();
    ctx.clip();
  };

  const drawMarquee = (
    ctx: CanvasRenderingContext2D,
    points: [number, number][],
  ) => {
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++)
      ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  const liftSelection = () => {
    const s = selRef.current;
    const b = s.bounds;
    const baseCtxCheck = getBaseCtx();
    if (!baseCtxCheck || !baseCanvasRef.current) return;
    const floating = document.createElement("canvas");
    floating.width = Math.max(1, b.w);
    floating.height = Math.max(1, b.h);
    const fctx = floating.getContext("2d")!;
    fctx.save();
    clipToPath(fctx, s.points, b.x, b.y);
    fctx.drawImage(baseCanvasRef.current, -b.x, -b.y);
    fctx.restore();

    const baseCtx = baseCtxCheck;
    baseCtx.save();
    clipToPath(baseCtx, s.points);
    baseCtx.fillStyle = bgColor;
    baseCtx.fillRect(b.x, b.y, b.w, b.h);
    baseCtx.restore();

    s.floating = floating;
    s.floatingOrigin = [b.x, b.y];
  };

  const handleSelectDown = (x: number, y: number, mode: SelMode) => {
    const s = selRef.current;
    if (s.stage === "selected" && pointInBounds(x, y, s.bounds)) {
      liftSelection();
      s.stage = "dragging";
      s.dragStart = [x, y];
      isDrawingRef.current = true;
      return;
    }
    s.stage = "drawing";
    s.points =
      mode === "select"
        ? [
            [x, y],
            [x, y],
            [x, y],
            [x, y],
          ]
        : [[x, y]];
    isDrawingRef.current = true;
  };

  const handleSelectMove = (x: number, y: number, mode: SelMode) => {
    const s = selRef.current;
    if (!isDrawingRef.current) return;
    if (s.stage === "drawing") {
      if (mode === "select") {
        const [x0, y0] = s.points[0];
        s.points = [
          [x0, y0],
          [x, y0],
          [x, y],
          [x0, y],
        ];
      } else {
        s.points.push([x, y]);
      }
      clearOverlay();
      const oCtx1 = getOverlayCtx();
      if (oCtx1) drawMarquee(oCtx1, s.points);
    } else if (s.stage === "dragging") {
      const dx = x - s.dragStart[0];
      const dy = y - s.dragStart[1];
      clearOverlay();
      const ctx = getOverlayCtx();
      if (ctx && s.floating)
        ctx.drawImage(
          s.floating,
          s.floatingOrigin[0] + dx,
          s.floatingOrigin[1] + dy,
        );
      const moved = s.points.map(
        ([px, py]) => [px + dx, py + dy] as [number, number],
      );
      if (ctx) drawMarquee(ctx, moved);
    }
  };

  const handleSelectUp = (x: number, y: number) => {
    const s = selRef.current;
    isDrawingRef.current = false;
    if (s.stage === "drawing") {
      const xs = s.points.map((p) => p[0]);
      const ys = s.points.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      if (maxX - minX < 2 || maxY - minY < 2) {
        selRef.current = emptySel();
        clearOverlay();
        return;
      }
      s.bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      s.stage = "selected";
      const oCtx2 = getOverlayCtx();
      if (oCtx2) drawMarquee(oCtx2, s.points);
    } else if (s.stage === "dragging") {
      const dx = x - s.dragStart[0];
      const dy = y - s.dragStart[1];
      if (s.floating) {
        const baseCtx = getBaseCtx();
        if (!baseCtx) return;
        if (transparentSelection) {
          // Transparent move: pixels matching the background color become holes
          // so whatever is underneath shows through (classic MS Paint behavior).
          const tmp = document.createElement("canvas");
          tmp.width = s.floating.width;
          tmp.height = s.floating.height;
          const tctx = tmp.getContext("2d")!;
          tctx.drawImage(s.floating, 0, 0);
          const id = tctx.getImageData(0, 0, tmp.width, tmp.height);
          const d = id.data;
          const [tr, tg, tb] = hexToRgba(bgColor);
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] === tr && d[i + 1] === tg && d[i + 2] === tb) d[i + 3] = 0;
          }
          tctx.putImageData(id, 0, 0);
          baseCtx.drawImage(
            tmp,
            s.floatingOrigin[0] + dx,
            s.floatingOrigin[1] + dy,
          );
        } else {
          baseCtx.drawImage(
            s.floating,
            s.floatingOrigin[0] + dx,
            s.floatingOrigin[1] + dy,
          );
        }
      }
      s.points = s.points.map(([px, py]) => [px + dx, py + dy]);
      s.bounds = { ...s.bounds, x: s.bounds.x + dx, y: s.bounds.y + dy };
      s.floatingOrigin = [s.floatingOrigin[0] + dx, s.floatingOrigin[1] + dy];
      s.stage = "selected";
      clearOverlay();
      const oCtx3 = getOverlayCtx();
      if (oCtx3) drawMarquee(oCtx3, s.points);
      pushHistory();
    }
  };

  const deleteSelection = () => {
    const s = selRef.current;
    if (s.stage !== "selected") return;
    const baseCtx = getBaseCtx();
    if (!baseCtx) return;
    baseCtx.save();
    clipToPath(baseCtx, s.points);
    baseCtx.fillStyle = bgColor;
    baseCtx.fillRect(s.bounds.x, s.bounds.y, s.bounds.w, s.bounds.h);
    baseCtx.restore();
    clearOverlay();
    selRef.current = emptySel();
    pushHistory();
  };

  const selectAll = () => {
    const overlayCtx = getOverlayCtx();
    if (!overlayCtx) return;
    setTool("select");
    const pts: [number, number][] = [
      [0, 0],
      [CANVAS_W, 0],
      [CANVAS_W, CANVAS_H],
      [0, CANVAS_H],
    ];
    selRef.current = {
      stage: "selected",
      points: pts,
      bounds: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
      floating: null,
      dragStart: [0, 0],
      floatingOrigin: [0, 0],
    };
    drawMarquee(overlayCtx, pts);
  };

  // ---- Text tool ----
  // Side effects (canvas draw + history push) must not live inside a setState
  // updater — React Strict Mode double-invokes updaters to test purity, which
  // would draw the text and push history twice. Read the pending value from a
  // ref instead and treat this as an event-triggered side effect.
  const commitText = useCallback(() => {
    if (!mountedRef.current) return;
    const current = textEditingRef.current;
    if (current && current.value.trim()) {
      const ctx = getBaseCtx();
      if (!ctx) return;
      ctx.fillStyle = fgColor;
      ctx.font = `${fontItalic ? "italic " : ""}${fontBold ? "bold " : ""}${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      if (fontUnderline) ctx.strokeStyle = fgColor;
      const lineH = fontSize * 1.15;
      for (const [i, line] of current.value.split("\n").entries()) {
        const ly = current.y + i * lineH;
        ctx.fillText(line, current.x, ly);
        if (fontUnderline) {
          const w = ctx.measureText(line).width;
          ctx.beginPath();
          ctx.lineWidth = Math.max(1, Math.floor(fontSize / 12));
          ctx.moveTo(current.x, ly + fontSize);
          ctx.lineTo(current.x + w, ly + fontSize);
          ctx.stroke();
        }
      }
      pushHistory();
    }
    setTextEditing(null);
  }, [
    fgColor,
    fontFamily,
    fontSize,
    fontBold,
    fontItalic,
    fontUnderline,
    getBaseCtx,
    pushHistory,
  ]);

  useEffect(() => {
    commitTextRef.current = commitText;
  }, [commitText]);

  // Focusing synchronously during the pointerdown that opened the editor loses
  // the race against the browser's native post-mousedown focus handling
  // (which clears focus right after), so defer to the next tick.
  const isTextEditing = textEditing !== null;
  useEffect(() => {
    if (!isTextEditing) return;
    const id = window.setTimeout(() => textAreaRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isTextEditing]);

  // ---- Airbrush ----
  const sprayOnce = useCallback(() => {
    if (!mountedRef.current) return;
    const pos = airbrushPosRef.current;
    if (!pos) return;
    const ctx = getBaseCtx();
    if (!ctx) return;
    ctx.fillStyle = activeColorRef.current;
    const density = airbrushSize * 2;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * airbrushSize;
      const px = Math.round(pos[0] + Math.cos(angle) * dist);
      const py = Math.round(pos[1] + Math.sin(angle) * dist);
      if (px >= 0 && py >= 0 && px < CANVAS_W && py < CANVAS_H)
        ctx.fillRect(px, py, 1, 1);
    }
  }, [airbrushSize, getBaseCtx]);

  // ---- Pointer dispatch ----
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!baseCanvasRef.current || !overlayCanvasRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const [x, y] = getLogicalPos(e);
    const isRight = e.button === 2;
    activeColorRef.current = isRight ? bgColor : fgColor;
    shiftHeldRef.current = e.shiftKey;

    switch (tool) {
      case "pencil": {
        isDrawingRef.current = true;
        lastPosRef.current = [x, y];
        makePlot(getBaseCtx(), activeColorRef.current)(x, y);
        break;
      }
      case "brush": {
        isDrawingRef.current = true;
        lastPosRef.current = [x, y];
        strokePolyline(
          [[x, y]],
          brushSize,
          brushShape,
          makePlot(getBaseCtx(), activeColorRef.current),
        );
        break;
      }
      case "eraser": {
        isDrawingRef.current = true;
        lastPosRef.current = [x, y];
        stampSquare(x, y, eraserSize, makePlot(getBaseCtx(), bgColor));
        break;
      }
      case "airbrush": {
        isDrawingRef.current = true;
        airbrushPosRef.current = [x, y];
        sprayOnce();
        if (airbrushTimerRef.current)
          window.clearInterval(airbrushTimerRef.current);
        airbrushTimerRef.current = window.setInterval(sprayOnce, 45);
        break;
      }
      case "fill": {
        const ctx = getBaseCtx();
        if (!ctx) break;
        const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        floodFillImageData(img, x, y, hexToRgba(activeColorRef.current));
        ctx.putImageData(img, 0, 0);
        pushHistory();
        break;
      }
      case "eyedropper": {
        const ctx = getBaseCtx();
        if (!ctx) break;
        const d = ctx.getImageData(x, y, 1, 1).data;
        const hex = rgbaToHex(d[0], d[1], d[2]);
        if (isRight) setBgColor(hex);
        else setFgColor(hex);
        break;
      }
      case "zoom": {
        const idx = MAGNIFICATIONS.indexOf(
          zoom as (typeof MAGNIFICATIONS)[number],
        );
        const nextIdx = isRight
          ? Math.max(0, idx - 1)
          : Math.min(MAGNIFICATIONS.length - 1, idx + 1);
        setZoom(MAGNIFICATIONS[nextIdx]);
        break;
      }
      case "text": {
        if (textEditing) commitText();
        setTextEditing({ x, y, value: "" });
        break;
      }
      case "line":
      case "rect":
      case "ellipse":
      case "roundrect": {
        isDrawingRef.current = true;
        shapeStartRef.current = [x, y];
        break;
      }
      case "curve":
        handleCurveDown(x, y);
        break;
      case "polygon":
        handlePolygonDown(x, y);
        break;
      case "select":
      case "lasso":
        handleSelectDown(x, y, tool);
        break;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!baseCanvasRef.current || !overlayCanvasRef.current) return;
    const [x, y] = getLogicalPos(e);
    setCursorLabel(`${x}, ${y}`);
    airbrushPosRef.current = [x, y];

    switch (tool) {
      case "pencil": {
        if (!isDrawingRef.current || !lastPosRef.current) break;
        const [lx, ly] = lastPosRef.current;
        bresenhamLine(
          lx,
          ly,
          x,
          y,
          makePlot(getBaseCtx(), activeColorRef.current),
        );
        lastPosRef.current = [x, y];
        break;
      }
      case "brush": {
        if (!isDrawingRef.current || !lastPosRef.current) break;
        strokePolyline(
          [lastPosRef.current, [x, y]],
          brushSize,
          brushShape,
          makePlot(getBaseCtx(), activeColorRef.current),
        );
        lastPosRef.current = [x, y];
        break;
      }
      case "eraser": {
        if (!isDrawingRef.current || !lastPosRef.current) break;
        strokePolyline(
          [lastPosRef.current, [x, y]],
          eraserSize,
          "square",
          makePlot(getBaseCtx(), bgColor),
        );
        lastPosRef.current = [x, y];
        break;
      }
      case "line": {
        if (!isDrawingRef.current || !shapeStartRef.current) break;
        previewLine(
          shapeStartRef.current[0],
          shapeStartRef.current[1],
          x,
          y,
          e.shiftKey,
        );
        break;
      }
      case "rect":
      case "ellipse":
      case "roundrect": {
        if (!isDrawingRef.current || !shapeStartRef.current) break;
        previewShape(
          tool,
          shapeStartRef.current[0],
          shapeStartRef.current[1],
          x,
          y,
          e.shiftKey,
        );
        break;
      }
      case "curve":
        handleCurveMove(x, y);
        break;
      case "polygon":
        if (polygonRef.current.active) drawPolygonPreview(x, y);
        break;
      case "select":
      case "lasso":
        handleSelectMove(x, y, tool);
        break;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!baseCanvasRef.current || !overlayCanvasRef.current) return;
    const [x, y] = getLogicalPos(e);

    switch (tool) {
      case "pencil":
      case "brush":
      case "eraser": {
        if (isDrawingRef.current) pushHistory();
        isDrawingRef.current = false;
        lastPosRef.current = null;
        break;
      }
      case "airbrush": {
        isDrawingRef.current = false;
        if (airbrushTimerRef.current) {
          window.clearInterval(airbrushTimerRef.current);
          airbrushTimerRef.current = null;
        }
        pushHistory();
        break;
      }
      case "line": {
        if (isDrawingRef.current && shapeStartRef.current) {
          const [ex, ey] = previewLine(
            shapeStartRef.current[0],
            shapeStartRef.current[1],
            x,
            y,
            shiftHeldRef.current,
          );
          commitLine(
            shapeStartRef.current[0],
            shapeStartRef.current[1],
            ex,
            ey,
          );
        }
        isDrawingRef.current = false;
        shapeStartRef.current = null;
        break;
      }
      case "rect":
      case "ellipse":
      case "roundrect": {
        if (isDrawingRef.current && shapeStartRef.current) {
          const [ex, ey] = previewShape(
            tool,
            shapeStartRef.current[0],
            shapeStartRef.current[1],
            x,
            y,
            shiftHeldRef.current,
          );
          commitShape(
            tool,
            shapeStartRef.current[0],
            shapeStartRef.current[1],
            ex,
            ey,
          );
        }
        isDrawingRef.current = false;
        shapeStartRef.current = null;
        break;
      }
      case "curve":
        handleCurveUp();
        break;
      case "select":
      case "lasso":
        handleSelectUp(x, y);
        break;
    }
  };

  const handleDoubleClick = () => {
    if (tool === "polygon") finishPolygon();
  };

  const handleContextMenuCanvas = (e: React.MouseEvent) => {
    e.preventDefault();
    if (tool === "polygon" && polygonRef.current.active) finishPolygon();
  };

  // ---- Keyboard shortcuts (only while this window is focused) ----
  useEffect(() => {
    if (!isFocused) return;
    const handler = (e: KeyboardEvent) => {
      if (textEditing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selRef.current.stage === "selected") {
          e.preventDefault();
          deleteSelection();
        }
      } else if (e.key === "Escape") {
        if (tool === "polygon") {
          polygonRef.current = { active: false, points: [] };
          clearOverlay();
        } else if (tool === "curve") {
          curveRef.current = emptyCurve();
          clearOverlay();
        } else if (selRef.current.stage === "selected") {
          selRef.current = emptySel();
          clearOverlay();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, textEditing, tool, undo, redo]);

  // ---- File / Image menu actions ----
  const requestNew = () => {
    if (dirtyRef.current) setShowNewConfirm(true);
    else doNew();
  };

  const doNew = () => {
    const ctx = getBaseCtx();
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    historyRef.current = [ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)];
    historyPosRef.current = 0;
    dirtyRef.current = false;
    selRef.current = emptySel();
    polygonRef.current = { active: false, points: [] };
    curveRef.current = emptyCurve();
    clearOverlay();
    setShowNewConfirm(false);
    setHistoryTick((t) => t + 1);
  };

  const updateTitle = useWindowStore((s) => s.updateTitle);

  const saveToVfs = (absPath: string) => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    vfs.writeFile(absPath, canvas.toDataURL("image/png"));
    setFilePath(absPath);
    const fname = absPath.split("\\").pop() ?? "untitled.png";
    updateTitle(windowId, `${fname} - Paint`);
    dirtyRef.current = false;
  };

  const handleSave = () => {
    if (filePath) {
      saveToVfs(filePath);
    } else {
      handleSaveAsPng();
    }
  };

  const handleSaveAsPng = () => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const defaultName = filePath
      ? (filePath.split("\\").pop() ?? "untitled.png")
      : "untitled.png";
    const input = window.prompt(
      "Save picture to (virtual folder path):",
      `C:\\My Documents\\${defaultName}`,
    );
    if (!input) return;
    const abs = vfs.resolvePath(input);
    if (!abs || !abs.toLowerCase().endsWith(".png")) {
      window.alert("Please enter a full path ending in .png under C:\\");
      return;
    }
    saveToVfs(abs);
  };

  const flipHorizontal = () => {
    const base = baseCanvasRef.current;
    const ctx = getBaseCtx();
    if (!base || !ctx) return;
    const tmp = document.createElement("canvas");
    tmp.width = CANVAS_W;
    tmp.height = CANVAS_H;
    tmp.getContext("2d")!.drawImage(base, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.translate(CANVAS_W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    pushHistory();
  };

  const flipVertical = () => {
    const base = baseCanvasRef.current;
    const ctx = getBaseCtx();
    if (!base || !ctx) return;
    const tmp = document.createElement("canvas");
    tmp.width = CANVAS_W;
    tmp.height = CANVAS_H;
    tmp.getContext("2d")!.drawImage(base, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.translate(0, CANVAS_H);
    ctx.scale(1, -1);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    pushHistory();
  };

  const invertColors = () => {
    const ctx = getBaseCtx();
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(img, 0, 0);
    pushHistory();
  };

  const clearImage = () => {
    const ctx = getBaseCtx();
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    selRef.current = emptySel();
    clearOverlay();
    pushHistory();
  };

  const openColorEditor = (target: "fg" | "bg") => {
    const [r, g, b] = hexToRgba(target === "fg" ? fgColor : bgColor);
    setColorEditor({ target, r, g, b });
    setOpenMenu(null);
  };

  const applyColorEditor = () => {
    if (!colorEditor) return;
    const hex = rgbaToHex(colorEditor.r, colorEditor.g, colorEditor.b);
    if (colorEditor.target === "fg") setFgColor(hex);
    else setBgColor(hex);
    setColorEditor(null);
  };

  const canUndo = historyPosRef.current > 0;
  const canRedo = historyPosRef.current < historyRef.current.length - 1;
  void historyTick; // re-render trigger for the two flags above

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        { label: "New", action: requestNew },
        { label: "Save", action: handleSave },
        { label: "Save As PNG...", action: handleSaveAsPng },
        { label: "", divider: true },
        { label: "Exit", action: () => closeWindow(windowId) },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo\tCtrl+Z", action: undo, disabled: !canUndo },
        { label: "Repeat\tCtrl+Y", action: redo, disabled: !canRedo },
        { label: "", divider: true },
        { label: "Select All\tCtrl+A", action: selectAll },
        {
          label: "Clear Selection\tDel",
          action: deleteSelection,
          disabled: selRef.current.stage !== "selected",
        },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Zoom 100%", action: () => setZoom(1) },
        { label: "Zoom 200%", action: () => setZoom(2) },
        { label: "Zoom 400%", action: () => setZoom(4) },
        { label: "Zoom 800%", action: () => setZoom(8) },
        { label: "", divider: true },
        { label: "Zoom In", action: () => {
          const idx = MAGNIFICATIONS.indexOf(zoom as (typeof MAGNIFICATIONS)[number]);
          const next = MAGNIFICATIONS[Math.min(MAGNIFICATIONS.length - 1, idx + 1)];
          if (next !== undefined) setZoom(next);
        }},
        { label: "Zoom Out", action: () => {
          const idx = MAGNIFICATIONS.indexOf(zoom as (typeof MAGNIFICATIONS)[number]);
          const next = MAGNIFICATIONS[Math.max(0, idx - 1)];
          if (next !== undefined) setZoom(next);
        }},
      ],
    },
    {
      label: "Image",
      items: [
        { label: "Flip Horizontal", action: flipHorizontal },
        { label: "Flip Vertical", action: flipVertical },
        { label: "", divider: true },
        { label: "Invert Colors\tCtrl+I", action: invertColors },
        { label: "", divider: true },
        { label: "Clear Image\tCtrl+Shift+N", action: clearImage },
      ],
    },
    {
      label: "Colors",
      items: [{ label: "Edit Colors...", action: () => openColorEditor("fg") }],
    },
    {
      label: "Help",
      items: [{ label: "About Paint", disabled: true }],
    },
  ];

  // Tool option choosers, reproduced 1:1 from jspaint's tool-options.js:
  // canvas-drawn graphics for stroke/eraser/shape-style/brush, PNG sprites for
  // transparent-mode/airbrush/magnification; chosen option on blue (#000080),
  // unselected on gray (#c0c0c0) where jspaint uses gray_background_for_unselected.
  const airbrushSizesJsp = [9, 16, 24];
  const magnificationsJsp = MAGNIFICATIONS;
  const brushChoices: { shape: BrushShape; size: number }[] = [
    { shape: "circle", size: 7 },
    { shape: "circle", size: 4 },
    { shape: "circle", size: 1 },
    { shape: "square", size: 8 },
    { shape: "square", size: 5 },
    { shape: "square", size: 2 },
    { shape: "diagonal", size: 8 },
    { shape: "diagonal", size: 5 },
    { shape: "diagonal", size: 2 },
    { shape: "reverse_diagonal", size: 8 },
    { shape: "reverse_diagonal", size: 5 },
    { shape: "reverse_diagonal", size: 2 },
  ];

  const showOptions = (() => {
    switch (tool) {
      case "lasso":
      case "select":
        // jspaint $choose_transparent_mode: two cells from options-transparency.png
        // (35x45; top = opaque, bottom = transparent). invert:false — only the
        // background flips blue/gray. Each cell is 39 wide (2px margin + 35 + 2).
        return (
          <Chooser>
            {[false, true].map((opt) => {
              const chosen = transparentSelection === opt;
              return (
                <ChooserCell
                  key={String(opt)}
                  $chosen={chosen}
                  $gray
                  onClick={() => setTransparentSelection(opt)}
                  title={opt ? "Transparent" : "Opaque"}
                  style={{ width: 39, height: 25 }}
                >
                  <span
                    style={{
                      display: "block",
                      width: 35,
                      height: 22,
                      backgroundImage:
                        "url(/paint-tools/options-transparency.png)",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: `0 ${opt ? "-22px" : "0"}`,
                      imageRendering: "pixelated",
                    }}
                  />
                </ChooserCell>
              );
            })}
          </Chooser>
        );
      case "text":
        // Text tool options: same transparent/opaque chooser. The font box is a
        // separate toolbar rendered above the workspace (see showFontBox below).
        return (
          <Chooser>
            {[false, true].map((opt) => {
              const chosen = transparentSelection === opt;
              return (
                <ChooserCell
                  key={String(opt)}
                  $chosen={chosen}
                  $gray
                  onClick={() => setTransparentSelection(opt)}
                  title={opt ? "Transparent" : "Opaque"}
                  style={{ width: 39, height: 25 }}
                >
                  <span
                    style={{
                      display: "block",
                      width: 35,
                      height: 22,
                      backgroundImage:
                        "url(/paint-tools/options-transparency.png)",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: `0 ${opt ? "-22px" : "0"}`,
                      imageRendering: "pixelated",
                    }}
                  />
                </ChooserCell>
              );
            })}
          </Chooser>
        );
      case "brush":
        // jspaint $choose_brush: 12 brushes (4 shapes x 3 sizes), each on a 10x10
        // canvas; wrapped row. Rendered with renderBrushShape exactly like jspaint.
        return (
          <ChooserWrap>
            {brushChoices.map((b) => {
              const chosen = brushShape === b.shape && brushSize === b.size;
              return (
                <ChooserCell
                  key={`${b.shape}-${b.size}`}
                  $chosen={chosen}
                  onClick={() => {
                    setBrushShape(b.shape);
                    setBrushSize(b.size);
                  }}
                  title={`${b.shape} brush, size ${b.size}`}
                  style={{ width: 13, height: 13 }}
                >
                  <OptionCanvas
                    w={10}
                    h={10}
                    chosen={chosen}
                    draw={(ctx, color) => {
                      ctx.fillStyle = color;
                      renderBrushShape(ctx, b.shape, b.size);
                    }}
                  />
                </ChooserCell>
              );
            })}
          </ChooserWrap>
        );
      case "eraser":
        // jspaint $choose_eraser_size: 4 square brushes (sizes 4,6,8,10) on 39x16
        // canvases, stacked; selected => blue + white brush.
        return (
          <Chooser>
            {ERASER_SIZES.map((s) => {
              const chosen = eraserSize === s;
              return (
                <ChooserCell
                  key={s}
                  $chosen={chosen}
                  $gray
                  onClick={() => setEraserSize(s)}
                  title={`Eraser size ${s}`}
                  style={{ width: 39, height: 16 }}
                >
                  <OptionCanvas
                    w={39}
                    h={16}
                    chosen={chosen}
                    draw={(ctx, color) => {
                      ctx.fillStyle = color;
                      renderBrushShape(ctx, "square", s);
                    }}
                  />
                </ChooserCell>
              );
            })}
          </Chooser>
        );
      case "airbrush": {
        // jspaint $choose_airbrush_size: 3 cells from options-airbrush-size.png
        // (72x24, each cell 24x24); image inverted when chosen.
        return (
          <ChooserWrap>
            {airbrushSizesJsp.map((s, i) => {
              const chosen = airbrushSize === s;
              const isBottom = i === 2;
              const shrink = isBottom ? 0 : 4;
              const w = 72 / 3 - shrink * 2;
              const srcX = (72 / 3) * i + shrink;
              return (
                <ChooserCell
                  key={s}
                  $chosen={chosen}
                  $gray
                  onClick={() => setAirbrushSize(s)}
                  title={`Airbrush size ${s}`}
                  style={{ width: w, height: 20 }}
                >
                  <span
                    style={{
                      display: "block",
                      width: w,
                      height: 20,
                      backgroundImage:
                        "url(/paint-tools/options-airbrush-size.png)",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: `${-srcX}px 0`,
                      imageRendering: "pixelated",
                      filter: chosen ? "invert(1)" : "none",
                    }}
                  />
                </ChooserCell>
              );
            })}
          </ChooserWrap>
        );
      }
      case "line":
      case "curve":
        // jspaint $choose_stroke_size: 5 horizontal bars (widths 1..5) on 39x12
        // canvases, centered vertically; selected => blue + white bar.
        return (
          <Chooser>
            {LINE_WIDTHS.map((w) => {
              const chosen = lineWidth === w;
              return (
                <ChooserCell
                  key={w}
                  $chosen={chosen}
                  $gray
                  onClick={() => setLineWidth(w)}
                  title={`Line width ${w}`}
                  style={{ width: 39, height: 12 }}
                >
                  <OptionCanvas
                    w={39}
                    h={12}
                    chosen={chosen}
                    draw={(ctx, color) => {
                      ctx.fillStyle = color;
                      const centerY = (12 - w) / 2;
                      ctx.fillRect(5, Math.floor(centerY), 29, w);
                    }}
                  />
                </ChooserCell>
              );
            })}
          </Chooser>
        );
      case "rect":
      case "ellipse":
      case "roundrect":
      case "polygon": {
        // jspaint $ChooseShapeStyle: 3 rects (outline / outline+fill / fill) on
        // 39x21 canvases, stacked; fill uses ButtonShadow, outline uses WindowText.
        const styles: { mode: ShapeMode; outline: boolean; fill: boolean }[] = [
          { mode: "outline", outline: true, fill: false },
          { mode: "outline-fill", outline: true, fill: true },
          { mode: "fill", outline: false, fill: true },
        ];
        return (
          <Chooser>
            {styles.map((st) => {
              const chosen = shapeStyle === st.mode;
              return (
                <ChooserCell
                  key={st.mode}
                  $chosen={chosen}
                  onClick={() => setShapeStyle(st.mode)}
                  title={
                    st.outline && st.fill
                      ? "Outline + fill"
                      : st.fill
                        ? "Solid fill"
                        : "Outline"
                  }
                  style={{ width: 39, height: 21 }}
                >
                  <OptionCanvas
                    w={39}
                    h={21}
                    chosen={chosen}
                    draw={(ctx, color) => {
                      const b = 5;
                      ctx.fillStyle = color;
                      if (st.outline)
                        ctx.fillRect(b, b, 39 - b * 2, 21 - b * 2);
                      ctx.fillStyle = "#808080";
                      const bi = b + 1;
                      if (st.fill)
                        ctx.fillRect(bi, bi, 39 - bi * 2, 21 - bi * 2);
                      else ctx.clearRect(bi, bi, 39 - bi * 2, 21 - bi * 2);
                    }}
                  />
                </ChooserCell>
              );
            })}
          </Chooser>
        );
      }
      case "zoom": {
        // jspaint $choose_magnification: cells from options-magnification.png
        // (92x9, each cell 23x9); image inverted when chosen.
        return (
          <Chooser>
            {magnificationsJsp.map((m, i) => {
              const chosen = zoom === m;
              return (
                <ChooserCell
                  key={m}
                  $chosen={chosen}
                  onClick={() => setZoom(m)}
                  title={`${m * 100}%`}
                  style={{ width: 39, height: 13 }}
                >
                  <span
                    style={{
                      display: "block",
                      width: 23,
                      height: 9,
                      backgroundImage:
                        "url(/paint-tools/options-magnification.png)",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: `${-i * 23}px 0`,
                      imageRendering: "pixelated",
                      filter: chosen ? "invert(1)" : "none",
                    }}
                  />
                </ChooserCell>
              );
            })}
          </Chooser>
        );
      }
      default:
        // pencil / fill / eyedropper have no options in jspaint (empty box).
        return null;
    }
  })();

  // Per-tool cursors, matching jspaint (images/cursors/*.png, hotspot coords).
  const TOOL_CURSOR: Record<ToolId, string> = {
    lasso: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    select: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    eraser: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    fill: `url(/paint-cursors/fill-bucket.png) 8 22, crosshair`,
    eyedropper: `url(/paint-cursors/eye-dropper.png) 9 22, crosshair`,
    zoom: `url(/paint-cursors/magnifier.png) 16 16, zoom-in`,
    pencil: `url(/paint-cursors/pencil.png) 13 23, crosshair`,
    brush: `url(/paint-cursors/precise-dotted.png) 16 16, crosshair`,
    airbrush: `url(/paint-cursors/airbrush.png) 7 22, crosshair`,
    text: "text",
    line: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    curve: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    rect: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    polygon: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    ellipse: `url(/paint-cursors/precise.png) 16 16, crosshair`,
    roundrect: `url(/paint-cursors/precise.png) 16 16, crosshair`,
  };
  const cursorStyle = TOOL_CURSOR[tool];

  // Open the Fonts tool-window (a real OS window) while the text tool is active,
  // and close it otherwise — like jspaint showing/hiding $FontBox with the text tool.
  useEffect(() => {
    if (tool === "text") {
      if (!fontsWindowIdRef.current) {
        const id = openApp("paint-fonts", {
          title: "Fonts",
          data: { paintWindowId: windowId },
        });
        setFontsWindowId(id);
      }
    } else if (fontsWindowIdRef.current) {
      closeWindow(fontsWindowIdRef.current);
      setFontsWindowId(null);
    }
    // Use ref so unmount cleanup always sees the current id (avoids stale closure).
    return () => {
      if (fontsWindowIdRef.current) {
        closeWindow(fontsWindowIdRef.current);
        fontsWindowIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, windowId]);

  // If the user closes the Fonts window manually (via its X button), drop the
  // stale id so the text tool can reopen it next time it's selected.
  const fontsWindowExists = useWindowStore((s) =>
    fontsWindowId ? s.windows.some((w) => w.id === fontsWindowId) : false,
  );
  useEffect(() => {
    if (fontsWindowId && !fontsWindowExists) setFontsWindowId(null);
  }, [fontsWindowId, fontsWindowExists]);

  return (
    <Root onContextMenu={(e) => e.preventDefault()}>
      <MenuBarRow onMouseLeave={() => setOpenMenu(null)}>
        {menus.map((menu) => (
          <div key={menu.label} style={{ position: "relative" }}>
            <MenuTopItem
              $open={openMenu === menu.label}
              onClick={() =>
                setOpenMenu((m) => (m === menu.label ? null : menu.label))
              }
              onMouseEnter={() => setOpenMenu((m) => (m ? menu.label : m))}
            >
              {menu.label}
            </MenuTopItem>
            {openMenu === menu.label && (
              <Dropdown>
                {menu.items.map((item, i) =>
                  item.divider ? (
                    <DropdownDivider key={i} />
                  ) : (
                    <DropdownItem
                      key={item.label}
                      $disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        item.action?.();
                        setOpenMenu(null);
                      }}
                    >
                      {item.label}
                    </DropdownItem>
                  ),
                )}
              </Dropdown>
            )}
          </div>
        ))}
      </MenuBarRow>

      <Workspace>
        <ToolboxCol>
          <ToolGrid>
            {TOOL_GRID.map((t) => (
              <ToolBtn
                key={t}
                $active={tool === t}
                title={TOOL_LABELS[t]}
                onClick={() => setTool(t)}
              >
                <ToolIcon tool={t} />
              </ToolBtn>
            ))}
          </ToolGrid>
          <OptionsBox>{showOptions}</OptionsBox>
        </ToolboxCol>

        <CanvasScroll>
          <CanvasStack
            style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
          >
            <PixelCanvas
              ref={baseCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
            />
            <OverlayCanvas
              ref={overlayCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{
                width: CANVAS_W * zoom,
                height: CANVAS_H * zoom,
                cursor: cursorStyle,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenuCanvas}
            />
            {textEditing && (
              <TextEditOverlay
                ref={textAreaRef}
                $x={textEditing.x}
                $y={textEditing.y}
                $zoom={zoom}
                $font={fontFamily}
                $size={fontSize}
                $bold={fontBold}
                $italic={fontItalic}
                $underline={fontUnderline}
                color={fgColor}
                value={textEditing.value}
                onChange={(e) =>
                  setTextEditing({ ...textEditing, value: e.target.value })
                }
                onBlur={() => commitText()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setTextEditing(null);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitText();
                  }
                }}
              />
            )}
          </CanvasStack>
        </CanvasScroll>
      </Workspace>

      <PaletteRow>
        <CurrentColors
          title="Click to swap foreground/background colors"
          onClick={() => {
            setFgColor(bgColor);
            setBgColor(fgColor);
          }}
        >
          <ColorSquare
            as="button"
            $color={bgColor}
            $back
            onClick={(e) => {
              e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              openColorEditor("bg");
            }}
            title="Background color"
          />
          <ColorSquare
            as="button"
            $color={fgColor}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              openColorEditor("fg");
            }}
            title="Foreground color"
          />
        </CurrentColors>
        <SwatchGrid>
          {PAINT_PALETTE.map((c) => (
            <Swatch
              key={c}
              $color={c}
              title={c}
              onClick={() => setFgColor(c)}
              onMouseDown={(e) => {
                if (e.button === 2) setBgColor(c);
              }}
            />
          ))}
        </SwatchGrid>
      </PaletteRow>

      <StatusBarRow>
        <StatusSeg>{TOOL_LABELS[tool]}</StatusSeg>
        <StatusSeg $w={100}>{cursorLabel}</StatusSeg>
      </StatusBarRow>

      {showNewConfirm && (
        <Overlay onMouseDown={() => setShowNewConfirm(false)}>
          <DialogBox onMouseDown={(e) => e.stopPropagation()}>
            <DialogHeader>Paint</DialogHeader>
            <DialogBody>
              Starting a new picture will erase any unsaved changes. Continue?
            </DialogBody>
            <DialogFooter>
              <Button onClick={doNew}>OK</Button>
              <Button onClick={() => setShowNewConfirm(false)}>Cancel</Button>
            </DialogFooter>
          </DialogBox>
        </Overlay>
      )}

      {colorEditor && (
        <Overlay onMouseDown={() => setColorEditor(null)}>
          <DialogBox onMouseDown={(e) => e.stopPropagation()}>
            <DialogHeader>Edit Colors</DialogHeader>
            <DialogBody>
              <div
                style={{
                  width: "100%",
                  height: 32,
                  marginBottom: 12,
                  background: rgbaToHex(
                    colorEditor.r,
                    colorEditor.g,
                    colorEditor.b,
                  ),
                  border: "2px solid #000",
                }}
              />
              {(["r", "g", "b"] as const).map((channel) => (
                <RgbRow key={channel}>
                  <label>{channel.toUpperCase()}</label>
                  <TextInput
                    type="number"
                    value={colorEditor[channel]}
                    onChange={(e) =>
                      setColorEditor({
                        ...colorEditor,
                        [channel]: Math.max(
                          0,
                          Math.min(255, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    fullWidth
                  />
                </RgbRow>
              ))}
            </DialogBody>
            <DialogFooter>
              <Button onClick={applyColorEditor} primary>
                OK
              </Button>
              <Button onClick={() => setColorEditor(null)}>Cancel</Button>
            </DialogFooter>
          </DialogBox>
        </Overlay>
      )}
    </Root>
  );
}
