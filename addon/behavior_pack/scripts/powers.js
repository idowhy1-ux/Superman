// Active powers: Heat Vision, Freeze Breath (extinguishes fire!), X-Ray Vision,
// Super Strength, Ground Slam and Solar Flare - plus the solar energy meter.
import { BlockVolume, Direction, EntityDamageCause, MolangVariableMap, system, world } from "@minecraft/server";
import { ANIM, ID, PARTICLE, SOUND, XRAY_ORES } from "./constants.js";
import { POWERS, flash, hasPower, stats } from "./leveling.js";
import { settings, state } from "./store.js";
import {
  V,
  basis,
  blockAt,
  cameraFade,
  clamp,
  colorVars,
  hasFamily,
  msg,
  particle,
  playerSound,
  safe,
  setBlock,
  shake,
  sound,
  valid,
} from "./util.js";
import { playAction, playPose, punchAnim, stopAction } from "./anim.js";
import { heldItemId } from "./suit.js";
import { onLanding } from "./flight.js";
import { emit } from "./bus.js";

const ORE_IDS = Object.keys(XRAY_ORES);
const MELT_TO_WATER = new Set(["minecraft:ice", "minecraft:packed_ice", "minecraft:blue_ice", "minecraft:frosted_ice"]);
const SNOW = new Set(["minecraft:snow_layer", "minecraft:snow", "minecraft:powder_snow"]);
const PASSABLE = new Set([
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:vine",
  "minecraft:snow_layer", "minecraft:light_block_15", "minecraft:iron_bars", "minecraft:glass_pane",
]);
const NOT_A_TARGET = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand", "minecraft:painting"]);

// ---------------------------------------------------------------------------
// Item events
// ---------------------------------------------------------------------------
world.afterEvents.itemUse.subscribe((ev) => {
  const player = ev.source;
  const id = ev.itemStack?.typeId;
  if (!player || !id) return;
  switch (id) {
    case ID.HEAT:
      startBeam(player, "heat");
      break;
    case ID.FREEZE:
      startBeam(player, "freeze");
      break;
    case ID.XRAY:
      toggleXray(player);
      break;
    case ID.FLARE:
      solarFlare(player);
      break;
    case ID.EMBLEM:
      emit("open_menu", player);
      break;
    case ID.BLUEPRINT:
      emit("blueprint", player);
      break;
  }
});

world.afterEvents.itemStartUse.subscribe((ev) => {
  const id = ev.itemStack?.typeId;
  if (id === ID.HEAT || id === ID.FREEZE) {
    const st = state(ev.source);
    const b = id === ID.HEAT ? st.heat : st.freeze;
    b.hold = true;
    b.until = Math.max(b.until, system.currentTick + 6);
  }
});

function release(player) {
  const st = state(player);
  st.heat.hold = false;
  st.freeze.hold = false;
}
world.afterEvents.itemStopUse.subscribe((ev) => release(ev.source));
world.afterEvents.itemReleaseUse.subscribe((ev) => release(ev.source));

/** @param {import("@minecraft/server").Player} player @param {"heat"|"freeze"} kind */
function startBeam(player, kind) {
  const st = state(player);
  if (!st.suited) {
    flash(player, "§7Put on the §9Hero Suit§7 to use this power.");
    return;
  }
  if (!hasPower(player, kind)) {
    flash(player, `§7${POWERS[kind].name} unlocks at level §e${POWERS[kind].level}`);
    return;
  }
  if (st.krypto >= 1) {
    flash(player, "§a☢ Cryptonite is blocking your powers!");
    return;
  }
  st[kind].until = system.currentTick + 14;
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------
/** @param {import("@minecraft/server").Player} player */
function inSunlight(player) {
  if (player.dimension.id !== "minecraft:overworld") return false;
  const t = world.getTimeOfDay();
  if (t > 12400 && t < 23400) return false;
  const sky = safe(() => player.dimension.getSkyLightLevel(player.getHeadLocation()), 0);
  return sky >= 13;
}

function tickEnergy(player, st, now, s) {
  if (now % 20 === 0) st.inSun = inSunlight(player);
  if (st.krypto >= 1) {
    st.energy = Math.max(0, st.energy - 0.6);
    return;
  }
  let regen = s.regen * (st.inSun ? 2.2 : 1);
  if (st.krypto > 0) regen *= 0.3;
  st.energy = Math.min(s.maxEnergy, st.energy + regen);
}

// ---------------------------------------------------------------------------
// Heat Vision
// ---------------------------------------------------------------------------
function faceOffset(face) {
  switch (face) {
    case Direction.Up:
      return { x: 0, y: 1, z: 0 };
    case Direction.Down:
      return { x: 0, y: -1, z: 0 };
    case Direction.North:
      return { x: 0, y: 0, z: -1 };
    case Direction.South:
      return { x: 0, y: 0, z: 1 };
    case Direction.East:
      return { x: 1, y: 0, z: 0 };
    default:
      return { x: -1, y: 0, z: 0 };
  }
}

function tickHeat(player, st, now, s) {
  const want = st.suited && heldItemId(player) === ID.HEAT && (st.heat.hold || now < st.heat.until) &&
    st.krypto < 1 && hasPower(player, "heat");
  if (!want) {
    if (st.heatActive) {
      st.heatActive = false;
      stopAction(player);
    }
    return;
  }
  const cost = st.krypto > 0 ? 1.6 : 0.8;
  if (st.energy < cost) {
    if (now % 20 === 0) flash(player, "§eNot enough solar energy - get some sun!");
    st.heat.until = 0;
    return;
  }
  st.energy -= cost;
  if (!st.heatActive) {
    st.heatActive = true;
    playAction(player, ANIM.HEAT);
  }
  fireHeat(player, st, now, s);
}

/** @param {import("@minecraft/server").Player} player */
function fireHeat(player, st, now, s) {
  const dim = player.dimension;
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  const range = s.heatRange;
  const bhit = safe(() => dim.getBlockFromRay(head, dir, { maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false }));
  let endDist = range;
  if (bhit) endDist = V.dist(head, V.add(bhit.block.location, bhit.faceLocation));
  let target;
  for (const h of safe(() => player.getEntitiesFromViewDirection({ maxDistance: endDist }), [])) {
    const e = h.entity;
    if (!valid(e) || e.id === player.id || NOT_A_TARGET.has(e.typeId) || hasFamily(e, "civilian")) continue;
    if (!target || h.distance < target.distance) target = h;
  }
  if (target) endDist = target.distance + 0.2;
  const end = V.add(head, V.scale(dir, endDist));

  const { right } = basis(dir);
  const vars = colorVars(1.0, 0.22, 0.06);
  for (const side of [-1, 1]) {
    const eye = { x: head.x + right.x * 0.12 * side + dir.x * 0.3, y: head.y + 0.03 + dir.y * 0.3, z: head.z + right.z * 0.12 * side + dir.z * 0.3 };
    const seg = V.sub(end, eye);
    const n = Math.min(64, Math.max(2, Math.ceil(V.len(seg) / 0.55)));
    for (let i = 0; i <= n; i++) particle(dim, PARTICLE.HEAT_BEAM, V.add(eye, V.scale(seg, i / n)), vars);
  }
  if (now % 2 === 0) particle(dim, PARTICLE.HEAT_IMPACT, end);
  if (now % 8 === 0) sound(dim, SOUND.HEAT, head, 0.7, 1);

  if (target) {
    if (now % 5 === 0) {
      const e = target.entity;
      const mult = e.typeId === ID.MECH ? 1.5 : 1;
      safe(() => e.applyDamage(s.heatDamage * mult, { cause: EntityDamageCause.fire, damagingEntity: player }));
      safe(() => e.setOnFire(4, true));
    }
  } else if (bhit && now % 2 === 0) {
    heatBlock(player, st, bhit);
  }
}

/** @param {import("@minecraft/server").Player} player */
function heatBlock(player, st, hit) {
  const dim = player.dimension;
  const b = hit.block;
  const loc = b.location;
  const key = V.key(loc);
  const n = (st.heatSpots.get(key) ?? 0) + 1;
  if (st.heatSpots.size > 64) st.heatSpots.clear();
  st.heatSpots.set(key, n);
  const t = b.typeId;
  const c = V.center(loc);
  if (MELT_TO_WATER.has(t) && n >= 8) {
    setBlock(dim, loc, "minecraft:water");
    particle(dim, PARTICLE.STEAM, c);
    st.heatSpots.delete(key);
  } else if (SNOW.has(t) && n >= 4) {
    setBlock(dim, loc, "minecraft:air");
    particle(dim, PARTICLE.STEAM, c);
    st.heatSpots.delete(key);
  } else if ((t === "minecraft:sand" || t === "minecraft:red_sand") && n >= 24) {
    setBlock(dim, loc, "minecraft:glass");
    sound(dim, "random.fizz", c, 0.6, 1.4);
    st.heatSpots.delete(key);
  } else if (t === "minecraft:tnt" && n >= 6) {
    setBlock(dim, loc, "minecraft:air");
    safe(() => dim.spawnEntity("minecraft:tnt", c));
    st.heatSpots.delete(key);
  } else if (n >= 16 && settings(player).heatFire) {
    const p = V.add(loc, faceOffset(hit.face));
    const ab = blockAt(dim, p);
    if (ab && ab.isAir) setBlock(dim, p, "minecraft:fire");
    st.heatSpots.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Freeze Breath
// ---------------------------------------------------------------------------
function tickFreeze(player, st, now, s) {
  const want = st.suited && heldItemId(player) === ID.FREEZE && (st.freeze.hold || now < st.freeze.until) &&
    st.krypto < 1 && hasPower(player, "freeze");
  if (!want) {
    if (st.freezeActive) {
      st.freezeActive = false;
      stopAction(player);
    }
    return;
  }
  const cost = st.krypto > 0 ? 1.4 : 0.7;
  if (st.energy < cost) {
    if (now % 20 === 0) flash(player, "§eNot enough solar energy - get some sun!");
    st.freeze.until = 0;
    return;
  }
  st.energy -= cost;
  if (!st.freezeActive) {
    st.freezeActive = true;
    playAction(player, ANIM.FREEZE);
  }
  fireFreeze(player, st, now, s);
}

function tilt(dir, axis, amount) {
  return V.norm(V.add(dir, V.scale(axis, amount)));
}

/** @param {import("@minecraft/server").Player} player */
function fireFreeze(player, st, now, s) {
  const dim = player.dimension;
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  const mouth = { x: head.x + dir.x * 0.45, y: head.y - 0.15 + dir.y * 0.45, z: head.z + dir.z * 0.45 };
  const vars = new MolangVariableMap();
  vars.setSpeedAndDirection("variable.breath", 13, dir);
  particle(dim, PARTICLE.FREEZE, mouth, vars);
  if (now % 9 === 0) sound(dim, SOUND.FREEZE, mouth, 0.8, 1);
  if (now % 2 !== 0) return;

  const range = s.freezeRange;
  const { right } = basis(dir);
  const up = V.norm({ x: -dir.x * dir.y, y: 1 - dir.y * dir.y, z: -dir.z * dir.y });
  const rays = [dir, tilt(dir, right, 0.13), tilt(dir, right, -0.13), tilt(dir, up, 0.13), tilt(dir, up, -0.13)];
  const seen = new Set();
  let fizz = false;
  for (const r of rays) {
    for (let d = 0.8; d <= range; d += 0.7) {
      const p = V.add(mouth, V.scale(r, d));
      const k = V.key(p);
      if (seen.has(k)) continue;
      seen.add(k);
      const b = blockAt(dim, p);
      if (!b) break;
      const res = freezeBlock(player, dim, b);
      if (res === "fire") fizz = true;
      if (res === "stop") break;
    }
  }
  if (fizz) sound(dim, "random.fizz", mouth, 0.7, 1.2);

  const ents = safe(() => dim.getEntities({ location: mouth, maxDistance: range, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }), []);
  for (const e of ents) {
    if (e.id === player.id) continue;
    const c = V.add(e.location, { x: 0, y: 0.9, z: 0 });
    const v = V.sub(c, mouth);
    const d = V.len(v);
    if (d < 0.1 || d > range || V.dot(V.scale(v, 1 / d), dir) < 0.86) continue;
    safe(() => e.extinguishFire(true));
    if (hasFamily(e, "civilian") || e.typeId === "minecraft:player") continue;
    const last = st.freezeHits.get(e.id) ?? -100;
    if (now - last < 6) continue;
    st.freezeHits.set(e.id, now);
    if (st.freezeHits.size > 60) st.freezeHits.clear();
    const weakToCold = e.typeId === ID.PYROCLAST || hasFamily(e, "blaze") || hasFamily(e, "magmacube");
    safe(() => e.applyDamage(s.freezeDamage * (weakToCold ? 3 : 1), { cause: EntityDamageCause.freezing, damagingEntity: player }));
    safe(() => e.addEffect("slowness", 60, { amplifier: 3 }));
    particle(dim, PARTICLE.FROST, c);
    const ft = (st.frozenTicks.get(e.id) ?? 0) + 6;
    st.frozenTicks.set(e.id, ft);
    if (st.frozenTicks.size > 60) st.frozenTicks.clear();
    if (ft >= 42) {
      st.frozenTicks.set(e.id, 0);
      safe(() => e.addEffect("slowness", 80, { amplifier: 10 }));
      safe(() => e.addEffect("weakness", 80, { amplifier: 1 }));
      particle(dim, PARTICLE.FROST, c);
      particle(dim, PARTICLE.FROST, V.add(c, { x: 0, y: 0.6, z: 0 }));
      sound(dim, "random.glass", c, 0.7, 1.6);
      flash(player, "§bFrozen solid!");
    }
  }
}

/**
 * Freeze breath vs. a block. Fire is put out, water and lava freeze,
 * campfires go dark.
 * @returns {"pass"|"stop"|"fire"}
 */
function freezeBlock(player, dim, b) {
  const t = b.typeId;
  const c = V.center(b.location);
  if (t === "minecraft:fire" || t === "minecraft:soul_fire") {
    safe(() => b.setType("minecraft:air"));
    particle(dim, PARTICLE.STEAM, c);
    emit("fire_out", { player, dim, loc: b.location });
    return "fire";
  }
  if (t === "minecraft:water" || t === "minecraft:flowing_water") {
    safe(() => b.setType("minecraft:ice"));
    particle(dim, PARTICLE.FROST, c);
    return "stop";
  }
  if (t === "minecraft:lava" || t === "minecraft:flowing_lava") {
    const depth = safe(() => Number(b.permutation.getState("liquid_depth")), 0);
    safe(() => b.setType(depth === 0 ? "minecraft:obsidian" : "minecraft:cobblestone"));
    particle(dim, PARTICLE.STEAM, c);
    return "stop";
  }
  if (t === "minecraft:campfire" || t === "minecraft:soul_campfire") {
    safe(() => {
      if (!b.permutation.getState("extinguished")) b.setPermutation(b.permutation.withState("extinguished", true));
    });
    particle(dim, PARTICLE.STEAM, c);
    emit("fire_out", { player, dim, loc: b.location });
    return "stop";
  }
  if (b.isAir || PASSABLE.has(t)) return "pass";
  return "stop";
}

// ---------------------------------------------------------------------------
// X-Ray Vision
// ---------------------------------------------------------------------------
/** @param {import("@minecraft/server").Player} player */
function toggleXray(player) {
  const st = state(player);
  if (!st.suited) {
    flash(player, "§7Put on the §9Hero Suit§7 to use this power.");
    return;
  }
  if (!hasPower(player, "xray")) {
    flash(player, `§7X-Ray Vision unlocks at level §e${POWERS.xray.level}`);
    return;
  }
  if (st.krypto >= 1) {
    flash(player, "§a☢ Cryptonite is blocking your powers!");
    return;
  }
  st.xray = !st.xray;
  playerSound(player, SOUND.XRAY, 0.8, st.xray ? 1.2 : 0.8);
  flash(player, st.xray ? "§aX-Ray Vision ON" : "§7X-Ray Vision off");
  if (!st.xray) safe(() => player.removeEffect("night_vision"));
}

function markerAt(dim, head, target, color) {
  const v = V.sub(target, head);
  const d = V.len(v);
  if (d < 0.6) return;
  const r = V.scale(v, 1 / d);
  const hit = safe(() => dim.getBlockFromRay(head, r, { maxDistance: Math.max(0.5, d - 0.7), includeLiquidBlocks: false, includePassableBlocks: false }));
  const p = hit ? V.sub(V.add(hit.block.location, hit.faceLocation), V.scale(r, 0.1)) : V.sub(target, V.scale(r, 0.55));
  particle(dim, PARTICLE.XRAY, p, colorVars(color[0], color[1], color[2]));
}

/** @param {import("@minecraft/server").Player} player */
function tickXray(player, st, now, s) {
  if (!st.xray) return;
  if (!st.suited || st.krypto >= 1 || st.energy <= 0.5) {
    st.xray = false;
    safe(() => player.removeEffect("night_vision"));
    if (st.energy <= 0.5) flash(player, "§eX-Ray needs solar energy");
    return;
  }
  st.energy -= 0.04;
  if (now % 40 === 0) {
    const nv = safe(() => player.getEffect("night_vision"));
    if (!nv || nv.duration < 260) safe(() => player.addEffect("night_vision", 400, { amplifier: 0, showParticles: false }));
  }
  if (now % 10 !== 0) return;
  const dim = player.dimension;
  const head = player.getHeadLocation();
  const R = s.xrayRange;
  const range = dim.heightRange;
  const from = { x: Math.floor(head.x - R), y: Math.max(range.min, Math.floor(head.y - R)), z: Math.floor(head.z - R) };
  const to = { x: Math.floor(head.x + R), y: Math.min(range.max - 1, Math.floor(head.y + R)), z: Math.floor(head.z + R) };
  /** @type {Record<string, number>} */
  const counts = {};
  const list = safe(() => dim.getBlocks(new BlockVolume(from, to), { includeTypes: ORE_IDS }, true));
  if (list) {
    let n = 0;
    for (const loc of list.getBlockLocationIterator()) {
      if (n++ > 60) break;
      const b = blockAt(dim, loc);
      if (!b) continue;
      const col = XRAY_ORES[b.typeId];
      if (!col) continue;
      const name = b.typeId.replace(/^.*:(deepslate_|lit_|nether_)*/, "").replace("_ore", "").replace("_", " ");
      counts[name] = (counts[name] ?? 0) + 1;
      markerAt(dim, head, V.center(loc), col);
    }
  }
  const ents = safe(() => dim.getEntities({ location: head, maxDistance: 28, excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:player"] }), []);
  let shown = 0;
  for (const e of ents) {
    if (shown > 16) break;
    let col;
    if (hasFamily(e, "villain")) col = [0.9, 0.2, 1.0];
    else if (hasFamily(e, "civilian")) col = [1.0, 1.0, 1.0];
    else if (hasFamily(e, "monster")) col = [1.0, 0.15, 0.15];
    if (!col) continue;
    shown++;
    markerAt(dim, head, V.add(e.location, { x: 0, y: 1, z: 0 }), col);
  }
  const parts = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`);
  st.xraySummary = parts.length ? `§aX-RAY §7${parts.join(", ")}` : "§aX-RAY §7no ores nearby";
}

// ---------------------------------------------------------------------------
// Solar Flare
// ---------------------------------------------------------------------------
/** @param {import("@minecraft/server").Player} player */
function solarFlare(player) {
  const st = state(player);
  const now = system.currentTick;
  const s = stats(player);
  if (!st.suited) return flash(player, "§7Put on the §9Hero Suit§7 to use this power.");
  if (!hasPower(player, "flare")) return flash(player, `§7Solar Flare unlocks at level §e${POWERS.flare.level}`);
  if (st.krypto > 0) return flash(player, "§a☢ Cryptonite is blocking your powers!");
  if (st.flareBlastAt) return;
  if (now < st.flareReadyAt) return flash(player, `§eSolar Flare recharging: ${Math.ceil((st.flareReadyAt - now) / 20)}s`);
  if (st.energy < s.maxEnergy * 0.6) {
    return flash(player, `§eNeed 60% solar energy (now ${Math.floor((st.energy / s.maxEnergy) * 100)}%)`);
  }
  st.flareBlastAt = now + 20;
  st.flareReadyAt = now + 900;
  playPose(player, ANIM.FLARE, { oneShot: true, force: true });
  sound(player.dimension, SOUND.CHARGE, player.location, 1, 1);
  safe(() => player.addEffect("levitation", 16, { amplifier: 0, showParticles: false }));
  flash(player, "§6Charging Solar Flare...");
}

function tickFlare(player, st, now, s) {
  if (!st.flareBlastAt) return;
  const dim = player.dimension;
  const loc = player.location;
  if (now < st.flareBlastAt) {
    if (now % 3 === 0) particle(dim, PARTICLE.AURA, loc);
    return;
  }
  st.flareBlastAt = 0;
  const c = { x: loc.x, y: loc.y + 1, z: loc.z };
  particle(dim, PARTICLE.FLARE, c);
  particle(dim, PARTICLE.EXPLOSION, c);
  for (let i = 0; i < 3; i++) particle(dim, PARTICLE.LEVEL_RING, { x: c.x, y: loc.y + 0.2 + i * 0.8, z: c.z });
  sound(dim, SOUND.FLARE, c, 1.5, 1);
  sound(dim, "random.explode", c, 0.6, 0.7);
  for (const p of safe(() => dim.getPlayers({ location: c, maxDistance: 32 }), [])) {
    cameraFade(p, 255, 248, 220, 0.04, 0.1, 0.9);
    shake(p, 0.6, 0.6);
  }
  const radius = s.flareRadius;
  for (const e of safe(() => dim.getEntities({ location: c, maxDistance: radius, excludeTypes: ["minecraft:player", "minecraft:item", "minecraft:xp_orb"] }), [])) {
    if (hasFamily(e, "civilian") || hasFamily(e, "inanimate")) continue;
    const away = V.norm(V.sub(e.location, loc));
    safe(() => e.applyDamage(s.flareDamage, { cause: EntityDamageCause.fire, damagingEntity: player }));
    safe(() => e.setOnFire(6, true));
    safe(() => e.applyKnockback({ x: away.x * 2.2, z: away.z * 2.2 }, 0.8));
  }
  st.energy = 0;
  flash(player, "§6§lSOLAR FLARE!", 40);
}

// ---------------------------------------------------------------------------
// Ground Slam (triggered by fast landings)
// ---------------------------------------------------------------------------
onLanding((player, impact, wasFlying) => {
  const st = state(player);
  const now = system.currentTick;
  if (!st.suited || impact < 1.05 || !hasPower(player, "slam") || st.krypto > 0 || now < st.slamReadyAt || st.energy < 15) {
    return false;
  }
  st.slamReadyAt = now + 60;
  st.energy -= 15;
  groundSlam(player, impact);
  return true;
});

/** @param {import("@minecraft/server").Player} player */
function groundSlam(player, impact) {
  const s = stats(player);
  const dim = player.dimension;
  const loc = player.location;
  const k = clamp(impact / 1.6, 0.7, 1.35);
  const radius = s.slamRadius * k;
  playPose(player, ANIM.LAND, { oneShot: true, force: true });
  particle(dim, PARTICLE.SHOCKWAVE, { x: loc.x, y: loc.y + 0.1, z: loc.z });
  particle(dim, PARTICLE.SHOCKWAVE, { x: loc.x, y: loc.y + 0.4, z: loc.z });
  particle(dim, "minecraft:large_explosion", loc);
  sound(dim, SOUND.SLAM, loc, 1.3, 1);
  sound(dim, "mace.heavy_smash_ground", loc, 1, 0.8);
  for (const p of safe(() => dim.getPlayers({ location: loc, maxDistance: 18 }), [])) {
    shake(p, p.id === player.id ? 0.7 : 0.4, 0.5);
  }
  for (const e of safe(() => dim.getEntities({ location: loc, maxDistance: radius, excludeTypes: ["minecraft:player", "minecraft:item", "minecraft:xp_orb"] }), [])) {
    if (hasFamily(e, "civilian") || hasFamily(e, "inanimate")) continue;
    const away = V.norm(V.sub(e.location, loc));
    safe(() => e.applyDamage(s.slamDamage * k, { cause: EntityDamageCause.entityAttack, damagingEntity: player }));
    safe(() => e.applyKnockback({ x: away.x * 1.6, z: away.z * 1.6 }, 0.7));
  }
  flash(player, "§6§lGROUND SLAM!", 30);
}

// ---------------------------------------------------------------------------
// Damage rules: super strength, invulnerability, cryptonite weapons
// ---------------------------------------------------------------------------
world.beforeEvents.entityHurt.subscribe((ev) => {
  const victim = ev.hurtEntity;
  const src = ev.damageSource;
  const attacker = src.damagingEntity;

  if (victim.typeId === "minecraft:player") {
    const st = state(/** @type {any} */ (victim));
    if (st.suited) {
      if ((src.cause === EntityDamageCause.fall || src.cause === EntityDamageCause.flyIntoWall) && st.krypto < 1) {
        ev.cancel = true;
        return;
      }
      let extra = 0;
      if (attacker && heldItemId(attacker) === ID.SWORD) {
        extra += 6;
        st.poisonUntil = system.currentTick + 140;
      }
      if (src.damagingProjectile?.typeId === ID.BOLT) {
        extra += 3;
        st.poisonUntil = system.currentTick + 120;
      }
      ev.damage = (ev.damage + extra) * (st.krypto >= 1 ? 1.5 : 1);
    }
  }

  if (attacker && attacker.typeId === "minecraft:player" && src.cause === EntityDamageCause.entityAttack) {
    const hero = /** @type {import("@minecraft/server").Player} */ (attacker);
    const st = state(hero);
    if (!st.suited || st.krypto >= 1 || hasFamily(victim, "civilian")) return;
    if (!hasPower(hero, "strength")) return;
    const s = stats(hero);
    const speed = V.len(st.vmeas);
    const flyingPunch = st.flying && speed > 0.7;
    const bonus = s.punch * (flyingPunch ? 1 + Math.min(speed, 2.5) : 1) * (st.krypto > 0 ? 0.4 : 1);
    ev.damage += bonus;
    system.run(() => punchFx(hero, victim, s, flyingPunch));
  }
});

/** @param {import("@minecraft/server").Player} hero @param {import("@minecraft/server").Entity} victim */
function punchFx(hero, victim, s, flyingPunch) {
  if (!valid(hero) || !valid(victim)) return;
  const dim = victim.dimension;
  const dir = V.norm({ x: victim.location.x - hero.location.x, y: 0, z: victim.location.z - hero.location.z });
  const kb = s.knockback * (flyingPunch ? 1.8 : 1);
  safe(() => victim.applyKnockback({ x: dir.x * kb, z: dir.z * kb }, 0.3 + kb * 0.15));
  const c = V.add(victim.location, { x: 0, y: 1, z: 0 });
  particle(dim, PARTICLE.PUNCH, c);
  punchAnim(hero);
  sound(dim, "mob.irongolem.hit", c, 0.8, 1.4);
  if (flyingPunch) {
    particle(dim, PARTICLE.SONIC, c);
    sound(dim, "random.explode", c, 0.5, 1.5);
    shake(hero, 0.35, 0.3);
    flash(hero, "§c§lFLYING PUNCH!", 25);
  }
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------
/** @param {import("@minecraft/server").Player} player */
export function tickPowers(player, now) {
  const st = state(player);
  if (!st.suited) {
    if (st.heatActive || st.freezeActive) {
      st.heatActive = st.freezeActive = false;
      stopAction(player);
    }
    if (st.xray) {
      st.xray = false;
      safe(() => player.removeEffect("night_vision"));
    }
    return;
  }
  const s = stats(player);
  tickEnergy(player, st, now, s);
  tickHeat(player, st, now, s);
  tickFreeze(player, st, now, s);
  tickXray(player, st, now, s);
  tickFlare(player, st, now, s);
}

export function notSuitedHint(player) {
  msg(player, "§7Put on the §9Hero Suit§7 to use your powers.");
}
