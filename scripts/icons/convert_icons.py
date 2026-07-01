#!/usr/bin/env python3
"""
Convert icons from the trapd00r/win95-winxp_icons repo into 32x32 RGBA PNGs
for rsnra-art's /public/icons.

The repo stores icons as multi-resolution .ico files (mostly 4/8-bpp with an
AND transparency mask). PIL doesn't always apply that mask correctly, so this
script parses the ICO format itself and builds RGBA with proper transparency.
It extracts the native 32x32 frame as-is (no rescaling) so the pixel grid stays
crisp — scaling pixel art to a non-integer size smears it.

Usage (via pnpm):
  pnpm icons:list [filter]        list .ico files in the repo (optional substring filter)
  pnpm icons:get <ico> [name]     fetch + convert <ico> -> public/icons/<name>.png
                                  (name defaults to the ico basename)
  pnpm icons:sync                 regenerate every icon in ICON_MAP below
  pnpm icons:all [--force]        download + convert every .ico in the repo

Requires Python 3 + Pillow (pip install pillow).
"""

import json
import os
import re
import struct
import sys
import urllib.request

from PIL import Image

REPO = "trapd00r/win95-winxp_icons"
BRANCH = "master"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/icons/"
TREE_API = f"https://api.github.com/repos/{REPO}/git/trees/{BRANCH}?recursive=1"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "icons")
FRAME_SIZE = 32

# app png name -> repo .ico name. w2k = Windows 2000 / Millennium-era look;
# w98 used for games/contact which don't exist in the w2k set.
ICON_MAP = {
    "computer.png": "w2k_my_computer.ico",
    "music-cd.png": "w2k_audio_cd.ico",
    "globe.png": "w2k_internet_explorer.ico",
    "globe-map.png": "w2k_globe.ico",
    "contact-card.png": "w98_write_card_phone.ico",
    "joystick.png": "w98_joystick.ico",
    "recycle-bin-empty.png": "w2k_recycle_bin_empty.ico",
    "control-panel.png": "w2k_control_panel.ico",
    "notepad.png": "w2k_notepad_1.ico",
    "notepad-file.png": "w2k_text_document.ico",
    "paint.png": "w2k_paint.ico",
    "help.png": "w2k_help.ico",
    "minesweeper.png": "w98_minesweeper.ico",
    "terminal.png": "w2k_ms-dos_application.ico",
    "msdos.png": "w2k_ms-dos_application.ico",
    "solitaire.png": "w98_game_solitaire.ico",
    "hearts.png": "w98_game_hearts.ico",
    "freecell.png": "w98_game_freecell.ico",
    "spider.png": "w98_spider.ico",
    "folder-open.png": "w2k_folder_open.ico",
    "documents.png": "w2k_documents.ico",
    "settings.png": "w2k_settings.ico",
    "find.png": "w2k_find.ico",
    "battery.png": "w2k_shut_down.ico",
    # File-type icons (by extension).
    "file-txt.png": "w2k_text_document.ico",
    "file-ini.png": "w2k_ini_&_inf.ico",
    "file-hlp.png": "w2k_help.ico",
    "file-font.png": "w2k_font.ico",
    "file-bmp.png": "w2k_bitmap_image.ico",
    "file-img.png": "w2k_jpeg_image.ico",
    "file-bat.png": "w2k_ms-dos_batch_file.ico",
    "file-config.png": "w2k_configuration_settings.ico",
    "file-dll.png": "w2k_configuration_settings.ico",
}


def repo_icon_names():
    """Return all .ico filenames in the repo's icons/ directory."""
    with urllib.request.urlopen(TREE_API) as r:
        data = json.load(r)
    return sorted(
        e["path"].split("/")[-1]
        for e in data["tree"]
        if e["type"] == "blob" and e["path"].startswith("icons/") and e["path"].endswith(".ico")
    )


def parse_ico(data, want):
    """Parse a .ico blob and return an RGBA Image for the frame closest to `want`,
    applying the AND transparency mask manually (Pillow misses it for 4/8-bpp)."""
    count = struct.unpack("<HHH", data[:6])[2]
    best = None
    for i in range(count):
        w, h, _c, _r, _pl, _bt, _sz, off = struct.unpack("<BBBBHHII", data[6 + i * 16 : 6 + (i + 1) * 16])
        w = 256 if w == 0 else w
        h = 256 if h == 0 else h
        if (w, h) == want:
            best = (off, w, h)
            break
        if best is None or abs(w - want[0]) < abs(best[1] - want[0]):
            best = (off, w, h)
    off, w, h = best
    hsiz, bw, bh, _pl, bpp = struct.unpack("<IiiHH", data[off : off + 16])
    bh //= 2  # height field is doubled (XOR + AND)
    pal_off = off + hsiz
    ncol = 1 << bpp
    pal = []
    for k in range(ncol):
        b, g, r2, _x = struct.unpack("<BBBB", data[pal_off + k * 4 : pal_off + k * 4 + 4])
        pal.append((r2, g, b))
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
            nib = []
            for byte in xor_bits:
                for k in range(7, -1, -1):
                    nib.append((byte >> k) & 1)
        elif bpp == 4:
            nib = []
            for byte in xor_bits:
                nib.append((byte >> 4) & 0xF)
                nib.append(byte & 0xF)
        elif bpp == 8:
            nib = list(xor_bits)
        else:
            nib = None  # 24/32-bpp handled per-pixel below
        for x in range(bw):
            if bpp == 24:
                o = row * xor_row + x * 3
                b, g, r2 = data[xor_off + o : xor_off + o + 3]
                col = (r2, g, b, 0 if (x < len(and_str) and and_str[x] == "1") else 255)
            elif bpp == 32:
                o = row * xor_row + x * 4
                b, g, r2, a = data[xor_off + o : xor_off + o + 4]
                col = (r2, g, b, a if a > 0 else (0 if (x < len(and_str) and and_str[x] == "1") else 255))
            else:
                idx = nib[x]
                col = pal[idx] + (255,)
                if x < len(and_str) and and_str[x] == "1":
                    col = col[:3] + (0,)
            px[x, y] = col
    if (bw, bh) != want:
        img = img.resize(want, Image.NEAREST)
    return img


def trim_fill(im, size=FRAME_SIZE):
    """Crop transparent padding and scale to fill a size x size frame (keeps
    aspect ratio, centers) so every icon has the same visual size."""
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    if w == 0 or h == 0:
        return im
    scale = size / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    im = im.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - nw) // 2, (size - nh) // 2), im)
    return canvas


def fetch_ico(name):
    with urllib.request.urlopen(RAW_BASE + name) as r:
        return r.read()


def convert_one(ico_name, out_name):
    data = fetch_ico(ico_name)
    # Use the native 32x32 frame as-is — NO rescaling. Pixel-art icons can't be
    # scaled to a non-integer size without smearing the pixel grid, so we keep
    # the original 32x32 raster (crisp pixels) rather than trim+resize.
    im = parse_ico(data, (FRAME_SIZE, FRAME_SIZE))
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, out_name)
    im.save(out)
    print(f"OK {out_name:22s} <- {ico_name}")


def cmd_list(args):
    names = repo_icon_names()
    filt = args[0].lower() if args else ""
    shown = [n for n in names if filt in n.lower()] if filt else names
    print(f"{len(names)} .ico files in {REPO}/icons/" + (f" (filter: {filt})" if filt else ""))
    for n in shown:
        print("  " + n)


def cmd_get(args):
    if not args:
        sys.exit("usage: pnpm icons:get <ico-name> [png-name]")
    ico = args[0]
    png = args[1] if len(args) > 1 else ico.rsplit(".", 1)[0] + ".png"
    if not png.endswith(".png"):
        png += ".png"
    convert_one(ico, png)


def cmd_sync(_args):
    for out_name, ico in ICON_MAP.items():
        try:
            convert_one(ico, out_name)
        except Exception as e:  # noqa: BLE001
            print(f"FAIL {out_name} <- {ico}: {e}")


def cmd_all(args):
    force = "--force" in args
    names = repo_icon_names()
    converted = skipped = failed = 0
    for ico in names:
        base = ico[:-4] if ico.endswith(".ico") else ico
        out_name = re.sub(r"[/:\x00-\x1f\x7f]", "_", base) + ".png"
        if not force and os.path.exists(os.path.join(OUT_DIR, out_name)):
            print(f"skip {out_name}")
            skipped += 1
            continue
        try:
            convert_one(ico, out_name)
            converted += 1
        except Exception as e:  # noqa: BLE001
            print(f"FAIL {out_name} <- {ico}: {e}")
            failed += 1
    print(f"\n{converted} converted, {skipped} skipped, {failed} failed")


COMMANDS = {"list": cmd_list, "get": cmd_get, "sync": cmd_sync, "all": cmd_all}


def main(argv):
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    cmd, rest = argv[0], argv[1:]
    fn = COMMANDS.get(cmd)
    if not fn:
        sys.exit(f"unknown command: {cmd}\n{__doc__}")
    fn(rest)


if __name__ == "__main__":
    main(sys.argv[1:])
