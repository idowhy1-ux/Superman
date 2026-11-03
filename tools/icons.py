"""On-screen icons: the HUD glyph sheet (font/glyph_E5.png), Power Wheel
icons (textures/ui/superhuman/*.png) and the nano item icons.

Glyph sheet layout (16x16 cells, character U+E5rc = row r, column c):
  row 0/1/2/7 : hero-suit abilities  normal / selected / locked / cooldown
  row 3/4/5/8 : nano-suit abilities  normal / selected / locked / cooldown
  row 6       : HUD symbols (sun, bolt, star, shield, speed, warning, ...)
Keep in sync with scripts/constants.js (ICON) and scripts/abilities.js (ROWS).
"""
from __future__ import annotations

import math
import os
from typing import Callable, Dict, List, Tuple

from art import Canvas, rgba, shade, mix

W = rgba("#ffffff")
K = rgba("#10131a")
RED = rgba("#ff3b2f")
ORANGE = rgba("#ff9a1f")
YELLOW = rgba("#ffe066")
GOLD = rgba("#f6c430")
ICE = rgba("#bff3ff")
CYAN = rgba("#46d9ff")
BLUE = rgba("#2f7bff")
GREEN = rgba("#45ff5a")
DKGREEN = rgba("#118a2a")
GRAY = rgba("#9aa4ad")
NRED = rgba("#c8161d")


def _line(c: Canvas, x0, y0, x1, y1, col, ox, oy):
    c.line(ox + x0, oy + y0, ox + x1, oy + y1, col)


# ---------------------------------------------------------------------------
# 12x12 ability art. Each painter draws at offset (ox, oy).
# ---------------------------------------------------------------------------

def art_heat(c, ox, oy):
    for ex in (1, 6):
        c.rect(ox + ex, oy + 1, 3, 2, RED)
        c.set(ox + ex + 1, oy + 1, W)
    for ex in (2, 7):
        _line(c, ex, 3, ex + 4, 10, ORANGE, ox, oy)
        _line(c, ex + 1, 3, ex + 4, 8, YELLOW, ox, oy)


def art_freeze(c, ox, oy):
    cx, cy = 5.5, 5.5
    for a in range(0, 360, 60):
        r = math.radians(a)
        for d in range(0, 6):
            c.set(ox + int(round(cx + math.cos(r) * d)), oy + int(round(cy + math.sin(r) * d)), ICE if d > 1 else CYAN)
    c.disc(ox + cx + 0.5, oy + cy + 0.5, 1.3, BLUE)


def art_xray(c, ox, oy):
    for x in range(12):
        h = int(round(3.2 * math.sin(math.pi * (x + 0.5) / 12)))
        for y in range(6 - h, 6 + h):
            c.set(ox + x, oy + y, W)
    c.disc(ox + 6, oy + 6, 2.6, GREEN)
    c.disc(ox + 6, oy + 6, 1.2, DKGREEN)
    c.set(ox + 5, oy + 4, W)


def art_clap(c, ox, oy):
    for r, col in ((5.5, W), (3.6, ICE)):
        for a in range(0, 360, 12):
            t = math.radians(a)
            c.set(ox + int(round(5.5 + math.cos(t) * r)), oy + int(round(5.5 + math.sin(t) * r)), col)
    c.disc(ox + 6, oy + 6, 1.6, YELLOW)


def art_flare(c, ox, oy):
    for a in range(0, 360, 45):
        t = math.radians(a)
        for d in (4, 5):
            c.set(ox + int(round(5.5 + math.cos(t) * d)), oy + int(round(5.5 + math.sin(t) * d)), ORANGE)
    c.disc(ox + 6, oy + 6, 3.3, GOLD)
    c.disc(ox + 6, oy + 6, 1.6, rgba("#fff6c8"))


def art_repulsor(c, ox, oy):
    c.disc(ox + 6, oy + 6, 5.6, NRED)
    c.disc(ox + 6, oy + 6, 4.0, rgba("#30363d"))
    c.disc(ox + 6, oy + 6, 2.9, CYAN)
    c.disc(ox + 6, oy + 6, 1.4, W)


def art_scan(c, ox, oy):
    for a in range(0, 360, 10):
        t = math.radians(a)
        c.set(ox + int(round(5.5 + math.cos(t) * 5)), oy + int(round(5.5 + math.sin(t) * 5)), CYAN)
    c.hline(ox, oy + 6, 4, CYAN)
    c.hline(ox + 8, oy + 6, 4, CYAN)
    c.vline(ox + 6, oy, 4, CYAN)
    c.vline(ox + 6, oy + 8, 4, CYAN)
    c.set(ox + 6, oy + 6, RED)


def art_missiles(c, ox, oy):
    for sx, sy in ((0, 6), (4, 3), (8, 0)):
        _line(c, sx, sy + 5, sx + 3, sy + 2, W, ox, oy)
        _line(c, sx + 1, sy + 5, sx + 3, sy + 3, GRAY, ox, oy)
        c.set(ox + sx + 3, oy + sy + 1, RED)
        c.set(ox + sx, oy + sy + 6, ORANGE)


def art_shield(c, ox, oy):
    pts = [(6 + 5.4 * math.cos(math.radians(a + 30)), 6 + 5.4 * math.sin(math.radians(a + 30))) for a in range(0, 360, 60)]
    for yy in range(12):
        for xx in range(12):
            px, py = xx + 0.5, yy + 0.5
            inside = True
            for i in range(6):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % 6]
                if (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1) < 0:
                    inside = False
                    break
            if inside:
                c.set(ox + xx, oy + yy, mix(BLUE, CYAN, yy / 12))
    for i in range(6):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % 6]
        c.line(ox + int(round(x1 - 0.5)), oy + int(round(y1 - 0.5)), ox + int(round(x2 - 0.5)), oy + int(round(y2 - 0.5)), ICE)


def art_blade(c, ox, oy):
    _line(c, 1, 10, 10, 1, GOLD, ox, oy)
    _line(c, 2, 10, 10, 2, NRED, ox, oy)
    _line(c, 1, 9, 9, 1, rgba("#ffd9a0"), ox, oy)
    c.rect(ox, oy + 9, 3, 3, rgba("#30363d"))


def art_unibeam(c, ox, oy):
    c.disc(ox + 3, oy + 6, 3.0, CYAN)
    c.disc(ox + 3, oy + 6, 1.5, W)
    for y, col in ((4, ICE), (5, W), (6, W), (7, ICE)):
        c.hline(ox + 6, oy + y, 6, col)


SUPER_ART = [art_heat, art_freeze, art_xray, art_clap, art_flare]
IRON_ART = [art_repulsor, art_scan, art_missiles, art_shield, art_blade, art_unibeam]


# ---------------------------------------------------------------------------
# 16x16 HUD symbols (row 6)
# ---------------------------------------------------------------------------

def sym_sun(c, ox, oy):
    art_flare(c, ox + 2, oy + 2)


def sym_bolt(c, ox, oy):
    pts = [(9, 1), (4, 8), (8, 8), (6, 14), (12, 6), (8, 6), (10, 1)]
    for i in range(len(pts) - 1):
        c.line(ox + pts[i][0], oy + pts[i][1], ox + pts[i + 1][0], oy + pts[i + 1][1], CYAN)
    for y in range(3, 12):
        for x in range(4, 12):
            pass
    c.line(ox + 8, oy + 3, ox + 6, oy + 7, W)


def sym_star(c, ox, oy):
    cx, cy = 7.5, 8
    pts = []
    for i in range(10):
        r = 6.5 if i % 2 == 0 else 2.8
        a = math.radians(-90 + i * 36)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    for yy in range(16):
        for xx in range(16):
            px, py = xx + 0.5, yy + 0.5
            inside = False
            j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i]
                xj, yj = pts[j]
                if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi:
                    inside = not inside
                j = i
            if inside:
                c.set(ox + xx, oy + yy, GOLD)


def sym_shield(c, ox, oy):
    for y in range(2, 15):
        half = 6 if y < 9 else max(0, 6 - (y - 8))
        for x in range(8 - half, 8 + half):
            c.set(ox + x, oy + y, NRED if (x + y) % 5 else shade(NRED, -0.2))
    c.disc(ox + 8, oy + 7, 2.2, GOLD)


def sym_speed(c, ox, oy):
    for off in (2, 7):
        c.line(ox + off, oy + 3, ox + off + 4, oy + 8, W)
        c.line(ox + off + 4, oy + 8, ox + off, oy + 13, W)
        c.line(ox + off + 1, oy + 3, ox + off + 5, oy + 8, ICE)
        c.line(ox + off + 5, oy + 8, ox + off + 1, oy + 13, ICE)


def sym_warn(c, ox, oy):
    for y in range(2, 15):
        half = (y - 2) // 2 + 1
        for x in range(8 - half, 8 + half):
            c.set(ox + x, oy + y, YELLOW if y < 14 else ORANGE)
    c.rect(ox + 7, oy + 6, 2, 5, K)
    c.rect(ox + 7, oy + 12, 2, 1, K)


def sym_crypto(c, ox, oy):
    for i in range(10):
        w = 2 + (i if i < 5 else 9 - i) // 1
        c.rect(ox + 8 - w // 2, oy + 3 + i, w, 1, GREEN if i % 3 else rgba("#c8ffc4"))


def sym_citizen(c, ox, oy):
    c.disc(ox + 8, oy + 4, 2.6, rgba("#f1c7a5"))
    c.rect(ox + 5, oy + 7, 6, 5, rgba("#3a7bd5"))
    c.rect(ox + 5, oy + 12, 2, 3, rgba("#2c3e66"))
    c.rect(ox + 9, oy + 12, 2, 3, rgba("#2c3e66"))


def sym_villain(c, ox, oy):
    c.disc(ox + 8, oy + 8, 6, rgba("#4a0d12"))
    c.rect(ox + 4, oy + 6, 3, 2, RED)
    c.rect(ox + 9, oy + 6, 3, 2, RED)
    c.line(ox + 3, oy + 1, ox + 5, oy + 4, rgba("#4a0d12"))
    c.line(ox + 12, oy + 1, ox + 10, oy + 4, rgba("#4a0d12"))
    c.rect(ox + 5, oy + 11, 6, 1, RED)


def sym_fire(c, ox, oy):
    for yy in range(16):
        for xx in range(16):
            dx = (xx - 7.5) / (2 + yy * 0.32)
            dy = (yy - 11) / 4.5
            r = math.sqrt(dx * dx + max(0, dy) ** 2 * 2)
            if yy >= 1 and r < 1:
                c.set(ox + xx, oy + yy, mix(YELLOW, rgba("#ff4500"), 1 - yy / 15))


def sym_attack(c, ox, oy):
    # mouse with the left button lit
    c.rect(ox + 4, oy + 2, 8, 12, rgba("#d8dde3"))
    c.rect(ox + 4, oy + 2, 4, 5, ORANGE)
    c.vline(ox + 8, oy + 2, 5, K)
    c.hline(ox + 4, oy + 7, 8, K)
    c.outline_rect(ox + 4, oy + 2, 8, 12, K)


def sym_sneak(c, ox, oy):
    c.rect(ox + 3, oy + 2, 10, 3, GRAY)
    for i in range(5):
        c.hline(ox + 3 + i, oy + 7 + i, 10 - 2 * i, W)


def sym_jump(c, ox, oy):
    for i in range(5):
        c.hline(ox + 3 + i, oy + 7 - i, 10 - 2 * i, W)
    c.rect(ox + 3, oy + 11, 10, 3, GRAY)


def sym_city(c, ox, oy):
    for x, h, col in ((1, 9, GRAY), (5, 13, rgba("#c9d3dd")), (10, 7, GRAY)):
        c.rect(ox + x, oy + 15 - h, 4, h, col)
        for yy in range(15 - h + 1, 14, 2):
            c.set(ox + x + 1, oy + yy, YELLOW)
            c.set(ox + x + 2, oy + yy, YELLOW)


def sym_heart(c, ox, oy):
    for yy in range(16):
        for xx in range(16):
            x = (xx - 7.5) / 6.5
            y = -(yy - 7) / 6.5
            if (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0:
                c.set(ox + xx, oy + yy, RED)


def sym_check(c, ox, oy):
    c.line(ox + 2, oy + 8, ox + 6, oy + 12, GREEN)
    c.line(ox + 2, oy + 9, ox + 6, oy + 13, GREEN)
    c.line(ox + 6, oy + 12, ox + 13, oy + 3, GREEN)
    c.line(ox + 6, oy + 13, ox + 13, oy + 4, GREEN)


SYMBOLS = [sym_sun, sym_bolt, sym_star, sym_shield, sym_speed, sym_warn, sym_crypto, sym_citizen,
           sym_villain, sym_fire, sym_attack, sym_sneak, sym_jump, sym_city, sym_heart, sym_check]

# ---------------------------------------------------------------------------
# Composition
# ---------------------------------------------------------------------------
FRAMES = {
    "normal": (rgba("#7f8a9b"), rgba("#141a24", 225), None),
    "selected": (rgba("#ffd23f"), rgba("#3a2e08", 235), rgba("#fff2a8")),
    "locked": (rgba("#3a3f47"), rgba("#0e1116", 215), None),
    "cooldown": (rgba("#b0413a"), rgba("#1c1010", 225), None),
}


def ability_cell(c: Canvas, x0: int, y0: int, art, variant: str) -> None:
    border, bg, inner = FRAMES[variant]
    c.rect(x0 + 1, y0 + 1, 14, 14, bg)
    c.outline_rect(x0, y0, 16, 16, border)
    c.set(x0, y0, (0, 0, 0, 0))
    c.set(x0 + 15, y0, (0, 0, 0, 0))
    c.set(x0, y0 + 15, (0, 0, 0, 0))
    c.set(x0 + 15, y0 + 15, (0, 0, 0, 0))
    if inner:
        c.outline_rect(x0 + 1, y0 + 1, 14, 14, inner)
    tmp = Canvas(12, 12)
    art(tmp, 0, 0)
    for yy in range(12):
        for xx in range(12):
            r, g, b, a = tmp.get(xx, yy)
            if a == 0:
                continue
            col = (r, g, b, a)
            if variant == "locked":
                lum = int(0.3 * r + 0.59 * g + 0.11 * b)
                col = (lum // 3 + 20, lum // 3 + 22, lum // 3 + 26, 255)
            elif variant == "cooldown":
                col = shade(col, -0.5)
            c.set(x0 + 2 + xx, y0 + 2 + yy, col)
    if variant == "locked":
        lock = rgba("#c9a227")
        c.rect(x0 + 10, y0 + 11, 4, 3, lock)
        c.outline_rect(x0 + 10, y0 + 9, 4, 3, lock)


def glyph_sheet(out: str) -> None:
    c = Canvas(256, 256)
    rows = {"normal": (0, 3), "selected": (1, 4), "locked": (2, 5), "cooldown": (7, 8)}
    for variant, (srow, irow) in rows.items():
        for col, art in enumerate(SUPER_ART):
            ability_cell(c, col * 16, srow * 16, art, variant)
        for col, art in enumerate(IRON_ART):
            ability_cell(c, col * 16, irow * 16, art, variant)
    for col, sym in enumerate(SYMBOLS):
        sym(c, col * 16, 6 * 16)
    c.save(out)


def _upscale(src: Canvas, factor: int) -> Canvas:
    out = Canvas(src.w * factor, src.h * factor)
    for y in range(src.h):
        for x in range(src.w):
            col = src.get(x, y)
            if col[3]:
                out.rect(x * factor, y * factor, factor, factor, col)
    return out


def wheel_icons(out_dir: str) -> None:
    names_super = ["heat", "freeze", "xray", "clap", "flare"]
    names_iron = ["repulsor", "scan", "missiles", "shield", "blade", "unibeam"]
    for name, art in list(zip(names_super, SUPER_ART)) + list(zip(names_iron, IRON_ART)):
        c = Canvas(16, 16)
        ability_cell(c, 0, 0, art, "normal")
        _upscale(c, 2).save(os.path.join(out_dir, f"{name}.png"))

    def framed(painter) -> Canvas:
        c = Canvas(16, 16)
        c.rect(1, 1, 14, 14, rgba("#141a24", 225))
        c.outline_rect(0, 0, 16, 16, rgba("#7f8a9b"))
        tmp = Canvas(16, 16)
        painter(tmp, 0, 0)
        for y in range(16):
            for x in range(16):
                col = tmp.get(x, y)
                if col[3] and 1 <= x <= 14 and 1 <= y <= 14:
                    c.set(x, y, col)
        return c

    def core(c, ox, oy):
        c.disc(ox + 8, oy + 8, 6, rgba("#5d636b"))
        c.disc(ox + 8, oy + 8, 4.4, CYAN)
        c.disc(ox + 8, oy + 8, 2.2, W)

    def gear(c, ox, oy):
        for a in range(0, 360, 45):
            t = math.radians(a)
            c.disc(ox + 8 + math.cos(t) * 5, oy + 8 + math.sin(t) * 5, 1.6, GRAY)
        c.disc(ox + 8, oy + 8, 4.4, GRAY)
        c.disc(ox + 8, oy + 8, 1.8, K)

    def tools(c, ox, oy):
        c.line(ox + 3, oy + 13, ox + 12, oy + 4, rgba("#b07d4a"))
        c.line(ox + 4, oy + 13, ox + 12, oy + 5, rgba("#8a5a2b"))
        c.rect(ox + 9, oy + 2, 5, 3, GRAY)

    for name, painter in (("nano_core", core), ("profile", sym_star), ("city", sym_city), ("controls", sym_attack),
                          ("settings", gear), ("tools", tools)):
        _upscale(framed(painter), 2).save(os.path.join(out_dir, f"{name}.png"))


def nano_item_icons(out_dir: str) -> None:
    c = Canvas(16, 16)
    c.disc(7.5, 7.5, 7.6, rgba("#2b2e33"))
    c.disc(7.5, 7.5, 6.6, rgba("#7c8792"))
    c.disc(7.5, 7.5, 5.0, rgba("#1d6f86"))
    c.disc(7.5, 7.5, 3.8, CYAN)
    c.disc(7.5, 7.5, 2.0, W)
    for a in range(0, 360, 60):
        t = math.radians(a)
        c.set(int(round(7.5 + math.cos(t) * 6.0)), int(round(7.5 + math.sin(t) * 6.0)), rgba("#2b2e33"))
    c.save(os.path.join(out_dir, "nano_core.png"))

    helmet = [
        "....kkkkkkk.....",
        "...kRRRRRRRk....",
        "..kRRRRRRRRRk...",
        "..kRGGGGGGGRk...",
        ".kRGGGGGGGGGRk..",
        ".kRGCCGGGCCGRk..",
        ".kRGGGGGGGGGRk..",
        ".kRRGGGGGGGRRk..",
        ".kRRGGgggGGRRk..",
        "..kRRGGGGGRRk...",
        "..kRRRGGGRRRk...",
        "...kkRRRRRkk....",
        ".....kkkkk......",
        "................",
        "................",
        "................",
    ]
    c = Canvas(16, 16)
    c.ascii(0, 1, helmet, {"k": rgba("#2b2e33"), "R": NRED, "G": GOLD, "g": rgba("#9c7419"), "C": rgba("#c8fbff")})
    c.save(os.path.join(out_dir, "nano_suit.png"))
