import { useRef, useState, type ChangeEvent } from "react";
import { Button, GroupBox, TextInput } from "react95";
import { useSaverCanvas } from "./useSaverCanvas";
import type { ScreenSaverProps, ScreenSaverSettings, ScreenSaverSettingsPanelProps } from "./types";
import { SystemDialog } from "../components/SystemDialog/SystemDialog";
import { Slider95 } from "../components/Slider95/Slider95";
import { ColorPickerDialog } from "../components/ColorPickerDialog/ColorPickerDialog";

export const MARQUEE_DEFAULT_TEXT = "Windows 2000";

const DEFAULTS: Required<ScreenSaverSettings> = {
  text: MARQUEE_DEFAULT_TEXT,
  mode: "text",
  speed: 50,
  size: 65,
  resolution: 70,
  count: 2,
  rotation: "none",
  surfaceStyle: "solid",
  fontFamily: "Arial",
  textColor: "#ffff00",
  backgroundColor: "#000000",
  palette: "dvd",
};

function resolved(settings?: ScreenSaverSettings): Required<ScreenSaverSettings> {
  return { ...DEFAULTS, ...settings };
}

// Scrolling Marquee — text drifting right-to-left across a black screen.
export function Marquee({ preview, settings }: ScreenSaverProps) {
  const options = resolved(settings);
  const offset = useRef<number | null>(null);
  const last = useRef(0);

  const ref = useSaverCanvas((ctx, w, h, t) => {
    const dt = Math.min(0.1, (t - last.current) / 1000);
    last.current = t;

    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    const size = preview ? 14 : Math.round(h * 0.09);
    ctx.font = `bold ${size}px 'ms_sans_serif', sans-serif`;
    ctx.textBaseline = "middle";
    const text = options.text || MARQUEE_DEFAULT_TEXT;
    const tw = ctx.measureText(text).width;

    if (offset.current === null) offset.current = w;
    offset.current -= dt * (preview ? 30 : 120) * (options.speed / 50);
    if (offset.current < -tw) offset.current = w;

    ctx.fillStyle = options.textColor;
    ctx.fillText(text, offset.current, h / 2);
  });

  return <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />;
}

export function MarqueeSettings({ settings, onApply, onCancel }: ScreenSaverSettingsPanelProps) {
  const [state, setState] = useState<Required<ScreenSaverSettings>>(resolved(settings));
  const [colorPicker, setColorPicker] = useState<"textColor" | "backgroundColor" | null>(null);
  const set = (patch: Partial<Required<ScreenSaverSettings>>) => setState((prev) => ({ ...prev, ...patch }));

  return (
    <SystemDialog title="Scrolling Marquee Settings" width={360} onClose={onCancel}>
      <div style={{ padding: "10px 12px 9px", display: "flex", flexDirection: "column", gap: 9 }}>
        <GroupBox label="Marquee text">
          <TextInput
            value={state.text}
            onChange={(event: ChangeEvent<HTMLInputElement>) => set({ text: event.target.value })}
            fullWidth
            autoFocus
          />
        </GroupBox>
        <GroupBox label="Speed">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>Slow</span>
            <Slider95 value={state.speed} min={1} max={100} size="100%" onChange={(speed) => set({ speed })} />
            <span>Fast</span>
          </div>
        </GroupBox>
        <GroupBox label="Colors">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(["textColor", "backgroundColor"] as const).map((field) => (
              <div key={field} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{field === "textColor" ? "Text color:" : "Background:"}</span>
                <button
                  type="button"
                  aria-label={`Choose ${field}`}
                  onClick={() => setColorPicker(field)}
                  style={{ width: 54, height: 22, background: state[field], border: "2px solid #808080", boxShadow: "inset 1px 1px #fff", cursor: "pointer" }}
                />
                <code>{state[field]}</code>
              </div>
            ))}
          </div>
        </GroupBox>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <Button primary style={{ width: 72 }} onClick={() => onApply(state)}>OK</Button>
          <Button style={{ width: 72 }} onClick={onCancel}>Cancel</Button>
        </div>
      </div>
      {colorPicker && (
        <ColorPickerDialog
          title={colorPicker === "textColor" ? "Text Color" : "Background Color"}
          color={state[colorPicker]}
          onPick={(color) => set({ [colorPicker]: color })}
          onClose={() => setColorPicker(null)}
        />
      )}
    </SystemDialog>
  );
}
