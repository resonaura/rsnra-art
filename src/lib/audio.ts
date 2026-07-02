// Central audio engine for RSNRA.ART. System sounds are the actual Windows
// Me/95 .wav files from C:\Windows\Media (served from /windows/media/*.wav),
// played through a single master GainNode bound to the volume store
// (src/store/audioStore.ts) — so the tray volume slider controls every sound.
//
// The AudioContext is created lazily on the first `playSound`/`unlockAudio`
// call (browsers require a user gesture). AudioBuffers are fetched + decoded
// once and cached. If a file is missing/fails, we fall back to a synthesized
// oscillator blip so events still make *some* sound.

import { useAudioStore } from "../store/audioStore";

export type SoundName =
  | "startup" // boot chime — intentionally unused (kept for API compat)
  | "error" // Critical Stop → chord.wav
  | "exclamation" // → notify.wav
  | "asterisk" // → chimes.wav
  | "question" // → chord.wav
  | "notify" // New Mail / notify → notify.wav
  | "ding" // Default Beep → ding.wav
  | "recycle" // Empty Recycle Bin → recycle.wav
  | "tada" // a flourish → tada.wav
  | "logoff" // shutdown/logoff → logoff.wav
  | "open"
  | "close"
  | "maximize"
  | "click";

const MEDIA = "/windows/media/";

// Map each event to its Windows Media .wav (lowercased filenames as served).
const FILE_MAP: Partial<Record<SoundName, string>> = {
  error: "chord.wav",
  exclamation: "notify.wav",
  asterisk: "chimes.wav",
  question: "chord.wav",
  notify: "notify.wav",
  ding: "ding.wav",
  recycle: "recycle.wav",
  tada: "tada.wav",
  logoff: "logoff.wav",
  // Light UI feedback — Win95 left these silent by default, but route them to
  // the soft default beep so they're audible when triggered.
  open: "ding.wav",
  close: "ding.wav",
  maximize: "ding.wav",
  click: "start.wav",
  // "startup" intentionally has no file (boot sound excluded per request).
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unsub: (() => void) | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer | null>>();
const inflight = new Set<SoundName>(); // avoid stacking the same sound

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

// Fetch + decode a .wav once, caching the AudioBuffer per URL.
function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (bufferCache.has(url)) return bufferCache.get(url)!;
  const p = (async () => {
    const c = ensureContext();
    if (!c) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return await c.decodeAudioData(arr);
    } catch {
      return null;
    }
  })();
  bufferCache.set(url, p);
  return p;
}

// Synthesized fallback (a short oscillator blip) if the .wav isn't available.
function synthBlip(c: AudioContext, out: GainNode, freq: number): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(env);
  env.connect(out);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Play a named system sound, routed through the master volume gain. */
export function playSound(name: SoundName): void {
  const c = ensureContext();
  if (!c || !master) return;
  if (effectiveGain() === 0) return; // muted / zero — nothing to hear
  if (inflight.has(name)) return;
  const file = FILE_MAP[name];
  if (!file) return; // no mapping (e.g. startup) → silent

  const bus = c.createGain();
  bus.gain.value = 0.9;
  bus.connect(master);

  inflight.add(name);
  const release = () => inflight.delete(name);

  loadBuffer(MEDIA + file).then((buf) => {
    if (buf) {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(bus);
      src.onended = release;
      src.start();
    } else {
      synthBlip(c, bus, name === "error" ? 200 : 880);
      window.setTimeout(release, 220);
    }
  });
}

/** Resume the audio context on a user gesture (call from a click handler). */
export function unlockAudio(): void {
  ensureContext();
}
