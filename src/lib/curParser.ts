export interface CurData {
  blobUrl: string;
  hotspot: [number, number];
}

export async function parseCur(buffer: ArrayBuffer, filename: string, shadowEnabled = true): Promise<CurData> {
  const view = new DataView(buffer);

  // Header
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);

  if (reserved !== 0 || type !== 2 || count === 0) {
    console.warn(`[parseCur] Invalid header for ${filename}: reserved=${reserved} type=${type} count=${count}`);
    throw new Error("Invalid CUR file");
  }

  // First image directory entry
  const width = view.getUint8(6) || 32;
  const height = view.getUint8(7) || 32;
  const hotspotX = view.getUint16(10, true);
  const hotspotY = view.getUint16(12, true);
  const bytesInRes = view.getUint32(14, true);
  const imageOffset = view.getUint32(18, true);

  // BMP Header
  const biSize = view.getUint32(imageOffset, true);
  const biWidth = view.getInt32(imageOffset + 4, true);
  const biHeight = view.getInt32(imageOffset + 8, true);
  const biBitCount = view.getUint16(imageOffset + 14, true);

  const realWidth = biWidth;
  const realHeight = Math.abs(biHeight) / (biHeight === height ? 1 : 2); // biHeight is usually 2 * height

  const canvas = document.createElement("canvas");
  canvas.width = realWidth;
  canvas.height = realHeight;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(realWidth, realHeight);

  if (biBitCount === 1) {
    // Monochrome CUR
    const colorTableOffset = imageOffset + biSize;
    let colors = [
      { r: view.getUint8(colorTableOffset + 2), g: view.getUint8(colorTableOffset + 1), b: view.getUint8(colorTableOffset) },
      { r: view.getUint8(colorTableOffset + 6), g: view.getUint8(colorTableOffset + 5), b: view.getUint8(colorTableOffset + 4) }
    ];
    if (colors[0].r === colors[1].r && colors[0].g === colors[1].g && colors[0].b === colors[1].b) {
      colors = [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 }
      ];
    }

    const xorStride = Math.floor((realWidth + 31) / 32) * 4;
    const andStride = Math.floor((realWidth + 31) / 32) * 4;

    const xorOffset = colorTableOffset + 8; // 2 colors * 4 bytes
    const andOffset = xorOffset + xorStride * realHeight;

    for (let y = 0; y < realHeight; y++) {
      const bmpRow = realHeight - 1 - y; // BMP scans bottom-to-top
      const xorRowOffset = xorOffset + bmpRow * xorStride;
      const andRowOffset = andOffset + bmpRow * andStride;

      for (let x = 0; x < realWidth; x++) {
        const byteIdx = Math.floor(x / 8);
        const bitShift = 7 - (x % 8);

        const xorByte = view.getUint8(xorRowOffset + byteIdx);
        const andByte = view.getUint8(andRowOffset + byteIdx);

        const xorBit = (xorByte >> bitShift) & 1;
        const andBit = (andByte >> bitShift) & 1;

        const pixelIdx = (y * realWidth + x) * 4;

        if (andBit === 0) {
          // Opaque color from color table
          const color = colors[xorBit];
          imgData.data[pixelIdx] = color.r;
          imgData.data[pixelIdx + 1] = color.g;
          imgData.data[pixelIdx + 2] = color.b;
          imgData.data[pixelIdx + 3] = 255;
        } else {
          // Transparent or inverted
          if (xorBit === 1) {
            // Inverted -> render as white for fill
            imgData.data[pixelIdx] = 255;
            imgData.data[pixelIdx + 1] = 255;
            imgData.data[pixelIdx + 2] = 255;
            imgData.data[pixelIdx + 3] = 255;
          } else {
            // Transparent
            imgData.data[pixelIdx] = 0;
            imgData.data[pixelIdx + 1] = 0;
            imgData.data[pixelIdx + 2] = 0;
            imgData.data[pixelIdx + 3] = 0;
          }
        }
      }
    }
  } else if (biBitCount === 32) {
    // 32-bit RGBA CUR
    const pixelOffset = imageOffset + biSize;
    for (let y = 0; y < realHeight; y++) {
      const bmpRow = realHeight - 1 - y;
      const bmpRowOffset = pixelOffset + bmpRow * realWidth * 4;

      for (let x = 0; x < realWidth; x++) {
        const idx = bmpRowOffset + x * 4;
        const pixelIdx = (y * realWidth + x) * 4;
        imgData.data[pixelIdx] = view.getUint8(idx + 2);     // R
        imgData.data[pixelIdx + 1] = view.getUint8(idx + 1); // G
        imgData.data[pixelIdx + 2] = view.getUint8(idx);     // B
        imgData.data[pixelIdx + 3] = view.getUint8(idx + 3); // A
      }
    }
  } else if (biBitCount === 4) {
    // 4-bit paletted CUR
    const biClrUsed = view.getUint32(imageOffset + 32, true);
    const numColors = biClrUsed === 0 ? 16 : biClrUsed;
    const colorTableOffset = imageOffset + biSize;
    const palette: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < numColors; i++) {
      const base = colorTableOffset + i * 4;
      palette.push({
        b: view.getUint8(base),
        g: view.getUint8(base + 1),
        r: view.getUint8(base + 2),
      });
    }
    // XOR plane stride: each row of 4bpp pixels is ceil(width/2) bytes, padded to 4
    const xorStride = Math.floor((realWidth / 2 + 3) & ~3);
    const xorOffset = colorTableOffset + numColors * 4;
    const andStride = Math.floor((realWidth + 31) / 32) * 4;
    const andOffset = xorOffset + xorStride * realHeight;

    for (let y = 0; y < realHeight; y++) {
      const bmpRow = realHeight - 1 - y;
      const xorRowOffset = xorOffset + bmpRow * xorStride;
      const andRowOffset = andOffset + bmpRow * andStride;

      for (let x = 0; x < realWidth; x++) {
        const nibbleByte = view.getUint8(xorRowOffset + Math.floor(x / 2));
        const paletteIdx = (x % 2 === 0) ? ((nibbleByte >> 4) & 0xf) : (nibbleByte & 0xf);
        const andByteIdx = Math.floor(x / 8);
        const andBit = (view.getUint8(andRowOffset + andByteIdx) >> (7 - (x % 8))) & 1;

        const pixelIdx = (y * realWidth + x) * 4;
        if (andBit === 0) {
          const color = palette[paletteIdx] ?? { r: 0, g: 0, b: 0 };
          imgData.data[pixelIdx] = color.r;
          imgData.data[pixelIdx + 1] = color.g;
          imgData.data[pixelIdx + 2] = color.b;
          imgData.data[pixelIdx + 3] = 255;
        } else if (paletteIdx !== 0) {
          // AND=1, XOR!=0 → screen inversion, render as white
          imgData.data[pixelIdx] = 255;
          imgData.data[pixelIdx + 1] = 255;
          imgData.data[pixelIdx + 2] = 255;
          imgData.data[pixelIdx + 3] = 255;
        } else {
          // AND=1, XOR=0 → fully transparent
          imgData.data[pixelIdx + 3] = 0;
        }
      }
    }
  } else if (biBitCount === 8) {

    // 8-bit paletted CUR — read palette size from biClrUsed
    const biClrUsed = view.getUint32(imageOffset + 32, true);
    const numColors = biClrUsed === 0 ? 256 : biClrUsed;
    const colorTableOffset = imageOffset + biSize;
    const palette: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < numColors; i++) {
      const base = colorTableOffset + i * 4;
      palette.push({
        b: view.getUint8(base),
        g: view.getUint8(base + 1),
        r: view.getUint8(base + 2),
      });
    }
    // XOR plane stride: pad to 4 bytes
    const xorStride = ((realWidth + 3) & ~3);
    const xorOffset = colorTableOffset + numColors * 4;
    const andStride = Math.floor((realWidth + 31) / 32) * 4;
    const andOffset = xorOffset + xorStride * realHeight;

    for (let y = 0; y < realHeight; y++) {
      const bmpRow = realHeight - 1 - y;
      const xorRowOffset = xorOffset + bmpRow * xorStride;
      const andRowOffset = andOffset + bmpRow * andStride;

      for (let x = 0; x < realWidth; x++) {
        const paletteIdx = view.getUint8(xorRowOffset + x);
        const andByteIdx = Math.floor(x / 8);
        const andBit = (view.getUint8(andRowOffset + andByteIdx) >> (7 - (x % 8))) & 1;

        const pixelIdx = (y * realWidth + x) * 4;
        if (andBit === 0) {
          // Opaque pixel from palette
          const color = palette[paletteIdx] ?? { r: 0, g: 0, b: 0 };
          imgData.data[pixelIdx] = color.r;
          imgData.data[pixelIdx + 1] = color.g;
          imgData.data[pixelIdx + 2] = color.b;
          imgData.data[pixelIdx + 3] = 255;
        } else if (paletteIdx !== 0) {
          // AND=1, XOR!=0 → screen inversion, render as white
          imgData.data[pixelIdx] = 255;
          imgData.data[pixelIdx + 1] = 255;
          imgData.data[pixelIdx + 2] = 255;
          imgData.data[pixelIdx + 3] = 255;
        } else {
          // AND=1, XOR=0 → fully transparent
          imgData.data[pixelIdx + 3] = 0;
        }
      }
    }
  } else {
    // Fallback for 4-bit, 24-bit
    return {
      blobUrl: `/cursors/${filename}`,
      hotspot: [hotspotX, hotspotY]
    };
  }


  ctx.putImageData(imgData, 0, 0);

  if (shadowEnabled) {
    // Apply a very soft, light drop-shadow baked directly into the canvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = realWidth;
    tempCanvas.height = realHeight;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, realWidth, realHeight);
    ctx.filter = "drop-shadow(1px 1px 0.5px rgba(0, 0, 0, 0.15))";
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = "none";
  }


  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    return {
      blobUrl: `/cursors/${filename}`,
      hotspot: [hotspotX, hotspotY]
    };
  }

  return {
    blobUrl: URL.createObjectURL(blob),
    hotspot: [hotspotX, hotspotY]
  };
}
