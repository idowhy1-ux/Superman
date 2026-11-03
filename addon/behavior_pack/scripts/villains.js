// Supervillain abilities, cryptonite meteors, villain uprisings and rewards.
import { EntityDamageCause, system, world } from "@minecraft/server";
import { EDITION } from "./config.js";
import { ANIM, ID, PARTICLE, SOUND, SUPERVILLAINS, VILLAINS } from "./constants.js";
import { addXp, flash, getLevel } from "./leveling.js";
import { getNum, setNum, state } from "./store.js";
import {
  V,
  arrowTo,
  blockAt,
  chance,
  choice,
  colorVars,
  hasFamily,
  isCreative,
  isSpectator,
  msg,
  particle,
  players,
  rand,
  randInt,
  safe,
  setBlock,
  shake,
  showTitle,
  sound,
  valid,
} from "./util.js";
import { mobAnim } from "./anim.js";
import { stopFlight } from "./flight.js";
import { cityAt } from "./cities.js";
import { emit } from "./bus.js";

/** @type {Map<string, Record<string, number>>} */
const cooldowns = new Map();

const EPITHETS = {
  [ID.PYROCLAST]: "The Living Inferno",
  [ID.VIRIDIAN]: "Master of Cryptonite",
  [ID.RAMPAGER]: "The Unstoppable",
  [ID.MECH]: "War Machine Prototype",
  [ID.GLACIUS]: "Lord of the Endless Winter",
  [ID.VOLT]: "The Human Power Surge",
};
const LINES = {
  [ID.PYROCLAST]: { intro: ["Everything burns!", "Your city is kindling, hero!"], phase: "MELTDOWN!", defeat: "The fire... goes out..." },
  [ID.VIRIDIAN]: { intro: ["Your powers mean nothing here.", "Feel the green glow, hero."], phase: "Minions! Tear them apart!", defeat: "This isn't over..." },
  [ID.RAMPAGER]: { intro: ["RAAAARGH!", "RAMPAGER SMASH!"], phase: "RAMPAGER... ANGRY!", defeat: "...rrrgh..." },
  [ID.MECH]: { intro: ["TARGET ACQUIRED.", "ELIMINATION PROTOCOL ENGAGED."], phase: "CRITICAL DAMAGE. ENGAGING BARRAGE.", defeat: "SYSTEM... FAILURE." },
  [ID.GLACIUS]: { intro: ["Winter has come for you.", "I will freeze this city solid!"], phase: "BLIZZARD!", defeat: "I... am... melting..." },
  [ID.VOLT]: { intro: ["Let's see how your toys handle a power surge!", "Feel the current, hero!"], phase: "MAXIMUM VOLTAGE!", defeat: "Short... circuit..." },
};

function say(v, text, radius = 48) {
  const name = VILLAINS[v.typeId]?.name ?? "Villain";
  for (const p of safe(() => v.dimension.getPlayers({ location: v.location, maxDistance: radius }), [])) {
    msg(p, `§4${name}: §c${text}`);
  }
}

function healthFrac(v) {
  return safe(() => {
    const h = v.getComponent("minecraft:health");
    return h.currentValue / h.effectiveMax;
  }, 1);
}

/** Title card the first time a hero meets a supervillain, and the phase-2 switch at half health. */
function personality(v, c, now) {
  if (!c.intro) {
    const near = nearestTarget(v, 32, true);
    if (near) {
      c.intro = 1;
      const name = VILLAINS[v.typeId]?.name ?? "Villain";
      for (const p of safe(() => v.dimension.getPlayers({ location: v.location, maxDistance: 56 }), [])) {
        showTitle(p, `§4§l${name.toUpperCase()}`, `§c${EPITHETS[v.typeId] ?? ""}`, 60);
        shake(p, 0.25, 0.6);
        emit("distress", { player: p, text: v.typeId === ID.VOLT ? "Warning: Volt can emit EMP pulses. Keep your distance." : `Supervillain detected: ${name}.` });
      }
      sound(v.dimension, "mob.wither.spawn", v.location, 0.6, 1.4);
      say(v, choice(LINES[v.typeId]?.intro ?? ["..."]));
      mobAnim(v, v.typeId === ID.RAMPAGER ? ANIM.RAMPAGER_ROAR : v.typeId === ID.MECH ? ANIM.MECH_STOMP : ANIM.VILLAIN_TAUNT);
    }
  }
  if (!c.phase2 && healthFrac(v) <= 0.5) {
    c.phase2 = 1;
    say(v, LINES[v.typeId]?.phase ?? "...");
    phaseTwo(v);
  }
  if (c.phase2 && now % 20 === 0) particle(v.dimension, PARTICLE.HEAT_IMPACT, V.add(v.location, { x: 0, y: 1.5, z: 0 }));
}

function phaseTwo(v) {
  const dim = v.dimension;
  const loc = v.location;
  particle(dim, PARTICLE.SHOCKWAVE, loc);
  particle(dim, "minecraft:large_explosion", V.add(loc, { x: 0, y: 1, z: 0 }));
  for (const p of safe(() => dim.getPlayers({ location: loc, maxDistance: 40 }), [])) shake(p, 0.4, 0.8);
  if (v.typeId === ID.RAMPAGER) {
    safe(() => v.addEffect("speed", 20 * 600, { amplifier: 1, showParticles: false }));
    safe(() => v.addEffect("strength", 20 * 600, { amplifier: 1, showParticles: false }));
    mobAnim(v, ANIM.RAMPAGER_ROAR);
    sound(dim, "mob.ravager.roar", loc, 2.5, 0.45);
  } else if (v.typeId === ID.PYROCLAST) {
    if (safe(() => world.gameRules.mobGriefing, true)) {
      for (let a = 0; a < 360; a += 30) {
        const r = (a * Math.PI) / 180;
        const pos = { x: Math.floor(loc.x + Math.cos(r) * 4), y: Math.floor(loc.y), z: Math.floor(loc.z + Math.sin(r) * 4) };
        const here = blockAt(dim, pos);
        const below = blockAt(dim, { x: pos.x, y: pos.y - 1, z: pos.z });
        if (here && here.isAir && below && !below.isAir && !below.isLiquid) setBlock(dim, pos, "minecraft:fire");
      }
    }
    mobAnim(v, ANIM.VILLAIN_BLAST);
    sound(dim, "mob.ghast.fireball", loc, 1.5, 0.6);
  } else if (v.typeId === ID.VIRIDIAN) {
    for (let i = 0; i < 2; i++) {
      const t = safe(() => dim.spawnEntity(ID.THUG, { x: loc.x + rand(-2, 2), y: loc.y, z: loc.z + rand(-2, 2) }, { spawnEvent: "superhuman:event_spawn" }));
      if (t) particle(dim, PARTICLE.CRYPTO_GLOW, t.location);
    }
    mobAnim(v, ANIM.VILLAIN_TAUNT);
  } else if (v.typeId === ID.GLACIUS) {
    for (let i = 0; i < 8; i++) particle(dim, PARTICLE.FROST, { x: loc.x + rand(-6, 6), y: loc.y + rand(1, 4), z: loc.z + rand(-6, 6) });
    sound(dim, "mob.stray.ambient", loc, 1.5, 0.5);
    mobAnim(v, ANIM.VILLAIN_BLAST);
  } else if (v.typeId === ID.VOLT) {
    safe(() => v.addEffect("speed", 20 * 600, { amplifier: 1, showParticles: false }));
    system.runTimeout(() => empBurst(v), 10);
    mobAnim(v, ANIM.VILLAIN_BLAST);
  } else if (v.typeId === ID.MECH) {
    const target = nearestTarget(v, 40, true);
    if (target) {
      for (let i = 0; i < 6; i++) {
        system.runTimeout(() => {
          if (!valid(v) || !valid(target.entity)) return;
          const from = { x: v.location.x + rand(-1, 1), y: v.location.y + 3.6, z: v.location.z + rand(-1, 1) };
          const m = safe(() => dim.spawnEntity(ID.MISSILE, from));
          if (!m) return;
          const to = V.add(target.entity.location, { x: rand(-1.5, 1.5), y: 1, z: rand(-1.5, 1.5) });
          safe(() => m.getComponent("minecraft:projectile")?.shoot(V.scale(V.norm(V.sub(to, from)), 1.2)));
          sound(dim, "firework.launch", from, 1, 0.8);
        }, i * 5);
      }
    }
    mobAnim(v, ANIM.MECH_LASER);
  }
}
/** @type {Map<string, {start:number,end:number,target:string}>} */
const lasers = new Map();
/** @type {Set<string>} */
const meteors = new Set();

function cd(id) {
  let c = cooldowns.get(id);
  if (!c) {
    c = {};
    cooldowns.set(id, c);
  }
  return c;
}

/** Nearest valid target (player not in creative/spectator, or civilian). */
function nearestTarget(v, radius, playersOnly = false) {
  let best;
  let bd = radius;
  for (const p of players()) {
    if (p.dimension.id !== v.dimension.id || isCreative(p) || isSpectator(p)) continue;
    const d = V.dist(p.location, v.location);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  if (!playersOnly) {
    for (const c of safe(() => v.dimension.getEntities({ location: v.location, maxDistance: bd, type: ID.CIVILIAN }), [])) {
      const d = V.dist(c.location, v.location);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  return best ? { entity: best, distance: bd } : undefined;
}

function shockwave(source, radius, damage, lift) {
  if (!valid(source)) return;
  const dim = source.dimension;
  const loc = source.location;
  particle(dim, PARTICLE.SHOCKWAVE, { x: loc.x, y: loc.y + 0.1, z: loc.z });
  particle(dim, PARTICLE.SHOCKWAVE, { x: loc.x, y: loc.y + 0.5, z: loc.z });
  particle(dim, "minecraft:large_explosion", loc);
  sound(dim, SOUND.SLAM, loc, 1.5, 0.8);
  sound(dim, "mace.heavy_smash_ground", loc, 1.2, 0.6);
  for (const p of safe(() => dim.getPlayers({ location: loc, maxDistance: 22 }), [])) shake(p, 0.5, 0.6);
  for (const e of safe(() => dim.getEntities({ location: loc, maxDistance: radius, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }), [])) {
    if (e.id === source.id || hasFamily(e, "villain")) continue;
    const away = V.norm({ x: e.location.x - loc.x, y: 0, z: e.location.z - loc.z });
    safe(() => e.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: source }));
    safe(() => e.applyKnockback({ x: away.x * 1.3, z: away.z * 1.3 }, lift));
  }
}

// ---------------------------------------------------------------------------
// Individual villains
// ---------------------------------------------------------------------------
function rampager(v, c, now) {
  const seen = nearestTarget(v, 24, true);
  if (seen && now - (c.roar ?? -9999) > 600) {
    c.roar = now;
    mobAnim(v, ANIM.RAMPAGER_ROAR);
    sound(v.dimension, "mob.ravager.roar", v.location, 2, 0.55);
    for (const p of safe(() => v.dimension.getPlayers({ location: v.location, maxDistance: 20 }), [])) shake(p, 0.3, 0.8);
  }
  const t = nearestTarget(v, 7);
  if (t && now >= (c.pound ?? 0) && safe(() => v.isOnGround, false)) {
    c.pound = now + (c.phase2 ? randInt(90, 140) : randInt(160, 240));
    mobAnim(v, ANIM.RAMPAGER_POUND);
    system.runTimeout(() => shockwave(v, 6.5, 10, 0.9), 15);
  }
}

function pyroclast(v, c, now) {
  const dim = v.dimension;
  const loc = v.location;
  particle(dim, PARTICLE.FLAME, { x: loc.x + rand(-0.4, 0.4), y: loc.y + 2.1, z: loc.z + rand(-0.4, 0.4) });
  if (now < (c.aura ?? 0)) return;
  c.aura = now + (c.phase2 ? randInt(30, 60) : randInt(60, 100));
  const target = nearestTarget(v, 18);
  if (!target) return;
  if (chance(0.3)) mobAnim(v, ANIM.VILLAIN_TAUNT);
  if (!safe(() => world.gameRules.mobGriefing, true)) return;
  for (let n = 0; n < 3; n++) {
    const p = { x: Math.floor(loc.x + rand(-4, 4)), y: Math.floor(loc.y), z: Math.floor(loc.z + rand(-4, 4)) };
    const here = blockAt(dim, p);
    const below = blockAt(dim, { x: p.x, y: p.y - 1, z: p.z });
    if (here && here.isAir && below && !below.isAir && !below.isLiquid) setBlock(dim, p, "minecraft:fire");
  }
  sound(dim, "mob.blaze.shoot", loc, 1, 0.7);
}

function viridian(v, c, now) {
  const dim = v.dimension;
  const loc = v.location;
  particle(dim, PARTICLE.CRYPTO_GLOW, { x: loc.x, y: loc.y + 1.2, z: loc.z });
  const target = nearestTarget(v, 20, true);
  if (!target) return;
  if (now >= (c.surge ?? 0) && target.distance < 16) {
    c.surge = now + randInt(220, 300);
    mobAnim(v, ANIM.VILLAIN_BLAST);
    system.runTimeout(() => {
      if (!valid(v)) return;
      const l = v.location;
      for (let i = 0; i < 4; i++) particle(dim, PARTICLE.CRYPTO_GLOW, { x: l.x + rand(-2, 2), y: l.y + 1, z: l.z + rand(-2, 2) });
      particle(dim, PARTICLE.SHOCKWAVE, { x: l.x, y: l.y + 0.2, z: l.z });
      sound(dim, SOUND.CRYPTO, l, 1.5, 1.4);
      for (const p of safe(() => dim.getPlayers({ location: l, maxDistance: 8 }), [])) {
        const st = state(p);
        if (st.suited) {
          st.poisonUntil = Math.max(st.poisonUntil, system.currentTick + 100);
          flash(p, "§a☢ Cryptonite surge! §cYour powers are failing!");
        }
      }
    }, 10);
  }
  if (now >= (c.blink ?? 0) && target.distance > 6) {
    c.blink = now + randInt(260, 340);
    const t = target.entity;
    const dir = safe(() => t.getViewDirection(), { x: 0, y: 0, z: 1 });
    const dest = { x: t.location.x - dir.x * 3, y: t.location.y, z: t.location.z - dir.z * 3 };
    const b = blockAt(dim, dest);
    const b2 = blockAt(dim, { x: dest.x, y: dest.y + 1, z: dest.z });
    if (b && b.isAir && b2 && b2.isAir) {
      particle(dim, PARTICLE.CRYPTO_GLOW, loc);
      safe(() => v.teleport(dest, { keepVelocity: false }));
      particle(dim, PARTICLE.CRYPTO_GLOW, dest);
      sound(dim, "mob.endermen.portal", dest, 1, 0.8);
    }
  }
}

function omegaMech(v, c, now) {
  const target = nearestTarget(v, 26, true);
  if (!target) return;
  if (target.distance < 4.5 && now >= (c.stomp ?? 0)) {
    c.stomp = now + 100;
    mobAnim(v, ANIM.MECH_STOMP);
    system.runTimeout(() => shockwave(v, 4.5, 7, 0.6), 10);
    return;
  }
  if (now >= (c.laser ?? 0) && !lasers.has(v.id)) {
    const head = { x: v.location.x, y: v.location.y + 3.1, z: v.location.z };
    const tl = V.add(target.entity.location, { x: 0, y: 1.2, z: 0 });
    const dir = V.norm(V.sub(tl, head));
    const hit = safe(() => v.dimension.getBlockFromRay(head, dir, { maxDistance: V.dist(head, tl), includeLiquidBlocks: false, includePassableBlocks: false }));
    if (hit) return;
    c.laser = now + (c.phase2 ? randInt(90, 130) : randInt(150, 210));
    mobAnim(v, ANIM.MECH_LASER);
    sound(v.dimension, SOUND.LASER, v.location, 1.5, 0.8);
    lasers.set(v.id, { start: now + 20, end: now + 46, target: target.entity.id });
  }
}

function glacius(v, c, now) {
  const dim = v.dimension;
  const loc = v.location;
  particle(dim, PARTICLE.FROST, { x: loc.x, y: loc.y + 1.9, z: loc.z });
  if (now < (c.aura ?? 0)) return;
  c.aura = now + (c.phase2 ? randInt(40, 70) : randInt(70, 110));
  const target = nearestTarget(v, 20);
  if (!target) return;
  if (chance(0.3)) mobAnim(v, ANIM.VILLAIN_BLAST);
  if (safe(() => world.gameRules.mobGriefing, true)) {
    for (let n = 0; n < 6; n++) {
      const p = { x: Math.floor(loc.x + rand(-4, 4)), y: Math.floor(loc.y), z: Math.floor(loc.z + rand(-4, 4)) };
      const here = blockAt(dim, p);
      const below = blockAt(dim, { x: p.x, y: p.y - 1, z: p.z });
      if (below && below.typeId === "minecraft:water") setBlock(dim, below.location, "minecraft:ice");
      else if (here && here.isAir && below && !below.isAir && !below.isLiquid) setBlock(dim, p, "minecraft:snow_layer");
    }
  }
  const radius = c.phase2 ? 12 : 5;
  for (const p of safe(() => dim.getPlayers({ location: loc, maxDistance: radius }), [])) {
    safe(() => p.addEffect("slowness", 60, { amplifier: c.phase2 ? 2 : 1 }));
    safe(() => p.applyDamage(c.phase2 ? 3 : 2, { cause: EntityDamageCause.freezing, damagingEntity: v }));
    particle(dim, PARTICLE.FROST, V.add(p.location, { x: 0, y: 1, z: 0 }));
  }
  sound(dim, "random.glass", loc, 0.8, 0.6);
}

function lightningBolt(dim, from, to) {
  const seg = V.sub(to, from);
  const len = V.len(seg);
  const steps = Math.max(4, Math.ceil(len / 1.2));
  let prev = from;
  const vars = colorVars(0.75, 0.95, 1.0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const jitter = i === steps ? 0 : 0.45;
    const p = { x: from.x + seg.x * t + rand(-jitter, jitter), y: from.y + seg.y * t + rand(-jitter, jitter), z: from.z + seg.z * t + rand(-jitter, jitter) };
    const d = V.sub(p, prev);
    const n = Math.max(2, Math.ceil(V.len(d) / 0.35));
    for (let k = 0; k <= n; k++) particle(dim, PARTICLE.HEAT_BEAM, V.add(prev, V.scale(d, k / n)), vars);
    prev = p;
  }
  particle(dim, PARTICLE.SPARK, to);
}

function volt(v, c, now) {
  const dim = v.dimension;
  const loc = v.location;
  if (now % 20 === 0) particle(dim, PARTICLE.SPARK, { x: loc.x, y: loc.y + 1.2, z: loc.z });
  const target = nearestTarget(v, 24, true);
  if (!target) return;
  if (now >= (c.zap ?? 0)) {
    const hand = { x: loc.x, y: loc.y + 1.5, z: loc.z };
    const tl = V.add(target.entity.location, { x: 0, y: 1, z: 0 });
    const hit = safe(() => dim.getBlockFromRay(hand, V.norm(V.sub(tl, hand)), { maxDistance: V.dist(hand, tl), includeLiquidBlocks: false, includePassableBlocks: false }));
    if (!hit) {
      c.zap = now + (c.phase2 ? randInt(30, 50) : randInt(50, 80));
      mobAnim(v, ANIM.VILLAIN_BLAST);
      lightningBolt(dim, hand, tl);
      sound(dim, SOUND.ZAP, hand, 1.2, 1);
      safe(() => target.entity.applyDamage(c.phase2 ? 7 : 5, { cause: EntityDamageCause.lightning, damagingEntity: v }));
    }
  }
  if (now >= (c.emp ?? 0) && target.distance < 12) {
    c.emp = now + (c.phase2 ? 160 : 240);
    mobAnim(v, ANIM.VILLAIN_TAUNT);
    sound(dim, SOUND.CHARGE, loc, 1, 1.6);
    system.runTimeout(() => empBurst(v), 12);
  }
}

/** Volt's EMP: shuts the nano suit's systems down for a few seconds. */
function empBurst(v) {
  if (!valid(v)) return;
  const dim = v.dimension;
  const loc = v.location;
  const now = system.currentTick;
  particle(dim, PARTICLE.SHOCKWAVE, { x: loc.x, y: loc.y + 0.2, z: loc.z });
  particle(dim, PARTICLE.SONIC, { x: loc.x, y: loc.y + 1.2, z: loc.z });
  for (let i = 0; i < 6; i++) particle(dim, PARTICLE.SPARK, { x: loc.x + rand(-3, 3), y: loc.y + rand(0.5, 2.5), z: loc.z + rand(-3, 3) });
  sound(dim, SOUND.EMP, loc, 1.6, 1);
  for (const p of safe(() => dim.getPlayers({ location: loc, maxDistance: 11 }), [])) {
    const st = state(p);
    shake(p, 0.35, 0.5);
    if (st.mode === "iron") {
      st.empUntil = now + 100;
      st.energy *= 0.4;
      st.lastHitTick = now;
      if (st.flying) stopFlight(p, st);
      showTitle(p, "§e§l⚡ EMP ⚡", "§cSuit systems offline - rebooting", 40);
      msg(p, "§b[VERA] §fElectromagnetic pulse detected! Rebooting systems...");
    } else {
      safe(() => p.applyDamage(3, { cause: EntityDamageCause.lightning, damagingEntity: v }));
    }
  }
}

/** Every tick: draw active mech lasers. */
function tickLasers(now) {
  for (const [id, L] of lasers) {
    const v = safe(() => world.getEntity(id));
    if (!valid(v) || now > L.end) {
      lasers.delete(id);
      continue;
    }
    if (now < L.start) continue;
    const t = safe(() => world.getEntity(L.target));
    if (!valid(t)) {
      lasers.delete(id);
      continue;
    }
    const dim = v.dimension;
    const head = { x: v.location.x, y: v.location.y + 3.1, z: v.location.z };
    const tl = V.add(t.location, { x: 0, y: 1.1, z: 0 });
    const seg = V.sub(tl, head);
    const len = V.len(seg);
    const dir = V.scale(seg, 1 / len);
    const hit = safe(() => dim.getBlockFromRay(head, dir, { maxDistance: len, includeLiquidBlocks: false, includePassableBlocks: false }));
    const end = hit ? V.add(hit.block.location, hit.faceLocation) : tl;
    const s2 = V.sub(end, head);
    const n = Math.min(60, Math.ceil(V.len(s2) / 0.6));
    const vars = colorVars(1.0, 0.05, 0.12);
    for (let i = 0; i <= n; i++) particle(dim, PARTICLE.HEAT_BEAM, V.add(head, V.scale(s2, i / n)), vars);
    particle(dim, PARTICLE.HEAT_IMPACT, end);
    if (!hit && now % 5 === 0) safe(() => t.applyDamage(3, { cause: EntityDamageCause.entityAttack, damagingEntity: v }));
  }
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------
world.afterEvents.projectileHitBlock.subscribe((ev) => {
  const type = safe(() => ev.projectile.typeId);
  if (type === ID.MISSILE) missileBoom(ev.dimension, ev.location, ev.source);
  else if (type === ID.METEOR) meteorImpact(ev.dimension, ev.location);
});

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const type = safe(() => ev.projectile.typeId);
  if (type === ID.ICE_SHARD) {
    const hit = safe(() => ev.getEntityHit()?.entity);
    if (valid(hit)) {
      safe(() => hit.addEffect("slowness", 60, { amplifier: 2 }));
      particle(ev.dimension, PARTICLE.FROST, V.add(hit.location, { x: 0, y: 1, z: 0 }));
    }
    sound(ev.dimension, "random.glass", ev.location, 0.7, 1.4);
  }
  if (type === ID.MISSILE) missileBoom(ev.dimension, ev.location, ev.source);
  else if (type === ID.METEOR) meteorImpact(ev.dimension, ev.location);
});

function missileBoom(dim, loc, source) {
  safe(() => dim.createExplosion(loc, 2.2, { breaksBlocks: false, causesFire: false, source: valid(source) ? source : undefined }));
}

// ---------------------------------------------------------------------------
// Cryptonite meteors
// ---------------------------------------------------------------------------
/** @param {import("@minecraft/server").Player} player */
export function launchMeteor(player) {
  const dim = player.dimension;
  if (dim.id !== "minecraft:overworld") return false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = rand(30, 60);
    const tx = player.location.x + Math.cos(ang) * dist;
    const tz = player.location.z + Math.sin(ang) * dist;
    if (cityAt({ x: tx, z: tz }, dim.id, 30)) continue;
    const top = safe(() => dim.getTopmostBlock({ x: tx, z: tz }));
    if (!top) continue;
    const target = { x: tx, y: top.location.y + 1, z: tz };
    const from = { x: tx - Math.cos(ang) * 40, y: Math.min(dim.heightRange.max - 5, target.y + 80), z: tz - Math.sin(ang) * 40 };
    const m = safe(() => dim.spawnEntity(ID.METEOR, from));
    if (!m) return false;
    const dir = V.norm(V.sub(target, from));
    safe(() => m.getComponent("minecraft:projectile")?.shoot(V.scale(dir, 1.5)));
    meteors.add(m.id);
    for (const p of players()) {
      if (p.dimension.id !== dim.id || V.dist(p.location, target) > 260) continue;
      showTitle(p, "§a☄ METEOR!", "§7A cryptonite meteor is falling from the sky!", 50);
      sound(dim, "ambient.weather.thunder", p.location, 0.6, 0.6);
    }
    return true;
  }
  return false;
}

function meteorImpact(dim, loc) {
  const griefing = safe(() => world.gameRules.mobGriefing, true);
  safe(() => dim.createExplosion(loc, 3.2, { breaksBlocks: griefing, causesFire: false }));
  particle(dim, PARTICLE.SMOKE, loc);
  particle(dim, "minecraft:huge_explosion_emitter", loc);
  // expose cryptonite crystals in the crater
  const c = V.floor(loc);
  let placed = 0;
  for (let n = 0; n < 40 && placed < 6; n++) {
    const p = { x: c.x + randInt(-2, 2), y: c.y + randInt(-3, 0), z: c.z + randInt(-2, 2) };
    const b = blockAt(dim, p);
    const above = blockAt(dim, { x: p.x, y: p.y + 1, z: p.z });
    if (!b || b.isAir || b.isLiquid || b.typeId === "minecraft:bedrock" || !above || !above.isAir) continue;
    setBlock(dim, p, placed === 0 ? ID.CRYPTO_BLOCK : ID.ORE);
    placed++;
  }
  for (let i = 0; i < 4; i++) particle(dim, PARTICLE.CRYPTO_GLOW, { x: loc.x + rand(-2, 2), y: loc.y + 0.5, z: loc.z + rand(-2, 2) });
  for (const p of players()) {
    if (p.dimension.id !== dim.id || V.dist(p.location, loc) > 300) continue;
    msg(p, `§a☄ A cryptonite meteor crashed at §f${Math.round(loc.x)}, ${Math.round(loc.y)}, ${Math.round(loc.z)}§a. §7Heroes beware - villains will want it.`);
  }
}

function tickMeteors(now) {
  for (const id of meteors) {
    const m = safe(() => world.getEntity(id));
    if (!valid(m)) {
      meteors.delete(id);
      continue;
    }
    particle(m.dimension, PARTICLE.METEOR_TRAIL, m.location);
    if (now % 3 === 0) particle(m.dimension, PARTICLE.FLAME, m.location);
  }
  if (now % 1200 !== 600) return;
  const t = world.getTimeOfDay();
  const night = t > 13000 && t < 23000;
  if (!night || !chance(0.18)) return;
  const candidates = players().filter((p) => p.dimension.id === "minecraft:overworld" && !cityAt(p.location, p.dimension.id, 20));
  if (candidates.length) launchMeteor(choice(candidates));
}

// ---------------------------------------------------------------------------
// Villain uprisings
// ---------------------------------------------------------------------------
/**
 * Spawn a supervillain somewhere near the player.
 * @param {import("@minecraft/server").Player} player
 * @param {string} [type]
 */
export function spawnSupervillainNear(player, type) {
  const level = getLevel(player);
  const allowed = SUPERVILLAINS.filter((id) => !EDITION.leveling || level >= VILLAINS[id].minLevel);
  const id = type ?? (allowed.length ? choice(allowed) : undefined);
  if (!id) return false;
  const dim = player.dimension;
  for (let attempt = 0; attempt < 8; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = rand(18, 28);
    const x = player.location.x + Math.cos(ang) * dist;
    const z = player.location.z + Math.sin(ang) * dist;
    const top = safe(() => dim.getTopmostBlock({ x, z }));
    if (!top || top.isLiquid) continue;
    const loc = { x, y: top.location.y + 1, z };
    const e = safe(() => dim.spawnEntity(id, loc));
    if (!e) continue;
    const name = VILLAINS[id].name;
    showTitle(player, `§4§l${name.toUpperCase()}`, `§chas appeared!  §f${arrowTo(player, loc)} ${Math.round(dist)}m`, 60);
    sound(dim, "mob.wither.spawn", player.location, 0.5, 1.3);
    msg(player, `§4» ${name} has appeared nearby! §7Defeat them for a big reward.`);
    return true;
  }
  return false;
}

function tickUprisings(now) {
  if (now % 3000 !== 1500) return;
  const t = world.getTimeOfDay();
  const night = t > 13000 && t < 23000;
  for (const p of players()) {
    const st = state(p);
    if (!st.suited || p.dimension.id !== "minecraft:overworld") continue;
    if (EDITION.leveling && getLevel(p) < 4) continue;
    if (!chance(night ? 0.3 : 0.1)) continue;
    const nearby = safe(() => p.dimension.getEntities({ location: p.location, maxDistance: 80, families: ["supervillain"] }).length, 0);
    if (nearby > 0) continue;
    spawnSupervillainNear(p);
  }
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------
world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  const type = safe(() => dead.typeId);
  let killer = ev.damageSource.damagingEntity;
  if (!killer || killer.typeId !== "minecraft:player") return;
  const player = /** @type {import("@minecraft/server").Player} */ (killer);
  const info = VILLAINS[type];
  if (info) {
    const count = getNum(player, "villains", 0) + 1;
    setNum(player, "villains", count);
    if (EDITION.leveling) addXp(player, info.xp, `${info.name} defeated`);
    emit("stat", { player, key: SUPERVILLAINS.includes(type) ? "supervillains" : "thugs", amount: 1 });
    if (SUPERVILLAINS.includes(type)) {
      const line = LINES[type]?.defeat;
      if (line) for (const p of safe(() => player.dimension.getPlayers({ location: player.location, maxDistance: 64 }), [])) msg(p, `§4${info.name}: §7${line}`);
      showTitle(player, "§6§lVILLAIN DEFEATED!", `§f${info.name}`, 50);
      sound(player.dimension, "random.levelup", player.location, 0.8, 0.8);
      particle(player.dimension, PARTICLE.TOTEM, player.location);
    }
    return;
  }
  const st = state(player);
  if (st.suited && EDITION.leveling && safe(() => hasFamily(dead, "monster"), false)) addXp(player, 3, "monster");
});

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  const type = safe(() => e.typeId);
  if (!type || !SUPERVILLAINS.includes(type)) return;
  system.run(() => {
    if (!valid(e)) return;
    for (const p of safe(() => e.dimension.getPlayers({ location: e.location, maxDistance: 64 }), [])) {
      flash(p, `§4⚠ ${VILLAINS[type].name} is here!`, 80);
    }
  });
});

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------
export function tickVillains(now) {
  tickLasers(now);
  tickMeteors(now);
  tickUprisings(now);
  if (now % 10 !== 0) return;
  const seen = new Set();
  for (const p of players()) {
    for (const v of safe(() => p.dimension.getEntities({ location: p.location, maxDistance: 64, families: ["supervillain"] }), [])) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      const c = cd(v.id);
      personality(v, c, now);
      if (v.typeId === ID.RAMPAGER) rampager(v, c, now);
      else if (v.typeId === ID.PYROCLAST) pyroclast(v, c, now);
      else if (v.typeId === ID.VIRIDIAN) viridian(v, c, now);
      else if (v.typeId === ID.MECH) omegaMech(v, c, now);
      else if (v.typeId === ID.GLACIUS) glacius(v, c, now);
      else if (v.typeId === ID.VOLT) volt(v, c, now);
    }
  }
  if (cooldowns.size > 200) cooldowns.clear();
}
