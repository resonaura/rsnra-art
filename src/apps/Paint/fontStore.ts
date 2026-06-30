import { create } from "zustand";

export interface PaintFont {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export const DEFAULT_FONT: PaintFont = {
  family: "Arial",
  size: 12,
  bold: false,
  italic: false,
  underline: false,
};

// Shared font settings per Paint window, so the (separate OS-window) Fonts box
// and the Paint instance itself read/write the same state. Matches jspaint,
// where the Fonts tool-window and the text tool share `text_tool_font`.
interface PaintFontState {
  fonts: Record<string, PaintFont>;
  getFont: (paintWindowId: string) => PaintFont;
  setFont: (paintWindowId: string, patch: Partial<PaintFont>) => void;
}

export const usePaintFontStore = create<PaintFontState>((set, get) => ({
  fonts: {},
  getFont: (paintWindowId) => get().fonts[paintWindowId] ?? DEFAULT_FONT,
  setFont: (paintWindowId, patch) =>
    set((state) => ({
      fonts: {
        ...state.fonts,
        [paintWindowId]: {
          ...(state.fonts[paintWindowId] ?? DEFAULT_FONT),
          ...patch,
        },
      },
    })),
}));
