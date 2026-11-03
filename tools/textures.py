"""Procedural pixel-art textures for the Heroes add-on."""
from __future__ import annotations

import math
import os
from typing import Dict, Optional

from art import TRANSPARENT, Canvas, box_faces, iter_rect, mix, radial_sprite, rgba, shade
from models import Model

# ---------------------------------------------------------------------------
# Palettes
# ---------------------------------------------------------------------------
SUIT_BLUE = rgba("#2350c8")
SUIT_BLUE_DARK = rgba("#16348a")
SUIT_BLUE_LIGHT = rgba("#4a7ff0")
CAPE_RED = rgba("#c8161d")
CAPE_RED_DARK = rgba("#8a0d12")
GOLD = rgba("#f6c430")
GOLD_DARK = rgba("#b07d0c")
BOOT_RED = rgba("#b3141a")
CRYPTO = rgba("#3dff4f")
CRYPTO_DARK = rgba("#0f7a22")
CRYPTO_LIGHT = rgba("#c8ffc4")


# ---------------------------------------------------------------------------
# Hero suit + cape (attachable texture, 64x64)
# ---------------------------------------------------------------------------

def paint_fabric(c: Canvas, rect, base, var=0.05):
    x, y, w, h = rect
    c.noise_rect(x, y, w, h, base, var)


def hero_suit_texture(model: Model, out: str) -> None:
    c = Canvas(64, 64, seed=7)
    model.assign_uvs()
    for bone, cube in model.cubes():
        w, h, d = cube.size
        faces = box_faces(cube.uv[0], cube.uv[1], w, h, d)
        if cube.mat == "body":
            for name, r in faces.items():
                paint_fabric(c, r, SUIT_BLUE)
            fx, fy, fw, fh = faces["north"]
            # muscle shading / highlights
            c.shade_rect(fx, fy, 1, fh, -0.25)
            c.shade_rect(fx + fw - 1, fy, 1, fh, -0.25)
            c.shade_rect(fx + 3, fy + 7, 2, 2, -0.12)
            # sun-disc emblem (original design)
            emblem = [
                "..YYYY..",
                ".YRRRRY.",
                ".YRYYRY.",
                ".YRYYRY.",
                ".YRRRRY.",
                "..YYYY..",
            ]
            c.ascii(fx, fy + 1, emblem, {"Y": GOLD, "R": CAPE_RED})
            c.set(fx + 3, fy + 3, shade(GOLD, 0.45))
            # belt on every side
            for name in ("north", "south", "west", "east"):
                bx, by, bw, bh = faces[name]
                c.rect(bx, by + 10, bw, 1, GOLD)
                c.rect(bx, by + 11, bw, 1, GOLD_DARK)
            c.rect(fx + 3, fy + 10, 2, 2, shade(GOLD, -0.35))  # buckle
            c.set(fx + 3, fy + 10, shade(GOLD, 0.4))
            # collar
            c.rect(fx + 2, fy, 4, 1, SUIT_BLUE_DARK)
            ux, uy, uw, uh = faces["up"]
            c.rect(ux + 2, uy + 1, 4, 2, SUIT_BLUE_DARK)
        elif cube.mat == "arm":
            for name, r in faces.items():
                paint_fabric(c, r, SUIT_BLUE)
            for name in ("north", "south", "west", "east"):
                bx, by, bw, bh = faces[name]
                c.rect(bx, by, bw, 1, SUIT_BLUE_LIGHT)          # shoulder highlight
                c.rect(bx, by + 9, bw, 1, SUIT_BLUE_DARK)       # cuff line
                c.rect(bx, by + 10, bw, 2, shade(SUIT_BLUE, -0.15))  # gloves
            dx, dy, dw, dh = faces["down"]
            c.rect(dx, dy, dw, dh, shade(SUIT_BLUE, -0.2))
        elif cube.mat == "leg":
            for name, r in faces.items():
                paint_fabric(c, r, SUIT_BLUE)
            for name in ("north", "south", "west", "east"):
                bx, by, bw, bh = faces[name]
                c.noise_rect(bx, by + 6, bw, 6, BOOT_RED, 0.05)
                c.rect(bx, by + 6, bw, 1, GOLD)               # boot trim
                c.rect(bx, by + 11, bw, 1, shade(BOOT_RED, -0.4))  # sole edge
            nx, ny, nw, nh = faces["north"]
            # boot "V" notch
            c.set(nx + 1, ny + 7, GOLD)
            c.set(nx + 2, ny + 7, GOLD)
            c.set(nx + 1, ny + 6, SUIT_BLUE)
            c.set(nx + 2, ny + 6, SUIT_BLUE)
            dx, dy, dw, dh = faces["down"]
            c.rect(dx, dy, dw, dh, shade(BOOT_RED, -0.5))
        elif cube.mat in ("cape_top", "cape_bottom"):
            for name, r in faces.items():
                x, y, fw, fh = r
                for yy in range(fh):
                    for xx in range(fw):
                        fold = 0.12 if (xx % 3 == 0) else (-0.06 if xx % 3 == 1 else 0.0)
                        v = (c.rng.random() * 2 - 1) * 0.04
                        c.set(x + xx, y + yy, shade(CAPE_RED, fold + v))
            if cube.mat == "cape_bottom":
                for name in ("north", "south", "west", "east"):
                    bx, by, bw, bh = faces[name]
                    c.rect(bx, by + bh - 1, bw, 1, GOLD_DARK)
                    c.rect(bx, by + bh - 2, bw, 1, CAPE_RED_DARK)
            else:
                sx, sy, sw, sh = faces["south"]
                # subtle emblem on the outside of the cape
                c.ascii(sx + 3, sy + 3, [".YY.", "YRRY", "YRRY", ".YY."], {"Y": GOLD_DARK, "R": CAPE_RED_DARK})
        elif cube.mat == "clasp":
            for name, r in faces.items():
                x, y, fw, fh = r
                c.rect(x, y, fw, fh, GOLD)
            nx, ny, nw, nh = faces["north"]
            c.set(nx, ny, shade(GOLD, 0.5))
    c.save(out)


# ---------------------------------------------------------------------------
# Humanoid skins (civilians, thugs, Pyroclast, Viridian)
# ---------------------------------------------------------------------------
HEAD = box_faces(0, 0, 8, 8, 8)
HAT = box_faces(32, 0, 8, 8, 8)
BODY = box_faces(16, 16, 8, 12, 4)
JACKET = box_faces(16, 32, 8, 12, 4)
RARM = box_faces(40, 16, 4, 12, 4)
RSLEEVE = box_faces(40, 32, 4, 12, 4)
LARM = box_faces(32, 48, 4, 12, 4)
LSLEEVE = box_faces(48, 48, 4, 12, 4)
RLEG = box_faces(0, 16, 4, 12, 4)
RPANTS = box_faces(0, 32, 4, 12, 4)
LLEG = box_faces(16, 48, 4, 12, 4)
LPANTS = box_faces(0, 48, 4, 12, 4)


def fill_box(c: Canvas, faces, col, var=0.05):
    for r in faces.values():
        c.noise_rect(*r, col, var)


def side_rows(c: Canvas, faces, y0, rows, col, var=0.04, sides=("north", "south", "west", "east")):
    for s in sides:
        x, y, w, h = faces[s]
        c.noise_rect(x, y + y0, w, rows, col, var)


def paint_face(c: Canvas, spec: Dict) -> None:
    skin = spec["skin"]
    fx, fy, _, _ = HEAD["north"]
    eye = spec.get("eye", rgba("#3b6bd6"))
    white = spec.get("eye_white", rgba("#f4f4f4"))
    c.set(fx + 1, fy + 4, white)
    c.set(fx + 2, fy + 4, eye)
    c.set(fx + 5, fy + 4, eye)
    c.set(fx + 6, fy + 4, white)
    brow = spec.get("brow", shade(spec.get("hair") or skin, -0.1))
    if spec.get("brows", True):
        c.set(fx + 1, fy + 3, brow)
        c.set(fx + 2, fy + 3, brow)
        c.set(fx + 5, fy + 3, brow)
        c.set(fx + 6, fy + 3, brow)
    c.set(fx + 3, fy + 5, shade(skin, -0.12))
    c.set(fx + 4, fy + 5, shade(skin, -0.12))
    mouth = spec.get("mouth", shade(skin, -0.38))
    c.rect(fx + 3, fy + 6, 2, 1, mouth)
    if spec.get("beard"):
        b = spec["beard"]
        c.rect(fx + 1, fy + 6, 2, 2, b)
        c.rect(fx + 5, fy + 6, 2, 2, b)
        c.rect(fx + 2, fy + 7, 4, 1, b)
        c.rect(fx + 3, fy + 7, 2, 1, shade(b, -0.1))
    if spec.get("glasses"):
        g = spec["glasses"]
        c.rect(fx, fy + 4, 8, 1, g)
        c.set(fx + 1, fy + 4, rgba("#bfe3ff"))
        c.set(fx + 2, fy + 4, rgba("#9cc9ef"))
        c.set(fx + 5, fy + 4, rgba("#9cc9ef"))
        c.set(fx + 6, fy + 4, rgba("#bfe3ff"))


def paint_hair(c: Canvas, spec: Dict) -> None:
    hair = spec.get("hair")
    style = spec.get("hair_style", "short")
    if hair is None or style == "bald":
        return
    c.noise_rect(*HEAD["up"], hair, 0.08)
    fx, fy, _, _ = HEAD["north"]
    if style in ("short", "long", "bun", "curly"):
        c.noise_rect(fx, fy, 8, 2, hair, 0.08)
        c.set(fx, fy + 2, hair)
        c.set(fx + 7, fy + 2, hair)
        if style == "curly":
            for i in range(0, 8, 2):
                c.set(fx + i, fy + 2, shade(hair, 0.1))
    for s in ("west", "east"):
        x, y, w, h = HEAD[s]
        rows = 7 if style == "long" else 3
        c.noise_rect(x, y, w, rows, hair, 0.08)
        if style != "long":
            c.noise_rect(x + (5 if s == "west" else 0), y + 3, 3, 1, hair, 0.08)
    bx, by, bw, bh = HEAD["south"]
    c.noise_rect(bx, by, bw, 8 if style == "long" else 5, hair, 0.08)
    if style == "bun":
        hx, hy, hw, hh = HAT["south"]
        c.noise_rect(hx + 2, hy + 1, 4, 3, shade(hair, -0.05), 0.08)
    if style == "long":
        # hair over the back of the jacket layer
        jx, jy, jw, jh = JACKET["south"]
        c.noise_rect(jx + 1, jy, jw - 2, 3, hair, 0.08)


def paint_skin_base(c: Canvas, skin) -> None:
    for faces in (HEAD, BODY, RARM, LARM, RLEG, LLEG):
        fill_box(c, faces, skin, 0.035)


def paint_outfit(c: Canvas, spec: Dict) -> None:
    shirt = spec.get("shirt", rgba("#3a7bd5"))
    pants = spec.get("pants", rgba("#2c3e66"))
    shoes = spec.get("shoes", rgba("#3b2a1a"))
    style = spec.get("style", "tshirt")
    skin = spec["skin"]

    # torso
    fill_box(c, BODY, shirt, 0.05)
    nx, ny, nw, nh = BODY["north"]
    if style == "suit":
        c.noise_rect(nx + 3, ny, 2, 6, rgba("#f2f2f2"), 0.02)
        c.rect(nx + 3, ny + 1, 2, 5, spec.get("tie", rgba("#b3202a")))
        c.set(nx + 2, ny, shade(shirt, -0.3))
        c.set(nx + 5, ny, shade(shirt, -0.3))
        c.rect(nx + 3, ny + 6, 2, 1, shade(shirt, -0.2))
    elif style == "tshirt":
        c.rect(nx + 3, ny, 2, 1, skin)
        if spec.get("logo"):
            c.rect(nx + 2, ny + 3, 4, 3, spec["logo"])
    elif style == "hoodie":
        c.rect(nx + 2, ny + 6, 4, 3, shade(shirt, -0.15))  # pocket
        c.set(nx + 3, ny + 1, rgba("#dddddd"))
        c.set(nx + 4, ny + 1, rgba("#dddddd"))
        c.set(nx + 3, ny + 2, rgba("#dddddd"))
        c.set(nx + 4, ny + 3, rgba("#dddddd"))
    elif style == "vest":
        side_rows(c, BODY, 0, 12, spec.get("under", rgba("#6d6d6d")), 0.04)
        vest = rgba("#ff7a1a")
        for s in ("north", "south"):
            x, y, w, h = BODY[s]
            c.noise_rect(x, y, w, 9, vest, 0.05)
            c.rect(x, y + 4, w, 1, rgba("#d9e0e3"))
        c.rect(nx + 3, ny, 2, 9, spec.get("under", rgba("#6d6d6d")))
    elif style == "coat":
        c.rect(nx + 3, ny, 2, 12, spec.get("under", rgba("#7fb3e6")))
        c.set(nx + 1, ny + 3, rgba("#c0392b"))  # name badge / cross
    elif style == "dress":
        c.rect(nx, ny + 9, nw, 1, shade(shirt, 0.15))
    if style not in ("vest",):
        bx, by, bw, bh = BODY["north"]
        c.rect(bx, by + 11, bw, 1, spec.get("belt", shade(pants, -0.25)))

    # arms
    sleeves = spec.get("sleeves", "short" if style in ("tshirt", "dress") else "long")
    for faces in (RARM, LARM):
        fill_box(c, faces, skin, 0.035)
        if sleeves == "short":
            side_rows(c, faces, 0, 4, shirt, 0.05)
            c.noise_rect(*faces["up"], shirt, 0.05)
        else:
            sleeve_col = spec.get("sleeve_color", shirt if style != "vest" else spec.get("under", rgba("#6d6d6d")))
            side_rows(c, faces, 0, 11, sleeve_col, 0.05)
            c.noise_rect(*faces["up"], sleeve_col, 0.05)
            side_rows(c, faces, 10, 1, shade(sleeve_col, -0.2), 0.0)
        if spec.get("gloves"):
            side_rows(c, faces, 10, 2, spec["gloves"], 0.04)
            c.noise_rect(*faces["down"], spec["gloves"], 0.04)

    # legs
    for faces in (RLEG, LLEG):
        if style == "dress":
            fill_box(c, faces, skin, 0.035)
            side_rows(c, faces, 0, 6, shirt, 0.05)
            c.noise_rect(*faces["up"], shirt, 0.05)
        else:
            fill_box(c, faces, pants, 0.05)
        side_rows(c, faces, 10, 2, shoes, 0.05)
        c.noise_rect(*faces["down"], shade(shoes, -0.2), 0.05)


def paint_overlay_extras(c: Canvas, spec: Dict) -> None:
    hat = spec.get("hat")
    if hat == "hardhat":
        col = rgba("#ffd21f")
        for s in ("north", "south", "west", "east"):
            x, y, w, h = HAT[s]
            c.noise_rect(x, y, w, 2, col, 0.05)
        c.noise_rect(*HAT["up"], col, 0.05)
        x, y, w, h = HAT["north"]
        c.rect(x, y + 2, w, 1, shade(col, -0.25))
    elif hat == "beanie":
        col = spec.get("hat_color", rgba("#1f1f1f"))
        for s in ("north", "south", "west", "east"):
            x, y, w, h = HAT[s]
            c.noise_rect(x, y, w, 3, col, 0.06)
        c.noise_rect(*HAT["up"], col, 0.06)
    elif hat == "hood":
        col = spec.get("hat_color", spec.get("shirt"))
        for s in ("south", "west", "east"):
            x, y, w, h = HAT[s]
            c.noise_rect(x, y, w, h, col, 0.05)
        c.noise_rect(*HAT["up"], col, 0.05)
        x, y, w, h = HAT["north"]
        c.noise_rect(x, y, w, 1, col, 0.05)
        c.set(x, y + 1, col)
        c.set(x + 7, y + 1, col)
    elif hat == "flames":
        for s in ("north", "south", "west", "east", "up"):
            x, y, w, h = HAT[s]
            for xx in range(w):
                height = c.rng.randint(1, 4) if s != "up" else h
                for yy in range(height):
                    t = yy / max(1, height)
                    col = mix(rgba("#fff36b"), rgba("#ff5a00"), t)
                    if s != "up":
                        c.set(x + xx, y + yy, col)
                    else:
                        c.set(x + xx, y + yy, mix(rgba("#ffb000"), rgba("#ff3d00"), c.rng.random()))
    if spec.get("mask"):
        m = spec["mask"]
        x, y, w, h = HAT["north"]
        c.noise_rect(x, y + 5, w, 3, m, 0.06)
        for s in ("west", "east", "south"):
            sx, sy, sw, sh = HAT[s]
            c.noise_rect(sx, sy + 5, sw, 2, m, 0.06)
    if spec.get("jacket"):
        j = spec["jacket"]
        for s in ("south", "west", "east"):
            x, y, w, h = JACKET[s]
            c.noise_rect(x, y, w, 10, j, 0.06)
        x, y, w, h = JACKET["north"]
        c.noise_rect(x, y, 3, 10, j, 0.06)
        c.noise_rect(x + 5, y, 3, 10, j, 0.06)
        for faces in (RSLEEVE, LSLEEVE):
            side_rows(c, faces, 0, 9, j, 0.06)
            c.noise_rect(*faces["up"], j, 0.06)


def humanoid_skin(spec: Dict, out: str, seed: int = 1) -> None:
    c = Canvas(64, 64, seed=seed)
    paint_skin_base(c, spec["skin"])
    paint_outfit(c, spec)
    paint_hair(c, spec)
    paint_face(c, spec)
    paint_overlay_extras(c, spec)
    post = spec.get("post")
    if post:
        post(c, spec)
    c.save(out)


CIVILIANS = [
    dict(skin=rgba("#f1c7a5"), hair=rgba("#5a3a1a"), hair_style="short", style="suit", shirt=rgba("#2f3542"),
         pants=rgba("#2f3542"), shoes=rgba("#1b1b1b"), tie=rgba("#c0392b"), eye=rgba("#2e86de")),
    dict(skin=rgba("#c68e62"), hair=rgba("#1d1209"), hair_style="long", style="dress", shirt=rgba("#e84393"),
         shoes=rgba("#6c1d45"), eye=rgba("#4b2e14")),
    dict(skin=rgba("#8d5524"), hair=rgba("#140c06"), hair_style="curly", style="tshirt", shirt=rgba("#27ae60"),
         pants=rgba("#34495e"), shoes=rgba("#ecf0f1"), logo=rgba("#f1c40f"), eye=rgba("#3b2412")),
    dict(skin=rgba("#ffdbb5"), hair=rgba("#e1b55a"), hair_style="bun", style="coat", shirt=rgba("#f5f6fa"),
         under=rgba("#7fb3e6"), pants=rgba("#7fb3e6"), shoes=rgba("#dfe6e9"), glasses=rgba("#2d3436"),
         eye=rgba("#3b8d3b")),
    dict(skin=rgba("#5c3a21"), hair=rgba("#0d0805"), hair_style="short", style="vest", under=rgba("#5a6773"),
         pants=rgba("#3d4f63"), shoes=rgba("#6b4423"), hat="hardhat", beard=rgba("#0d0805"), eye=rgba("#2b1a0e")),
    dict(skin=rgba("#e0ac69"), hair=rgba("#8e2b10"), hair_style="short", style="hoodie", shirt=rgba("#8e44ad"),
         pants=rgba("#2d3436"), shoes=rgba("#d63031"), eye=rgba("#27632a")),
]

THUGS = [
    dict(skin=rgba("#d9a07a"), hair=rgba("#2a1d14"), hair_style="short", style="hoodie", shirt=rgba("#3d3d3d"),
         pants=rgba("#20252e"), shoes=rgba("#e8e8e8"), hat="beanie", hat_color=rgba("#141414"),
         beard=rgba("#3b2a1f"), eye=rgba("#2b2b2b"), brows=True),
    dict(skin=rgba("#9c6b43"), hair=rgba("#140d08"), hair_style="short", style="tshirt", shirt=rgba("#7a0f12"),
         pants=rgba("#1c2330"), shoes=rgba("#121212"), jacket=rgba("#4a2f1b"), mask=rgba("#9e1b1b"),
         eye=rgba("#1d1d1d")),
]


def pyro_post(c: Canvas, spec: Dict) -> None:
    # glowing lava cracks over the charcoal body
    for faces in (HEAD, BODY, RARM, LARM, RLEG, LLEG):
        for r in faces.values():
            x, y, w, h = r
            for _ in range(max(1, (w * h) // 6)):
                xx = x + c.rng.randrange(w)
                yy = y + c.rng.randrange(h)
                col = mix(rgba("#ff6a00"), rgba("#ffd04a"), c.rng.random())
                c.set(xx, yy, col)
                if c.rng.random() < 0.5:
                    c.set(xx + (1 if c.rng.random() < 0.5 else -1), yy, shade(col, -0.25))
    fx, fy, _, _ = HEAD["north"]
    c.rect(fx + 1, fy + 4, 2, 1, rgba("#fff8c2"))
    c.rect(fx + 5, fy + 4, 2, 1, rgba("#fff8c2"))
    c.rect(fx + 2, fy + 6, 4, 1, rgba("#ffb300"))
    nx, ny, _, _ = BODY["north"]
    c.disc(nx + 4, ny + 4, 2.2, rgba("#ffcf3f"))
    c.set(nx + 4, ny + 4, rgba("#fffbe0"))


PYROCLAST = dict(skin=rgba("#2b2522"), hair=None, hair_style="bald", style="tshirt", shirt=rgba("#3a2f2a"),
                 pants=rgba("#2d2420"), shoes=rgba("#1c1513"), sleeves="long", hat="flames", brows=False,
                 eye=rgba("#fff5b0"), eye_white=rgba("#ffd04a"), mouth=rgba("#ff8a00"), post=pyro_post,
                 belt=rgba("#5a1a00"))


def viridian_post(c: Canvas, spec: Dict) -> None:
    nx, ny, _, _ = BODY["north"]
    c.disc(nx + 4, ny + 4, 2.4, CRYPTO)
    c.set(nx + 4, ny + 4, CRYPTO_LIGHT)
    c.set(nx + 3, ny + 3, CRYPTO_LIGHT)
    # glowing seams
    for faces in (BODY, RLEG, LLEG, RARM, LARM):
        for s in ("north", "south"):
            x, y, w, h = faces[s]
            c.vline(x + w // 2, y + 1, h - 2, shade(CRYPTO, -0.35))
    fx, fy, _, _ = HEAD["north"]
    c.rect(fx, fy + 3, 8, 2, rgba("#0b0f0b"))
    c.rect(fx + 1, fy + 3, 2, 2, CRYPTO)
    c.rect(fx + 5, fy + 3, 2, 2, CRYPTO)
    c.set(fx + 1, fy + 3, CRYPTO_LIGHT)
    c.set(fx + 5, fy + 3, CRYPTO_LIGHT)


VIRIDIAN = dict(skin=rgba("#b7c9b0"), hair=rgba("#0d1f0d"), hair_style="short", style="tshirt",
                shirt=rgba("#173d1c"), sleeves="long", sleeve_color=rgba("#0f2612"), pants=rgba("#0f2612"),
                shoes=rgba("#0a0a0a"), gloves=rgba("#2dbb3c"), hat="hood", hat_color=rgba("#0f2b13"),
                brows=False, eye=CRYPTO, post=viridian_post, belt=rgba("#2dbb3c"))


ICE = rgba("#9fdcff")
ICE_LIGHT = rgba("#effbff")
ICE_DARK = rgba("#3d86c6")
VOLT_YELLOW = rgba("#ffe23a")
VOLT_WHITE = rgba("#fffbd0")


def glacius_post(c: Canvas, spec: Dict) -> None:
    # crystalline armour facets: diagonal light streaks and frost cracks
    for faces in (BODY, RARM, LARM, RLEG, LLEG):
        for side in ("north", "south", "west", "east"):
            x, y, w, h = faces[side]
            for k in range(0, h + w, 5):
                for i in range(min(w, h)):
                    xx, yy = x + i, y + k - i
                    if x <= xx < x + w and y <= yy < y + h and c.rng.random() < 0.75:
                        c.set(xx, yy, mix(c.get(xx, yy), ICE_LIGHT, 0.45))
            for _ in range(max(1, (w * h) // 14)):
                xx, yy = x + c.rng.randrange(w), y + c.rng.randrange(h)
                c.set(xx, yy, ICE_LIGHT)
    # ice core on the chest
    nx, ny, _, _ = BODY["north"]
    c.disc(nx + 4, ny + 4, 2.4, ICE)
    c.set(nx + 4, ny + 4, rgba("#ffffff"))
    c.set(nx + 3, ny + 3, ICE_LIGHT)
    c.hline(nx + 1, ny + 4, 6, ICE_LIGHT)
    c.vline(nx + 4, ny + 1, 6, ICE_LIGHT)
    # frozen face: frost on the cheeks, glowing eyes
    fx, fy, _, _ = HEAD["north"]
    c.set(fx, fy + 5, ICE_LIGHT)
    c.set(fx + 7, fy + 5, ICE_LIGHT)
    c.rect(fx + 1, fy + 4, 2, 1, rgba("#7ff6ff"))
    c.rect(fx + 5, fy + 4, 2, 1, rgba("#7ff6ff"))
    c.set(fx + 2, fy + 4, rgba("#ffffff"))
    c.set(fx + 5, fy + 4, rgba("#ffffff"))
    # crown of ice spikes on the hat layer
    for side in ("north", "south", "west", "east"):
        x, y, w, h = HAT[side]
        for xx in range(w):
            height = 3 if (xx % 3 == 1) else (2 if xx % 3 == 0 else 1)
            for yy in range(height):
                c.set(x + xx, y + yy, mix(ICE_LIGHT, ICE, yy / 3))
        c.hline(x, y + 3, w, ICE_DARK if side == "north" else ICE)
    ux, uy, uw, uh = HAT["up"]
    for xx in range(uw):
        c.set(ux + xx, uy, ICE)
        c.set(ux + xx, uy + uh - 1, ICE)
    for yy in range(uh):
        c.set(ux, uy + yy, ICE)
        c.set(ux + uw - 1, uy + yy, ICE)
    # icicles hanging from the forearms (sleeve layer)
    for faces in (RSLEEVE, LSLEEVE):
        for side in ("north", "south", "west", "east"):
            x, y, w, h = faces[side]
            for xx in range(w):
                if c.rng.random() < 0.6:
                    for yy in range(c.rng.randint(1, 3)):
                        c.set(x + xx, y + 7 + yy, mix(ICE_LIGHT, ICE, yy / 3))


GLACIUS = dict(skin=rgba("#cfe6f2"), hair=rgba("#f2fbff"), hair_style="short", style="tshirt",
               shirt=rgba("#4f9fd6"), sleeves="long", sleeve_color=rgba("#3d86c6"), pants=rgba("#2c6aa3"),
               shoes=rgba("#bfe9ff"), gloves=rgba("#dff6ff"), brows=False, eye=rgba("#7ff6ff"),
               eye_white=rgba("#e0ffff"), mouth=rgba("#5d8fb0"), post=glacius_post, belt=rgba("#dff6ff"))


def volt_post(c: Canvas, spec: Dict) -> None:
    # lightning bolt across the chest
    nx, ny, _, _ = BODY["north"]
    bolt = [(5, 0), (4, 1), (4, 2), (3, 3), (2, 4), (3, 4), (4, 4), (5, 4), (4, 5), (3, 6), (3, 7), (2, 8), (2, 9)]
    for bx, by in bolt:
        c.set(nx + bx, ny + by, VOLT_YELLOW)
    for bx, by in bolt[::3]:
        c.set(nx + bx, ny + by, VOLT_WHITE)
    # the same on the back, mirrored
    sx, sy, _, _ = BODY["south"]
    for bx, by in bolt:
        c.set(sx + 7 - bx, sy + by, VOLT_YELLOW)
    # yellow conduit stripes down arms and legs
    for faces in (RARM, LARM, RLEG, LLEG):
        for side in ("west", "east", "north"):
            x, y, w, h = faces[side]
            if side == "north":
                c.set(x + 1, y + 3, VOLT_YELLOW)
                c.set(x + 2, y + 4, VOLT_YELLOW)
                c.set(x + 1, y + 5, VOLT_YELLOW)
                c.set(x + 2, y + 6, VOLT_WHITE)
                continue
            c.vline(x + w // 2, y, h - 2, VOLT_YELLOW)
            for yy in range(0, h - 2, 3):
                c.set(x + w // 2, y + yy, VOLT_WHITE)
    # shoulder coils
    for faces in (RSLEEVE, LSLEEVE):
        for side in ("north", "south", "west", "east"):
            x, y, w, h = faces[side]
            for yy in (0, 2):
                c.hline(x, y + yy, w, rgba("#b87333"))
            c.hline(x, y + 1, w, VOLT_YELLOW)
        c.noise_rect(*faces["up"], rgba("#b87333"), 0.08)
    # goggles with glowing lenses
    fx, fy, _, _ = HEAD["north"]
    c.rect(fx, fy + 3, 8, 3, rgba("#1a1a1f"))
    c.rect(fx + 1, fy + 4, 2, 1, VOLT_YELLOW)
    c.rect(fx + 5, fy + 4, 2, 1, VOLT_YELLOW)
    c.set(fx + 1, fy + 4, VOLT_WHITE)
    c.set(fx + 5, fy + 4, VOLT_WHITE)
    for side in ("west", "east", "south"):
        x, y, w, h = HEAD[side]
        c.hline(x, y + 4, w, rgba("#1a1a1f"))
    # crackling hair spikes on the hat layer
    for side in ("north", "south", "west", "east"):
        x, y, w, h = HAT[side]
        for xx in range(w):
            height = c.rng.randint(1, 3)
            for yy in range(height):
                c.set(x + xx, y + yy, mix(VOLT_WHITE, VOLT_YELLOW, yy / 3))
    ux, uy, uw, uh = HAT["up"]
    for _ in range(uw * uh // 3):
        c.set(ux + c.rng.randrange(uw), uy + c.rng.randrange(uh), mix(VOLT_WHITE, VOLT_YELLOW, c.rng.random()))


VOLT = dict(skin=rgba("#d9a679"), hair=rgba("#fff3a0"), hair_style="short", style="tshirt",
            shirt=rgba("#1c1d26"), sleeves="long", sleeve_color=rgba("#23242f"), pants=rgba("#1c1d26"),
            shoes=rgba("#e8c21c"), gloves=rgba("#e8c21c"), brows=False, eye=VOLT_YELLOW, post=volt_post,
            belt=rgba("#e8c21c"))


# ---------------------------------------------------------------------------
# Big models (auto UV layout) - painted per cube material
# ---------------------------------------------------------------------------

def paint_model(model: Model, out: str, painters: Dict, seed: int = 3) -> None:
    c = Canvas(model.tex_w, model.tex_h, seed=seed)
    model.assign_uvs()
    for bone, cube in model.cubes():
        w, h, d = cube.size
        faces = box_faces(cube.uv[0], cube.uv[1], max(1, w), max(1, h), max(1, d))
        painter = painters.get(cube.mat) or painters["default"]
        painter(c, faces, cube, bone)
    c.save(out)


def rock_faces(c: Canvas, faces, base, crack, light, var=0.09):
    for r in faces.values():
        x, y, w, h = r
        c.noise_rect(x, y, w, h, base, var)
        for _ in range(max(1, (w * h) // 10)):
            xx, yy = x + c.rng.randrange(w), y + c.rng.randrange(h)
            c.set(xx, yy, crack)
            if c.rng.random() < 0.6:
                c.set(xx + 1, yy + (1 if c.rng.random() < 0.5 else 0), crack)
        for _ in range(max(1, (w * h) // 18)):
            c.set(x + c.rng.randrange(w), y + c.rng.randrange(h), light)


def rampager_texture(model: Model, out: str) -> None:
    skin = rgba("#6b6157")
    crack = rgba("#3a332d")
    light = rgba("#8f857a")
    bone_col = rgba("#e8dcc0")

    def skin_p(c, faces, cube, bone):
        rock_faces(c, faces, skin, crack, light)

    def chest_p(c, faces, cube, bone):
        rock_faces(c, faces, shade(skin, -0.08), crack, light)

    def spike_p(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.vgradient(x, y, w, h, bone_col, shade(bone_col, -0.35), 0.04)

    def fist_p(c, faces, cube, bone):
        rock_faces(c, faces, shade(skin, -0.18), crack, light)
        x, y, w, h = faces["north"]
        for i in range(0, w, 2):
            c.set(x + i, y + 1, light)

    def head_p(c, faces, cube, bone):
        rock_faces(c, faces, shade(skin, -0.04), crack, light)
        x, y, w, h = faces["north"]
        c.rect(x, y + 3, w, 1, shade(skin, -0.35))  # brow ridge
        c.rect(x + 2, y + 4, 2, 2, rgba("#ff2a12"))
        c.rect(x + w - 4, y + 4, 2, 2, rgba("#ff2a12"))
        c.set(x + 2, y + 4, rgba("#ffd2a0"))
        c.set(x + w - 4, y + 4, rgba("#ffd2a0"))

    def jaw_p(c, faces, cube, bone):
        rock_faces(c, faces, shade(skin, -0.22), crack, light)
        x, y, w, h = faces["north"]
        for i in range(w):
            if i % 2 == 0:
                c.set(x + i, y, bone_col)

    paint_model(model, out, {
        "default": skin_p, "torso": skin_p, "arm": skin_p, "leg": skin_p, "chest": chest_p,
        "spike": spike_p, "fist": fist_p, "head": head_p, "jaw": jaw_p,
    }, seed=11)


def mech_texture(model: Model, out: str) -> None:
    steel = rgba("#7c8792")
    dark = rgba("#3c434b")

    def metal(c, faces, cube, bone, base=steel):
        for r in faces.values():
            x, y, w, h = r
            c.noise_rect(x, y, w, h, base, 0.04)
            for yy in range(y, y + h, 5):
                c.hline(x, yy, w, shade(base, -0.28))
            for xx in range(x, x + w, 6):
                c.vline(xx, y, h, shade(base, -0.18))
            for yy in range(y + 2, y + h, 5):
                for xx in range(x + 2, x + w, 6):
                    c.set(xx, yy, shade(base, 0.35))

    def metal_dark(c, faces, cube, bone):
        metal(c, faces, cube, bone, dark)

    def hazard(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            for yy in range(h):
                for xx in range(w):
                    stripe = ((xx + yy) // 2) % 2 == 0
                    c.set(x + xx, y + yy, rgba("#f2c014") if stripe else rgba("#1b1b1b"))

    def core(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.rect(x, y, w, h, rgba("#1ad8ff"))
        x, y, w, h = faces["north"]
        c.rect(x, y, w, h, rgba("#0b6f8a"))
        c.disc(x + w / 2, y + h / 2, min(w, h) / 2 - 0.5, rgba("#21e6ff"))
        c.disc(x + w / 2, y + h / 2, min(w, h) / 4, rgba("#d9fbff"))

    def visor(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.rect(x, y, w, h, rgba("#ff2020"))
        x, y, w, h = faces["north"]
        c.hline(x, y, w, rgba("#ffb0b0"))

    def cannon(c, faces, cube, bone):
        metal(c, faces, cube, bone, rgba("#2b3036"))
        x, y, w, h = faces["down"]
        c.rect(x, y, w, h, rgba("#ff7a1a"))
        c.rect(x + 1, y + 1, w - 2, h - 2, rgba("#0a0a0a"))

    def antenna(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.rect(x, y, w, h, rgba("#9aa4ad"))
        x, y, w, h = faces["up"]
        c.rect(x, y, w, h, rgba("#ff2a2a"))

    paint_model(model, out, {
        "default": metal, "metal": metal, "metal_dark": metal_dark, "hazard": hazard, "core": core,
        "visor": visor, "cannon": cannon, "antenna": antenna,
    }, seed=17)


def small_textures(models: Dict[str, Model], out_dir: str) -> None:
    def crystal(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.noise_rect(x, y, w, h, CRYPTO, 0.12)
            c.set(x, y, CRYPTO_LIGHT)

    def crystal_core(c, faces, cube, bone):
        for r in faces.values():
            c.rect(*r, CRYPTO_LIGHT)

    paint_model(models["cryptonite_bolt"], os.path.join(out_dir, "cryptonite_bolt.png"),
                {"default": crystal, "crystal": crystal, "crystal_core": crystal_core})

    def ice(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.noise_rect(x, y, w, h, ICE, 0.1)
            c.set(x, y, ICE_LIGHT)
            if w > 1 and h > 1:
                c.set(x + w - 1, y + h - 1, ICE_DARK)

    def ice_core(c, faces, cube, bone):
        for r in faces.values():
            c.rect(*r, ICE_LIGHT)

    paint_model(models["cryptonite_bolt"], os.path.join(out_dir, "ice_shard.png"),
                {"default": ice, "crystal": ice, "crystal_core": ice_core})

    def mbody(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.noise_rect(x, y, w, h, rgba("#e9edf0"), 0.03)
            if h > 3:
                c.hline(x, y + h // 2, w, rgba("#c0392b"))

    def mtip(c, faces, cube, bone):
        for r in faces.values():
            c.rect(*r, rgba("#d63031"))

    def mfin(c, faces, cube, bone):
        for r in faces.values():
            c.noise_rect(*r, rgba("#4b5259"), 0.05)

    paint_model(models["mech_missile"], os.path.join(out_dir, "mech_missile.png"),
                {"default": mbody, "missile_body": mbody, "missile_tip": mtip, "missile_fin": mfin})

    def rock(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.noise_rect(x, y, w, h, rgba("#2e2a2b"), 0.12)
            for _ in range(max(1, (w * h) // 8)):
                xx, yy = x + c.rng.randrange(w), y + c.rng.randrange(h)
                c.set(xx, yy, CRYPTO if c.rng.random() < 0.6 else CRYPTO_DARK)

    paint_model(models["meteor"], os.path.join(out_dir, "cryptonite_meteor.png"),
                {"default": rock, "rock": rock, "crystal": crystal})


# ---------------------------------------------------------------------------
# Blocks (16x16)
# ---------------------------------------------------------------------------

def stone_bg(c: Canvas, base, var=0.08, streaks=False):
    c.noise_rect(0, 0, 16, 16, base, var)
    for _ in range(14):
        x, y = c.rng.randrange(16), c.rng.randrange(16)
        c.set(x, y, shade(base, -0.18))
        c.set((x + 1) % 16, y, shade(base, -0.12))
    if streaks:
        for y in range(1, 16, 4):
            for x in range(16):
                if c.rng.random() < 0.55:
                    c.set(x, y, shade(base, -0.22))


def crystal_cluster(c: Canvas, cx: int, cy: int, size: int) -> None:
    for i in range(size):
        for j in range(-(size - i) // 2, (size - i) // 2 + 1):
            c.set(cx + j, cy - i, CRYPTO if j != 0 else CRYPTO_LIGHT)
    for j in range(-(size // 2) - 1, size // 2 + 2):
        c.set(cx + j, cy + 1, CRYPTO_DARK)
    c.set(cx, cy - size + 1, rgba("#ffffff"))


def block_textures(out_dir: str) -> None:
    c = Canvas(16, 16, seed=21)
    stone_bg(c, rgba("#7d7d7d"))
    for (x, y, s) in ((4, 6, 4), (11, 5, 3), (7, 12, 4), (13, 13, 2), (2, 13, 2)):
        crystal_cluster(c, x, y, s)
    c.save(os.path.join(out_dir, "cryptonite_ore.png"))

    c = Canvas(16, 16, seed=22)
    stone_bg(c, rgba("#464649"), 0.07, streaks=True)
    for (x, y, s) in ((4, 7, 4), (11, 4, 3), (8, 13, 4), (13, 12, 3)):
        crystal_cluster(c, x, y, s)
    c.save(os.path.join(out_dir, "deepslate_cryptonite_ore.png"))

    c = Canvas(16, 16, seed=23)
    for y in range(16):
        for x in range(16):
            facet = ((x // 4) + (y // 4)) % 2
            base = CRYPTO if facet else shade(CRYPTO, -0.25)
            v = (c.rng.random() * 2 - 1) * 0.06
            c.set(x, y, shade(base, v))
    for i in range(16):
        c.set(i, i, CRYPTO_LIGHT)
        c.set(15 - i, i, shade(CRYPTO_LIGHT, -0.1))
    c.outline_rect(0, 0, 16, 16, CRYPTO_DARK)
    c.save(os.path.join(out_dir, "cryptonite_block.png"))


# ---------------------------------------------------------------------------
# Item icons (16x16)
# ---------------------------------------------------------------------------
ICON_PAL = {
    "k": rgba("#0d1530"), "B": SUIT_BLUE, "b": SUIT_BLUE_DARK, "L": SUIT_BLUE_LIGHT,
    "R": CAPE_RED, "r": CAPE_RED_DARK, "Y": GOLD, "y": GOLD_DARK, "W": rgba("#ffffff"),
    "O": rgba("#ff8c1a"), "o": rgba("#c2410c"), "G": CRYPTO, "g": CRYPTO_DARK, "l": CRYPTO_LIGHT,
    "C": rgba("#7fe8ff"), "c": rgba("#2bb5e0"), "D": rgba("#1b6fa8"), "n": rgba("#6b4423"),
    "s": rgba("#9aa4ad"), "x": rgba("#3c434b"), "P": rgba("#2d5fa3"), "p": rgba("#1b3d6e"),
    "e": rgba("#e8f4ff"), "q": rgba("#0b3d0b"),
}

ICONS = {
    "hero_suit": [
        "................",
        "....kkk..kkk....",
        "...kBBBkkBBBk...",
        "..kBLBBBBBBbBk..",
        ".kBLBBBBBBBBbBk.",
        ".kBLBBYYYYBBbBk.",
        "kBBkBYRRRRYBkbBk",
        "kLBkBYRYYRYBkbBk",
        "kLBkBYRRRRYBkbBk",
        "kkkkBBYYYYBBkkkk",
        "rRrkBBBBBBBBkrRr",
        "rRrkyYYyyYYykrRr",
        ".rRkBBBBBBBbkRr.",
        ".rRkBBBkkBBbkRr.",
        "..rkkkk..kkkkr..",
        "................",
    ],
    "heat_vision": [
        "................",
        ".kkkk...kkkk....",
        "kWRRrk.kWRRrk...",
        "kRYRrk.kRYRrk...",
        ".kkkOo..kkkOo...",
        ".....OYo....OYo.",
        "......OYo....OYo",
        ".......OYo....OY",
        "........OYo....O",
        ".........OYo....",
        "..........OYo...",
        "...........OYo..",
        "............OYo.",
        ".............OY.",
        "..............O.",
        "................",
    ],
    "xray_vision": [
        "................",
        "................",
        "................",
        ".....kkkkkk.....",
        "...kkeeeeeekk...",
        "..keeeGGGGeeek..",
        ".keeeGGggGGeeek.",
        "keeeGGgqqgGGeeek",
        ".keeeGGggGGeeek.",
        "..keeeGGGGeeek..",
        "...kkeeeeeekk...",
        ".....kkkkkk.....",
        "................",
        "lGlGlGlGlGlGlGlG",
        "................",
        "GlGlGlGlGlGlGlGl",
    ],
    "cryptonite_shard": [
        "................",
        "........q.......",
        ".......qlq......",
        ".......qWGq.....",
        "...q...qlGq..q..",
        "..qlq..qlGq.qGq.",
        "..qWGq.qlGgqlGq.",
        "..qlGq.qlGgqlGgq",
        "..qlGgqqlGgqlGgq",
        "..qlGgqqGGgqGGgq",
        "..qGGgqqGGgqGgq.",
        "...qGgqGGGgqGgq.",
        "...qqGGGGGGGgqq.",
        "....qqgggggggq..",
        ".....qqqqqqqq...",
        "................",
    ],
    "cryptonite_sword": [
        "..............qq",
        ".............qWq",
        "............qGWq",
        "...........qGlq.",
        "..........qGlq..",
        ".........qGlq...",
        "........qGlq....",
        ".......qGlq.....",
        "..qq..qGlq......",
        "..qYqqGlq.......",
        "...qYgGq........",
        "....qYq.........",
        "...qnqYq........",
        "..qnq.qYq.......",
        ".qnq...qq.......",
        ".qq.............",
    ],
    "city_blueprint": [
        "................",
        ".kkkkkkkkkkkkkk.",
        ".kPPPPPPPPPPPPk.",
        ".kPPPPPPPPePPPk.",
        ".kPPeePPPPePPPk.",
        ".kPPeePPPeeePPk.",
        ".kPPeePePeeePPk.",
        ".kPeeePePeeeePk.",
        ".kPeeeeePeeeePk.",
        ".kPeeeeeeeeeePk.",
        ".kPPPPPPPPPPPPk.",
        ".kPppppppppppPk.",
        ".kPPPPPPPPPPPPk.",
        ".kkkkkkkkkkkkkk.",
        "................",
        "................",
    ],
}


def icon_sun(out: str, core=GOLD, ray=rgba("#ff9d00"), seed=5) -> None:
    c = Canvas(16, 16, seed=seed)
    for a in range(0, 360, 45):
        rad = math.radians(a)
        for r in range(5, 8):
            c.set(int(round(7.5 + math.cos(rad) * r)), int(round(7.5 + math.sin(rad) * r)), ray)
    c.disc(7.5, 7.5, 4.6, rgba("#ff7a00"))
    c.disc(7.5, 7.5, 3.8, core)
    c.disc(7.5, 7.5, 2.2, rgba("#fff3b0"))
    c.set(6, 6, rgba("#ffffff"))
    c.save(out)


def icon_snowflake(out: str) -> None:
    c = Canvas(16, 16, seed=6)
    col, core = rgba("#e8fbff"), rgba("#7fe8ff")
    for a in range(0, 360, 60):
        rad = math.radians(a)
        for r in range(0, 8):
            x = int(round(7.5 + math.cos(rad) * r))
            y = int(round(7.5 + math.sin(rad) * r))
            c.set(x, y, col if r > 2 else core)
            if r == 5:
                for b in (-1, 1):
                    rb = math.radians(a + b * 45)
                    c.set(int(round(x + math.cos(rb) * 1.6)), int(round(y + math.sin(rb) * 1.6)), col)
    c.disc(7.5, 7.5, 1.6, rgba("#2bb5e0"))
    c.save(out)


def icon_emblem(out: str) -> None:
    c = Canvas(16, 16, seed=8)
    c.disc(7.5, 7.5, 7.6, GOLD_DARK)
    c.disc(7.5, 7.5, 6.8, GOLD)
    c.disc(7.5, 7.5, 5.4, CAPE_RED)
    c.disc(7.5, 7.5, 2.6, GOLD)
    for a in range(0, 360, 45):
        rad = math.radians(a)
        c.set(int(round(7.5 + math.cos(rad) * 4)), int(round(7.5 + math.sin(rad) * 4)), GOLD)
    c.set(5, 4, shade(GOLD, 0.6))
    c.set(4, 5, shade(GOLD, 0.6))
    c.save(out)


def item_textures(out_dir: str) -> None:
    for name, rows in ICONS.items():
        for r in rows:
            assert len(r) == 16, (name, r, len(r))
        assert len(rows) == 16, name
        c = Canvas(16, 16)
        c.ascii(0, 0, rows, ICON_PAL)
        c.save(os.path.join(out_dir, f"{name}.png"))
    icon_sun(os.path.join(out_dir, "solar_flare.png"))
    icon_snowflake(os.path.join(out_dir, "freeze_breath.png"))
    icon_emblem(os.path.join(out_dir, "hero_emblem.png"))


# ---------------------------------------------------------------------------
# Particle atlas (64x64, 16px cells)
# ---------------------------------------------------------------------------

def particle_atlas(out: str) -> None:
    c = Canvas(64, 64, seed=9)
    white = rgba("#ffffff")
    radial_sprite(c, 0, 0, 16, white, falloff=1.4)                 # glow
    radial_sprite(c, 16, 0, 16, white, ring=(0.78, 0.2))            # ring
    # snowflake
    for a in range(0, 360, 60):
        rad = math.radians(a)
        for r in range(0, 7):
            c.set(32 + int(round(7.5 + math.cos(rad) * r)), int(round(7.5 + math.sin(rad) * r)), white)
    # sparkle
    for i in range(16):
        t = 1 - abs(i - 7.5) / 8
        a = int(255 * max(0.0, t) ** 2)
        c.set(48 + i, 7, (255, 255, 255, a))
        c.set(48 + i, 8, (255, 255, 255, a))
        c.set(48 + 7, i, (255, 255, 255, a))
        c.set(48 + 8, i, (255, 255, 255, a))
    c.disc(48 + 8, 8, 1.6, white)
    # streak
    for x in range(16):
        t = 1 - abs(x - 7.5) / 8
        for y, f in ((7, 1.0), (8, 1.0), (6, 0.35), (9, 0.35)):
            c.set(x, 16 + y, (255, 255, 255, int(255 * f * t)))
    # smoke puff
    for yy in range(16):
        for xx in range(16):
            dx, dy = (xx - 7.5) / 8, (yy - 7.5) / 8
            r = math.sqrt(dx * dx + dy * dy)
            n = c.rng.random() * 0.35
            a = max(0.0, 1 - r - n * 0.5)
            if a > 0.05:
                c.set(16 + xx, 16 + yy, (235, 235, 235, int(255 * min(1, a * 1.4))))
    # flame
    for yy in range(16):
        for xx in range(16):
            dx = (xx - 7.5) / (3 + yy * 0.35)
            dy = (yy - 11) / 5.0
            r = math.sqrt(dx * dx + max(0, dy) ** 2 * 2)
            if yy >= 2 and r < 1:
                t = yy / 15
                col = mix(rgba("#fff3a0"), rgba("#ff4500"), 1 - t)
                c.set(32 + xx, 16 + yy, (col[0], col[1], col[2], int(255 * (1 - r) ** 0.6)))
    # shard
    shard = ["......W.", ".....WWW", "....WWW.", "...WWW..", "..WWW...", ".WWW....", "WWW.....", ".W......"]
    c.ascii(48 + 4, 16 + 4, shard, {"W": white})
    # crisp dot
    c.disc(8, 40, 3.2, white)
    radial_sprite(c, 16, 32, 16, white, falloff=3.0)               # tight core glow
    c.save(out)


# ---------------------------------------------------------------------------
# Pack icons
# ---------------------------------------------------------------------------

def pack_icon(out: str, theme: str) -> None:
    size = 128
    c = Canvas(size, size, seed=31 if theme == "origins" else 32)
    if theme == "origins":
        top, bottom = rgba("#4fb3ff"), rgba("#0d2a6b")
    else:
        top, bottom = rgba("#ff9f1a"), rgba("#5c0a0a")
    c.vgradient(0, 0, size, size, top, bottom)
    # light rays
    for a in range(0, 360, 20):
        rad = math.radians(a)
        for r in range(20, 90):
            x = int(64 + math.cos(rad) * r)
            y = int(58 + math.sin(rad) * r)
            if 0 <= x < size and 0 <= y < size:
                c.set(x, y, mix(c.get(x, y), rgba("#ffffff"), 0.18))
    # cape swoosh
    for i in range(70):
        t = i / 70
        cx = 30 + t * 70
        cy = 100 - math.sin(t * math.pi) * 30
        c.disc(cx, cy, 10 - t * 6, CAPE_RED)
    # emblem
    c.disc(64, 56, 34, GOLD_DARK)
    c.disc(64, 56, 31, GOLD)
    c.disc(64, 56, 25, CAPE_RED)
    c.disc(64, 56, 11, GOLD)
    for a in range(0, 360, 30):
        rad = math.radians(a)
        c.disc(64 + math.cos(rad) * 18, 56 + math.sin(rad) * 18, 2.6, GOLD)
    c.disc(58, 50, 4, shade(GOLD, 0.6))
    if theme == "origins":
        # level bars
        for i in range(5):
            h = 6 + i * 5
            c.rect(18 + i * 20, 122 - h, 12, h, mix(rgba("#7dffb0"), rgba("#ffffff"), i / 6))
            c.outline_rect(18 + i * 20, 122 - h, 12, h, rgba("#0d2a6b"))
    else:
        # lightning bolt
        bolt = [(96, 84), (84, 100), (94, 100), (80, 122), (106, 96), (95, 96), (104, 84)]
        for i in range(len(bolt) - 1):
            x0, y0 = bolt[i]
            x1, y1 = bolt[i + 1]
            for k in range(-2, 3):
                c.line(x0 + k, y0, x1 + k, y1, rgba("#fff36b"))
    c.save(out)


# ---------------------------------------------------------------------------
# Nano suit (iron hero)
# ---------------------------------------------------------------------------
NANO_RED = rgba("#b3141c")
NANO_RED_DARK = rgba("#6e0a10")
NANO_GOLD = rgba("#e9b53a")
NANO_GOLD_DARK = rgba("#9c7419")
NANO_GLOW = rgba("#c8fbff")
NANO_GLOW_MID = rgba("#5fe3ff")
NANO_JOINT = rgba("#2b2e33")


def metal_panel(c: Canvas, rect, base, lines=True, var=0.04):
    x, y, w, h = rect
    for yy in range(h):
        t = yy / max(1, h - 1)
        for xx in range(w):
            v = (c.rng.random() * 2 - 1) * var
            c.set(x + xx, y + yy, shade(base, 0.12 - 0.24 * t + v))
    if lines and w > 3 and h > 3:
        c.hline(x, y, w, shade(base, 0.25))
        c.hline(x, y + h - 1, w, shade(base, -0.35))


def nano_suit_texture(model: Model, out: str) -> None:
    c = Canvas(model.tex_w, model.tex_h, seed=41)
    model.assign_uvs()
    for bone, cube in model.cubes():
        w, h, d = cube.size
        faces = box_faces(cube.uv[0], cube.uv[1], w, h, d)
        m = cube.mat
        if m == "chest":
            for r in faces.values():
                metal_panel(c, r, NANO_RED)
            fx, fy, fw, fh = faces["north"]
            # gold chest plates + abdominal segments
            c.rect(fx + 1, fy + 1, fw - 2, 2, NANO_GOLD)
            for i in range(3):
                c.rect(fx + 2, fy + 6 + i * 2, fw - 4, 1, NANO_GOLD if i % 2 == 0 else NANO_GOLD_DARK)
            c.vline(fx + fw // 2, fy + 6, 6, NANO_RED_DARK)
            c.rect(fx, fy + fh - 1, fw, 1, NANO_JOINT)
            bx, by, bw, bh = faces["south"]
            c.rect(bx + 2, by + 2, bw - 4, 6, shade(NANO_RED, -0.15))
            c.vline(bx + bw // 2, by + 1, bh - 2, NANO_RED_DARK)
            for s in ("west", "east"):
                x, y, ww, hh = faces[s]
                c.rect(x, y + 3, ww, 1, NANO_GOLD_DARK)
        elif m == "reactor":
            for r in faces.values():
                c.rect(*r, NANO_GLOW_MID)
            fx, fy, fw, fh = faces["north"]
            c.rect(fx, fy, fw, fh, NANO_GLOW_MID)
            c.set(fx + fw // 2, fy + fh // 2, NANO_GLOW)
            c.set(fx + 1, fy, NANO_GLOW)
        elif m == "helmet":
            for r in faces.values():
                metal_panel(c, r, NANO_RED)
            fx, fy, fw, fh = faces["north"]
            # gold faceplate with glowing eye slits
            c.rect(fx + 1, fy + 1, fw - 2, fh - 1, NANO_GOLD)
            c.rect(fx + 1, fy + 1, fw - 2, 1, shade(NANO_GOLD, 0.25))
            c.rect(fx + 1, fy + 3, 2, 1, NANO_GLOW)
            c.rect(fx + fw - 3, fy + 3, 2, 1, NANO_GLOW)
            c.set(fx + 2, fy + 3, rgba("#ffffff"))
            c.set(fx + fw - 3, fy + 3, rgba("#ffffff"))
            c.rect(fx + 2, fy + 6, fw - 4, 1, NANO_GOLD_DARK)
            c.vline(fx + fw // 2, fy + 4, 2, NANO_GOLD_DARK)
            c.rect(fx, fy + fh - 1, fw, 1, NANO_RED_DARK)
            for s in ("west", "east"):
                x, y, ww, hh = faces[s]
                c.disc(x + ww / 2, y + hh / 2 + 0.5, 1.4, NANO_GOLD_DARK)
                c.set(x + ww // 2, y + hh // 2, NANO_GOLD)
            ux, uy, uw, uh = faces["up"]
            c.vline(ux + uw // 2, uy, uh, NANO_GOLD_DARK)
        elif m == "arm":
            for r in faces.values():
                metal_panel(c, r, NANO_RED)
            for s in ("north", "south", "west", "east"):
                x, y, ww, hh = faces[s]
                c.rect(x, y + 5, ww, 1, NANO_JOINT)       # elbow joint
                c.rect(x, y + 7, ww, 3, NANO_GOLD)        # gold forearm
                c.rect(x, y + 10, ww, 2, shade(NANO_RED, -0.1))
            dx, dy, dw, dh = faces["down"]
            c.rect(dx, dy, dw, dh, NANO_JOINT)
            c.disc(dx + dw / 2, dy + dh / 2, 1.6, NANO_GLOW_MID)   # palm repulsor
            c.set(dx + dw // 2, dy + dh // 2, NANO_GLOW)
        elif m == "shoulder":
            for r in faces.values():
                metal_panel(c, r, NANO_RED)
            for s in ("north", "south", "west", "east"):
                x, y, ww, hh = faces[s]
                c.rect(x, y + hh - 1, ww, 1, NANO_GOLD)
            c.rect(*faces["down"], NANO_JOINT)
        elif m == "leg":
            for r in faces.values():
                metal_panel(c, r, NANO_RED)
            for s in ("north", "south", "west", "east"):
                x, y, ww, hh = faces[s]
                c.rect(x, y + 5, ww, 1, NANO_JOINT)       # knee joint
            nx, ny, nw, nh = faces["north"]
            c.rect(nx + 1, ny + 1, nw - 2, 3, NANO_GOLD)   # thigh plate
            c.rect(nx + 1, ny + 6, nw - 2, 2, NANO_GOLD_DARK)  # knee plate
            c.rect(*faces["up"], NANO_JOINT)
        elif m == "boot":
            for r in faces.values():
                metal_panel(c, r, NANO_RED)
            nx, ny, nw, nh = faces["north"]
            c.rect(nx, ny, nw, 1, NANO_GOLD)
            c.rect(nx + 1, ny + nh - 2, nw - 2, 1, NANO_GOLD_DARK)
            dx, dy, dw, dh = faces["down"]
            c.rect(dx, dy, dw, dh, NANO_JOINT)
            c.disc(dx + dw / 2, dy + dh / 2, 1.3, rgba("#ff9a3c"))   # thruster
            c.set(dx + dw // 2, dy + dh // 2, rgba("#fff3c4"))
    c.save(out)


def nano_core_texture(model: Model, out: str) -> None:
    c = Canvas(model.tex_w, model.tex_h, seed=42)
    model.assign_uvs()
    for bone, cube in model.cubes():
        w, h, d = cube.size
        faces = box_faces(cube.uv[0], cube.uv[1], w, h, d)
        if cube.mat == "housing":
            for r in faces.values():
                metal_panel(c, r, rgba("#5d636b"), lines=False)
            fx, fy, fw, fh = faces["north"]
            c.outline_rect(fx, fy, fw, fh, rgba("#2b2e33"))
            c.rect(fx + 1, fy + 1, fw - 2, fh - 2, rgba("#8a929c"))
        else:
            for r in faces.values():
                c.rect(*r, NANO_GLOW_MID)
            fx, fy, fw, fh = faces["north"]
            c.set(fx + fw // 2, fy + fh // 2, NANO_GLOW)
    c.save(out)


def nano_missile_texture(model: Model, out: str) -> None:
    def body(c, faces, cube, bone):
        for r in faces.values():
            x, y, w, h = r
            c.noise_rect(x, y, w, h, NANO_RED, 0.04)
            if h > 3:
                c.hline(x, y + h // 2, w, NANO_GOLD)

    def tip(c, faces, cube, bone):
        for r in faces.values():
            c.rect(*r, NANO_GOLD)

    def fin(c, faces, cube, bone):
        for r in faces.values():
            c.noise_rect(*r, NANO_JOINT, 0.05)

    paint_model(model, out, {"default": body, "missile_body": body, "missile_tip": tip, "missile_fin": fin}, seed=43)
