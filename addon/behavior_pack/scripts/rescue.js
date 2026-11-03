// Civilians, carrying, and city emergencies:
//   * FIRE     - a building burns with people trapped on the roof. Put the fire
//                out with Freeze Breath (or carry everyone down).
//   * ATTACK   - thugs (and sometimes a supervillain) attack citizens.
//   * FALLING  - someone slips off a skyscraper. Catch them in mid-air!
import { ButtonState, EntityDamageCause, InputButton, system, world } from "@minecraft/server";
import { EDITION } from "./config.js";
import { ID, PARTICLE, SOUND, SUPERVILLAINS, VILLAINS } from "./constants.js";
import { addXp, flash, getLevel, stats } from "./leveling.js";
import { getNum, setNum, settings, state } from "./store.js";
import {
  V,
  basis,
  blockAt,
  chance,
  choice,
  groundBelow,
  hasFamily,
  msg,
  particle,
  playerSound,
  players,
  rand,
  randInt,
  safe,
  setBlock,
  showTitle,
  sound,
  valid,
} from "./util.js";
import { HALF, LOT, ROAD, GRID, allCities, randomSidewalk, roofY, spawnCivilian } from "./cities.js";
import { on } from "./bus.js";

const STATE_PROP = "superhuman:state";
const RESCUE_XP = 60;
const CATCH_XP = 40;
const EVENT_XP = 100;

const THANKS = [
  '"Thank you, hero!"', '"You saved my life!"', '"I knew you would come!"', '"My hero!"',
  '"Wow... you really can fly!"', '"I owe you one!"',
];
const CHEERS = [
  '"Look! Up in the sky!"', "\"It's a bird! It's a plane! It's... a hero!\"", '"Go get them!"',
  '"We are safe now!"', '"Did you see that?!"',
];

/**
 * @typedef {{cityId:number, type:string, label:string, falling?:boolean, buildingTop?:number}} DangerInfo
 * @typedef {{type:"fire"|"attack"|"falling", cityId:number, start:number, deadline:number,
 *   center:{x:number,y:number,z:number}, victims:string[], fires?:Array<{x:number,y:number,z:number,out:boolean}>,
 *   building?:{x:number,z:number,w:number,d:number,h:number,type:string}, villains?:string[], fallAt?:number,
 *   fallState?:string, firesOutByHero?:number}} CityEvent
 */

/** @type {Map<string, DangerInfo>} */
const danger = new Map();
/** @type {Map<string, string>} civilian id -> player id */
const carriedBy = new Map();
/** @type {Map<number, CityEvent>} */
const events = new Map();
/** @type {Map<number, number>} */
const nextEventAt = new Map();

// ---------------------------------------------------------------------------
// Civilian helpers
// ---------------------------------------------------------------------------
function setCivState(e, s) {
  safe(() => e.setProperty(STATE_PROP, s));
}

function markDanger(e, info) {
  danger.set(e.id, info);
  setCivState(e, "danger");
  safe(() => {
    e.nameTag = info.label;
  });
  safe(() => e.addTag("sh_danger"));
}

function clearDanger(e) {
  danger.delete(e.id);
  setCivState(e, "idle");
  safe(() => {
    e.nameTag = "";
  });
  safe(() => e.removeTag("sh_danger"));
  safe(() => e.removeEffect("slowness"));
}

function getEntity(id) {
  return safe(() => world.getEntity(id));
}

/** Civilian in danger nearest to a location (used by Super Hearing / HUD). */
export function nearestDanger(loc, dimId, maxDist) {
  let best;
  let bestD = maxDist;
  for (const id of danger.keys()) {
    const e = getEntity(id);
    if (!valid(e) || e.dimension.id !== dimId) continue;
    const d = V.dist(e.location, loc);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best ? { entity: best, distance: bestD } : undefined;
}

// ---------------------------------------------------------------------------
// Carrying
// ---------------------------------------------------------------------------
world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  const player = ev.player;
  const target = ev.target;
  if (!valid(target) || target.typeId !== ID.CIVILIAN) return;
  const st = state(player);
  if (carriedBy.get(target.id) === player.id) {
    if (safe(() => player.isOnGround, false)) releaseCarry(player, target);
    else flash(player, "§7Land first, then sneak to set them down.");
    return;
  }
  if (!st.suited) {
    if (danger.has(target.id)) flash(player, "§7Put on the §9Hero Suit§7 to carry people to safety.");
    return;
  }
  if (st.krypto >= 1) {
    flash(player, "§a☢ Cryptonite! §cYou are too weak to carry anyone.");
    return;
  }
  if (st.carrying) {
    flash(player, "§eYou are already carrying someone.");
    return;
  }
  startCarry(player, target);
});

world.afterEvents.playerButtonInput.subscribe((ev) => {
  if (ev.button !== InputButton.Sneak || ev.newButtonState !== ButtonState.Pressed) return;
  const player = ev.player;
  const st = state(player);
  if (!st.carrying || !safe(() => player.isOnGround, false)) return;
  const civ = getEntity(st.carrying);
  if (valid(civ)) releaseCarry(player, civ);
  else st.carrying = undefined;
});

/** @param {import("@minecraft/server").Player} player @param {import("@minecraft/server").Entity} civ */
function startCarry(player, civ) {
  const st = state(player);
  const other = carriedBy.get(civ.id);
  if (other && other !== player.id) return;
  safe(() => civ.triggerEvent("superhuman:start_carry"));
  setCivState(civ, "carried");
  carriedBy.set(civ.id, player.id);
  st.carrying = civ.id;
  safe(() => civ.removeEffect("slowness"));
  safe(() => civ.removeEffect("slow_falling"));
  const info = danger.get(civ.id);
  if (info) {
    if (info.falling && !safe(() => civ.isOnGround, true)) {
      info.falling = false;
      addXp(player, CATCH_XP, "caught!");
      showTitle(player, "", "§a§lGOTCHA!", 25);
      const ev = events.get(info.cityId);
      if (ev && ev.type === "falling") ev.fallState = "caught";
    }
    safe(() => {
      civ.nameTag = "§bSafe with you";
    });
  }
  playerSound(player, "random.pop", 0.6, 1.2);
  flash(player, info ? "§aGot them! §7Fly somewhere safe and sneak on the ground to set them down." : "§7Carrying a citizen - sneak on the ground to set them down.", 80);
}

/** @param {import("@minecraft/server").Player} player @param {import("@minecraft/server").Entity} civ */
export function releaseCarry(player, civ) {
  const st = state(player);
  carriedBy.delete(civ.id);
  if (st.carrying === civ.id) st.carrying = undefined;
  safe(() => civ.triggerEvent("superhuman:stop_carry"));
  const { fwd } = basis(safe(() => player.getViewDirection(), { x: 0, y: 0, z: 1 }));
  const loc = player.location;
  safe(() => civ.teleport({ x: loc.x + fwd.x * 0.9, y: loc.y + 0.1, z: loc.z + fwd.z * 0.9 }, { keepVelocity: false }));
  const info = danger.get(civ.id);
  if (!info) {
    setCivState(civ, "idle");
    return;
  }
  if (isSafe(civ, info)) rescued(player, civ, info);
  else {
    setCivState(civ, "danger");
    safe(() => {
      civ.nameTag = info.label;
    });
    flash(player, "§cIt's not safe here yet!");
  }
}

function isSafe(civ, info) {
  const dim = civ.dimension;
  const loc = civ.location;
  const g = groundBelow(dim, { x: loc.x, y: loc.y + 0.5, z: loc.z }, 4);
  if (g === undefined) return false;
  if (info.buildingTop !== undefined && loc.y > info.buildingTop - 3) return false;
  const ev = events.get(info.cityId);
  if (ev && ev.type === "fire" && ev.building) {
    const b = ev.building;
    const inside = loc.x > b.x - 1 && loc.x < b.x + b.w + 1 && loc.z > b.z - 1 && loc.z < b.z + b.d + 1;
    if (inside && loc.y > roofY(cityById(info.cityId), b) - 4) return false;
  }
  const threats = safe(() => dim.getEntities({ location: loc, maxDistance: 7, families: ["monster"] }), []);
  return threats.length === 0;
}

function cityById(id) {
  return allCities().find((c) => c.id === id);
}

/** @param {import("@minecraft/server").Player} hero @param {import("@minecraft/server").Entity} civ */
function rescued(hero, civ, info) {
  danger.delete(civ.id);
  safe(() => civ.removeTag("sh_danger"));
  safe(() => civ.removeEffect("slowness"));
  setCivState(civ, "cheer");
  safe(() => {
    civ.nameTag = "§a✔ Saved!";
  });
  const c = V.add(civ.location, { x: 0, y: 1.8, z: 0 });
  particle(civ.dimension, PARTICLE.HEART, c);
  particle(civ.dimension, PARTICLE.HAPPY, c);
  sound(civ.dimension, "mob.villager.yes", civ.location, 1, 1.3);
  if (hero && valid(hero)) {
    playerSound(hero, SOUND.RESCUE, 1, 1);
    const saved = getNum(hero, "saved", 0) + 1;
    setNum(hero, "saved", saved);
    msg(hero, `§7Citizen: §f${choice(THANKS)} §8(saved: ${saved})`);
    if (EDITION.leveling) addXp(hero, RESCUE_XP, "civilian rescued");
    else flash(hero, `§a+1 citizen saved §7(total ${saved})`);
  }
  const ev = events.get(info.cityId);
  if (ev) ev.victims = ev.victims.filter((v) => v !== civ.id);
  system.runTimeout(() => {
    if (!valid(civ) || danger.has(civ.id)) return;
    setCivState(civ, "idle");
    safe(() => {
      civ.nameTag = "";
    });
  }, 100);
}

/** Free a civilian whose carrier left the game. @param {string} civId */
export function releaseOrphan(civId) {
  carriedBy.delete(civId);
  const civ = getEntity(civId);
  if (!valid(civ)) return;
  safe(() => civ.triggerEvent("superhuman:stop_carry"));
  const info = danger.get(civId);
  setCivState(civ, info ? "danger" : "idle");
}

/** Let go of a carried civilian where they are (hero died, left, etc.). */
export function dropCarried(player) {
  const st = state(player);
  if (!st.carrying) return;
  const civ = getEntity(st.carrying);
  carriedBy.delete(st.carrying);
  st.carrying = undefined;
  if (!valid(civ)) return;
  safe(() => civ.triggerEvent("superhuman:stop_carry"));
  const info = danger.get(civ.id);
  if (info) {
    setCivState(civ, "danger");
    safe(() => {
      civ.nameTag = info.label;
    });
  } else setCivState(civ, "idle");
}

/** Keep carried civilians in the hero's arms. Called every tick. */
export function tickCarry(player) {
  const st = state(player);
  if (!st.carrying) return;
  const civ = getEntity(st.carrying);
  if (!valid(civ)) {
    st.carrying = undefined;
    return;
  }
  if (!st.suited || st.krypto >= 1) {
    releaseCarry(player, civ);
    flash(player, st.krypto >= 1 ? "§a☢ Cryptonite! §cYou dropped them!" : "§7You set them down.");
    return;
  }
  // Held at the hero's side (standing/hovering) or below them (flying) so the
  // citizen never blocks the first-person view.
  const { fwd, right } = basis(safe(() => player.getViewDirection(), { x: 0, y: 0, z: 1 }));
  const loc = player.location;
  const yaw = safe(() => player.getRotation().y, 0);
  const moving = st.flying && V.hlen(st.vmeas) > 0.25;
  const pos = moving
    ? { x: loc.x + fwd.x * 0.3, y: loc.y - 1.1, z: loc.z + fwd.z * 0.3 }
    : { x: loc.x + right.x * 0.7 + fwd.x * 0.2, y: loc.y + (st.flying ? -0.3 : 0.15), z: loc.z + right.z * 0.7 + fwd.z * 0.2 };
  safe(() => civ.teleport(pos, { rotation: { x: 0, y: yaw }, keepVelocity: false, checkForBlocks: false }));
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function heroesNear(city, radius) {
  return players().filter((p) => p.dimension.id === city.dim && state(p).suited &&
    Math.hypot(p.location.x - city.x, p.location.z - city.z) < radius);
}

function announce(city, title, subtitle, text, radius = 220) {
  for (const p of players()) {
    if (p.dimension.id !== city.dim) continue;
    if (Math.hypot(p.location.x - city.x, p.location.z - city.z) > radius) continue;
    if (title) showTitle(p, title, subtitle, 50);
    if (text) msg(p, text);
    playerSound(p, "note.pling", 0.8, 0.7);
  }
}

function startEvent(city, heroes, now, forced) {
  const level = Math.max(...heroes.map((h) => getLevel(h)));
  const roll = Math.random();
  const type = forced ?? (roll < 0.4 ? "fire" : roll < 0.75 ? "attack" : "falling");
  let ok = false;
  if (type === "fire") ok = startFire(city, now);
  else if (type === "attack") ok = startAttack(city, now, level);
  else ok = startFalling(city, now);
  if (!ok && !forced) ok = startAttack(city, now, level);
  return ok;
}

/** Start an emergency in the city nearest to the player (used by commands/menu). */
export function forceEvent(player, type) {
  const city = nearestCityTo(player);
  if (!city) {
    msg(player, "§cNo city nearby.");
    return false;
  }
  if (events.has(city.id)) {
    msg(player, "§eThat city already has an emergency in progress.");
    return false;
  }
  return startEvent(city, [player], system.currentTick, type);
}

function nearestCityTo(player) {
  let best;
  let bd = 400;
  for (const c of allCities()) {
    if (!c.built || c.dim !== player.dimension.id) continue;
    const d = Math.hypot(c.x - player.location.x, c.z - player.location.z);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

function startFire(city, now) {
  const dim = world.getDimension(city.dim);
  const options = city.buildings.filter((b) => b.h >= 8 && b.type !== "shops");
  if (!options.length) return false;
  const b = choice(options);
  const top = city.y + b.h;
  const fires = [];
  for (let n = 0; n < 40 && fires.length < 12; n++) {
    const x = b.x + randInt(1, b.w - 2);
    const z = b.z + randInt(1, b.d - 2);
    if (Math.abs(x - (b.x + (b.w >> 1))) <= 1 && Math.abs(z - (b.z + (b.d >> 1))) <= 1) continue;
    const pos = { x, y: top + 1, z };
    const blk = blockAt(dim, pos);
    if (!blk || !blk.isAir) continue;
    if (fires.some((f) => f.x === x && f.z === z)) continue;
    setBlock(dim, pos, "minecraft:fire");
    fires.push({ ...pos, out: false });
  }
  if (fires.length < 4) return false;
  const victims = [];
  for (let n = 0; n < randInt(2, 3); n++) {
    const loc = { x: b.x + (b.w >> 1) + rand(-0.8, 0.8) + 0.5, y: top + 1, z: b.z + (b.d >> 1) + rand(-0.8, 0.8) + 0.5 };
    const e = spawnCivilian(dim, city, loc);
    if (!e) continue;
    markDanger(e, { cityId: city.id, type: "fire", label: "§c⚠ HELP! FIRE!", buildingTop: top });
    safe(() => e.addEffect("slowness", 20 * 600, { amplifier: 255, showParticles: false }));
    victims.push(e.id);
  }
  events.set(city.id, {
    type: "fire", cityId: city.id, start: now, deadline: now + 20 * 210,
    center: { x: b.x + b.w / 2, y: top + 1, z: b.z + b.d / 2 }, victims, fires, building: b, firesOutByHero: 0,
  });
  announce(city, "§c§lFIRE!", `§f${city.name}: people are trapped on a burning roof!`,
    `§c» FIRE in ${city.name}! §7Use §bFreeze Breath§7 to put it out, or fly the trapped citizens to safety. §8(${Math.round(b.x)}, ${top}, ${Math.round(b.z)})`);
  return true;
}

function startAttack(city, now, level) {
  const dim = world.getDimension(city.dim);
  const i = randInt(0, GRID);
  const j = randInt(0, GRID);
  const spot = { x: city.x - HALF + i * (LOT + ROAD) + 2.5, y: city.y + 1, z: city.z - HALF + j * (LOT + ROAD) + 2.5 };
  const villains = [];
  const count = randInt(3, 5);
  for (let n = 0; n < count; n++) {
    const loc = { x: spot.x + rand(-2, 2), y: spot.y, z: spot.z + rand(-2, 2) };
    const e = safe(() => dim.spawnEntity(ID.THUG, loc, { initialPersistence: true, spawnEvent: "superhuman:event_spawn" }));
    if (e) {
      safe(() => e.addTag(`sh_event_${city.id}`));
      villains.push(e.id);
    }
  }
  let boss;
  const allowed = SUPERVILLAINS.filter((id) => !EDITION.leveling || level >= VILLAINS[id].minLevel);
  if (allowed.length && chance(EDITION.leveling ? 0.35 : 0.45)) {
    boss = choice(allowed);
    const e = safe(() => dim.spawnEntity(boss, { x: spot.x, y: spot.y, z: spot.z }, { initialPersistence: true }));
    if (e) {
      safe(() => e.addTag(`sh_event_${city.id}`));
      villains.push(e.id);
    }
  }
  if (!villains.length) return false;
  const victims = [];
  for (const e of safe(() => dim.getEntities({ location: spot, maxDistance: 28, type: ID.CIVILIAN }), [])) {
    if (victims.length >= 6 || danger.has(e.id)) continue;
    markDanger(e, { cityId: city.id, type: "attack", label: "§c⚠ Help!" });
    victims.push(e.id);
  }
  events.set(city.id, { type: "attack", cityId: city.id, start: now, deadline: now + 20 * 300, center: spot, victims, villains });
  const bossName = boss ? ` §4${VILLAINS[boss].name}§c is leading them!` : "";
  announce(city, "§c§lVILLAIN ATTACK!", `§f${city.name} is under attack!${boss ? " §4" + VILLAINS[boss].name : ""}`,
    `§c» Villains are attacking ${city.name}!${bossName} §8(${Math.round(spot.x)}, ${spot.y}, ${Math.round(spot.z)})`);
  return true;
}

function startFalling(city, now) {
  const dim = world.getDimension(city.dim);
  const tall = city.buildings.filter((b) => b.h >= 14).sort((a, b) => b.h - a.h);
  if (!tall.length) return false;
  const b = tall[0];
  const top = city.y + b.h;
  const side = randInt(0, 3);
  const mx = b.x + (b.w >> 1) + 0.5;
  const mz = b.z + (b.d >> 1) + 0.5;
  const inner = [
    { x: mx, z: b.z + 1.5, ox: 0, oz: -2.2 },
    { x: mx, z: b.z + b.d - 1.5, ox: 0, oz: 2.2 },
    { x: b.x + 1.5, z: mz, ox: -2.2, oz: 0 },
    { x: b.x + b.w - 1.5, z: mz, ox: 2.2, oz: 0 },
  ][side];
  const e = spawnCivilian(dim, city, { x: inner.x, y: top + 1, z: inner.z });
  if (!e) return false;
  markDanger(e, { cityId: city.id, type: "falling", label: "§e⚠ Help! I'm slipping!", buildingTop: top });
  safe(() => e.addEffect("slowness", 20 * 30, { amplifier: 255, showParticles: false }));
  events.set(city.id, {
    type: "falling", cityId: city.id, start: now, deadline: now + 20 * 60, center: { x: inner.x, y: top + 1, z: inner.z },
    victims: [e.id], fallAt: now + 70, fallState: "waiting", building: { ...b, fallOx: inner.ox, fallOz: inner.oz },
  });
  announce(city, "§e§lSOMEONE IS SLIPPING!", `§f${city.name}: a citizen is about to fall from a skyscraper!`,
    `§e» A citizen is about to fall from the tallest tower in ${city.name}! Be ready to catch them!`);
  return true;
}

function finishEvent(city, ev, success, reason) {
  events.delete(city.id);
  nextEventAt.set(city.id, system.currentTick + randInt(20 * 120, 20 * 240));
  const dim = world.getDimension(city.dim);
  if (ev.fires) {
    for (const f of ev.fires) {
      const b = blockAt(dim, f);
      if (b && b.typeId === "minecraft:fire") setBlock(dim, f, "minecraft:air");
    }
  }
  const heroes = heroesNear(city, 140);
  if (success) {
    for (const id of ev.victims) {
      const e = getEntity(id);
      if (valid(e) && danger.has(id)) rescued(nearestPlayer(heroes, e.location), e, danger.get(id));
    }
    for (const h of heroes) {
      showTitle(h, "§a§lCITY SAVED!", `§f${reason}`, 50);
      if (EDITION.leveling) addXp(h, EVENT_XP, "emergency resolved");
      playerSound(h, SOUND.RESCUE, 1, 0.8);
    }
  } else {
    for (const id of ev.victims) {
      const e = getEntity(id);
      if (valid(e)) clearDanger(e);
    }
    for (const h of heroes) msg(h, `§7» ${reason}`);
  }
  if (ev.villains) {
    for (const id of ev.villains) {
      const v = getEntity(id);
      if (valid(v) && !success) {
        particle(v.dimension, "minecraft:large_explosion", v.location);
        safe(() => v.remove());
      }
    }
  }
}

function nearestPlayer(list, loc) {
  let best;
  let bd = Infinity;
  for (const p of list) {
    const d = V.dist(p.location, loc);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

on("fire_out", ({ player, loc }) => {
  for (const ev of events.values()) {
    if (ev.type !== "fire" || !ev.fires) continue;
    const f = ev.fires.find((ff) => ff.x === loc.x && ff.y === loc.y && ff.z === loc.z && !ff.out);
    if (!f) continue;
    f.out = true;
    ev.firesOutByHero = (ev.firesOutByHero ?? 0) + 1;
    const left = ev.fires.filter((ff) => !ff.out).length;
    if (EDITION.leveling) addXp(player, 4, `fire out (${left} left)`);
    else flash(player, `§bFire out! §7${left} left`);
  }
});

function updateFire(city, ev, now) {
  const dim = world.getDimension(city.dim);
  let burning = 0;
  for (const f of ev.fires) {
    if (f.out) continue;
    const b = blockAt(dim, f);
    if (!b) continue;
    if (b.typeId === "minecraft:fire") burning++;
    else if (b.isAir) {
      setBlock(dim, f, "minecraft:fire");
      burning++;
    } else f.out = true;
  }
  if (burning > 0 && now % 40 === 0) {
    const f = choice(ev.fires.filter((x) => !x.out));
    if (f) particle(dim, PARTICLE.SMOKE, { x: f.x + 0.5, y: f.y + 1, z: f.z + 0.5 });
  }
  const victimsLeft = ev.victims.filter((id) => valid(getEntity(id)) && danger.has(id));
  if (burning === 0) {
    finishEvent(city, ev, true, "The fire is out!");
  } else if (victimsLeft.length === 0) {
    finishEvent(city, ev, true, "Everyone made it off the roof!");
  } else if (now > ev.deadline) {
    finishEvent(city, ev, false, `Firefighters finally reached the roof in ${city.name}. The citizens were injured.`);
  }
}

function updateAttack(city, ev, now) {
  ev.villains = ev.villains.filter((id) => {
    const e = getEntity(id);
    return valid(e) && safe(() => (e.getComponent("minecraft:health")?.currentValue ?? 0) > 0, false);
  });
  if (ev.villains.length === 0) finishEvent(city, ev, true, "The villains have been defeated!");
  else if (now > ev.deadline) finishEvent(city, ev, false, `The villains escaped from ${city.name}...`);
}

function updateFalling(city, ev, now) {
  const civ = getEntity(ev.victims[0]);
  if (!valid(civ)) {
    events.delete(city.id);
    return;
  }
  if (ev.fallState === "waiting" && now >= ev.fallAt) {
    if (carriedBy.has(civ.id)) {
      ev.fallState = "caught";
    } else {
      ev.fallState = "falling";
      const b = ev.building;
      safe(() => civ.removeEffect("slowness"));
      safe(() => civ.teleport({ x: civ.location.x + b.fallOx, y: civ.location.y + 0.6, z: civ.location.z + b.fallOz }, { keepVelocity: false }));
      safe(() => civ.addEffect("slow_falling", 20 * 20, { amplifier: 0, showParticles: false }));
      const info = danger.get(civ.id);
      if (info) {
        info.falling = true;
        info.label = "§c⚠ AAAAAH!";
      }
      safe(() => {
        civ.nameTag = "§c⚠ AAAAAH!";
      });
      sound(civ.dimension, "game.player.hurt", civ.location, 1, 1.6);
    }
  }
  if (ev.fallState === "falling") {
    if (carriedBy.has(civ.id)) {
      ev.fallState = "caught";
      return;
    }
    // auto-catch: fly into them
    for (const p of players()) {
      const st = state(p);
      if (!st.suited || st.carrying || st.krypto >= 1 || p.dimension.id !== civ.dimension.id) continue;
      if (V.dist(p.location, civ.location) < 2.6) {
        startCarry(p, civ);
        ev.fallState = "caught";
        return;
      }
    }
    if (safe(() => civ.isOnGround, false)) {
      ev.fallState = "injured";
      safe(() => civ.removeEffect("slow_falling"));
      safe(() => civ.applyDamage(6, { cause: EntityDamageCause.magic }));
      clearDanger(civ);
      safe(() => {
        civ.nameTag = "§7Injured";
      });
      finishEvent(city, ev, false, "Nobody caught the falling citizen. They were injured...");
    }
  }
  if (ev.fallState === "caught") {
    if (!danger.has(civ.id)) finishEvent(city, ev, true, "You caught them!");
    else if (now > ev.deadline + 20 * 120) finishEvent(city, ev, true, "The citizen made it home.");
  } else if (now > ev.deadline && ev.fallState === "waiting") {
    finishEvent(city, ev, false, "The citizen climbed back to safety.");
  }
}

/** Called every 10 ticks. */
export function tickRescue(now) {
  for (const city of allCities()) {
    if (!city.built) continue;
    const heroes = heroesNear(city, 110);
    const ev = events.get(city.id);
    if (ev) {
      if (ev.type === "fire") updateFire(city, ev, now);
      else if (ev.type === "attack") updateAttack(city, ev, now);
      else updateFalling(city, ev, now);
      continue;
    }
    if (!heroes.length) continue;
    if (now % 100 === 0) maintainPopulation(city);
    if (!nextEventAt.has(city.id)) nextEventAt.set(city.id, now + randInt(20 * 40, 20 * 90));
    if (now >= nextEventAt.get(city.id)) {
      if (!startEvent(city, heroes, now)) nextEventAt.set(city.id, now + 20 * 30);
    }
  }
  if (now % 20 === 0) cheering(now);
}

function maintainPopulation(city) {
  const dim = world.getDimension(city.dim);
  const civs = safe(() => dim.getEntities({ location: { x: city.x, y: city.y, z: city.z }, maxDistance: HALF + 25, type: ID.CIVILIAN }), []);
  const count = civs.length;
  for (let n = count; n < Math.min(count + 2, 10); n++) spawnCivilian(dim, city, randomSidewalk(city));
  // event victims add citizens over time; let a few "go home" when crowded
  if (count > 16) {
    const idle = civs.filter((c) => !danger.has(c.id) && !carriedBy.has(c.id));
    for (const c of idle.slice(0, count - 14)) {
      particle(dim, "minecraft:white_smoke_particle", c.location);
      safe(() => c.remove());
    }
  }
}

/** Citizens cheer when a hero flies by. */
function cheering(now) {
  for (const p of players()) {
    const st = state(p);
    if (!st.suited || !st.flying || V.len(st.vmeas) < 0.35) continue;
    const near = safe(() => p.dimension.getEntities({ location: p.location, maxDistance: 14, type: ID.CIVILIAN }), []);
    let cheered = false;
    for (const c of near) {
      if (danger.has(c.id) || carriedBy.has(c.id) || !chance(0.35)) continue;
      setCivState(c, "cheer");
      cheered = true;
      system.runTimeout(() => {
        if (valid(c) && !danger.has(c.id) && !carriedBy.has(c.id)) setCivState(c, "idle");
      }, 60);
    }
    if (cheered && settings(p).cheers && now - st.lastCheerLine > 20 * 45) {
      st.lastCheerLine = now;
      msg(p, `§7Citizen: §f${choice(CHEERS)}`);
    }
  }
}

world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (!e || e.typeId !== ID.CIVILIAN) return;
  const id = safe(() => e.id);
  if (id && danger.has(id)) {
    const info = danger.get(id);
    danger.delete(id);
    const city = cityById(info.cityId);
    if (city) for (const h of heroesNear(city, 160)) msg(h, "§c✖ A citizen didn't make it...");
  }
  if (id) {
    const pid = carriedBy.get(id);
    carriedBy.delete(id);
    if (pid) {
      const p = players().find((pl) => pl.id === pid);
      if (p) state(p).carrying = undefined;
    }
  }
});

/** Status line for the HUD (event info + super hearing). */
export function hudHint(player) {
  const s = stats(player);
  const nd = nearestDanger(player.location, player.dimension.id, s.hearingRange);
  if (!nd) return "";
  return `§c! Cry for help §f${Math.round(nd.distance)}m`;
}

export function dangerTarget(player) {
  const s = stats(player);
  return nearestDanger(player.location, player.dimension.id, s.hearingRange);
}

export function activeEventCount() {
  return events.size;
}
