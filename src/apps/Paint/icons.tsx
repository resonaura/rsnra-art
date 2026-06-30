// Authentic MS Paint (jspaint) pixel-art tool icons.
// Source: https://github.com/1j01/jspaint — images/classic/tools.png sprite,
// sliced into per-tool 16x16 PNGs in /paint-tools/.

export type ToolId =
  | "select"
  | "lasso"
  | "eraser"
  | "fill"
  | "eyedropper"
  | "zoom"
  | "pencil"
  | "brush"
  | "airbrush"
  | "text"
  | "line"
  | "curve"
  | "rect"
  | "polygon"
  | "ellipse"
  | "roundrect";

// Classic MS Paint tool order (matches jspaint's `tools` array / tools.png sprite).
export const TOOL_GRID: ToolId[] = [
  "lasso",
  "select",
  "eraser",
  "fill",
  "eyedropper",
  "zoom",
  "pencil",
  "brush",
  "airbrush",
  "text",
  "line",
  "curve",
  "rect",
  "polygon",
  "ellipse",
  "roundrect",
];

export const TOOL_LABELS: Record<ToolId, string> = {
  select: "Select",
  lasso: "Free-Form Select",
  eraser: "Eraser/Color Eraser",
  fill: "Fill With Color",
  eyedropper: "Pick Color",
  zoom: "Magnifier",
  pencil: "Pencil",
  brush: "Brush",
  airbrush: "Airbrush",
  text: "Text",
  line: "Line",
  curve: "Curve",
  rect: "Rectangle",
  polygon: "Polygon",
  ellipse: "Ellipse",
  roundrect: "Rounded Rectangle",
};

const TOOL_ICON_SRC: Record<ToolId, string> = {
  lasso: "/paint-tools/tool-lasso.png",
  select: "/paint-tools/tool-select.png",
  eraser: "/paint-tools/tool-eraser.png",
  fill: "/paint-tools/tool-fill.png",
  eyedropper: "/paint-tools/tool-eyedropper.png",
  zoom: "/paint-tools/tool-zoom.png",
  pencil: "/paint-tools/tool-pencil.png",
  brush: "/paint-tools/tool-brush.png",
  airbrush: "/paint-tools/tool-airbrush.png",
  text: "/paint-tools/tool-text.png",
  line: "/paint-tools/tool-line.png",
  curve: "/paint-tools/tool-curve.png",
  rect: "/paint-tools/tool-rect.png",
  polygon: "/paint-tools/tool-polygon.png",
  ellipse: "/paint-tools/tool-ellipse.png",
  roundrect: "/paint-tools/tool-roundrect.png",
};

export function ToolIcon({ tool }: { tool: ToolId }) {
  return (
    <img
      src={TOOL_ICON_SRC[tool]}
      alt=""
      draggable={false}
      width={16}
      height={16}
      style={{ imageRendering: "pixelated", pointerEvents: "none" }}
    />
  );
}
