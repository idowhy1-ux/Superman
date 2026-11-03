"""Geometry definitions for every custom model.

Each model is described as bones + cubes. Cubes either have a fixed box-UV
(``uv=(u, v)``) or get one assigned automatically by :class:`UVPacker`.
The very same cube list is handed to the texture painter, so the painted
texture always lines up with the geometry.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from art import UVPacker

Vec3 = Tuple[float, float, float]


@dataclass
class Cube:
    origin: Vec3
    size: Tuple[int, int, int]
    mat: str = "base"
    uv: Optional[Tuple[int, int]] = None
    inflate: float = 0.0
    mirror: bool = False
    pivot: Optional[Vec3] = None
    rotation: Optional[Vec3] = None


@dataclass
class Bone:
    name: str
    parent: Optional[str]
    pivot: Vec3
    cubes: List[Cube] = field(default_factory=list)
    rotation: Optional[Vec3] = None


@dataclass
class Model:
    identifier: str
    tex_w: int
    tex_h: int
    bones: List[Bone]
    bounds: Tuple[float, float, Vec3] = (2.0, 3.0, (0.0, 1.5, 0.0))

    def assign_uvs(self) -> None:
        packer = UVPacker(self.tex_w, self.tex_h)
        # Fixed regions are the caller's job; auto-pack only free cubes,
        # tallest first (simple shelf packing).
        todo = [c for b in self.bones for c in b.cubes if c.uv is None]
        todo.sort(key=lambda c: (c.size[1] + c.size[2], 2 * (c.size[0] + c.size[2])), reverse=True)
        for c in todo:
            w, h, d = c.size
            c.uv = packer.place(max(1, w), max(1, h), max(1, d))

    def to_json(self) -> dict:
        self.assign_uvs()
        bones = []
        for b in self.bones:
            jb: Dict = {"name": b.name, "pivot": list(b.pivot)}
            if b.parent:
                jb["parent"] = b.parent
            if b.rotation:
                jb["rotation"] = list(b.rotation)
            if b.cubes:
                cubes = []
                for c in b.cubes:
                    jc: Dict = {"origin": list(c.origin), "size": list(c.size), "uv": list(c.uv)}
                    if c.inflate:
                        jc["inflate"] = c.inflate
                    if c.mirror:
                        jc["mirror"] = True
                    if c.pivot is not None:
                        jc["pivot"] = list(c.pivot)
                    if c.rotation is not None:
                        jc["rotation"] = list(c.rotation)
                    cubes.append(jc)
                jb["cubes"] = cubes
            bones.append(jb)
        w, h, off = self.bounds
        return {
            "description": {
                "identifier": self.identifier,
                "texture_width": self.tex_w,
                "texture_height": self.tex_h,
                "visible_bounds_width": w,
                "visible_bounds_height": h,
                "visible_bounds_offset": list(off),
            },
            "bones": bones,
        }

    def cubes(self) -> List[Tuple[Bone, Cube]]:
        return [(b, c) for b in self.bones for c in b.cubes]


# ---------------------------------------------------------------------------
# Humanoid (standard 64x64 skin layout) - civilians, thugs, Pyroclast, Viridian
# ---------------------------------------------------------------------------

def humanoid() -> Model:
    return Model(
        "geometry.superhuman.humanoid",
        64,
        64,
        [
            Bone("root", None, (0, 0, 0)),
            Bone("waist", "root", (0, 12, 0)),
            Bone("body", "waist", (0, 24, 0), [
                Cube((-4, 12, -2), (8, 12, 4), "body", uv=(16, 16)),
                Cube((-4, 12, -2), (8, 12, 4), "jacket", uv=(16, 32), inflate=0.25),
            ]),
            Bone("head", "body", (0, 24, 0), [Cube((-4, 24, -4), (8, 8, 8), "head", uv=(0, 0))]),
            Bone("hat", "head", (0, 24, 0), [Cube((-4, 24, -4), (8, 8, 8), "hat", uv=(32, 0), inflate=0.5)]),
            Bone("rightArm", "body", (-5, 22, 0), [
                Cube((-8, 12, -2), (4, 12, 4), "arm", uv=(40, 16)),
                Cube((-8, 12, -2), (4, 12, 4), "sleeve", uv=(40, 32), inflate=0.25),
            ]),
            Bone("leftArm", "body", (5, 22, 0), [
                Cube((4, 12, -2), (4, 12, 4), "arm", uv=(32, 48)),
                Cube((4, 12, -2), (4, 12, 4), "sleeve", uv=(48, 48), inflate=0.25),
            ]),
            Bone("rightLeg", "root", (-1.9, 12, 0), [
                Cube((-3.9, 0, -2), (4, 12, 4), "leg", uv=(0, 16)),
                Cube((-3.9, 0, -2), (4, 12, 4), "pants", uv=(0, 32), inflate=0.25),
            ]),
            Bone("leftLeg", "root", (1.9, 12, 0), [
                Cube((-0.1, 0, -2), (4, 12, 4), "leg", uv=(16, 48)),
                Cube((-0.1, 0, -2), (4, 12, 4), "pants", uv=(0, 48), inflate=0.25),
            ]),
        ],
        bounds=(1.5, 2.5, (0, 1.25, 0)),
    )


# ---------------------------------------------------------------------------
# Hero suit (attachable worn in the chest slot, covers the whole body)
# ---------------------------------------------------------------------------

SUIT_INFLATE = 0.32


def hero_suit() -> Model:
    i = SUIT_INFLATE
    return Model(
        "geometry.superhuman.hero_suit",
        64,
        64,
        [
            Bone("waist", None, (0, 12, 0)),
            Bone("body", "waist", (0, 24, 0), [Cube((-4, 12, -2), (8, 12, 4), "body", uv=(16, 16), inflate=i)]),
            Bone("sh_cape", "body", (0, 24, 2.7), [Cube((-5, 15, 2.7), (10, 9, 1), "cape_top", uv=(0, 0))]),
            Bone("sh_cape2", "sh_cape", (0, 15, 2.7), [Cube((-5, 6, 2.7), (10, 9, 1), "cape_bottom", uv=(0, 32))]),
            Bone("sh_clasp", "body", (0, 24, 0), [
                Cube((-4.6, 22.2, -2.6), (2, 2, 1), "clasp", uv=(24, 0)),
                Cube((2.6, 22.2, -2.6), (2, 2, 1), "clasp", uv=(24, 3)),
            ]),
            Bone("rightArm", "body", (-5, 22, 0), [Cube((-8, 12, -2), (4, 12, 4), "arm", uv=(40, 16), inflate=i)]),
            Bone("leftArm", "body", (5, 22, 0), [Cube((4, 12, -2), (4, 12, 4), "arm", uv=(32, 48), inflate=i)]),
            # Same parenting as vanilla geometry.player.armor.base (legs under body);
            # bones are bound to the wearer's skeleton by name.
            Bone("rightLeg", "body", (-1.9, 12, 0), [Cube((-3.9, 0, -2), (4, 12, 4), "leg", uv=(0, 16), inflate=i)]),
            Bone("leftLeg", "body", (1.9, 12, 0), [Cube((-0.1, 0, -2), (4, 12, 4), "leg", uv=(16, 48), inflate=i)]),
        ],
        bounds=(2.5, 2.5, (0, 1.2, 0)),
    )


# ---------------------------------------------------------------------------
# Rampager - hulking brute boss (approx 3 blocks tall)
# ---------------------------------------------------------------------------

def rampager() -> Model:
    return Model(
        "geometry.superhuman.rampager",
        128,
        128,
        [
            Bone("root", None, (0, 0, 0)),
            Bone("body", "root", (0, 22, 0), [
                Cube((-10, 22, -6), (20, 18, 12), "torso"),
                Cube((-8, 36, -8), (16, 6, 4), "chest"),
            ]),
            Bone("spikes", "body", (0, 40, 6), [
                Cube((-7, 35, 6), (2, 6, 2), "spike"),
                Cube((-1, 37, 6), (2, 7, 2), "spike"),
                Cube((5, 35, 6), (2, 6, 2), "spike"),
                Cube((-4, 28, 6), (2, 5, 2), "spike"),
                Cube((2, 28, 6), (2, 5, 2), "spike"),
                Cube((-12, 38, -2), (3, 4, 3), "spike"),
                Cube((9, 38, -2), (3, 4, 3), "spike"),
            ]),
            Bone("head", "body", (0, 38, -6), [
                Cube((-5, 36, -14), (10, 10, 9), "head"),
                Cube((-4, 33, -14.5), (8, 3, 7), "jaw"),
                Cube((-6, 44, -10), (2, 4, 2), "spike"),
                Cube((4, 44, -10), (2, 4, 2), "spike"),
            ]),
            Bone("rightArm", "body", (-12, 37, 0), [
                Cube((-19, 15, -4), (7, 24, 8), "arm"),
                Cube((-20, 8, -5), (9, 7, 10), "fist"),
            ]),
            Bone("leftArm", "body", (12, 37, 0), [
                Cube((12, 15, -4), (7, 24, 8), "arm"),
                Cube((11, 8, -5), (9, 7, 10), "fist"),
            ]),
            Bone("rightLeg", "root", (-5, 22, 0), [Cube((-9, 0, -4), (8, 22, 8), "leg")]),
            Bone("leftLeg", "root", (5, 22, 0), [Cube((1, 0, -4), (8, 22, 8), "leg")]),
        ],
        bounds=(4.0, 4.0, (0, 1.8, 0)),
    )


# ---------------------------------------------------------------------------
# Omega Mech - giant robot boss (approx 3.5 blocks tall)
# ---------------------------------------------------------------------------

def omega_mech() -> Model:
    return Model(
        "geometry.superhuman.omega_mech",
        256,
        128,
        [
            Bone("root", None, (0, 0, 0)),
            Bone("rightLeg", "root", (-7, 26, 0), [
                Cube((-11, 13, -4), (8, 13, 8), "metal"),
                Cube((-11.5, 0, -6), (9, 13, 11), "metal_dark"),
            ]),
            Bone("leftLeg", "root", (7, 26, 0), [
                Cube((3, 13, -4), (8, 13, 8), "metal"),
                Cube((2.5, 0, -6), (9, 13, 11), "metal_dark"),
            ]),
            Bone("body", "root", (0, 26, 0), [
                Cube((-9, 26, -6), (18, 6, 12), "metal_dark"),
                Cube((-13, 32, -9), (26, 18, 18), "metal"),
                Cube((-4, 37, -10), (8, 8, 1), "core"),
                Cube((-11, 46, 9), (22, 3, 3), "hazard"),
            ]),
            Bone("head", "body", (0, 50, 0), [
                Cube((-6, 50, -7), (12, 8, 12), "metal"),
                Cube((-5, 53, -7.6), (10, 2, 1), "visor"),
                Cube((3, 58, 1), (1, 6, 1), "antenna"),
            ]),
            Bone("rightArm", "body", (-15, 46, 0), [
                Cube((-22, 41, -6), (8, 8, 12), "hazard"),
                Cube((-21, 22, -4), (6, 19, 8), "metal"),
                Cube((-20.5, 13, -3.5), (5, 9, 5), "cannon"),
            ]),
            Bone("leftArm", "body", (15, 46, 0), [
                Cube((14, 41, -6), (8, 8, 12), "hazard"),
                Cube((15, 22, -4), (6, 19, 8), "metal"),
                Cube((14.5, 15, -5), (7, 7, 10), "metal_dark"),
            ]),
        ],
        bounds=(4.5, 4.5, (0, 2.0, 0)),
    )


# ---------------------------------------------------------------------------
# Small things
# ---------------------------------------------------------------------------

def cryptonite_bolt() -> Model:
    return Model(
        "geometry.superhuman.cryptonite_bolt",
        32,
        32,
        [
            Bone("root", None, (0, 0, 0)),
            Bone("crystal", "root", (0, 2, 0), [
                Cube((-1, 1, -3), (2, 2, 6), "crystal"),
                Cube((-0.5, 1.5, -4), (1, 1, 8), "crystal_core"),
            ]),
        ],
        bounds=(1.0, 1.0, (0, 0.25, 0)),
    )


def mech_missile() -> Model:
    return Model(
        "geometry.superhuman.mech_missile",
        32,
        32,
        [
            Bone("root", None, (0, 0, 0)),
            Bone("missile", "root", (0, 2, 0), [
                Cube((-1.5, 0.5, -5), (3, 3, 9), "missile_body"),
                Cube((-1, 1, -6), (2, 2, 1), "missile_tip"),
                Cube((-2.5, 1.5, 2), (5, 1, 2), "missile_fin"),
                Cube((-0.5, -0.5, 2), (1, 5, 2), "missile_fin"),
            ]),
        ],
        bounds=(1.0, 1.0, (0, 0.25, 0)),
    )


def meteor() -> Model:
    return Model(
        "geometry.superhuman.cryptonite_meteor",
        64,
        64,
        [
            Bone("root", None, (0, 0, 0)),
            Bone("rock", "root", (0, 6, 0), [
                Cube((-6, 0, -6), (12, 12, 12), "rock"),
                Cube((-4, 11, -3), (7, 3, 6), "rock"),
                Cube((5, 3, -3), (3, 6, 5), "rock"),
                Cube((-8, 4, -2), (3, 5, 4), "rock"),
                Cube((-2, 2, -8), (5, 5, 3), "crystal"),
            ]),
        ],
        bounds=(2.0, 2.0, (0, 0.5, 0)),
    )


ALL_MODELS = {
    "humanoid": humanoid,
    "hero_suit": hero_suit,
    "rampager": rampager,
    "omega_mech": omega_mech,
    "cryptonite_bolt": cryptonite_bolt,
    "mech_missile": mech_missile,
    "meteor": meteor,
}


def geometry_file(models: Sequence[Model]) -> dict:
    return {"format_version": "1.12.0", "minecraft:geometry": [m.to_json() for m in models]}
