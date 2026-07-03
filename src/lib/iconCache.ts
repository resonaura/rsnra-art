import { decodeIco } from "./icoParser";

// Every icon on disk now lives as a source .ico (multi-resolution) under
// /icons, with the old pre-baked PNGs kept under /icons/legacy as a
// fallback of last resort. This resolves a legacy-style "/icons/name.ico"
// (or "name.ico") reference to a PNG actually decoded, in-browser, from the
// frame closest to the size it's being displayed at.
//
// The legacy PNG is used ONLY when the .ico genuinely doesn't exist (fetch
// 404s) or fails to parse — never as an optimistic placeholder while a real
// .ico is still loading. `resolvedCache` lets callers check synchronously
// (during render) whether a given icon+size has already been decoded, so
// repeat renders of an already-seen icon never flash anything.

// The actual sizes Windows .ico files ship frames at. Bucket to the
// *nearest* one (not the next one up) so e.g. an 18px request lands on the
// native 16px frame instead of skipping past it to grab — and blurrily
// downscale — a 32px frame.
const STEPS = [16, 24, 32, 48, 64, 96, 128, 256];
function roundSize(size: number): number {
  return STEPS.reduce((best, s) =>
    Math.abs(s - size) < Math.abs(best - size) ? s : best,
  );
}

function iconNameFromSrc(src: string): string | null {
  const m = src.match(/\/icons\/([^/]+?)(?:\.(?:png|ico))?$/i);
  return m ? m[1] : null;
}

export function legacyIconUrl(src: string): string {
  const name = iconNameFromSrc(src);
  return name ? `/icons/legacy/${name}.png` : src;
}

function cacheKey(src: string, size: number): string | null {
  const name = iconNameFromSrc(src);
  if (!name || !src.startsWith("/icons/")) return null;
  return `${name}@${roundSize(Math.max(1, Math.round(size)))}`;
}

const promiseCache = new Map<string, Promise<string>>();
const resolvedCache = new Map<string, string>();

/** Synchronous lookup — only returns a hit once resolveIconUrl has settled
 * for this exact icon+size before. Used to avoid a placeholder flash on
 * repeat renders. */
export function getCachedIconUrl(src: string, size: number): string | null {
  const key = cacheKey(src, size);
  return key ? (resolvedCache.get(key) ?? null) : null;
}

export function resolveIconUrl(src: string, size: number): Promise<string> {
  const name = iconNameFromSrc(src);
  const key = cacheKey(src, size);
  if (!name || !key) return Promise.resolve(src);

  const cached = promiseCache.get(key);
  if (cached) return cached;

  const bucket = roundSize(Math.max(1, Math.round(size)));
  const promise = (async () => {
    const res = await fetch(`/icons/${name}.ico`);
    if (!res.ok) throw new Error(`no .ico for ${name}`);
    const buf = await res.arrayBuffer();
    return decodeIco(buf, bucket);
  })()
    .catch(() => legacyIconUrl(src))
    .then((url) => {
      resolvedCache.set(key, url);
      return url;
    });

  promiseCache.set(key, promise);
  return promise;
}
