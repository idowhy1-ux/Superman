#!/usr/bin/env python3
"""Regenerate every procedural asset of the add-on.

Usage:  python3 tools/generate_assets.py [--force-sounds]

Writes textures, sounds, geometry and animation files into
``addon/resource_pack`` (and pack icons for both packs).
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import animations  # noqa: E402
import icons  # noqa: E402
import models  # noqa: E402
import sounds  # noqa: E402
import textures  # noqa: E402

ROOT = os.path.dirname(HERE)
RP = os.path.join(ROOT, "addon", "resource_pack")
BP = os.path.join(ROOT, "addon", "behavior_pack")


def write_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def main() -> None:
    built = {name: fn() for name, fn in models.ALL_MODELS.items()}

    # geometry ---------------------------------------------------------------
    geo_dir = os.path.join(RP, "models", "entity")
    write_json(os.path.join(geo_dir, "superhuman_humanoid.geo.json"), models.geometry_file([built["humanoid"]]))
    write_json(os.path.join(geo_dir, "superhuman_hero_suit.geo.json"), models.geometry_file([built["hero_suit"]]))
    write_json(os.path.join(geo_dir, "superhuman_rampager.geo.json"), models.geometry_file([built["rampager"]]))
    write_json(os.path.join(geo_dir, "superhuman_omega_mech.geo.json"), models.geometry_file([built["omega_mech"]]))
    write_json(os.path.join(geo_dir, "superhuman_nano_suit.geo.json"), models.geometry_file([built["nano_suit"], built["nano_core"]]))
    write_json(os.path.join(geo_dir, "superhuman_projectiles.geo.json"), models.geometry_file(
        [built["cryptonite_bolt"], built["mech_missile"], built["meteor"]]))

    # animations -------------------------------------------------------------
    for fname, fn in animations.ANIMATION_FILES.items():
        write_json(os.path.join(RP, "animations", fname), fn())

    # textures ---------------------------------------------------------------
    ent = os.path.join(RP, "textures", "entity", "superhuman")
    textures.hero_suit_texture(built["hero_suit"], os.path.join(RP, "textures", "models", "superhuman", "hero_suit.png"))
    for i, spec in enumerate(textures.CIVILIANS):
        textures.humanoid_skin(spec, os.path.join(ent, f"civilian_{i}.png"), seed=100 + i)
    for i, spec in enumerate(textures.THUGS):
        textures.humanoid_skin(spec, os.path.join(ent, f"thug_{i}.png"), seed=200 + i)
    textures.humanoid_skin(textures.PYROCLAST, os.path.join(ent, "pyroclast.png"), seed=300)
    textures.humanoid_skin(textures.VIRIDIAN, os.path.join(ent, "viridian.png"), seed=301)
    textures.rampager_texture(built["rampager"], os.path.join(ent, "rampager.png"))
    textures.mech_texture(built["omega_mech"], os.path.join(ent, "omega_mech.png"))
    textures.small_textures(built, ent)
    textures.nano_suit_texture(built["nano_suit"], os.path.join(RP, "textures", "models", "superhuman", "nano_suit.png"))
    textures.nano_core_texture(built["nano_core"], os.path.join(RP, "textures", "models", "superhuman", "nano_core.png"))
    textures.nano_missile_texture(models.mech_missile(), os.path.join(ent, "nano_missile.png"))
    icons.glyph_sheet(os.path.join(RP, "font", "glyph_E5.png"))
    os.makedirs(os.path.join(RP, "textures", "ui", "superhuman"), exist_ok=True)
    icons.wheel_icons(os.path.join(RP, "textures", "ui", "superhuman"))
    icons.nano_item_icons(os.path.join(RP, "textures", "items", "superhuman"))
    textures.block_textures(os.path.join(RP, "textures", "blocks", "superhuman"))
    textures.item_textures(os.path.join(RP, "textures", "items", "superhuman"))
    textures.particle_atlas(os.path.join(RP, "textures", "particle", "superhuman_particles.png"))
    textures.pack_icon(os.path.join(RP, "pack_icon.png"), "rising")
    textures.pack_icon(os.path.join(BP, "pack_icon.png"), "rising")
    textures.pack_icon(os.path.join(ROOT, "tools", "icons", "rising.png"), "rising")
    textures.pack_icon(os.path.join(ROOT, "tools", "icons", "unleashed.png"), "unleashed")

    # sounds -----------------------------------------------------------------
    sounds.generate(os.path.join(RP, "sounds", "superhuman"), force="--force-sounds" in sys.argv)
    print("assets generated")


if __name__ == "__main__":
    main()
