// Decodes real Windows .ico files (multi-resolution icon containers) fully
// client-side: pick the embedded frame closest to the size we're about to
// display, decode its DIB (or embedded PNG, for Vista+ 256x256 frames) onto
// a canvas, and hand back a PNG data URL. No server-side/build-time
// conversion — every icon is rendered at the resolution it's actually shown
// at, exactly like the OS does when it reads an .ico off disk.

export interface IcoEntry {
  width: number;
  height: number;
  bitCount: number;
  bytesInRes: number;
  imageOffset: number;
}

export function parseIcoDirectory(buffer: ArrayBuffer): IcoEntry[] {
  const view = new DataView(buffer);
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);
  if (reserved !== 0 || type !== 1 || count === 0) {
    throw new Error("Invalid ICO file");
  }
  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    const wByte = view.getUint8(base);
    const hByte = view.getUint8(base + 1);
    const bitCount = view.getUint16(base + 6, true);
    const bytesInRes = view.getUint32(base + 8, true);
    const imageOffset = view.getUint32(base + 12, true);
    entries.push({
      width: wByte === 0 ? 256 : wByte,
      height: hByte === 0 ? 256 : hByte,
      bitCount,
      bytesInRes,
      imageOffset,
    });
  }
  return entries;
}

/** Prefer the smallest frame that's still >= the target — crisper when
 * downscaled than upscaling a smaller frame (ties go to the larger one). A
 * 16px request against a {16,32,48} icon picks the 16px frame exactly —
 * it does NOT skip past a close/exact match to grab a bigger one. */
export function pickBestEntry(entries: IcoEntry[], targetSize: number): IcoEntry {
  return [...entries].sort((a, b) => {
    const da = a.width - targetSize;
    const db = b.width - targetSize;
    const adist = Math.abs(da);
    const bdist = Math.abs(db);
    if (adist !== bdist) return adist - bdist;
    // equidistant: prefer the larger (crisper downscale over blurry upscale)
    return db - da;
  })[0];
}

function readPalette(view: DataView, offset: number, numColors: number) {
  const palette: { r: number; g: number; b: number }[] = [];
  for (let i = 0; i < numColors; i++) {
    const base = offset + i * 4;
    palette.push({
      b: view.getUint8(base),
      g: view.getUint8(base + 1),
      r: view.getUint8(base + 2),
    });
  }
  return palette;
}

async function decodeEntry(
  buffer: ArrayBuffer,
  entry: IcoEntry,
): Promise<HTMLCanvasElement> {
  const view = new DataView(buffer);
  const { imageOffset, bytesInRes } = entry;

  // Vista+ large frames (typically 256x256) embed a literal PNG instead of
  // a DIB — detect via the PNG magic and just decode it as an image.
  if (
    view.getUint8(imageOffset) === 0x89 &&
    view.getUint8(imageOffset + 1) === 0x50 &&
    view.getUint8(imageOffset + 2) === 0x4e &&
    view.getUint8(imageOffset + 3) === 0x47
  ) {
    const blob = new Blob([buffer.slice(imageOffset, imageOffset + bytesInRes)], {
      type: "image/png",
    });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    return canvas;
  }

  // Otherwise it's a BITMAPINFOHEADER DIB: an XOR color plane followed by a
  // 1bpp AND transparency mask, height doubled to cover both.
  const biSize = view.getUint32(imageOffset, true);
  const biWidth = view.getInt32(imageOffset + 4, true);
  const biHeight = view.getInt32(imageOffset + 8, true);
  const biBitCount = view.getUint16(imageOffset + 14, true);
  const biClrUsed = view.getUint32(imageOffset + 32, true);

  const width = biWidth;
  const height = Math.abs(biHeight) / 2;
  const topDown = biHeight < 0;
  const rowOf = (y: number) => (topDown ? y : height - 1 - y);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(width, height);

  const maskStride = Math.floor((width + 31) / 32) * 4;
  const andMaskBit = (maskOffset: number, row: number, x: number) => {
    const byte = view.getUint8(maskOffset + row * maskStride + Math.floor(x / 8));
    return (byte >> (7 - (x % 8))) & 1;
  };

  if (biBitCount === 32) {
    const pixelOffset = imageOffset + biSize;
    for (let y = 0; y < height; y++) {
      const row = rowOf(y);
      const rowOffset = pixelOffset + row * width * 4;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x * 4;
        const p = (y * width + x) * 4;
        imgData.data[p] = view.getUint8(idx + 2);
        imgData.data[p + 1] = view.getUint8(idx + 1);
        imgData.data[p + 2] = view.getUint8(idx);
        imgData.data[p + 3] = view.getUint8(idx + 3);
      }
    }
  } else if (biBitCount === 24) {
    const stride = (width * 3 + 3) & ~3;
    const pixelOffset = imageOffset + biSize;
    const maskOffset = pixelOffset + stride * height;
    for (let y = 0; y < height; y++) {
      const row = rowOf(y);
      const rowOffset = pixelOffset + row * stride;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x * 3;
        const p = (y * width + x) * 4;
        imgData.data[p] = view.getUint8(idx + 2);
        imgData.data[p + 1] = view.getUint8(idx + 1);
        imgData.data[p + 2] = view.getUint8(idx);
        imgData.data[p + 3] = andMaskBit(maskOffset, row, x) ? 0 : 255;
      }
    }
  } else if (biBitCount === 8 || biBitCount === 4 || biBitCount === 1) {
    const bpp = biBitCount;
    const numColors = biClrUsed || 1 << bpp;
    const colorTableOffset = imageOffset + biSize;
    const palette = readPalette(view, colorTableOffset, numColors);
    const pixelsPerByte = 8 / bpp;
    const stride = Math.floor((width + pixelsPerByte - 1) / pixelsPerByte + 3) & ~3;
    const xorOffset = colorTableOffset + numColors * 4;
    const maskOffset = xorOffset + stride * height;

    for (let y = 0; y < height; y++) {
      const row = rowOf(y);
      const rowOffset = xorOffset + row * stride;
      for (let x = 0; x < width; x++) {
        let paletteIdx: number;
        if (bpp === 8) {
          paletteIdx = view.getUint8(rowOffset + x);
        } else if (bpp === 4) {
          const byte = view.getUint8(rowOffset + Math.floor(x / 2));
          paletteIdx = x % 2 === 0 ? (byte >> 4) & 0xf : byte & 0xf;
        } else {
          const byte = view.getUint8(rowOffset + Math.floor(x / 8));
          paletteIdx = (byte >> (7 - (x % 8))) & 1;
        }
        const p = (y * width + x) * 4;
        const opaque = andMaskBit(maskOffset, row, x) === 0;
        if (opaque) {
          const color = palette[paletteIdx] ?? { r: 0, g: 0, b: 0 };
          imgData.data[p] = color.r;
          imgData.data[p + 1] = color.g;
          imgData.data[p + 2] = color.b;
          imgData.data[p + 3] = 255;
        } else if (bpp === 1 && paletteIdx === 1) {
          // AND=1, XOR=1 → screen inversion (rare "hollow" cursor pixels)
          imgData.data[p] = 255;
          imgData.data[p + 1] = 255;
          imgData.data[p + 2] = 255;
          imgData.data[p + 3] = 255;
        } else {
          imgData.data[p + 3] = 0;
        }
      }
    }
  } else {
    throw new Error(`Unsupported ICO bit depth: ${biBitCount}`);
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Decode the frame closest to `targetSize` and return a PNG data URL. */
export async function decodeIco(
  buffer: ArrayBuffer,
  targetSize: number,
): Promise<string> {
  const entries = parseIcoDirectory(buffer);
  const best = pickBestEntry(entries, targetSize);
  const canvas = await decodeEntry(buffer, best);
  return canvas.toDataURL("image/png");
}
