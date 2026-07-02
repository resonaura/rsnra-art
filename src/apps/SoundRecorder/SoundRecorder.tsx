import { LegacyIframeApp } from "../../components/LegacyIframeApp";

export function SoundRecorder() {
  return (
    <LegacyIframeApp
      src="/legacy/programs/sound-recorder/index.html"
      title="Sound Recorder"
      allow="microphone"
    />
  );
}
