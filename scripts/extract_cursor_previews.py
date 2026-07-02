#!/usr/bin/env python3
"""
extract_cursor_previews.py
---------------------------
Renders every real Windows .CUR file in public/cursors/ME/ into:

  public/cursors/ME-preview/<name>.png   32x32 PNG, for <img> thumbnails in
                                          the Mouse Properties picker UI
                                          (browsers don't reliably rasterize
                                          .cur inside <img>, only via CSS
                                          `cursor:`, so this needs a PNG).
  public/cursors/ME-live/<name>.CUR      16x16, freshly-authored *native*
                                          .cur file for the actual CSS
                                          `cursor: url(...)`. Two reasons
                                          this isn't a plain resize of the
                                          source .cur:
                                           - the source pixels are corrected
                                             first (see "screen-invert" note
                                             below) — a straight byte-copy
                                             would still have the cut-out-
                                             white bug.
                                           - browsers draw cursor *images* at
                                             their native pixel size in CSS
                                             px, so the source 32x32 bitmaps
                                             look ~2x too big next to a real
                                             OS pointer; re-authoring at
                                             16x16 (exact 2:1 downscale, no
                                             fractional-ratio pixel mangling)
                                             fixes that. A native .cur is
                                             also more likely to hit the
                                             browser/OS's hardware-cursor
                                             path instead of a software-
                                             scaled PNG, for a crisper result.
  public/cursors/ME-live/<name>@2x.CUR   32x32 companion of the above, at
                                          native (uninterpolated) resolution,
                                          used via `cursor: image-set(...
                                          1x, ... 2x)` so a HiDPI display
                                          doesn't have to upscale-and-blur
                                          the 16x16 asset itself.

Also writes src/data/cursorHotspots.generated.ts — redundant with the
hotspot now embedded natively in each ME-live/*.CUR file, but kept as an
explicit CSS `cursor: url(...) x y, auto` fallback for engines that ignore
a cur's native hotspot.

Color/transparency notes
-------------------------
.CUR is the same container as .ICO (an AND-mask + XOR-mask device-independent
bitmap) plus a hotspot in the directory entry. Pillow's built-in CUR/ICO
decoder doesn't composite the AND transparency mask correctly for 1/4/8-bpp
images, so this parses the format directly (same approach as
scripts/icons/convert_icons.py).

Classic Windows cursors also use a second trick beyond plain transparency:
where the AND-mask bit is 1 *and* the XOR bitmap color is non-black, the
real GDI renderer XORs that color into the screen (screen-invert) rather
than leaving the pixel transparent — this is how many system cursors keep a
bright, always-visible interior against any background. Browsers don't
implement that invert compositing for CSS cursors (or <img>), so a naive
AND-mask-as-alpha read leaves those pixels fully transparent — visually,
the cursor's white fill gets "cut out". We approximate the invert trick as
opaque solid color instead (closest static equivalent), which is what
render_cur() below does.

Usage: python3 scripts/extract_cursor_previews.py
"""

import json
import os
import struct

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC_DIR = os.path.join(ROOT, "public", "cursors", "ME")
PREVIEW_DIR = os.path.join(ROOT, "public", "cursors", "ME-preview")
LIVE_DIR = os.path.join(ROOT, "public", "cursors", "ME-live")
HOTSPOT_OUT = os.path.join(ROOT, "src", "data", "cursorHotspots.generated.ts")
NATIVE = (32, 32)
LIVE_SIZE = 16  # exact 2:1 downscale from the 32x32 source — no fractional
# sampling, so NEAREST can't mangle the pixel art.


def render_cur(data, want=NATIVE):
    """Parse a .CUR blob into (RGBA Image at `want` size, hotspot at that size)."""
    _reserved, typ, count = struct.unpack("<HHH", data[:6])
    if typ != 2:
        raise ValueError("not a CUR file")
    best = None
    for i in range(count):
        w, h, _c, _r, hx, hy, _sz, off = struct.unpack(
            "<BBBBHHII", data[6 + i * 16 : 6 + (i + 1) * 16]
        )
        w = 256 if w == 0 else w
        h = 256 if h == 0 else h
        if (w, h) == want:
            best = (off, hx, hy)
            break
        if best is None:
            best = (off, hx, hy)
    off, hx, hy = best
    hsiz, bw, bh, _pl, bpp = struct.unpack("<IiiHH", data[off : off + 16])
    bh //= 2  # height field covers XOR + AND masks stacked
    pal_off = off + hsiz
    ncol = 1 << bpp if bpp <= 8 else 0
    pal = [
        struct.unpack("<BBBB", data[pal_off + k * 4 : pal_off + k * 4 + 4])[2::-1]
        for k in range(ncol)
    ]
    xor_row = ((bw * bpp + 31) // 32) * 4
    xor_off = pal_off + ncol * 4
    and_row = ((bw + 31) // 32) * 4
    and_off = xor_off + xor_row * bh
    img = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    px = img.load()
    for row in range(bh):
        y = bh - 1 - row  # BMP rows are bottom-up
        xor_bits = data[xor_off + row * xor_row : xor_off + (row + 1) * xor_row]
        and_bits = data[and_off + row * and_row : and_off + (row + 1) * and_row]
        and_str = "".join(format(b, "08b") for b in and_bits)
        if bpp == 1:
            nib = [(byte >> k) & 1 for byte in xor_bits for k in range(7, -1, -1)]
        elif bpp == 4:
            nib = [v for byte in xor_bits for v in ((byte >> 4) & 0xF, byte & 0xF)]
        elif bpp == 8:
            nib = list(xor_bits)
        else:
            nib = None
        for x in range(bw):
            masked = x < len(and_str) and and_str[x] == "1"
            if bpp == 24:
                o = row * xor_row + x * 3
                b, g, r2 = data[xor_off + o : xor_off + o + 3]
                rgb = (r2, g, b)
            elif bpp == 32:
                o = row * xor_row + x * 4
                b, g, r2, a = data[xor_off + o : xor_off + o + 4]
                if a > 0:
                    px[x, y] = (r2, g, b, a)
                    continue
                rgb = (r2, g, b)
            else:
                rgb = tuple(pal[nib[x]])
            if not masked:
                px[x, y] = rgb + (255,)  # opaque XOR color
            elif rgb != (0, 0, 0):
                # AND=1 with a non-black XOR color is the classic
                # screen-invert trick — approximate as opaque solid color
                # instead of leaving a transparent hole.
                px[x, y] = rgb + (255,)
            else:
                px[x, y] = (0, 0, 0, 0)  # true transparency (AND=1, XOR=0)
    if (bw, bh) != want:
        sx, sy = want[0] / bw, want[1] / bh
        img = img.resize(want, Image.NEAREST)
        hx, hy = round(hx * sx), round(hy * sy)
    return img, (hx, hy)


def at2x(filename):
    stem, ext = os.path.splitext(filename)
    return f"{stem}@2x{ext}"


def write_cur(path, img, hotspot):
    """Author a minimal, valid single-frame 32bpp .CUR from an RGBA image.

    32bpp XOR data carries real alpha (so no palette / invert-trick
    ambiguity survives into the file), plus a conventional 1bpp AND mask
    for decoders that ignore alpha — built straight from that same alpha
    channel (opaque wherever alpha > 0), so it can't disagree with it.
    """
    w, h = img.size
    hx, hy = hotspot
    hx, hy = max(0, min(w - 1, hx)), max(0, min(h - 1, hy))
    px = img.load()

    xor_rows = bytearray()
    and_row_bytes = ((w + 31) // 32) * 4
    and_rows = bytearray()
    for row in range(h):
        y = h - 1 - row  # bottom-up
        and_bits = []
        for x in range(w):
            r, g, b, a = px[x, y]
            xor_rows += bytes((b, g, r, a))
            and_bits.append(0 if a > 0 else 1)
        # pack this row's AND bits MSB-first, padded to and_row_bytes
        row_bytes = bytearray(and_row_bytes)
        for x, bit in enumerate(and_bits):
            if bit:
                row_bytes[x // 8] |= 0x80 >> (x % 8)
        and_rows += row_bytes

    dib_header = struct.pack(
        "<IiiHHIIiiII",
        40,  # biSize
        w,  # biWidth
        h * 2,  # biHeight (XOR + AND stacked, per the .cur/.ico convention)
        1,  # biPlanes
        32,  # biBitCount
        0,  # biCompression (BI_RGB)
        len(xor_rows) + len(and_rows),  # biSizeImage
        0,
        0,  # biXPelsPerMeter / biYPelsPerMeter
        0,
        0,  # biClrUsed / biClrImportant
    )
    image_data = dib_header + bytes(xor_rows) + bytes(and_rows)
    image_offset = 6 + 16
    dir_entry = struct.pack(
        "<BBBBHHII",
        w if w < 256 else 0,
        h if h < 256 else 0,
        0,
        0,  # colorCount, reserved
        hx,
        hy,  # hotspot
        len(image_data),
        image_offset,
    )
    icondir = struct.pack("<HHH", 0, 2, 1)  # reserved, type=CUR, count=1
    with open(path, "wb") as f:
        f.write(icondir + dir_entry + image_data)


def main():
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    os.makedirs(LIVE_DIR, exist_ok=True)
    ok = fail = 0
    hotspots = {}
    for fn in sorted(os.listdir(SRC_DIR)):
        if not fn.upper().endswith(".CUR"):
            continue
        with open(os.path.join(SRC_DIR, fn), "rb") as f:
            data = f.read()
        try:
            im, (hx, hy) = render_cur(data, NATIVE)
            im.save(os.path.join(PREVIEW_DIR, fn[:-4] + ".png"))

            # NEAREST avoids alpha-fringing on these flat B/W pixel-art shapes
            # (LANCZOS bleeds black from transparent-RGB(0,0,0,0) neighbors
            # into edge pixels) and matches the app's pixelated icon look.
            live = im.resize((LIVE_SIZE, LIVE_SIZE), Image.NEAREST)
            scale = LIVE_SIZE / NATIVE[0]
            live_hotspot = (
                min(LIVE_SIZE - 1, round(hx * scale)),
                min(LIVE_SIZE - 1, round(hy * scale)),
            )
            write_cur(os.path.join(LIVE_DIR, fn), live, live_hotspot)

            # Native-resolution 2x companion (just the corrected 32x32 image,
            # no resize) for `cursor: image-set(... 1x, ... 2x)`. Without
            # this, a HiDPI display has to upscale the 16x16 asset itself
            # (16 CSS px -> 32 device px), which blurs it; image-set lets
            # the browser pick this crisp native-res image instead while
            # still showing it at the 16 CSS px logical size.
            write_cur(os.path.join(LIVE_DIR, at2x(fn)), im, (hx, hy))

            hotspots[fn] = list(live_hotspot)
            ok += 1
        except Exception:
            fail += 1
    print(f"ok={ok} fail={fail} -> {PREVIEW_DIR}, {LIVE_DIR}")

    lines = [
        "// Auto-generated by scripts/extract_cursor_previews.py — do not edit by hand.",
        "// Maps each source .CUR filename to its [x, y] CSS hotspot in the 16x16",
        "// ME-live/ raster (scaled down from the file's embedded 32x32 hotspot).",
        "export const CURSOR_HOTSPOTS: Record<string, [number, number]> = {",
    ]
    for fn, (hx, hy) in sorted(hotspots.items()):
        lines.append(f'  "{fn}": [{hx}, {hy}],')
    lines.append("};")
    with open(HOTSPOT_OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {HOTSPOT_OUT}")


if __name__ == "__main__":
    main()
