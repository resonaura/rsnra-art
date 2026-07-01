// Central audio engine for RSNRA 95. All in-app sound is synthesized here and
// routed through a single master GainNode whose value is bound to the volume
// store (src/store/audioStore.ts), so the tray volume slider is the one knob
// that controls every sound the desktop makes.
//
// The AudioContext is created lazily on the first `playSound` call (browsers
// require a user gesture to start audio) and resumed if it's been suspended.

import { useAudioStore } from "../store/audioStore";

export type SoundName =
  | "startup"
  | "click"
  | "open"
  | "close"
  | "error"
  | "notify"
  | "chord"
  | "maximize";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unsub: (() => void) | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = effectiveGain();
    master.connect(ctx.destination);
    // Keep the master gain in sync with the volume store.
    unsub?.();
    unsub = useAudioStore.subscribe((s) => {
      if (master && ctx) {
        master.gain.setTargetAtTime(effectiveGain(s), ctx.currentTime, 0.01);
      }
    });
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function effectiveGain(s = useAudioStore.getState()): number {
  return s.muted ? 0 : s.volume;
}

// A short oscillator "blip" with an exponential decay envelope.
function blip(
  c: AudioContext,
  out: GainNode,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  peak = 0.9,
): void {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env);
  env.connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// Sound definitions: each schedules notes against the shared context + a
// per-sound gain (so individual sounds can be balanced).
const SOUNDS: Record<SoundName, (c: AudioContext, out: GainNode) => void> = {
  startup: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 523.25, t, 0.5, "triangle", 0.5);
    blip(c, out, 659.25, t + 0.12, 0.5, "triangle", 0.5);
    blip(c, out, 783.99, t + 0.24, 0.7, "triangle", 0.5);
  },
  open: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 440, t, 0.08, "square", 0.25);
  },
  close: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 330, t, 0.08, "square", 0.22);
  },
  maximize: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 660, t, 0.06, "square", 0.2);
  },
  click: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 1800, t, 0.03, "square", 0.12);
  },
  error: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 200, t, 0.18, "sawtooth", 0.4);
    blip(c, out, 200, t + 0.22, 0.18, "sawtooth", 0.4);
  },
  notify: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 880, t, 0.12, "sine", 0.35);
    blip(c, out, 1174.66, t + 0.1, 0.18, "sine", 0.3);
  },
  chord: (c, out) => {
    const t = c.currentTime;
    blip(c, out, 392, t, 0.4, "triangle", 0.3);
    blip(c, out, 523.25, t, 0.4, "triangle", 0.3);
    blip(c, out, 659.25, t, 0.4, "triangle", 0.3);
  },
};

/** Play a named UI sound, routed through the master volume gain. */
export function playSound(name: SoundName): void {
  const c = ensureContext();
  if (!c || !master) return;
  if (effectiveGain() === 0) return; // muted / zero — nothing to hear
  const bus = c.createGain();
  bus.gain.value = 0.8;
  bus.connect(master);
  SOUNDS[name]?.(c, bus);
}

/** Resume the audio context on a user gesture (call from a click handler). */
export function unlockAudio(): void {
  ensureContext();
}
