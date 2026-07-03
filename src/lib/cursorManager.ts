import { parseAni } from "./aniParser";
import { parseCur } from "./curParser";

interface AniState {
  frames: string[]; // Blob Object URLs
  rate: number[];
  seq?: number[];
  hotspot: [number, number];
  currentStep: number;
  timerId: any;
}

const activeAnimations: Record<string, AniState> = {};
const curHotspotCache: Record<string, [number, number]> = {};
const aniHotspotCache: Record<string, [number, number]> = {};
const curBlobUrlCache: Record<string, string> = {};

async function fetchCurHotspot(url: string): Promise<[number, number]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [0, 0];
    const buffer = await res.arrayBuffer();
    const view = new DataView(buffer);
    if (buffer.byteLength > 14 && view.getUint16(2, true) === 2) {
      return [view.getUint16(10, true), view.getUint16(12, true)];
    }
  } catch (e) {
    console.error("Error reading cursor hotspot:", e);
  }
  return [0, 0];
}

export async function prefetchHotspot(file: string, url: string, shadowEnabled = true): Promise<[number, number]> {
  if (file.endsWith(".ani") || file.endsWith(".ANI")) {
    if (aniHotspotCache[file]) return aniHotspotCache[file];
    return [0, 0];
  }
  if (curHotspotCache[file]) return curHotspotCache[file];

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const buffer = await res.arrayBuffer();
    const parsed = await parseCur(buffer, file, shadowEnabled);
    curHotspotCache[file] = parsed.hotspot;
    curBlobUrlCache[file] = parsed.blobUrl;
    return parsed.hotspot;
  } catch (e) {
    console.error("Failed to parse CUR file, using raw fallback:", file, e);
    const hs = await fetchCurHotspot(url);
    curHotspotCache[file] = hs;
    return hs;
  }
}

export function getCachedHotspot(file: string): [number, number] {
  if (file.endsWith(".ani") || file.endsWith(".ANI")) {
    return aniHotspotCache[file] || [0, 0];
  }
  return curHotspotCache[file] || [0, 0];
}

export function getResolvedCursorUrl(file: string): string {
  return curBlobUrlCache[file] || `/cursors/${file}`;
}

export async function startAni(file: string, url: string, shadowEnabled = true): Promise<[number, number]> {
  if (activeAnimations[file]) {
    return activeAnimations[file].hotspot;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return [0, 0];
    const buffer = await res.arrayBuffer();
    const parsed = await parseAni(buffer);

    const frameUrls = await Promise.all(
      parsed.frames.map(async (blob, idx) => {
        const frameBuf = await blob.arrayBuffer();
        const frameParsed = await parseCur(frameBuf, `${file}_frame_${idx}.cur`, shadowEnabled);
        return frameParsed.blobUrl;
      })
    );
    aniHotspotCache[file] = parsed.hotspot;

    const state: AniState = {
      frames: frameUrls,
      rate: parsed.rate,
      seq: parsed.seq,
      hotspot: parsed.hotspot,
      currentStep: 0,
      timerId: null,
    };

    activeAnimations[file] = state;

    const safeName = file.replace(/[^a-zA-Z0-9-]/g, "-");

    const tick = () => {
      const step = state.currentStep;
      const frameIdx = state.seq ? state.seq[step] : step;
      if (frameIdx >= 0 && frameIdx < state.frames.length) {
        const frameUrl = state.frames[frameIdx];
        document.documentElement.style.setProperty(
          `--cursor-anim-url-${safeName}`,
          `url("${frameUrl}")`
        );
      }

      const duration = state.rate[step] || 100;
      state.currentStep = (step + 1) % (state.seq ? state.seq.length : state.frames.length);
      state.timerId = setTimeout(tick, duration);
    };

    tick();
    return parsed.hotspot;
  } catch (e) {
    console.error("Failed to load animated cursor:", file, e);
    return [0, 0];
  }
}

export function stopAni(file: string) {
  const state = activeAnimations[file];
  if (!state) return;

  if (state.timerId) {
    clearTimeout(state.timerId);
  }
  state.frames.forEach((url) => URL.revokeObjectURL(url));
  delete activeAnimations[file];
  delete aniHotspotCache[file];
}

export function stopAllAnimations() {
  Object.keys(activeAnimations).forEach(stopAni);
}

export function clearCurBlobCache() {
  Object.values(curBlobUrlCache).forEach((url) => {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  });
  Object.keys(curBlobUrlCache).forEach((key) => delete curBlobUrlCache[key]);
  Object.keys(curHotspotCache).forEach((key) => delete curHotspotCache[key]);
}

export async function initActiveSchemeCursors(files: Record<string, string>, shadowEnabled = true) {
  stopAllAnimations();
  clearCurBlobCache();

  const promises = Object.entries(files).map(async ([_, file]) => {
    const isAni = file.endsWith(".ani") || file.endsWith(".ANI");
    const url = `/cursors/${file}`;
    if (isAni) {
      await startAni(file, url, shadowEnabled);
    } else {
      await prefetchHotspot(file, url, shadowEnabled);
    }
  });

  await Promise.all(promises);
}
