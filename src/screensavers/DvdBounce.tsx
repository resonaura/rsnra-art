import { useRef, useState } from "react";
import { Button, GroupBox, Select } from "react95";
import { Slider95 } from "../components/Slider95/Slider95";
import { SystemDialog } from "../components/SystemDialog/SystemDialog";
import { useSaverCanvas } from "./useSaverCanvas";
import type {
  ScreenSaverProps,
  ScreenSaverSettings,
  ScreenSaverSettingsPanelProps,
} from "./types";

// DVD-logo bouncing screensaver — the iconic meme screensaver.
// Bounces a colored "DVD" logo around the screen, changing color when hitting a wall.
// Color change on corner hit is legendary.

const DVD_CLASSIC_COLORS = [
  "#51688e",
  "#344c73",
  "#7183a0",
  "#8a9bb5",
  "#405a83",
  "#637b9d",
];

const WINDOWS_COLORS = [
  "#000000", "#800000", "#008000", "#808000",
  "#000080", "#800080", "#008080", "#c0c0c0",
  "#808080", "#ff0000", "#00ff00", "#ffff00",
  "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
];

const SPECTRUM_COLORS = [
  "#ff0000", // red
  "#00ff00", // green
  "#0000ff", // blue
  "#ffff00", // yellow
  "#ff00ff", // magenta
  "#00ffff", // cyan
  "#ffffff", // white
  "#808080", // gray
];

const PALETTES: Record<NonNullable<ScreenSaverSettings["palette"]>, string[]> = {
  dvd: DVD_CLASSIC_COLORS,
  windows: WINDOWS_COLORS,
  spectrum: SPECTRUM_COLORS,
};

interface State {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colorIdx: number;
  lastT: number;
}

export function DvdBounce({ preview, settings }: ScreenSaverProps) {
  const state = useRef<State | null>(null);
  const palette = PALETTES[settings?.palette ?? "dvd"];
  const logoW = preview ? 32 : 120;
  const logoH = preview ? 16 : 56;

  const ref = useSaverCanvas((ctx, w, h, t) => {
    if (!state.current) {
      const speed = (preview ? 40 : 90) * Math.max(0.15, (settings?.speed ?? 50) / 50);
      state.current = {
        x: Math.random() * Math.max(0, w - logoW),
        y: Math.random() * Math.max(0, h - logoH),
        vx: speed * (Math.random() > 0.5 ? 1 : -1),
        vy: speed * (Math.random() > 0.5 ? 1 : -1),
        colorIdx: 0,
        lastT: t,
      };
    }

    const s = state.current;
    const dt = Math.min(0.08, (t - s.lastT) / 1000);
    s.lastT = t;

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    let hitCorner = false;
    let bounced = false;

    if (s.x <= 0) {
      s.x = 0;
      s.vx = Math.abs(s.vx);
      bounced = true;
    } else if (s.x + logoW >= w) {
      s.x = w - logoW;
      s.vx = -Math.abs(s.vx);
      bounced = true;
    }

    if (s.y <= 0) {
      s.y = 0;
      s.vy = Math.abs(s.vy);
      if (bounced) hitCorner = true;
      bounced = true;
    } else if (s.y + logoH >= h) {
      s.y = h - logoH;
      s.vy = -Math.abs(s.vy);
      if (bounced) hitCorner = true;
      bounced = true;
    }

    if (bounced) {
      s.colorIdx = (s.colorIdx + 1) % palette.length;
    }

    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Draw DVD logo text
    const color = palette[s.colorIdx];
    const fontSize = preview ? 10 : 36;
    const smallFontSize = preview ? 5 : 14;

    ctx.save();
    ctx.translate(s.x, s.y);

    // Outer oval / background
    ctx.beginPath();
    ctx.ellipse(
      logoW / 2,
      logoH / 2,
      logoW / 2 - 1,
      logoH / 2 - 1,
      0,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = preview ? 1 : 2;
    ctx.stroke();

    // "DVD" text
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DVD", logoW / 2, logoH / 2 - (preview ? 2 : 6));

    // "VIDEO" small text below
    ctx.font = `${smallFontSize}px 'Arial', sans-serif`;
    ctx.fillText("VIDEO", logoW / 2, logoH / 2 + (preview ? 4 : 16));

    ctx.restore();

    // Corner hit flash effect
    if (hitCorner) {
      ctx.fillStyle = `${color}22`;
      ctx.fillRect(0, 0, w, h);
    }
  });

  return (
    <canvas
      ref={ref}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}

const DEFAULT_SETTINGS: Required<ScreenSaverSettings> = {
  text: "Windows 2000",
  mode: "text",
  speed: 50,
  size: 65,
  resolution: 70,
  count: 2,
  rotation: "spin",
  surfaceStyle: "solid",
  fontFamily: "Arial",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  palette: "dvd",
};

export function DvdBounceSettings({ settings, onApply, onCancel }: ScreenSaverSettingsPanelProps) {
  const [state, setState] = useState({ ...DEFAULT_SETTINGS, ...settings });
  const set = (patch: Partial<Required<ScreenSaverSettings>>) =>
    setState((previous) => ({ ...previous, ...patch }));

  return (
    <SystemDialog title="DVD Logo Settings" width={340} onClose={onCancel}>
      <div style={{ padding: "10px 12px 9px", display: "flex", flexDirection: "column", gap: 10 }}>
        <GroupBox label="Logo colors">
          <Select
            value={state.palette}
            onChange={(option: { value: string }) => set({ palette: option.value as Required<ScreenSaverSettings>["palette"] })}
            options={[
              { value: "dvd", label: "DVD blue and silver" },
              { value: "windows", label: "Windows 16 colors" },
              { value: "spectrum", label: "Full spectrum" },
            ]}
            style={{ width: "100%" }}
          />
          <div aria-hidden="true" style={{ display: "flex", height: 12, marginTop: 8, border: "1px solid #808080" }}>
            {PALETTES[state.palette].slice(0, 8).map((color) => (
              <span key={color} style={{ flex: 1, background: color }} />
            ))}
          </div>
        </GroupBox>
        <GroupBox label="Speed">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>Slow</span>
            <Slider95 value={state.speed} min={1} max={100} size="100%" onChange={(speed) => set({ speed })} />
            <span>Fast</span>
          </div>
        </GroupBox>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <Button primary style={{ width: 72 }} onClick={() => onApply(state)}>OK</Button>
          <Button style={{ width: 72 }} onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </SystemDialog>
  );
}
