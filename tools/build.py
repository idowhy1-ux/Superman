#!/usr/bin/env python3
"""Build both editions of the add-on.

    python3 tools/build.py              # validate, type-check, build both
    python3 tools/build.py --skip-checks

Outputs (in dist/):
    Heroes_Origins.mcaddon  - leveling system (XP, unlock powers by level)
    Heroes_Legends.mcaddon  - no leveling, every power from the start
Each edition has its own pack names and UUIDs, so both can be imported into
Minecraft at the same time (use one of them per world).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_BP = os.path.join(ROOT, "addon", "behavior_pack")
SRC_RP = os.path.join(ROOT, "addon", "resource_pack")
DIST = os.path.join(ROOT, "dist")

VERSION = [2, 0, 0]
MIN_ENGINE = [1, 26, 10]
SCRIPT_DEPS = [
    {"module_name": "@minecraft/server", "version": "2.6.0"},
    {"module_name": "@minecraft/server-ui", "version": "2.0.0"},
]

EDITIONS = {
    # The UUIDs are the same as in version 1 ("Superhuman: Rising" / "Superhuman: Unleashed"),
    # so importing a newer version upgrades the old packs instead of adding a duplicate.
    "origins": {
        "file": "Heroes_Origins",
        "name": "Heroes: Origins",
        "leveling": True,
        "icon": "tools/icons/origins.png",
        "description": "Start as a rookie and become a legend! Wear the caped Hero Suit or the nanotech Nano Suit, "
                       "save citizens, put out fires and defeat supervillains to level up and unlock new powers. "
                       "Beware of Cryptonite!",
        "bp_uuid": "0297dc4f-37dd-471c-b2a7-7c2516e86461",
        "bp_data": "14ac4373-fe88-404c-bc09-35a3600bc99c",
        "bp_script": "27ae013c-768f-4c1e-af5b-16759c3a3ecf",
        "rp_uuid": "a8dc9efa-311c-4921-9eb9-1072d0e8975e",
        "rp_res": "a140b072-5f3b-49aa-abd5-1a7117070f6c",
    },
    "legends": {
        "file": "Heroes_Legends",
        "name": "Heroes: Legends",
        "leveling": False,
        "icon": "tools/icons/legends.png",
        "description": "Every power from the start! Fly with the caped Hero Suit or deploy the nanotech Nano Suit: "
                       "heat vision, freeze breath, repulsors, micro-missiles, the unibeam and more. Save cities, "
                       "stop the supervillains - and watch out for Cryptonite!",
        "bp_uuid": "eefe9e11-8a4d-4800-90dc-1308122206e8",
        "bp_data": "33e2a857-087a-4ffe-9d19-8d3c37707578",
        "bp_script": "2fa89817-c1bc-49c8-8c21-806c68eefb0b",
        "rp_uuid": "d5db6593-c534-4d3e-b948-ad04fc83b8cb",
        "rp_res": "9f52b245-2473-4845-a0d1-5d7ded649136",
    },
}


def bp_manifest(ed: dict) -> dict:
    return {
        "format_version": 2,
        "header": {
            "name": ed["name"],
            "description": ed["description"],
            "uuid": ed["bp_uuid"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": ed["bp_data"], "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": ed["bp_script"], "version": VERSION,
             "entry": "scripts/main.js"},
        ],
        "dependencies": SCRIPT_DEPS + [{"uuid": ed["rp_uuid"], "version": VERSION}],
    }


def rp_manifest(ed: dict) -> dict:
    return {
        "format_version": 2,
        "header": {
            "name": ed["name"],
            "description": ed["description"],
            "uuid": ed["rp_uuid"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [{"type": "resources", "uuid": ed["rp_res"], "version": VERSION}],
    }


def config_js(key: str, ed: dict) -> str:
    return (
        "// Edition settings. tools/build.py rewrites this file for each edition:\n"
        "//   Heroes: Origins  -> leveling: true  (earn XP, unlock powers level by level)\n"
        "//   Heroes: Legends  -> leveling: false (every power unlocked from the start)\n"
        "export const EDITION = {\n"
        f'  id: "{key}",\n'
        f'  name: "{ed["name"]}",\n'
        f'  leveling: {"true" if ed["leveling"] else "false"},\n'
        "};\n"
    )


def write_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def write_source_manifests() -> None:
    """Keep the source packs usable directly (they are the Origins edition)."""
    ed = EDITIONS["origins"]
    write_json(os.path.join(SRC_BP, "manifest.json"), bp_manifest(ed))
    write_json(os.path.join(SRC_RP, "manifest.json"), rp_manifest(ed))


def ignore(_dir, names):
    return [n for n in names if n in ("__pycache__", ".DS_Store") or n.endswith(".pyc")]


def build_edition(key: str, ed: dict) -> str:
    out_dir = os.path.join(DIST, ed["file"])
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    bp = os.path.join(out_dir, f"{ed['file']}_BP")
    rp = os.path.join(out_dir, f"{ed['file']}_RP")
    shutil.copytree(SRC_BP, bp, ignore=ignore)
    shutil.copytree(SRC_RP, rp, ignore=ignore)
    write_json(os.path.join(bp, "manifest.json"), bp_manifest(ed))
    write_json(os.path.join(rp, "manifest.json"), rp_manifest(ed))
    with open(os.path.join(bp, "scripts", "config.js"), "w", encoding="utf-8") as f:
        f.write(config_js(key, ed))
    icon = os.path.join(ROOT, ed["icon"])
    shutil.copy(icon, os.path.join(bp, "pack_icon.png"))
    shutil.copy(icon, os.path.join(rp, "pack_icon.png"))

    archive = os.path.join(DIST, f"{ed['file']}.mcaddon")
    if os.path.exists(archive):
        os.remove(archive)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        for base in (bp, rp):
            for folder, _dirs, files in os.walk(base):
                for fn in sorted(files):
                    full = os.path.join(folder, fn)
                    z.write(full, os.path.relpath(full, out_dir))
    return archive


def run_checks() -> bool:
    ok = True
    schemas = os.environ.get("BEDROCK_SAMPLES", "")
    cmd = [sys.executable, os.path.join(ROOT, "tools", "validate.py")]
    if schemas:
        cmd += ["--schemas", schemas]
    print("== validate.py")
    if subprocess.run(cmd).returncode != 0:
        ok = False
    if os.path.isdir(os.path.join(ROOT, "node_modules", "@minecraft", "server")):
        print("== tsc (type-check scripts against @minecraft/server typings)")
        npx = shutil.which("npx")
        if npx and subprocess.run([npx, "tsc", "-p", os.path.join(ROOT, "tsconfig.json")], cwd=ROOT).returncode != 0:
            ok = False
    else:
        print("== tsc skipped (run `npm install` to enable script type-checking)")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-checks", action="store_true")
    args = ap.parse_args()
    write_source_manifests()
    if not args.skip_checks and not run_checks():
        print("checks failed - not building")
        return 1
    os.makedirs(DIST, exist_ok=True)
    ok = True
    for key, ed in EDITIONS.items():
        path = build_edition(key, ed)
        print(f"built {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KB)")
        if not args.skip_checks and not smoke_test(ed):
            print(f"smoke test FAILED for {ed['name']} - removing {os.path.basename(path)}")
            os.remove(path)
            ok = False
    return 0 if ok else 1


def smoke_test(ed: dict) -> bool:
    """Run the scripts of a built edition against the mock runtime."""
    node = shutil.which("node")
    if not node:
        print("== smoke test skipped (node not found)")
        return True
    scripts = os.path.join(DIST, ed["file"], f"{ed['file']}_BP", "scripts")
    print(f"== smoke test: {ed['name']}")
    res = subprocess.run([node, "--import", "./tools/smoke/register.mjs", "tools/smoke/run.mjs", scripts],
                         cwd=ROOT, capture_output=True, text=True, timeout=600)
    lines = [l for l in res.stdout.splitlines() if l.startswith(("FAIL", "ALL", "edition")) or "FAILED" in l]
    print("\n".join("   " + l for l in lines))
    return res.returncode == 0


if __name__ == "__main__":
    sys.exit(main())
