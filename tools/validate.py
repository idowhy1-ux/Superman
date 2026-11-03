#!/usr/bin/env python3
"""Static validation for the Superhuman add-on.

Checks performed:
  * every JSON file parses (strict JSON)
  * behavior-pack entities / items / blocks validate against Mojang's
    official JSON schemas (from github.com/Mojang/bedrock-samples, if a local
    checkout is available via --schemas or $BEDROCK_SAMPLES)
  * entity component names exist in the schema for the declared version
  * cross references: textures, geometries, animations, render controllers,
    loot tables, sounds, item icons, block textures, language keys
Exit code is non-zero when problems are found.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from typing import Dict, List, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

errors: List[str] = []
warnings: List[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def load(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def vkey(v: str):
    return tuple(int(x) for x in v.split("."))


# ---------------------------------------------------------------------------
# Official schema validation
# ---------------------------------------------------------------------------
class Schemas:
    def __init__(self, base: str):
        from referencing import Registry, Resource
        from referencing.jsonschema import DRAFT7

        self.base = base
        self.root = os.path.join(base, "metadata", "json_schemas")
        resources = []
        for p in glob.glob(os.path.join(self.root, "**", "*.json"), recursive=True):
            try:
                doc = load(p)
            except Exception:
                continue
            sid = doc.get("$id")
            if not sid:
                continue
            uri = "https://mc.local" + sid
            doc["$id"] = uri
            # Several official schemas use "oneOf" where branches overlap (e.g. a
            # filter test object also matches the open "filter group map"), which
            # makes every valid document fail. "anyOf" keeps the checks useful.
            doc = json.loads(json.dumps(doc).replace('"oneOf"', '"anyOf"'))
            resources.append((uri, Resource.from_contents(doc, default_specification=DRAFT7)))
        self.registry = Registry().with_resources(resources)

    def versions(self, kind: str) -> List[str]:
        d = os.path.join(self.root, "server", kind)
        return sorted([v for v in os.listdir(d) if re.match(r"^\d+\.\d+\.\d+$", v)], key=vkey)

    def pick(self, kind: str, fmt: str, filename: str) -> Optional[str]:
        cands = [v for v in self.versions(kind)
                 if os.path.exists(os.path.join(self.root, "server", kind, v, filename))]
        if not cands:
            return None
        older = [v for v in cands if vkey(v) <= vkey(fmt)]
        v = older[-1] if older else cands[0]
        return "https://mc.local/server/%s/%s/%s" % (kind, v, filename.replace(" ", "%20"))

    def validate(self, uri: str, instance, label: str) -> None:
        import jsonschema

        validator = jsonschema.Draft7Validator({"$ref": uri}, registry=self.registry)
        for e in sorted(validator.iter_errors(instance), key=lambda e: list(e.path)):
            path = "/".join(str(p) for p in e.path)
            err(f"{label}: schema: {path}: {e.message[:300]}")

    def component_names(self, kind: str, fmt: str) -> Optional[set]:
        uri = self.pick(kind, fmt, "Entity component definitions.json")
        if not uri:
            return None
        rel = uri.replace("https://mc.local/", "").replace("%20", " ")
        doc = load(os.path.join(self.root, rel))
        return set(doc.get("properties", {}).keys())


def validate_bp_with_schemas(bp: str, schemas: Schemas) -> None:
    for p in sorted(glob.glob(os.path.join(bp, "entities", "*.json"))):
        d = load(p)
        fmt = d["format_version"]
        ent = d["minecraft:entity"]
        uri = schemas.pick("entity", fmt, "ActorDocument.json")
        schemas.validate(uri, ent, os.path.relpath(p, ROOT))
        names = schemas.component_names("entity", fmt) or set()
        groups = [ent.get("components", {})] + list(ent.get("component_groups", {}).values())
        for g in groups:
            for comp in g:
                if names and comp not in names:
                    err(f"{os.path.relpath(p, ROOT)}: unknown entity component '{comp}' for format {fmt}")
    for p in sorted(glob.glob(os.path.join(bp, "items", "*.json"))):
        d = load(p)
        uri = schemas.pick("item", "9.9.9", "ItemDocument.json")
        schemas.validate(uri, d["minecraft:item"], os.path.relpath(p, ROOT))
    for p in sorted(glob.glob(os.path.join(bp, "blocks", "*.json"))):
        d = load(p)
        comps = d["minecraft:block"]["components"]
        uri = "https://mc.local/server/block_components/1.26.60/Block%20Components.json"
        plain = {k: v for k, v in comps.items() if not k.startswith("tag:")}
        schemas.validate(uri, plain, os.path.relpath(p, ROOT))


# ---------------------------------------------------------------------------
# Cross reference checks
# ---------------------------------------------------------------------------

def collect_lang(rp: str) -> Dict[str, str]:
    keys = {}
    for p in glob.glob(os.path.join(rp, "texts", "*.lang")):
        for line in open(p, encoding="utf-8"):
            line = line.split("##")[0].rstrip("\n")
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                keys[k.strip()] = v
    return keys


def texture_exists(rp: str, rel: str) -> bool:
    return any(os.path.exists(os.path.join(rp, rel + ext)) for ext in (".png", ".tga", ".jpg"))


def check_refs(bp: str, rp: str) -> None:
    lang = collect_lang(rp)
    item_tex = load(os.path.join(rp, "textures", "item_texture.json"))["texture_data"]
    terrain = load(os.path.join(rp, "textures", "terrain_texture.json"))["texture_data"]
    for k, v in list(item_tex.items()) + list(terrain.items()):
        t = v["textures"]
        for tt in (t if isinstance(t, list) else [t]):
            path = tt if isinstance(tt, str) else tt.get("path")
            if not texture_exists(rp, path):
                err(f"texture atlas entry {k}: missing file {path}")

    # geometry / animation / controller inventories
    geos = set()
    for p in glob.glob(os.path.join(rp, "models", "**", "*.json"), recursive=True):
        for g in load(p).get("minecraft:geometry", []):
            geos.add(g["description"]["identifier"])
    anims = set()
    for p in glob.glob(os.path.join(rp, "animations", "*.json")):
        anims |= set(load(p).get("animations", {}).keys())
    ctrls = set()
    for p in glob.glob(os.path.join(rp, "animation_controllers", "*.json")):
        ctrls |= set(load(p).get("animation_controllers", {}).keys())
    rcs = set()
    for p in glob.glob(os.path.join(rp, "render_controllers", "*.json")):
        rcs |= set(load(p).get("render_controllers", {}).keys())
    vanilla_ok = lambda name: name.startswith("controller.render.armor") or name.startswith("animation.armor.")

    # items
    bp_items = {}
    for p in glob.glob(os.path.join(bp, "items", "*.json")):
        d = load(p)["minecraft:item"]
        ident = d["description"]["identifier"]
        bp_items[ident] = d
        icon = d["components"].get("minecraft:icon")
        icon = icon if isinstance(icon, str) else (icon or {}).get("textures", {}).get("default") or (icon or {}).get("texture")
        if icon not in item_tex:
            err(f"item {ident}: icon '{icon}' not in item_texture.json")
        dn = d["components"].get("minecraft:display_name", {}).get("value")
        if dn and dn not in lang:
            err(f"item {ident}: lang key '{dn}' missing")
    # blocks
    blocks_json = load(os.path.join(rp, "blocks.json"))
    for p in glob.glob(os.path.join(bp, "blocks", "*.json")):
        d = load(p)["minecraft:block"]
        ident = d["description"]["identifier"]
        for inst in d["components"].get("minecraft:material_instances", {}).values():
            if isinstance(inst, dict) and inst.get("texture") not in terrain:
                err(f"block {ident}: texture '{inst.get('texture')}' not in terrain_texture.json")
        dn = d["components"].get("minecraft:display_name")
        if dn and dn not in lang:
            err(f"block {ident}: lang key '{dn}' missing")
        if ident not in blocks_json:
            warn(f"block {ident}: no entry in blocks.json (sounds)")
        loot = d["components"].get("minecraft:loot")
        if loot and not os.path.exists(os.path.join(bp, loot)):
            err(f"block {ident}: loot table {loot} missing")

    # entities (server)
    server_entities = {}
    for p in glob.glob(os.path.join(bp, "entities", "*.json")):
        d = load(p)["minecraft:entity"]
        ident = d["description"]["identifier"]
        server_entities[ident] = d
        blobs = json.dumps(d)
        for loot in re.findall(r'"table": "([^"]+)"', blobs):
            if not os.path.exists(os.path.join(bp, loot)):
                err(f"entity {ident}: loot table {loot} missing")
        for ev in re.findall(r'"event": "([^"]+)"', blobs):
            if ev not in d.get("events", {}) and not ev.startswith("minecraft:"):
                err(f"entity {ident}: references undefined event {ev}")
        for ev in d.get("events", {}).values():
            for grp in re.findall(r'"component_groups": \[([^\]]*)\]', json.dumps(ev)):
                for g in re.findall(r'"([^"]+)"', grp):
                    if g not in d.get("component_groups", {}):
                        err(f"entity {ident}: event uses missing component group {g}")
        if d["description"].get("is_spawnable") and f"item.spawn_egg.entity.{ident}.name" not in lang:
            err(f"entity {ident}: spawn egg lang key missing")
        if f"entity.{ident}.name" not in lang:
            err(f"entity {ident}: lang key entity.{ident}.name missing")

    # client entities + attachables
    for p in glob.glob(os.path.join(rp, "entity", "*.json")) + glob.glob(os.path.join(rp, "attachables", "*.json")):
        root = load(p)
        d = root.get("minecraft:client_entity") or root.get("minecraft:attachable")
        desc = d["description"]
        ident = desc["identifier"]
        label = os.path.relpath(p, ROOT)
        if "minecraft:client_entity" in root and ident not in server_entities:
            err(f"{label}: no behavior entity {ident}")
        if "minecraft:attachable" in root and ident not in bp_items:
            err(f"{label}: no item {ident}")
        for k, tex in desc.get("textures", {}).items():
            if tex.startswith("textures/misc/"):
                continue
            if not texture_exists(rp, tex):
                err(f"{label}: texture {tex} missing")
        for k, geo in desc.get("geometry", {}).items():
            if geo not in geos:
                err(f"{label}: geometry {geo} missing")
        for k, a in desc.get("animations", {}).items():
            if a.startswith("controller.animation."):
                if a not in ctrls:
                    err(f"{label}: animation controller {a} missing")
            elif a not in anims and not vanilla_ok(a):
                err(f"{label}: animation {a} missing")
        for rc in desc.get("render_controllers", []):
            name = rc if isinstance(rc, str) else list(rc.keys())[0]
            if name not in rcs and not vanilla_ok(name):
                err(f"{label}: render controller {name} missing")
        animate = desc.get("scripts", {}).get("animate", [])
        for a in animate:
            name = a if isinstance(a, str) else list(a.keys())[0]
            if name not in desc.get("animations", {}):
                err(f"{label}: scripts.animate uses unknown short name {name}")

    # sounds
    sdefs = load(os.path.join(rp, "sounds", "sound_definitions.json"))["sound_definitions"]
    for ev, sd in sdefs.items():
        for s in sd.get("sounds", []):
            name = s if isinstance(s, str) else s["name"]
            if not os.path.exists(os.path.join(rp, name + ".ogg")) and not os.path.exists(os.path.join(rp, name + ".fsb")):
                if name.startswith("sounds/superhuman/"):
                    err(f"sound {ev}: file {name}.ogg missing")

    # particles referenced by scripts exist
    particles = set()
    for p in glob.glob(os.path.join(rp, "particles", "*.json")):
        particles.add(load(p)["particle_effect"]["description"]["identifier"])
    script_text = ""
    for p in glob.glob(os.path.join(bp, "scripts", "**", "*.js"), recursive=True):
        script_text += open(p, encoding="utf-8").read()
    for pid in set(re.findall(r'"(superhuman:[a-z_]+)"', script_text)):
        pass
    for pid in set(re.findall(r'P\.([A-Z_]+)', script_text)):
        pass
    used_particles = set(re.findall(r'"(superhuman:[a-z0-9_]+_particle)"', script_text))
    for pid in used_particles:
        if pid not in particles:
            err(f"script uses particle {pid} that is not defined")
    used_sounds = set(re.findall(r'"(superhuman\.[a-z0-9_.]+)"', script_text))
    for s in used_sounds:
        if s not in sdefs:
            err(f"script uses sound {s} that is not in sound_definitions.json")
    used_anims = set(re.findall(r'"(animation\.superhuman\.[a-z0-9_.]+)"', script_text))
    for a in used_anims:
        if a not in anims:
            err(f"script uses animation {a} that is not defined")
    used_ids = set(re.findall(r'"(superhuman:[a-z0-9_]+)"', script_text))
    known = set(bp_items) | set(server_entities) | particles | {
        load(p)["minecraft:block"]["description"]["identifier"] for p in glob.glob(os.path.join(bp, "blocks", "*.json"))}
    for i in used_ids:
        if i not in known and not i.startswith("superhuman:state") and not re.match(r"superhuman:(power|suit|cryptonite)$", i):
            warn(f"script references unknown id {i}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bp", default=os.path.join(ROOT, "addon", "behavior_pack"))
    ap.add_argument("--rp", default=os.path.join(ROOT, "addon", "resource_pack"))
    ap.add_argument("--schemas", default=os.environ.get("BEDROCK_SAMPLES"))
    args = ap.parse_args()

    for p in glob.glob(os.path.join(args.bp, "**", "*.json"), recursive=True) + \
            glob.glob(os.path.join(args.rp, "**", "*.json"), recursive=True):
        try:
            load(p)
        except Exception as e:  # noqa: BLE001
            err(f"{os.path.relpath(p, ROOT)}: invalid JSON: {e}")
    if errors:
        print("\n".join(errors))
        return 1

    if args.schemas and os.path.isdir(args.schemas):
        validate_bp_with_schemas(args.bp, Schemas(args.schemas))
    else:
        warn("official schemas not available; skipped schema validation")

    check_refs(args.bp, args.rp)

    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
