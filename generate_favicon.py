#!/usr/bin/env python3
"""Generate favicon.ico at the repo root.

Every page load makes the browser request /favicon.ico; with no file there it
404s, which is the benign-but-noisy console warning tracked in issue #46. A real
favicon.ico at the root answers that request site-wide with zero HTML edits (the
browser fetches /favicon.ico automatically, so no per-page <link> is needed).

Pure standard library — no Pillow — so it runs anywhere. It writes a 32x32
32-bit RGBA icon: the site's Dartmouth-green accent (#00693E) with a white
medical cross. Re-run after changing the design.

    python3 generate_favicon.py
"""
import struct
import zlib

SIZE = 32
GREEN = (0, 105, 62, 255)     # #00693E — the light-theme brand accent
WHITE = (255, 255, 255, 255)


def cross(x, y):
    """White plus sign centered on the tile, green elsewhere."""
    v_bar = 13 <= x <= 18 and 5 <= y <= 26
    h_bar = 13 <= y <= 18 and 5 <= x <= 26
    return WHITE if (v_bar or h_bar) else GREEN


def png_bytes():
    # Raw image data: each row is a filter byte (0) followed by RGBA pixels.
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)
        for x in range(SIZE):
            raw.extend(cross(x, y))
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", compressed)
            + chunk(b"IEND", b""))


def ico_bytes(png):
    # ICONDIR + one ICONDIRENTRY that points at an embedded PNG (valid since
    # Vista; every current browser decodes it).
    icondir = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII",
                        SIZE, SIZE, 0, 0, 1, 32, len(png), 6 + 16)
    return icondir + entry + png


if __name__ == "__main__":
    data = ico_bytes(png_bytes())
    with open("favicon.ico", "wb") as fh:
        fh.write(data)
    print(f"wrote favicon.ico ({len(data)} bytes)")
