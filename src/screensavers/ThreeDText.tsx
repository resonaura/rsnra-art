import { useRef, useState, type ChangeEvent } from "react";
import { Button, GroupBox, Radio, Select, TextInput } from "react95";
import { useSaverCanvas } from "./useSaverCanvas";
import type {
  ScreenSaverProps,
  ScreenSaverSettings,
  ScreenSaverSettingsPanelProps,
} from "./types";
import { SystemDialog } from "../components/SystemDialog/SystemDialog";
import { Slider95 } from "../components/Slider95/Slider95";
import { ColorPickerDialog } from "../components/ColorPickerDialog/ColorPickerDialog";

const DEFAULTS: Required<ScreenSaverSettings> = {
  text: "Windows 2000",
  mode: "text",
  speed: 50,
  size: 65,
  resolution: 70,
  count: 2,
  rotation: "spin",
  surfaceStyle: "solid",
  fontFamily: "Tahoma",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  palette: "dvd",
};

function resolved(settings?: ScreenSaverSettings): Required<ScreenSaverSettings> {
  return { ...DEFAULTS, ...settings };
}

/** A small canvas-based take on the classic Windows 2000 3D Text saver. */
export function ThreeDText({ preview, settings }: ScreenSaverProps) {
  const options = resolved(settings);
  const rotationStyle = useRef<NonNullable<ScreenSaverSettings["rotation"]> | null>(null);
  if (rotationStyle.current === null) {
    const rotations = ["spin", "tumble", "wobble"] as const;
    rotationStyle.current = options.rotation === "random"
      ? rotations[Math.floor(Math.random() * rotations.length)]
      : options.rotation;
  }
  const ref = useSaverCanvas((ctx, w, h, t) => {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    const baseSize = preview
      ? Math.max(12, Math.round(h * 0.19))
      : Math.max(32, Math.round(h * 0.15));
    const size = baseSize * (options.size / 65);
    const label = options.mode === "time"
      ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : options.text || "Windows 2000";
    const speed = options.speed / 50;
    const phase = t * 0.00035 * speed;
    const fontFamily = ["Arial", "Tahoma", "Times New Roman", "Courier New"].includes(options.fontFamily)
      ? options.fontFamily
      : "Arial";
    ctx.font = `bold ${size}px "${fontFamily}", sans-serif`;
    const textWidth = ctx.measureText(label).width;
    // Win2K's text can rotate through 90°, so fitting only against screen
    // width clips long labels when they turn upright. Keep the whole line
    // inside the smaller screen dimension whenever rotation is enabled.
    const fitWidth = rotationStyle.current === "none"
      ? w * 0.72
      : Math.min(w, h) * 0.72;
    const fit = Math.min(1, fitWidth / Math.max(textWidth, 1));
    const marginX = Math.min(w / 2, (textWidth * fit) / 2 + size * 0.3);
    const marginY = Math.min(h / 2, size * 1.1);
    const cx = marginX + (w - marginX * 2) * (0.5 + 0.5 * Math.cos(phase * 0.72));
    const cy = marginY + (h - marginY * 2) * (0.5 + 0.5 * Math.sin(phase * 0.9));

    ctx.save();
    ctx.translate(cx, cy);
    const rotation = rotationStyle.current === "spin"
      ? phase
      : rotationStyle.current === "tumble"
        ? Math.sin(phase) * 0.62
        : rotationStyle.current === "wobble"
          ? Math.sin(phase * 1.7) * 0.18
          : 0;
    ctx.rotate(rotation);
    const squeeze = rotationStyle.current === "tumble"
      ? Math.max(0.28, Math.abs(Math.cos(phase * 0.7)))
      : rotationStyle.current === "wobble"
        ? 0.88 + Math.sin(phase * 1.3) * 0.12
        : 1;
    ctx.scale(squeeze * fit, fit);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    const depth = preview
      ? Math.max(1, Math.round(options.resolution / 35))
      : Math.max(2, Math.round(2 + options.resolution / 12));
    for (let layer = depth; layer > 0; layer -= 1) {
      ctx.fillStyle = layer > depth * 0.65 ? "#343434" : "#777777";
      ctx.fillText(label, layer * (preview ? 0.65 : 1.5), layer * (preview ? 0.65 : 1.5));
    }

    const face = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    if (options.surfaceStyle === "textured") {
      face.addColorStop(0, "#f4f6f8");
      face.addColorStop(0.16, options.textColor);
      face.addColorStop(0.42, "#aab4c0");
      face.addColorStop(0.58, "#ffffff");
      face.addColorStop(0.82, options.textColor);
      face.addColorStop(1, "#667080");
    } else {
      face.addColorStop(0, options.textColor);
      face.addColorStop(1, options.textColor === "#ffffff" ? "#bfc7d0" : options.textColor);
    }
    ctx.fillStyle = face;
    ctx.strokeStyle = "rgba(0,0,0,.8)";
    ctx.lineWidth = preview ? 0.6 : 1.5;
    ctx.strokeText(label, 0, 0);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  return <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />;
}

export function ThreeDTextSettings({ settings, onApply, onCancel }: ScreenSaverSettingsPanelProps) {
  // Local settings are initialized once when the dialog opens; edits remain
  // private until OK so Cancel has the same semantics as Windows' dialog.
  const [state, setState] = useState<Required<ScreenSaverSettings>>(resolved(settings));
  const [colorPicker, setColorPicker] = useState<"textColor" | "backgroundColor" | null>(null);

  const set = (patch: Partial<Required<ScreenSaverSettings>>) => setState((prev) => ({ ...prev, ...patch }));
  const ColorRow = ({ field, label }: { field: "textColor" | "backgroundColor"; label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flex: 1 }}>{label}:</span>
      <button
        type="button"
        aria-label={`Choose ${label.toLowerCase()}`}
        onClick={() => setColorPicker(field)}
        style={{ width: 54, height: 22, background: state[field], border: "2px solid #808080", boxShadow: "inset 1px 1px #fff", cursor: "pointer" }}
      />
      <code>{state[field]}</code>
    </div>
  );

  return (
    <SystemDialog title="3D Text Setup" width={390} onClose={onCancel}>
      <div style={{ padding: "10px 12px 9px", display: "flex", flexDirection: "column", gap: 8 }}>
        <GroupBox label="Display">
          <Radio label="Text" checked={state.mode === "text"} onChange={() => set({ mode: "text" })} />
          <TextInput
            value={state.text}
            disabled={state.mode !== "text"}
            onChange={(event: ChangeEvent<HTMLInputElement>) => set({ text: event.target.value })}
            fullWidth
            style={{ margin: "4px 0 7px" }}
          />
          <Radio label="Time" checked={state.mode === "time"} onChange={() => set({ mode: "time" })} />
        </GroupBox>
        <GroupBox label="Spin Style">
          <Select
            value={state.rotation}
            onChange={(option: { value: string }) => set({ rotation: option.value as Required<ScreenSaverSettings>["rotation"] })}
            options={[
              { value: "random", label: "Random" },
              { value: "spin", label: "Spin" },
              { value: "tumble", label: "Tumble" },
              { value: "wobble", label: "Wobble" },
              { value: "none", label: "None" },
            ]}
            style={{ width: "100%" }}
          />
        </GroupBox>
        <GroupBox label="Size">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>Small</span>
            <Slider95 value={state.size} min={20} max={100} size="100%" onChange={(size) => set({ size })} />
            <span>Large</span>
          </div>
        </GroupBox>
        <GroupBox label="Speed">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>Slow</span>
            <Slider95 value={state.speed} min={1} max={100} size="100%" onChange={(speed) => set({ speed })} />
            <span>Fast</span>
          </div>
        </GroupBox>
        <GroupBox label="Resolution">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>Low</span>
            <Slider95 value={state.resolution} min={10} max={100} size="100%" onChange={(resolution) => set({ resolution })} />
            <span>High</span>
          </div>
        </GroupBox>
        <GroupBox label="Surface Style">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Radio label="Solid Color" checked={state.surfaceStyle === "solid"} onChange={() => set({ surfaceStyle: "solid" })} />
            <Radio label="Textured" checked={state.surfaceStyle === "textured"} onChange={() => set({ surfaceStyle: "textured" })} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ColorRow field="textColor" label="Text color" />
            <ColorRow field="backgroundColor" label="Background" />
          </div>
        </GroupBox>
        <GroupBox label="Font">
          <Select
            value={state.fontFamily}
            onChange={(option: { value: string }) => set({ fontFamily: option.value })}
            options={["Arial", "Tahoma", "Times New Roman", "Courier New"].map((font) => ({ value: font, label: font }))}
            style={{ width: "100%" }}
          />
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
