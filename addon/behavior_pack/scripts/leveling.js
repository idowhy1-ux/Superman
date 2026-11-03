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

/** Power catalogue. `level` = unlock level in the Rising edition. */
export const POWERS = {
  flight: { name: "Flight", level: 1, desc: "Jump, then press jump again in the air to fly." },
  strength: { name: "Super Strength", level: 1, desc: "Your punches send enemies flying." },
  toughness: { name: "Invulnerability", level: 1, desc: "Damage resistance, no fall damage, fire immunity." },
  speed: { name: "Super Speed", level: 1, desc: "Run and jump far beyond human limits." },
  xray: { name: "X-Ray Vision", level: 2, item: ID.XRAY, desc: "See ores, villains and people through walls." },
  freeze: { name: "Freeze Breath", level: 3, item: ID.FREEZE, desc: "Hold to freeze water and EXTINGUISH FIRE." },
  sonic: { name: "Supersonic Flight", level: 4, desc: "Sprint while flying to break the sound barrier." },
  heat: { name: "Heat Vision", level: 5, item: ID.HEAT, desc: "Hold to fire burning beams from your eyes." },
  hearing: { name: "Super Hearing", level: 7, desc: "Hear cries for help from far away." },
  slam: { name: "Ground Slam", level: 9, desc: "Dive into the ground to unleash a shockwave." },
  flare: { name: "Solar Flare", level: 12, item: ID.FLARE, desc: "Release all stored sunlight in a huge blast." },
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
  };
}

/** Unlocked power ids at a level. */
export function powersAt(level) {
  return Object.keys(POWERS).filter((k) => POWERS[k].level === level);
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
