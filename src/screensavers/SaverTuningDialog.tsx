import { useState } from "react";
import { Button, GroupBox } from "react95";
import { Slider95 } from "../components/Slider95/Slider95";
import { SystemDialog } from "../components/SystemDialog/SystemDialog";
import type { ScreenSaverSettingsPanelProps } from "./types";

type TuningKey = "speed" | "count";

interface TuningField {
  key: TuningKey;
  label: string;
  min: number;
  max: number;
  initial: number;
  lowLabel: string;
  highLabel: string;
}

interface SaverTuningDialogProps extends ScreenSaverSettingsPanelProps {
  title: string;
  fields: readonly TuningField[];
}

function SaverTuningDialog({
  title,
  fields,
  settings,
  onApply,
  onCancel,
}: SaverTuningDialogProps) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map(({ key, initial }) => [key, settings[key] ?? initial]),
    ) as Record<TuningKey, number>,
  );

  return (
    <SystemDialog title={title} width={350} onClose={onCancel}>
      <div style={{ padding: "10px 12px 9px", display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map((field) => (
          <GroupBox key={field.key} label={field.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>{field.lowLabel}</span>
              <Slider95
                value={values[field.key] ?? field.initial}
                min={field.min}
                max={field.max}
                size="100%"
                onChange={(value) => setValues((previous) => ({ ...previous, [field.key]: value }))}
              />
              <span>{field.highLabel}</span>
            </div>
          </GroupBox>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <Button primary style={{ width: 72 }} onClick={() => onApply({ ...settings, ...values })}>OK</Button>
          <Button style={{ width: 72 }} onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </SystemDialog>
  );
}

const MYSTIFY_FIELDS: readonly TuningField[] = [
  { key: "speed", label: "Speed", min: 1, max: 100, initial: 50, lowLabel: "Slow", highLabel: "Fast" },
  { key: "count", label: "Lines", min: 1, max: 6, initial: 2, lowLabel: "Few", highLabel: "Many" },
];

const STARFIELD_FIELDS: readonly TuningField[] = [
  { key: "speed", label: "Speed", min: 1, max: 100, initial: 50, lowLabel: "Slow", highLabel: "Fast" },
  { key: "count", label: "Number of stars", min: 40, max: 400, initial: 220, lowLabel: "Few", highLabel: "Many" },
];

const FLOWERBOX_FIELDS: readonly TuningField[] = [
  { key: "speed", label: "Speed", min: 1, max: 100, initial: 50, lowLabel: "Slow", highLabel: "Fast" },
];

export function MystifySettings(props: ScreenSaverSettingsPanelProps) {
  return <SaverTuningDialog title="Mystify Your Mind Settings" fields={MYSTIFY_FIELDS} {...props} />;
}

export function StarfieldSettings(props: ScreenSaverSettingsPanelProps) {
  return <SaverTuningDialog title="Starfield Settings" fields={STARFIELD_FIELDS} {...props} />;
}

export function FlowerBoxSettings(props: ScreenSaverSettingsPanelProps) {
  return <SaverTuningDialog title="3D Flower Box Settings" fields={FLOWERBOX_FIELDS} {...props} />;
}
