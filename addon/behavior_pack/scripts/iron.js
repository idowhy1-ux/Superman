// The iron hero: a nanotech suit that flows out of the Nano Core and covers
// the body. Thruster flight (see flight.js), repulsors, homing micro-missiles,
// unibeam, nano shield, nano blade, tactical scan, suit integrity and VERA,
// the suit's A.I. assistant.
import { BlockVolume, EntityDamageCause, EquipmentSlot, ItemStack, MolangVariableMap, system, world } from "@minecraft/server";
import { ANIM, ID, PARTICLE, SOUND, XRAY_ORES } from "./constants.js";
import { flash, stats } from "./leveling.js";
import { state } from "./store.js";
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
  rand,
  safe,
  shake,
  showTitle,
  sound,
  valid,
} from "./util.js";
import { actionOnce, playAction, playPose, stopAction } from "./anim.js";
import { chestId } from "./suit.js";
import { markerAt } from "./powers.js";
import { registerAbility } from "./abilities.js";
import { emit, on } from "./bus.js";

const SCAN_ORES = Object.keys(XRAY_ORES).filter((id) => /diamond|emerald|gold|debris|cryptonite|redstone|lapis/.test(id));
const NOT_A_TARGET = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand", "minecraft:painting"]);
const REPULSOR_COLOR = [0.65, 0.95, 1.0];
const UNIBEAM_COLOR = [0.8, 1.0, 1.0];

/** @type {Map<string, {owner:string, target?:string, born:number}>} */
const missiles = new Map();
/** @type {Map<string, {until:number, reverse:boolean}>} */
const nanoFx = new Map();

// ---------------------------------------------------------------------------
// VERA - the suit's A.I.
// ---------------------------------------------------------------------------
const veraLast = new Map();
/** @param {import("@minecraft/server").Player} player @param {string} text */
export function vera(player, text, minGap = 60) {
  const key = `${player.id}:${text}`;
  const now = system.currentTick;
  if (now - (veraLast.get(key) ?? -9999) < minGap) return;
  veraLast.set(key, now);
  if (veraLast.size > 300) veraLast.clear();
  msg(player, `§b[VERA] §f${text}`);
  playerSound(player, SOUND.VERA, 0.6, 1);
}

// ---------------------------------------------------------------------------
// Deploy / retract
// ---------------------------------------------------------------------------
function setChest(player, id) {
  return safe(() => {
    player.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Chest, new ItemStack(id, 1));
    return true;
  }, false);
}

/** Toggle between Nano Core and the deployed suit. @param {import("@minecraft/server").Player} player */
export function toggleNano(player) {
  const st = state(player);
  const now = system.currentTick;
  if (now < st.nanoBusyUntil) return;
  const chest = chestId(player);
  if (chest === ID.NANO_CORE) deploy(player);
  else if (chest === ID.NANO_SUIT) retract(player);
  else flash(player, "§7Wear the §cNano Core§7 in your chest slot to deploy the suit.");
}

/** @param {import("@minecraft/server").Player} player */
function deploy(player) {
  const st = state(player);
  const now = system.currentTick;
  if (!setChest(player, ID.NANO_SUIT)) return;
  st.nanoBusyUntil = now + 30;
  nanoFx.set(player.id, { until: now + 30, reverse: false });
  playPose(player, ANIM.IRON_ASSEMBLE, { oneShot: true, force: true });
  sound(player.dimension, SOUND.NANO_ON, player.location, 1, 1);
  cameraFade(player, 255, 70, 40, 0.05, 0.05, 0.4);
  showTitle(player, "§c§lNANO SUIT", "§7deploying...", 30);
  emit("nano_deployed", player);
  system.runTimeout(() => {
    if (!valid(player) || chestId(player) !== ID.NANO_SUIT) return;
    shake(player, 0.15, 0.25);
    vera(player, "Nano suit deployed. All systems online.", 20);
  }, 30);
}

/** @param {import("@minecraft/server").Player} player */
function retract(player) {
  const st = state(player);
  const now = system.currentTick;
  if (st.flying || !safe(() => player.isOnGround, true)) {
    flash(player, "§7Land first to retract the suit.");
    return;
  }
  if (!setChest(player, ID.NANO_RETRACT)) return;
  st.nanoBusyUntil = now + 22;
  nanoFx.set(player.id, { until: now + 18, reverse: true });
  sound(player.dimension, SOUND.NANO_OFF, player.location, 1, 1);
  system.runTimeout(() => {
    if (valid(player) && chestId(player) === ID.NANO_RETRACT) setChest(player, ID.NANO_CORE);
  }, 16);
}

/** Nanites swarm over (or away from) the body while the suit forms. */
function tickNanoFx(player, now) {
  const fx = nanoFx.get(player.id);
  if (!fx) return;
  if (now > fx.until) {
    nanoFx.delete(player.id);
    return;
  }
  const loc = player.location;
  const dim = player.dimension;
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const h = Math.random() * 1.9;
    const r = fx.reverse ? 0.35 : 0.9;
    const p = { x: loc.x + Math.cos(a) * r, y: loc.y + h, z: loc.z + Math.sin(a) * r };
    const center = { x: loc.x, y: loc.y + 1.1, z: loc.z };
    const dir = fx.reverse ? V.norm(V.sub(p, center)) : V.norm(V.sub(center, p));
    const vars = new MolangVariableMap();
    vars.setSpeedAndDirection("variable.nano", 1.6, dir);
    particle(dim, PARTICLE.NANO, p, vars);
  }
}

/** The deployed suit cannot leave the chest slot - it turns back into a Nano Core. */
function enforceCore(player) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) {
    const id = safe(() => inv.getItem(i)?.typeId);
    if (id === ID.NANO_SUIT || id === ID.NANO_RETRACT) safe(() => inv.setItem(i, new ItemStack(ID.NANO_CORE, 1)));
  }
  const off = safe(() => player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand)?.typeId);
  if (off === ID.NANO_SUIT || off === ID.NANO_RETRACT) {
    safe(() => player.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Offhand, new ItemStack(ID.NANO_CORE, 1)));
  }
}

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (safe(() => e.typeId) !== "minecraft:item") return;
  system.run(() => {
    if (!valid(e)) return;
    const id = safe(() => e.getComponent("minecraft:item")?.itemStack?.typeId);
    if (id !== ID.NANO_SUIT && id !== ID.NANO_RETRACT) return;
    const loc = e.location;
    const dim = e.dimension;
    safe(() => e.remove());
    safe(() => dim.spawnItem(new ItemStack(ID.NANO_CORE, 1), loc));
  });
});

on("nano_toggle", (player) => toggleNano(player));

// ---------------------------------------------------------------------------
// Targeting helpers
// ---------------------------------------------------------------------------
function isEnemy(e) {
  if (!valid(e) || NOT_A_TARGET.has(e.typeId) || e.typeId === "minecraft:player") return false;
  if (hasFamily(e, "civilian") || hasFamily(e, "inanimate")) return false;
  return hasFamily(e, "monster") || hasFamily(e, "villain");
}

function handPos(player, side = 1) {
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  const { right } = basis(dir);
  return { x: head.x + right.x * 0.38 * side + dir.x * 0.5, y: head.y - 0.32 + dir.y * 0.5, z: head.z + right.z * 0.38 * side + dir.z * 0.5 };
}

function drawBeam(dim, from, to, color, spacing = 0.55, max = 70) {
  const seg = V.sub(to, from);
  const n = Math.min(max, Math.max(2, Math.ceil(V.len(seg) / spacing)));
  const vars = colorVars(color[0], color[1], color[2]);
  for (let i = 0; i <= n; i++) particle(dim, PARTICLE.HEAT_BEAM, V.add(from, V.scale(seg, i / n)), vars);
}

// ---------------------------------------------------------------------------
// Repulsor
// ---------------------------------------------------------------------------
function repulsor(player, st, now) {
  const s = stats(player);
  if (st.energy < 4) {
    flash(player, "§eReactor power low");
    return false;
  }
  st.energy -= 4;
  const dim = player.dimension;
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  const range = 40;
  const bhit = safe(() => dim.getBlockFromRay(head, dir, { maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false }));
  let endDist = bhit ? V.dist(head, V.add(bhit.block.location, bhit.faceLocation)) : range;
  let target;
  for (const h of safe(() => player.getEntitiesFromViewDirection({ maxDistance: endDist }), [])) {
    if (h.entity.id === player.id || NOT_A_TARGET.has(h.entity.typeId) || hasFamily(h.entity, "civilian")) continue;
    if (!target || h.distance < target.distance) target = h;
  }
  if (target) endDist = target.distance + 0.3;
  const end = V.add(head, V.scale(dir, endDist));
  actionOnce(player, ANIM.REPULSOR);
  drawBeam(dim, handPos(player), end, REPULSOR_COLOR, 0.6, 50);
  particle(dim, PARTICLE.REPULSOR_IMPACT, end);
  sound(dim, SOUND.REPULSOR, head, 0.9, rand(0.95, 1.1));
  if (target) {
    const e = target.entity;
    safe(() => e.applyDamage(s.repulsorDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: player }));
    safe(() => e.applyKnockback({ x: dir.x * 1.4, z: dir.z * 1.4 }, 0.35));
    emit("stat", { player, key: "repulsor_hits", amount: 1 });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Micro-missiles
// ---------------------------------------------------------------------------
function launchMissiles(player, st, now) {
  const s = stats(player);
  if (st.energy < 25) {
    flash(player, "§eReactor power low - missiles need 25 power");
    return false;
  }
  st.energy -= 25;
  const dim = player.dimension;
  const loc = player.location;
  const dir = player.getViewDirection();
  const targets = safe(() => dim.getEntities({ location: loc, maxDistance: 42 }), [])
    .filter((e) => isEnemy(e) && V.dot(V.norm(V.sub(e.location, loc)), dir) > -0.2)
    .sort((a, b) => V.dist(a.location, loc) - V.dist(b.location, loc))
    .slice(0, s.missileCount);
  const { right } = basis(dir);
  for (let i = 0; i < s.missileCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const from = { x: loc.x + right.x * 0.5 * side, y: loc.y + 1.7, z: loc.z + right.z * 0.5 * side };
    const m = safe(() => dim.spawnEntity(ID.NANO_MISSILE, from));
    if (!m) continue;
    const proj = safe(() => m.getComponent("minecraft:projectile"));
    if (proj) safe(() => (proj.owner = player));
    const launch = V.norm({ x: dir.x + right.x * side * 0.6 + rand(-0.15, 0.15), y: 0.9 + rand(0, 0.3), z: dir.z + right.z * side * 0.6 + rand(-0.15, 0.15) });
    safe(() => proj?.shoot(V.scale(launch, 0.9)));
    const t = targets.length ? targets[i % targets.length] : undefined;
    missiles.set(m.id, { owner: player.id, target: t?.id, born: now });
  }
  actionOnce(player, ANIM.MISSILES);
  sound(dim, SOUND.MISSILES, loc, 1, 1);
  vera(player, targets.length ? `Targets locked: ${targets.length}. Missiles away.` : "No targets locked - firing ahead.", 10);
  return true;
}

function tickMissiles(now) {
  for (const [id, rec] of missiles) {
    const m = safe(() => world.getEntity(id));
    if (!valid(m)) {
      missiles.delete(id);
      continue;
    }
    particle(m.dimension, PARTICLE.MISSILE_TRAIL, m.location);
    const age = now - rec.born;
    if (age > 100) {
      missileBlast(m.dimension, m.location, rec.owner);
      missiles.delete(id);
      safe(() => m.remove());
      continue;
    }
    if (age < 6) continue; // let them fan out first
    const owner = safe(() => world.getEntity(rec.owner));
    let goal;
    const t = rec.target ? safe(() => world.getEntity(rec.target)) : undefined;
    if (valid(t)) goal = V.add(t.location, { x: 0, y: 0.9, z: 0 });
    else if (valid(owner)) goal = V.add(m.location, V.scale(owner.getViewDirection(), 10));
    if (!goal) continue;
    const desired = V.scale(V.norm(V.sub(goal, m.location)), 1.5);
    const cur = safe(() => m.getVelocity(), desired);
    const next = V.lerp(cur, desired, 0.3);
    safe(() => m.clearVelocity());
    safe(() => m.applyImpulse(next));
  }
}

function missileBlast(dim, loc, ownerId) {
  const owner = safe(() => world.getEntity(ownerId));
  const dmg = valid(owner) ? stats(/** @type {any} */ (owner)).missileDamage : 8;
  particle(dim, "minecraft:large_explosion", loc);
  sound(dim, "random.explode", loc, 0.7, 1.4);
  for (const e of safe(() => dim.getEntities({ location: loc, maxDistance: 2.8 }), [])) {
    if (!isEnemy(e)) continue;
    const away = V.norm(V.sub(e.location, loc));
    safe(() => e.applyDamage(dmg, valid(owner) ? { cause: EntityDamageCause.entityExplosion, damagingEntity: owner } : { cause: EntityDamageCause.entityExplosion }));
    safe(() => e.applyKnockback({ x: away.x * 0.8, z: away.z * 0.8 }, 0.4));
  }
}

world.afterEvents.projectileHitBlock.subscribe((ev) => {
  if (safe(() => ev.projectile.typeId) !== ID.NANO_MISSILE) return;
  const rec = missiles.get(safe(() => ev.projectile.id));
  missileBlast(ev.dimension, ev.location, rec?.owner);
  if (rec) missiles.delete(ev.projectile.id);
});
world.afterEvents.projectileHitEntity.subscribe((ev) => {
  if (safe(() => ev.projectile.typeId) !== ID.NANO_MISSILE) return;
  const rec = missiles.get(safe(() => ev.projectile.id));
  missileBlast(ev.dimension, ev.location, rec?.owner);
  if (rec) missiles.delete(ev.projectile.id);
});

// ---------------------------------------------------------------------------
// Unibeam
// ---------------------------------------------------------------------------
function unibeam(player, st, now) {
  if (st.energy < 50) {
    flash(player, "§eThe Unibeam needs 50 reactor power");
    return false;
  }
  st.energy -= 50;
  st.unibeamStart = now + 20;
  st.unibeamEnd = now + 52;
  playAction(player, ANIM.UNIBEAM);
  sound(player.dimension, SOUND.UNIBEAM, player.location, 1.2, 1);
  vera(player, "Unibeam charging.", 10);
  return true;
}

function tickUnibeam(player, st, now, s) {
  if (!st.unibeamEnd) return;
  if (now >= st.unibeamEnd) {
    st.unibeamStart = st.unibeamEnd = 0;
    stopAction(player);
    return;
  }
  const dim = player.dimension;
  const dir = player.getViewDirection();
  const chest = { x: player.location.x + dir.x * 0.4, y: player.location.y + 1.25, z: player.location.z + dir.z * 0.4 };
  if (now < st.unibeamStart) {
    if (now % 2 === 0) particle(dim, PARTICLE.HEAT_IMPACT, chest);
    return;
  }
  const range = 48;
  const bhit = safe(() => dim.getBlockFromRay(chest, dir, { maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false }));
  const len = bhit ? V.dist(chest, V.add(bhit.block.location, bhit.faceLocation)) : range;
  const end = V.add(chest, V.scale(dir, len));
  const { right } = basis(dir);
  for (const o of [-0.18, 0, 0.18]) {
    const off = V.scale(right, o);
    drawBeam(dim, V.add(chest, off), V.add(end, off), UNIBEAM_COLOR, 0.7, 70);
  }
  particle(dim, PARTICLE.REPULSOR_IMPACT, end);
  if (now % 6 === 0) shake(player, 0.2, 0.3);
  if (now % 4 !== 0) return;
  for (const e of safe(() => dim.getEntities({ location: chest, maxDistance: len + 2 }), [])) {
    if (!isEnemy(e)) continue;
    const rel = V.sub(V.add(e.location, { x: 0, y: 0.9, z: 0 }), chest);
    const t = V.dot(rel, dir);
    if (t < 0 || t > len) continue;
    const perp = V.len(V.sub(rel, V.scale(dir, t)));
    if (perp > 1.4) continue;
    safe(() => e.applyDamage(s.unibeamDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: player }));
    safe(() => e.applyKnockback({ x: dir.x * 0.7, z: dir.z * 0.7 }, 0.2));
    safe(() => e.setOnFire(2, true));
  }
}

// ---------------------------------------------------------------------------
// Nano shield & blade
// ---------------------------------------------------------------------------
function nanoShield(player, st, now) {
  const s = stats(player);
  if (st.energy < 30) {
    flash(player, "§eThe Nano Shield needs 30 reactor power");
    return false;
  }
  st.energy -= 30;
  st.shieldUntil = now + s.shieldTicks;
  actionOnce(player, ANIM.SHIELD);
  sound(player.dimension, SOUND.SHIELD, player.location, 1, 1);
  vera(player, "Shield up.", 10);
  return true;
}

function nanoBlade(player, st, now) {
  if (st.energy < 20) {
    flash(player, "§eThe Nano Blade needs 20 reactor power");
    return false;
  }
  st.energy -= 20;
  st.bladeUntil = now + 240;
  actionOnce(player, ANIM.BLADE);
  sound(player.dimension, "item.trident.riptide_1", player.location, 0.8, 1.4);
  vera(player, "Nano blade formed.", 10);
  return true;
}

function tickShieldBlade(player, st, now) {
  const dim = player.dimension;
  const loc = player.location;
  if (now < st.shieldUntil && now % 3 === 0) {
    for (let i = 0; i < 5; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      particle(dim, PARTICLE.SHIELD, { x: loc.x + Math.cos(a) * r * 1.3, y: loc.y + 1 + u * 1.3, z: loc.z + Math.sin(a) * r * 1.3 });
    }
  }
  if (st.shieldUntil && now === st.shieldUntil) vera(player, "Shield down.", 10);
  if (now < st.bladeUntil && now % 2 === 0) {
    const dir = safe(() => player.getViewDirection(), { x: 0, y: 0, z: 1 });
    const { right, fwd } = basis(dir);
    particle(dim, PARTICLE.BLADE, { x: loc.x + right.x * 0.45 + fwd.x * 0.4, y: loc.y + 0.85, z: loc.z + right.z * 0.45 + fwd.z * 0.4 });
  }
}

// ---------------------------------------------------------------------------
// Tactical scan
// ---------------------------------------------------------------------------
function toggleScan(player, st) {
  st.scan = !st.scan;
  playerSound(player, SOUND.XRAY, 0.8, st.scan ? 1.4 : 0.9);
  if (!st.scan) safe(() => player.removeEffect("night_vision"));
  vera(player, st.scan ? "Tactical scan online." : "Tactical scan offline.", 10);
  return true;
}

function tickScan(player, st, now) {
  if (!st.scan) return;
  if (st.energy <= 0.5) {
    st.scan = false;
    safe(() => player.removeEffect("night_vision"));
    return;
  }
  st.energy -= 0.03;
  if (now % 40 === 0) {
    const nv = safe(() => player.getEffect("night_vision"));
    if (!nv || nv.duration < 260) safe(() => player.addEffect("night_vision", 400, { amplifier: 0, showParticles: false }));
  }
  if (now % 10 !== 0) return;
  const dim = player.dimension;
  const head = player.getHeadLocation();
  let hostiles = 0;
  let citizens = 0;
  let shown = 0;
  for (const e of safe(() => dim.getEntities({ location: head, maxDistance: 40, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }), [])) {
    if (e.id === player.id || shown > 20) continue;
    let col;
    if (hasFamily(e, "villain")) {
      col = [0.95, 0.2, 1.0];
      hostiles++;
    } else if (hasFamily(e, "monster")) {
      col = [1.0, 0.15, 0.1];
      hostiles++;
    } else if (hasFamily(e, "civilian")) {
      col = [1.0, 1.0, 1.0];
      citizens++;
    } else if (e.typeId === "minecraft:player") col = [0.3, 1.0, 0.4];
    if (!col) continue;
    shown++;
    markerAt(dim, head, V.add(e.location, { x: 0, y: 1, z: 0 }), col);
  }
  let ores = 0;
  const R = 6;
  const range = dim.heightRange;
  const list = safe(() => dim.getBlocks(new BlockVolume(
    { x: Math.floor(head.x - R), y: Math.max(range.min, Math.floor(head.y - R)), z: Math.floor(head.z - R) },
    { x: Math.floor(head.x + R), y: Math.min(range.max - 1, Math.floor(head.y + R)), z: Math.floor(head.z + R) }),
  { includeTypes: SCAN_ORES }, true));
  if (list) {
    for (const loc of list.getBlockLocationIterator()) {
      if (ores++ > 30) break;
      const b = blockAt(dim, loc);
      const col = b && XRAY_ORES[b.typeId];
      if (col) markerAt(dim, head, V.center(loc), col);
    }
  }
  st.xraySummary = `§bSCAN §c${hostiles} hostile §f${citizens} citizen §e${ores} ore`;
}

// ---------------------------------------------------------------------------
// Damage: suit integrity, shield, blade, armored punches
// ---------------------------------------------------------------------------
world.beforeEvents.entityHurt.subscribe((ev) => {
  const victim = ev.hurtEntity;
  const src = ev.damageSource;
  const now = system.currentTick;
  if (victim.typeId === "minecraft:player") {
    const st = state(/** @type {any} */ (victim));
    if (st.mode === "iron" && src.cause !== EntityDamageCause.void && src.cause !== EntityDamageCause.selfDestruct &&
      src.cause !== EntityDamageCause.override) {
      if (now < st.shieldUntil) {
        ev.cancel = true;
        const loc = victim.location;
        system.run(() => {
          particle(victim.dimension, PARTICLE.SHIELD, { x: loc.x, y: loc.y + 1, z: loc.z });
          sound(victim.dimension, "random.anvil_land", loc, 0.25, 2);
        });
        return;
      }
      if (st.integrity > 0) {
        const absorb = Math.min(st.integrity, ev.damage * 0.8);
        st.integrity -= absorb;
        ev.damage -= absorb;
        st.lastHitTick = now;
        if (ev.damage <= 0.05) ev.cancel = true;
      }
    }
  }
  const attacker = src.damagingEntity;
  if (attacker && attacker.typeId === "minecraft:player" && src.cause === EntityDamageCause.entityAttack) {
    const hero = /** @type {import("@minecraft/server").Player} */ (attacker);
    const st = state(hero);
    if (st.mode !== "iron" || hasFamily(victim, "civilian")) return;
    const s = stats(hero);
    const blade = now < st.bladeUntil;
    ev.damage += blade ? s.bladeDamage : 2;
    system.run(() => armoredHit(hero, victim, s, blade));
  }
});

function armoredHit(hero, victim, s, blade) {
  if (!valid(hero) || !valid(victim)) return;
  const dir = V.norm({ x: victim.location.x - hero.location.x, y: 0, z: victim.location.z - hero.location.z });
  safe(() => victim.applyKnockback({ x: dir.x * (blade ? 1.2 : 0.8), z: dir.z * (blade ? 1.2 : 0.8) }, 0.3));
  if (!blade) return;
  const dim = victim.dimension;
  particle(dim, PARTICLE.BLADE, V.add(victim.location, { x: 0, y: 1, z: 0 }));
  sound(dim, "item.trident.hit", victim.location, 0.8, 1.2);
  // sweep nearby enemies
  for (const e of safe(() => dim.getEntities({ location: victim.location, maxDistance: 2.8 }), [])) {
    if (e.id === victim.id || !isEnemy(e)) continue;
    safe(() => e.applyDamage(s.bladeDamage * 0.5, { cause: EntityDamageCause.entityAttack, damagingEntity: hero }));
  }
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------
/** @param {import("@minecraft/server").Player} player */
export function tickIron(player, now) {
  const st = state(player);
  tickNanoFx(player, now);
  if (now % 20 === 7) enforceCore(player);
  if (st.mode !== "iron") {
    if (st.scan) st.scan = false;
    return;
  }
  const s = stats(player);
  // arc reactor power regenerates steadily (no sunlight needed)
  st.energy = Math.min(s.maxEnergy, st.energy + 0.22 + s.level * 0.008);
  if (now - st.lastHitTick > 100) st.integrity = Math.min(s.integrity, st.integrity + 0.3);
  const pct = st.integrity / s.integrity;
  if (pct < 0.25 && now - st.lastHitTick < 5) vera(player, "Warning: suit integrity critical!", 200);
  tickUnibeam(player, st, now, s);
  tickShieldBlade(player, st, now);
  tickScan(player, st, now);
}

export function tickIronGlobal(now) {
  tickMissiles(now);
}

registerAbility("repulsor", { fire: repulsor, cooldown: 6 });
registerAbility("scan", { fire: (player, st) => toggleScan(player, st), active: (st) => st.scan });
registerAbility("missiles", { fire: launchMissiles, cooldown: 140 });
registerAbility("shield", { fire: nanoShield, cooldown: 400, active: (st, now) => now < st.shieldUntil });
registerAbility("blade", { fire: nanoBlade, cooldown: 360, active: (st, now) => now < st.bladeUntil });
registerAbility("unibeam", { fire: unibeam, cooldown: 600, active: (st, now) => now < st.unibeamEnd });

/** Distress calls reach the suit's A.I. */
on("distress", ({ player, text }) => {
  if (valid(player) && state(player).mode === "iron") vera(player, text, 100);
});

/** Short readout for the HUD. */
export function integrityPct(player) {
  const st = state(player);
  return clamp(st.integrity / stats(player).integrity, 0, 1);
}
