# Superhuman – a superhero add-on for Minecraft Bedrock

Two ways to become a hero:

* Put on the **Hero Suit** and become an invincible, flying superhero: supersonic flight
  with real flight animations, super strength, heat vision, freeze breath, x-ray vision,
  thunder claps, ground slams and a solar-flare ultimate.
* Wear the **Nano Core** and, with one gesture, let a swarm of nanites **build an armored
  Nano Suit around you** piece by piece: jet-boot flight, repulsor blasts, homing
  micro-missiles, an energy shield, a nano blade and the chest-reactor **Unibeam** – guided
  by your suit A.I., **VERA**.

All powers are controlled **on screen** – no power items in your inventory. Protect
procedurally built **cities** full of citizens, save people from burning buildings and falls,
complete **missions**, fight six **supervillains** with boss phases – and stay away from
**Cryptonite** (Hero Suit) and **Volt's EMP** (Nano Suit).

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

## Getting the suits

**Hero Suit** – craft it (or take it from the Creative inventory, *Equipment* tab) and wear it
in the **chest** armor slot. It covers your whole body and has a cape that flutters as you
run and streams behind you when you fly.

```
 Red Wool   Gold Ingot   Red Wool
Blue Wool    Diamond    Blue Wool
Blue Wool   Blue Wool   Blue Wool
```

**Nano Core** – craft it and wear it in the **chest** slot. On its own it is a glowing
arc-reactor housing on your chest; **hold sneak and press jump** (on the ground) and the
nanites flow out of the core and assemble the full **Nano Suit** around you – torso first,
then arms, legs and finally the helmet, with a nanite swarm, sound and VERA's greeting.
Do the same again to retract the suit back into the core.

```
Iron Block   Redstone Block   Iron Block
 Redstone       Diamond        Redstone      (Redstone = Block of Redstone)
Iron Block     Gold Block     Iron Block
```

The deployed Nano Suit can't be taken off by accident – it always turns back into the
Nano Core if it leaves your chest slot.

## On-screen controls

There are **no power items**. Your selected power, every power's icon (selected, locked or
recharging), energy, suit integrity, speed and alerts are drawn above the hotbar.

| Action | How |
|---|---|
| **Use the selected power** | **Attack the air** with an empty hand (left-click / tap the screen) |
| **Switch power** | **Sneak + attack** the air |
| **Power Wheel** | **Double-tap sneak** while standing on the ground |
| **Deploy / retract the Nano Suit** | **Hold sneak and press jump** on the ground while wearing the Nano Core |
| Take off | Jump, then press **jump again in mid-air** |
| Fly | Look where you want to go and hold **forward** (strafe works too) |
| Up / down | Hold **jump** / **sneak** |
| Supersonic flight | **Sprint** while flying (or double-tap forward) – FOV kicks out, wind trails, sonic boom |
| Land | Sneak down onto the ground – superhero landing pose |
| Stop flying mid-air | Double-tap **sneak** in the air |
| Ground Slam | Dive into the ground at high speed |
| Punch | Attack an enemy as usual – super strength (Hero Suit) or armored fists (Nano Suit) |
| Carry a citizen | **Use/tap** the citizen; land and **sneak** to set them down |

Attacking a mob or a block within reach punches or mines as normal – the power only fires
when you attack empty air, so you never lose normal Minecraft controls.

The **Power Wheel** is a menu with a big icon button for every power (tap one to select
it – on touch screens it also fires it), plus Deploy/Retract Nano Suit, your Hero Profile &
Missions, Find Nearest City, Controls & Tips, Settings and (in Creative) Test Tools.

Mobile, controller and keyboard all work: the gestures only use attack, sneak and jump.
For the first minutes after suiting up, button hints are shown under the ability bar (can
be turned off in Settings).

## Hero Suit powers

Powers use **solar energy** (☀ on the HUD), which recharges twice as fast in direct sunlight.

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
| Thunder Clap | A clap that blasts enemies away and **blows out fires** in front of you | Level 6 |
| Super Hearing | Hear cries for help from 220 m away (HUD arrow + distance) | Level 7 |
| Ground Slam | Fast landings release a damaging shockwave | Level 9 |
| Solar Flare | Ultimate: blast every enemy around you with stored sunlight | Level 12 |

Heat Vision and Freeze Breath are beams: attack the air once and the beam runs for a moment.
X-Ray is a toggle.

## Nano Suit powers

The Nano Suit runs on **reactor energy** (⚡ on the HUD), which recharges anywhere, and has
**suit integrity** that absorbs most incoming damage and slowly self-repairs. It is
**immune to Cryptonite**.

| Power | What it does | Unlock (Rising) |
|---|---|---|
| Thruster Flight | Jet-boot and hand-thruster flight with flames, hover pose and fast-flight pose | Level 1 |
| Repulsor Blast | Fast palm blasts with knockback – the concussive blast also smothers fires | Level 1 |
| Tactical Scan | Marks enemies, citizens and ores through walls and lists them on the HUD | Level 2 |
| Supersonic Flight | Afterburner speed | Level 4 |
| Micro-Missiles | A salvo of 3–6 **homing missiles** that lock onto enemies | Level 4 |
| Nano Shield | An energy shield that blocks almost all damage for several seconds | Level 6 |
| Super Hearing | Cries for help from far away | Level 7 |
| Nano Blade | Forms a nanotech blade: huge melee damage with a sweep | Level 8 |
| Ground Slam | Armored landings shake the ground | Level 9 |
| Unibeam | Charge the chest reactor, then fire a devastating beam | Level 10 |

**VERA**, the suit A.I., greets you, reports city emergencies, warns you when a
supervillain shows up (and about Volt's EMP), and when suit integrity is critical or reactor
power runs low.

## Leveling (Rising)

In **Rising** you start at level 1 and both suits share one hero level. Every level also
increases flight speed, punch damage, energy, resistance, suit integrity, missile count and
health. **Unleashed** starts with every power and the maximum values.

| Deed | XP |
|---|---|
| Rescue a citizen | 60 (+40 for catching a falling one) |
| Resolve a city emergency | 100 |
| Put out a fire block during an emergency | 4 |
| Defeat a thug | 20 |
| Defeat Pyroclast / Viridian / Glacius / Volt / Rampager / Omega Mech | 180 / 200 / 220 / 240 / 300 / 300 |
| Defeat any other monster while suited | 3 |
| Fly 250 blocks | 3 |
| Complete a mission | 50 – 500 |

XP needed for the next level is `100 + 60 × (level − 1)`. Level-ups play a special animation:
golden flash, rising aura rings, the hero lifts into the air with arms spread, and new
powers are announced.

## Missions

Open the Power Wheel → **Hero Profile & Missions** to see your progress. Missions work in
both editions (in Rising they also give XP):

| Mission | Goal |
|---|---|
| First Flight | Fly 200 blocks |
| Sound Barrier | Break the sound barrier |
| Firefighter | Put out 25 fires |
| Guardian | Save 10 citizens |
| Safe Hands | Catch 3 falling citizens |
| City Hero | Resolve 5 city emergencies |
| Crime Fighter | Defeat 25 thugs |
| Villain Hunter | Defeat 3 supervillains |
| Nanotech | Deploy the Nano Suit |
| Sharpshooter | Hit 50 enemies with repulsors |
| Heavy Hitter | Perform 10 ground slams |
| Meteor Hunter | Mine 10 cryptonite |
| **Legend** | Complete every other mission – unlocks a golden flight trail |

## Cryptonite

Glowing green **Cryptonite Ore** generates underground (and in deepslate), and
**cryptonite meteors** sometimes crash down at night. While wearing the Hero Suit, being near
cryptonite – ore, blocks, dropped shards, anyone holding it, the villain Viridian, or a hit
from a Cryptonite Blade or bolt – weakens you. (The Nano Suit is immune – switch suits!)

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
trees and street lamps, parked cars and around a dozen citizens. Use the Power Wheel →
*Find Nearest City* to track one down, or build one where you want with the creative-only
**City Blueprint**.

While a suited hero is nearby, emergencies happen every few minutes:

* **Building fire** – a rooftop is burning with citizens trapped. Put the fire out with
  **Freeze Breath**, a **Thunder Clap** or **Repulsor blasts** (or fly each citizen down to
  the street).
* **Villain attack** – thugs (and at higher levels a supervillain) attack citizens.
* **Falling citizen** – someone slips off the tallest tower. Fly into them to catch them.

A tall **signal beam** rises over the city while an emergency is running, and the HUD shows
an arrow and distance to it. Citizens in danger show a red "HELP!" tag, flail their arms and
flee. Saved citizens cheer, thank you and sometimes hand you a gift (emeralds, food, a golden
apple, even a diamond). Resolved emergencies make the **breaking news** for every player.

## Villains

| Villain | Abilities | Weakness |
|---|---|---|
| **Thug** | Street criminals that attack citizens; also spawn rarely at night | Your fists |
| **Pyroclast** | Living magma: fireball bursts, burning touch, sets the ground on fire | Freeze Breath (×3 damage), water |
| **Viridian** | Cryptonite-powered: cryptonite bolts, aura that weakens heroes, surges, teleports behind you | The Nano Suit, range, keep moving |
| **Glacius** | Ice lord: ice-shard volleys that slow you, frost aura, freezes water and covers the ground in snow | Heat Vision (×3 fire damage) |
| **Volt** | Living lightning: lightning bolts, sprints, **EMP pulses that shut the Nano Suit down** for a few seconds | Water, the Hero Suit |
| **Rampager** | 3-block-tall brute: leaps, smashes windows, roars, ground-pound shockwaves | Stay airborne |
| **Omega Mech** | Giant robot: missile barrages, charged laser beam, stomp | Heat Vision (×1.5 damage) |

Supervillains are real boss fights: each gets a title card and taunts when they appear, a
boss health bar, and at half health they enter a **second phase** (Rampager enrages,
Pyroclast erupts in a ring of fire, Viridian calls in thugs, Omega Mech fires a six-missile
barrage, Glacius releases a frost burst with a much larger aura, Volt overcharges). The HUD
shows the name and health of whatever you are aiming at. They drop valuable loot and appear
during city emergencies, as random "villain uprisings" near heroes (level 4+ in Rising), and
from spawn eggs.

## Commands (cheats on)

```
/scriptevent superhuman:help
/scriptevent superhuman:city                          build a city in front of you
/scriptevent superhuman:event fire|attack|falling     start an emergency in the nearest city
/scriptevent superhuman:villain pyroclast|viridian|glacius|volt|rampager|omega_mech
/scriptevent superhuman:meteor                        call a cryptonite meteor
/scriptevent superhuman:level 10                      (Rising) set your level
/scriptevent superhuman:xp 500                        (Rising) add XP
/scriptevent superhuman:autocities on|off             automatic city generation
```

Creative-mode players also get a **Creative / Test Tools** page in the Power Wheel.

## Notes

* The add-on never replaces the vanilla player files – poses are played with the Script API,
  so it works with custom skins and most other add-ons.
* Flight uses knockback to steer you and automatically **calibrates itself** to the engine in
  the first few seconds of flying (the tuning is saved per world). If flight ever feels off
  after a Minecraft update, run `/scriptevent superhuman:resetflight`.
* Knockback-resistant armor (netherite leggings/boots/helmet) slightly slows flight.
* Settings (HUD, on-screen hints, speed FOV effect, camera shake, heat vision setting fires,
  super speed, citizen shouts) are in the Power Wheel.
* The ability icons are custom font glyphs (`resource_pack/font/glyph_E5.png`). If another
  resource pack also replaces that glyph sheet, the icons may look wrong – put this pack on top.
* Worlds from version 1 keep working: old power items in your inventory still fire their
  power, and you get a one-time tip about the new on-screen controls.
* The names (Superhuman, Cryptonite, Nano Core, VERA, the villains) and all art are original. To rename the
  editions, edit `EDITIONS` in `tools/build.py` and rebuild.

## Building from source

```
addon/behavior_pack     items, blocks, entities, loot, recipes, spawn rules, ore generation, scripts
addon/resource_pack     client entities, suit attachables, models, animations, particles, sounds, textures, font glyphs
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
