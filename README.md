# Superhuman – a superhero add-on for Minecraft Bedrock

Put on the **Hero Suit** and become an invincible, flying superhero: supersonic flight
with real flight animations, super strength, heat vision, freeze breath, x-ray vision,
ground slams and a solar-flare ultimate. Protect procedurally built **cities** full of
citizens, save people from burning buildings and falls, fight **supervillains** – and stay
away from **Cryptonite**.

The add-on comes in **two editions with different names**:

| Edition | File | Leveling |
|---|---|---|
| **Superhuman: Rising** | [`dist/Superhuman_Rising.mcaddon`](dist/Superhuman_Rising.mcaddon) | Yes – start at level 1, earn XP, unlock powers up to level 20 |
| **Superhuman: Unleashed** | [`dist/Superhuman_Unleashed.mcaddon`](dist/Superhuman_Unleashed.mcaddon) | No – every power and max stats from the start |

Both editions have their own pack names and UUIDs, so you can import both. Use **one
edition per world**.

## Install

1. Download one (or both) `.mcaddon` files from the [`dist/`](dist) folder.
2. Open the file on your device (double-click on Windows, "Open with Minecraft" on
   mobile). Minecraft imports the behavior pack and the resource pack.
3. Create or edit a world → **Behavior Packs** → activate the edition you want. The matching
   resource pack is applied automatically.
4. No experimental toggles are needed. Requires **Minecraft Bedrock 1.26.10 or newer**
   (Script API `@minecraft/server` 2.6.0).

## Getting the suit

Craft the **Hero Suit** (or take it from the Creative inventory, *Equipment* tab):

```
 Red Wool   Gold Ingot   Red Wool
Blue Wool    Diamond    Blue Wool
Blue Wool   Blue Wool   Blue Wool
```

Wear it in the **chest** armor slot. It covers your whole body and has a cape that
flutters as you run and streams behind you when you fly. Your power items (Hero Emblem,
X-Ray, Freeze Breath, Heat Vision, Solar Flare) appear in your inventory automatically
once they are unlocked. They are kept on death and can't be dropped by accident; use
*Restore Power Items* in the Hero Emblem menu if you ever lose one.

## Controls

| Action | How |
|---|---|
| Take off | Jump, then press **jump again in mid-air** |
| Fly | Look where you want to go and hold **forward** (strafe works too) |
| Up / down | Hold **jump** / **sneak** |
| Supersonic flight | **Sprint** while flying (or double-tap forward) – FOV kicks out, wind trails, sonic boom |
| Land | Sneak down onto the ground – superhero landing pose |
| Stop flying mid-air | Double-tap **sneak** |
| Ground Slam | Dive into the ground at high speed |
| Super strength | Punch – enemies go flying. Punch while flying fast for a **Flying Punch** |
| Heat Vision / Freeze Breath | Hold the item and **hold use** (tap = short burst) |
| X-Ray Vision | Tap use on the item to toggle |
| Solar Flare | Use the item with at least 60% solar energy |
| Carry a citizen | **Use/tap** the citizen; land and **sneak** to set them down |
| Hero menu | Use the **Hero Emblem** – profile, powers, settings, nearest city |

Mobile and console work the same way (jump/sneak buttons, long-press to use). The HUD
above the hotbar shows your level, solar energy, speed and alerts.

## Powers

Powers use **solar energy**, which recharges twice as fast in direct sunlight.

| Power | What it does | Unlock (Rising) |
|---|---|---|
| Flight | Hover, cruise, dive, bank into turns | Level 1 |
| Super Strength | Huge melee bonus and knockback | Level 1 |
| Invulnerability | Resistance, fire immunity, no fall damage | Level 1 |
| Super Speed | Speed and jump boost on foot | Level 1 |
| X-Ray Vision | Night vision; colored markers show ores, villains and citizens through walls | Level 2 |
| Freeze Breath | **Puts out fire** (fire blocks, campfires, burning mobs), freezes water to ice, lava to obsidian, slows and freezes enemies – triple damage to fire villains | Level 3 |
| Supersonic Flight | Higher top speed, sonic boom shockwave | Level 4 |
| Heat Vision | Twin eye beams: burn enemies, melt ice and snow, turn sand into glass, ignite TNT | Level 5 |
| Super Hearing | Hear cries for help from 220 m away (HUD arrow + distance) | Level 7 |
| Ground Slam | Fast landings release a damaging shockwave | Level 9 |
| Solar Flare | Ultimate: blast every enemy around you with stored sunlight | Level 12 |

In **Rising**, every level also increases flight speed, punch damage, energy, resistance and
health. **Unleashed** starts at those maximum values.

### Earning XP (Rising)

| Deed | XP |
|---|---|
| Rescue a citizen | 60 (+40 for catching a falling one) |
| Resolve a city emergency | 100 |
| Put out a fire block during an emergency | 4 |
| Defeat a thug | 20 |
| Defeat Pyroclast / Viridian / Rampager / Omega Mech | 180 / 200 / 300 / 300 |
| Defeat any other monster while suited | 3 |
| Fly 250 blocks | 3 |

XP needed for the next level is `100 + 60 × (level − 1)`. Level-ups play a special animation:
golden flash, rising aura rings, the hero lifts into the air with arms spread, and new
powers are announced and added to your inventory.

## Cryptonite

Glowing green **Cryptonite Ore** generates underground (and in deepslate), and
**cryptonite meteors** sometimes crash down at night. While wearing the suit, being near
cryptonite – ore, blocks, dropped shards, anyone holding it, the villain Viridian, or a hit
from a Cryptonite Blade or bolt – weakens you:

* **Weakened**: half-speed flight, no supersonic boost, weaker punches, slowness.
* **Critical** (very close or holding it): no powers, you **can't fly** (you fall!),
  you drop anyone you are carrying and you slowly take damage.

Mine it with a pickaxe to get **Cryptonite Shards** → craft the **Block of Cryptonite**
or the **Cryptonite Blade** (deals bonus damage to suited heroes – great for PvP).

## Cities and people to save

Cities are built automatically: one appears about 150 blocks from where you first spawn,
and new ones rise as you explore far away (at least ~650 blocks apart). Each city has
roads with lane markings and crosswalks, skyscrapers with helipads or antennas, offices,
apartments with water towers, shops, a hospital and a central plaza with a fountain,
trees and street lamps, parked cars and around a dozen citizens. Use the Hero Emblem →
*Find Nearest City* to track one down, or build one where you want with the creative-only
**City Blueprint**.

While a suited hero is nearby, emergencies happen every few minutes:

* **Building fire** – a rooftop is burning with citizens trapped. Put the fire out with
  **Freeze Breath** (or fly each citizen down to the street).
* **Villain attack** – thugs (and at higher levels a supervillain) attack citizens.
* **Falling citizen** – someone slips off the tallest tower. Fly into them to catch them.

Citizens in danger show a red "HELP!" tag, flail their arms and flee. Saved citizens cheer
and thank you, and citizens wave when you fly over them.

## Villains

| Villain | Abilities | Weakness |
|---|---|---|
| **Thug** | Street criminals that attack citizens; also spawn rarely at night | Your fists |
| **Pyroclast** | Living magma: fireball bursts, burning touch, sets the ground on fire | Freeze Breath (×3 damage), water |
| **Viridian** | Cryptonite-powered: cryptonite bolts, aura that weakens heroes, surges, teleports behind you | Fight from range, keep moving |
| **Rampager** | 3-block-tall brute: leaps, smashes windows, roars, ground-pound shockwaves | Stay airborne |
| **Omega Mech** | Giant robot: missile barrages, charged laser beam, stomp | Heat Vision (×1.5 damage) |

Supervillains have boss health bars, drop valuable loot and appear during city emergencies,
as random "villain uprisings" near heroes (level 4+ in Rising), and from spawn eggs.

## Commands (cheats on)

```
/scriptevent superhuman:help
/scriptevent superhuman:city                          build a city in front of you
/scriptevent superhuman:event fire|attack|falling     start an emergency in the nearest city
/scriptevent superhuman:villain pyroclast|viridian|rampager|omega_mech
/scriptevent superhuman:meteor                        call a cryptonite meteor
/scriptevent superhuman:level 10                      (Rising) set your level
/scriptevent superhuman:xp 500                        (Rising) add XP
/scriptevent superhuman:autocities on|off             automatic city generation
```

Creative-mode players also get a **Creative / Test Tools** page in the Hero Emblem menu.

## Notes

* The add-on never replaces the vanilla player files – poses are played with the Script API,
  so it works with custom skins and most other add-ons.
* Flight uses knockback to steer you and automatically **calibrates itself** to the engine in
  the first few seconds of flying (the tuning is saved per world). If flight ever feels off
  after a Minecraft update, run `/scriptevent superhuman:resetflight`.
* Knockback-resistant armor (netherite leggings/boots/helmet) slightly slows flight.
* Settings (HUD, speed FOV effect, heat vision setting fires, super speed, citizen shouts)
  are in the Hero Emblem menu.
* The names (Superhuman, Cryptonite, the villains) and all art are original. To rename the
  editions, edit `EDITIONS` in `tools/build.py` and rebuild.

## Building from source

```
addon/behavior_pack     items, blocks, entities, loot, recipes, spawn rules, ore generation, scripts
addon/resource_pack     client entities, suit attachable, models, animations, particles, sounds, textures
tools/generate_assets.py  regenerates textures, sounds, models and animations from code
tools/build.py          validates, type-checks, smoke-tests and builds both .mcaddon files into dist/
tools/validate.py       JSON / official-schema / cross-reference checks
tools/smoke/            mock Script API runtime that plays through the main features in Node
```

Requirements: Python 3 with Pillow and NumPy, ffmpeg (sounds), Node.js 22 (optional, for
type-checking and the smoke test).

```bash
npm install                                  # optional: typings + TypeScript
python3 tools/generate_assets.py             # only if you change art/models/animations
BEDROCK_SAMPLES=/path/to/Mojang/bedrock-samples python3 tools/build.py
```

`BEDROCK_SAMPLES` (a checkout of [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples))
enables validation against Mojang's official JSON schemas; without it the other checks still run.
