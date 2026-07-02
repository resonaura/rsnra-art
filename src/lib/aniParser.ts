export interface AniData {
  frames: Blob[];
  rate: number[]; // duration in ms for each step
  seq?: number[];
  hotspot: [number, number];
}

export async function parseAni(buffer: ArrayBuffer): Promise<AniData> {
  const view = new DataView(buffer);

  // Verify RIFF header
  if (view.getUint32(0, true) !== 0x46464952) { // "RIFF"
    throw new Error("Not a RIFF file");
  }
  if (view.getUint32(8, true) !== 0x4e4f4341) { // "ACON"
    throw new Error("Not an ACON file");
  }

  let offset = 12;
  const frames: Blob[] = [];
  let numFrames = 0;
  let numSteps = 0;
  let defaultRate = 10; // in jiffies (166.7ms)
  let seq: number[] | undefined;
  let rate: number[] | undefined;

  while (offset < buffer.byteLength - 8) {
    const chunkId = view.getUint32(offset, true);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    offset += 8 + ((chunkSize + 1) & ~1); // pad to 2 bytes

    if (chunkId === 0x68696e61) { // "anih"
      numFrames = view.getUint32(chunkStart + 4, true);
      numSteps = view.getUint32(chunkStart + 8, true);
      defaultRate = view.getUint32(chunkStart + 28, true);
    } else if (chunkId === 0x71657320) { // "seq "
      seq = [];
      for (let i = 0; i < numSteps; i++) {
        seq.push(view.getUint32(chunkStart + i * 4, true));
      }
    } else if (chunkId === 0x65746172) { // "rate"
      rate = [];
      for (let i = 0; i < numSteps; i++) {
        rate.push(view.getUint32(chunkStart + i * 4, true));
      }
    } else if (chunkId === 0x5453494c) { // "LIST"
      const listType = view.getUint32(chunkStart, true);
      if (listType === 0x6d617266) { // "fram"
        let listOffset = chunkStart + 4;
        const listEnd = chunkStart + chunkSize;
        while (listOffset < listEnd - 8) {
          const subId = view.getUint32(listOffset, true);
          const subSize = view.getUint32(listOffset + 4, true);
          const subStart = listOffset + 8;
          listOffset += 8 + ((subSize + 1) & ~1);

          if (subId === 0x6e6f6369) { // "icon"
            const iconBuffer = buffer.slice(subStart, subStart + subSize);
            frames.push(new Blob([iconBuffer], { type: "image/x-icon" }));
          }
        }
      }
    }
  }

  // 1 jiffy = 1/60 sec = 16.666 ms
  const defaultRateMs = defaultRate * 16.666;
  const stepDurations = rate
    ? rate.map((j) => j * 16.666)
    : Array(numSteps || numFrames).fill(defaultRateMs);

  // Extract hotspot from first frame's buffer if available
  let hotspot: [number, number] = [0, 0];
  if (frames.length > 0) {
    const curBuffer = await frames[0].arrayBuffer();
    const curView = new DataView(curBuffer);
    if (curBuffer.byteLength > 14 && curView.getUint16(2, true) === 2) {
      hotspot = [curView.getUint16(10, true), curView.getUint16(12, true)];
    }
  }

  return {
    frames,
    rate: stepDurations,
    seq,
    hotspot,
  };
}
