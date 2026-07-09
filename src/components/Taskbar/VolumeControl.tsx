import { useEffect, useRef, useState } from "react";
import { Checkbox } from "react95";
import styled from "styled-components";
import { unlockAudio } from "../../lib/audio";
import { useAudioStore } from "../../store/audioStore";
import { Icon } from "../Icon/Icon";
import { Slider95 } from "../Slider95/Slider95";

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;

  &:active {
    outline: 1px dotted #000;
    outline-offset: -2px;
  }
`;

const Popup = styled.div`
  position: fixed;
  bottom: 36px;
  right: 4px;
  z-index: 200001;
  width: 180px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.4);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
`;

const Title = styled.div`
  font-weight: bold;
  text-align: center;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Level = styled.span`
  width: 34px;
  text-align: right;
`;

export function VolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const toggleMuted = useAudioStore((s) => s.toggleMuted);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the popup on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pct = Math.round((muted ? 0 : volume) * 100);

  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center" }}>
      <IconButton
        title={muted ? "Volume (Muted)" : `Volume: ${pct}%`}
        onClick={() => {
          unlockAudio();
          setOpen((o) => !o);
        }}
      >
        <Icon
          src="/icons/mmsys.cpl/001.ico"
          size={16}
          style={{ opacity: muted || volume === 0 ? 0.5 : 1 }}
        />
      </IconButton>
      {open && (
        <Popup>
          <Title>Volume Control</Title>
          <Row style={{ minHeight: 34 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Slider95
                min={0}
                max={100}
                step={1}
                value={Math.round(volume * 100)}
                onChange={(v) => setVolume(v / 100)}
                size="100%"
              />
            </div>
            <Level>{pct}%</Level>
          </Row>
          <Row>
            <Checkbox
              label="Mute"
              checked={muted}
              onChange={() => {
                unlockAudio();
                toggleMuted();
              }}
            />
          </Row>
        </Popup>
      )}
    </div>
  );
}
