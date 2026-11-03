// Level system. In the "Unleashed" edition (EDITION.leveling === false) every
// power is unlocked and every stat sits at its maximum; XP is never shown.
import { system } from "@minecraft/server";
import { EDITION } from "./config.js";
import { ANIM, ID, PARTICLE, SOUND } from "./constants.js";
import { getNum, setNum, state } from "./store.js";
import { cameraFade, msg, particle, playerSound, safe, showTitle, sound } from "./util.js";
import { playPose } from "./anim.js";

export const MAX_LEVEL = 20;
export const XP_MULTIPLIER = 1.0;

/**
 * Power catalogue. `level` = unlock level in the Rising edition,
 * `suit` = which hero uses it ("super", "iron" or "both").
 */
export const POWERS = {
  flight: { name: "Flight", level: 1, suit: "both", desc: "Jump, then press jump again in the air to fly." },
  strength: { name: "Super Strength", level: 1, suit: "super", desc: "Your punches send enemies flying." },
  toughness: { name: "Invulnerability", level: 1, suit: "super", desc: "Damage resistance, no fall damage, fire immunity." },
  speed: { name: "Super Speed", level: 1, suit: "super", desc: "Run and jump far beyond human limits." },
  repulsor: { name: "Repulsor Blast", level: 1, suit: "iron", desc: "Fire energy blasts from your palm." },
  xray: { name: "X-Ray Vision", level: 2, suit: "super", desc: "See ores, villains and people through walls." },
  scan: { name: "Tactical Scan", level: 2, suit: "iron", desc: "Mark enemies, citizens and ores through walls." },
  freeze: { name: "Freeze Breath", level: 3, suit: "super", desc: "Freeze water and EXTINGUISH FIRE." },
  sonic: { name: "Supersonic Flight", level: 4, suit: "both", desc: "Sprint while flying to break the sound barrier." },
  missiles: { name: "Micro-Missiles", level: 4, suit: "iron", desc: "A salvo of homing missiles that lock onto enemies." },
  heat: { name: "Heat Vision", level: 5, suit: "super", desc: "Burning beams from your eyes." },
  clap: { name: "Thunder Clap", level: 6, suit: "super", desc: "A clap that blasts enemies away and blows out fires." },
  shield: { name: "Nano Shield", level: 6, suit: "iron", desc: "Nanotech energy shield that blocks almost all damage." },
  hearing: { name: "Super Hearing", level: 7, suit: "both", desc: "Hear cries for help from far away." },
  blade: { name: "Nano Blade", level: 8, suit: "iron", desc: "Form a nanotech blade: huge melee damage with a sweep." },
  slam: { name: "Ground Slam", level: 9, suit: "both", desc: "Dive into the ground to unleash a shockwave." },
  unibeam: { name: "Unibeam", level: 10, suit: "iron", desc: "Charge the chest reactor and fire a devastating beam." },
  flare: { name: "Solar Flare", level: 12, suit: "super", desc: "Release all stored sunlight in a huge blast." },
};

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level) {
  return 100 + (level - 1) * 60;
}

/** @param {import("@minecraft/server").Player} player */
export function getLevel(player) {
  if (!EDITION.leveling) return MAX_LEVEL;
  return Math.max(1, Math.min(MAX_LEVEL, getNum(player, "level", 1)));
}

/** @param {import("@minecraft/server").Player} player */
export function getXp(player) {
  return getNum(player, "xp", 0);
}

/** @param {import("@minecraft/server").Player} player @param {string} power */
export function hasPower(player, power) {
  if (!EDITION.leveling) return true;
  return getLevel(player) >= POWERS[power].level;
}

/** Stats for the player's current level (max stats in the Unleashed edition). */
export function stats(player) {
  const L = getLevel(player);
  const t = (L - 1) / (MAX_LEVEL - 1);
  const sonic = L >= POWERS.sonic.level || !EDITION.leveling;
  return {
    level: L,
    cruise: 0.55 + 0.35 * t,
    boost: sonic ? 1.45 + 1.15 * t : 1.05,
    punch: 3 + 9 * t,
    knockback: 1.1 + 1.2 * t,
    maxEnergy: Math.round(100 + 150 * t),
    regen: 0.12 + 0.18 * t,
    resistance: L < 6 ? 0 : L < 12 ? 1 : 2,
    healthBoost: L < 5 ? -1 : Math.min(3, Math.floor(L / 5) - 1),
    regeneration: L >= 10,
    jump: 1 + Math.floor(t * 2.99),
    speed: 1 + Math.floor(t * 2.99),
    heatDamage: 4 + 6 * t,
    heatRange: 24 + 16 * t,
    freezeRange: 8 + 6 * t,
    freezeDamage: 1 + 3 * t,
    xrayRange: Math.round(6 + 4 * t),
    slamRadius: 4 + 4 * t,
    slamDamage: 8 + 12 * t,
    flareRadius: 10 + 6 * t,
    flareDamage: 20 + 20 * t,
    hearingRange: L >= POWERS.hearing.level || !EDITION.leveling ? 220 : 48,
    // iron nanotech suit
    ironCruise: 0.5 + 0.3 * t,
    ironBoost: sonic ? 1.35 + 1.05 * t : 1.0,
    repulsorDamage: 5 + 7 * t,
    missileDamage: 6 + 8 * t,
    missileCount: 3 + Math.floor(t * 3.99),
    unibeamDamage: 5 + 5 * t,
    shieldTicks: Math.round(100 + 80 * t),
    bladeDamage: 7 + 9 * t,
    integrity: Math.round(60 + 90 * t),
    ironResistance: L < 8 ? 0 : L < 15 ? 1 : 2,
    clapDamage: 5 + 7 * t,
    clapRange: 7 + 4 * t,
  };
}

/** Unlocked power ids at a level. */
export function powersAt(level) {
  return Object.keys(POWERS).filter((k) => POWERS[k].level === level);
}

/** Display name of a power ("hearing" is "Distress Tracker" for the iron suit). */
export function powerName(key, mode) {
  if (key === "hearing" && mode === "iron") return "Distress Tracker";
  if (key === "flight" && mode === "iron") return "Thruster Flight";
  return POWERS[key]?.name ?? key;
}

/**
 * Grant XP (Rising edition only). Shows a small popup on the action bar.
 * @param {import("@minecraft/server").Player} player
 * @param {number} amount
 * @param {string} [reason]
 */
export function addXp(player, amount, reason = "") {
  if (!EDITION.leveling || amount <= 0) return;
  amount = Math.max(1, Math.round(amount * XP_MULTIPLIER));
  let level = getLevel(player);
  if (level >= MAX_LEVEL) {
    flash(player, `§6+${amount} XP §7${reason} §8(max level)`);
    return;
  }
  let xp = getXp(player) + amount;
  const gained = [];
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    gained.push(level);
  }
  if (level >= MAX_LEVEL) xp = 0;
  setNum(player, "xp", xp);
  setNum(player, "level", level);
  flash(player, `§a+${amount} XP${reason ? " §7" + reason : ""}`);
  for (const l of gained) levelUpFx(player, l);
}

/** @param {import("@minecraft/server").Player} player @param {number} level */
export function setLevel(player, level) {
  level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const old = getNum(player, "level", 1);
  setNum(player, "level", level);
  setNum(player, "xp", 0);
  if (level > old) levelUpFx(player, level);
}

/** Short message on the HUD line for a couple of seconds. */
export function flash(player, text, ticks = 50) {
  const st = state(player);
  st.hudExtra = text;
  st.hudExtraUntil = system.currentTick + ticks;
}

const levelUpListeners = [];
/** Register a callback (player, newLevel) used e.g. to hand out new power items. */
export function onLevelUp(fn) {
  levelUpListeners.push(fn);
}

/**
 * The special level-up animation: title card, golden flash, rising aura,
 * a short lift into the air and the hero's power-up pose.
 * @param {import("@minecraft/server").Player} player
 * @param {number} level
 */
export function levelUpFx(player, level) {
  const unlocked = powersAt(level).map((k) => POWERS[k].name);
  const subtitle = unlocked.length ? `§eUnlocked: §f${unlocked.join(", ")}` : `§7Strength, speed and stamina increased`;
  showTitle(player, `§6§lLEVEL ${level}`, subtitle, 70);
  cameraFade(player, 255, 215, 90, 0.1, 0.05, 0.6);
  playerSound(player, SOUND.LEVEL_UP, 1, 1);
  sound(player.dimension, "random.totem", player.location, 0.6, 1.2);
  playPose(player, ANIM.LEVEL_UP, { oneShot: true, force: true });
  safe(() => player.addEffect("levitation", 14, { amplifier: 1, showParticles: false }));
  const dim = player.dimension;
  const base = player.location;
  for (let i = 0; i < 3; i++) {
    particle(dim, PARTICLE.LEVEL_RING, { x: base.x, y: base.y + 0.1 + i * 0.6, z: base.z });
  }
  particle(dim, PARTICLE.AURA, base);
  particle(dim, PARTICLE.TOTEM, { x: base.x, y: base.y + 1, z: base.z });
  msg(player, `§6§l» LEVEL UP! §r§eYou are now level §6${level}§e.`);
  for (const k of powersAt(level)) {
    msg(player, `§a  + ${POWERS[k].name}: §7${POWERS[k].desc}`);
  }
  for (const fn of levelUpListeners) safe(() => fn(player, level));
}
