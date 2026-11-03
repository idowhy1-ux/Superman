"""Tiny pixel-art toolkit used to paint every texture in the add-on.

All textures are generated from code so the packs can be rebuilt (and
re-themed) at any time with ``python3 tools/generate_assets.py``.
"""
from __future__ import annotations

import math
import random
from typing import Dict, Iterable, Optional, Sequence, Tuple

from PIL import Image

Color = Tuple[int, int, int, int]


def rgba(hex_or_tuple, alpha: int = 255) -> Color:
    if isinstance(hex_or_tuple, tuple):
        if len(hex_or_tuple) == 4:
            return hex_or_tuple  # type: ignore[return-value]
        r, g, b = hex_or_tuple
        return (r, g, b, alpha)
    h = hex_or_tuple.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def shade(color: Color, amount: float) -> Color:
    """amount > 0 lightens, < 0 darkens (range roughly -1..1)."""
    r, g, b, a = color
    if amount >= 0:
        return (
            int(r + (255 - r) * amount),
            int(g + (255 - g) * amount),
            int(b + (255 - b) * amount),
            a,
        )
    f = 1 + amount
    return (int(r * f), int(g * f), int(b * f), a)


def mix(c1: Color, c2: Color, t: float) -> Color:
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))  # type: ignore[return-value]


TRANSPARENT: Color = (0, 0, 0, 0)


class Canvas:
    def __init__(self, w: int, h: int, fill: Color = TRANSPARENT, seed: int = 1):
        self.w = w
        self.h = h
        self.img = Image.new("RGBA", (w, h), fill)
        self.px = self.img.load()
        self.rng = random.Random(seed)

    # -- primitives -------------------------------------------------------
    def set(self, x: int, y: int, c: Color) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = c

    def get(self, x: int, y: int) -> Color:
        return self.px[x, y]

    def rect(self, x: int, y: int, w: int, h: int, c: Color) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def noise_rect(self, x: int, y: int, w: int, h: int, c: Color, var: float = 0.08,
                   speckle: float = 0.0, speckle_color: Optional[Color] = None) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                v = (self.rng.random() * 2 - 1) * var
                col = shade(c, v)
                if speckle and self.rng.random() < speckle:
                    col = speckle_color or shade(c, -0.35)
                self.set(xx, yy, col)

    def vgradient(self, x: int, y: int, w: int, h: int, top: Color, bottom: Color, var: float = 0.0) -> None:
        for yy in range(h):
            t = yy / max(1, h - 1)
            base = mix(top, bottom, t)
            for xx in range(w):
                v = (self.rng.random() * 2 - 1) * var
                self.set(x + xx, y + yy, shade(base, v) if var else base)

    def hline(self, x: int, y: int, w: int, c: Color) -> None:
        self.rect(x, y, w, 1, c)

    def vline(self, x: int, y: int, h: int, c: Color) -> None:
        self.rect(x, y, 1, h, c)

    def line(self, x0: int, y0: int, x1: int, y1: int, c: Color) -> None:
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def outline_rect(self, x: int, y: int, w: int, h: int, c: Color) -> None:
        self.hline(x, y, w, c)
        self.hline(x, y + h - 1, w, c)
        self.vline(x, y, h, c)
        self.vline(x + w - 1, y, h, c)

    def disc(self, cx: float, cy: float, r: float, c: Color) -> None:
        for yy in range(int(cy - r - 1), int(cy + r + 2)):
            for xx in range(int(cx - r - 1), int(cx + r + 2)):
                if (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r:
                    self.set(xx, yy, c)

    def shade_rect(self, x: int, y: int, w: int, h: int, amount: float) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < self.w and 0 <= yy < self.h:
                    c = self.px[xx, yy]
                    if c[3]:
                        self.px[xx, yy] = shade(c, amount)

    def ascii(self, x: int, y: int, rows: Sequence[str], palette: Dict[str, Color]) -> None:
        """Paint an ASCII pixel map. '.' and ' ' are transparent/skip."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in ".  ":
                    continue
                if ch not in palette:
                    raise KeyError(f"palette missing '{ch}'")
                self.set(x + i, y + j, palette[ch])

    def save(self, path: str) -> None:
        import os

        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.img.save(path, optimize=True)


# ---------------------------------------------------------------------------
# Box-UV helpers (Bedrock "box uv" layout)
# ---------------------------------------------------------------------------

def box_faces(u: int, v: int, w: int, h: int, d: int) -> Dict[str, Tuple[int, int, int, int]]:
    """Return the rectangle (x, y, width, height) of each face of a cube.

    Bedrock box UV: row 1 = [d] top(w) bottom(w); row 2 = west(d) north(w)
    east(d) south(w). North (-Z) is the front of an entity.
    """
    return {
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
        "west": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "east": (u + d + w, v + d, d, h),
        "south": (u + d + w + d, v + d, w, h),
    }


def box_size(w: int, h: int, d: int) -> Tuple[int, int]:
    return (2 * (w + d), h + d)


class UVPacker:
    """Greedy shelf packer for box-UV regions."""

    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.x = 0
        self.y = 0
        self.shelf = 0

    def place(self, w: int, h: int, d: int) -> Tuple[int, int]:
        bw, bh = box_size(w, h, d)
        if self.x + bw > self.width:
            self.x = 0
            self.y += self.shelf
            self.shelf = 0
        if self.y + bh > self.height:
            raise ValueError(f"UV atlas overflow placing {w}x{h}x{d}")
        pos = (self.x, self.y)
        self.x += bw
        self.shelf = max(self.shelf, bh)
        return pos


def radial_sprite(c: Canvas, x0: int, y0: int, size: int, color: Color, falloff: float = 1.6,
                  ring: Optional[Tuple[float, float]] = None) -> None:
    """Soft glow / ring sprite into a square cell."""
    cx = cy = size / 2
    for yy in range(size):
        for xx in range(size):
            dx = (xx + 0.5 - cx) / (size / 2)
            dy = (yy + 0.5 - cy) / (size / 2)
            r = math.sqrt(dx * dx + dy * dy)
            if ring:
                center, width = ring
                a = max(0.0, 1 - abs(r - center) / width)
                a = a ** 1.5
            else:
                a = max(0.0, 1 - r) ** falloff
            if a > 0.01:
                c.set(x0 + xx, y0 + yy, (color[0], color[1], color[2], int(255 * min(1.0, a))))


def iter_rect(rect: Tuple[int, int, int, int]) -> Iterable[Tuple[int, int]]:
    x, y, w, h = rect
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            yield xx, yy
