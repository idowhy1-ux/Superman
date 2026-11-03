// Hero modes: wearing the Hero Suit makes you the super hero, a deployed Nano
// Suit makes you the iron hero. Handles mode changes, passive powers and the
// tutorial. Powers no longer come from inventory items - see abilities.js.
import { EquipmentSlot, system } from "@minecraft/server";
import { EDITION } from "./config.js";
import { ANIM, ICON, ID, PARTICLE, SOUND, SUIT_MODES } from "./constants.js";
import { getLevel, hasPower, stats } from "./leveling.js";
import { getNum, setNum, settings, state } from "./store.js";
import { cameraFade, msg, particle, playerSound, safe, showTitle, sound } from "./util.js";
import { playPose, stopAction, stopPose } from "./anim.js";
import { emit } from "./bus.js";

/** @param {import("@minecraft/server").Player} player */
export function chestId(player) {
  return safe(() => player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Chest)?.typeId, undefined);
}

/** "super", "iron" or "none" from what the player wears. @param {import("@minecraft/server").Player} player */
export function heroMode(player) {
  return SUIT_MODES[chestId(player)] ?? "none";
}

/** Kept for older modules: true when any hero suit is worn. */
export function isSuited(player) {
  return heroMode(player) !== "none";
}

/** @param {import("@minecraft/server").Entity} entity */
export function heldItemId(entity, slot = EquipmentSlot.Mainhand) {
  return safe(() => entity.getComponent("minecraft:equippable")?.getEquipment(slot)?.typeId, undefined);
}

const EFFECTS = ["resistance", "fire_resistance", "health_boost", "regeneration", "speed", "jump_boost", "water_breathing", "saturation", "slow_falling"];

/** Remove every effect a suit grants. */
export function clearHeroEffects(player) {
  for (const e of EFFECTS) safe(() => player.removeEffect(e));
}

/** Add an effect only when missing or about to expire (avoids flicker). */
function keep(player, effect, amplifier, duration = 300, refreshBelow = 120) {
  const cur = safe(() => player.getEffect(effect));
  if (cur && cur.amplifier === amplifier && cur.duration > refreshBelow) return;
  if (cur && cur.amplifier !== amplifier) safe(() => player.removeEffect(effect));
  safe(() => player.addEffect(effect, duration, { amplifier, showParticles: false }));
}

/**
 * Passive powers, refreshed every couple of seconds while suited.
 * @param {import("@minecraft/server").Player} player
 */
export function applyPassives(player) {
  const st = state(player);
  const s = stats(player);
  if (st.mode === "iron") {
    if (s.ironResistance >= 0) keep(player, "resistance", s.ironResistance);
    keep(player, "fire_resistance", 0);
    keep(player, "water_breathing", 0);
    for (const e of ["speed", "jump_boost", "health_boost", "regeneration", "saturation"]) safe(() => player.removeEffect(e));
    return;
  }
  const set = settings(player);
  const critical = st.krypto >= 1;
  const weakened = st.krypto > 0;
  if (critical) {
    for (const e of ["resistance", "health_boost", "regeneration", "speed", "jump_boost", "fire_resistance"]) {
      safe(() => player.removeEffect(e));
    }
    return;
  }
  const resist = weakened ? s.resistance - 1 : s.resistance;
  if (resist >= 0) keep(player, "resistance", resist);
  else safe(() => player.removeEffect("resistance"));
  keep(player, "fire_resistance", 0);
  keep(player, "water_breathing", 0);
  keep(player, "saturation", 0, 60, 20);
  if (s.healthBoost >= 0 && !weakened) keep(player, "health_boost", s.healthBoost, 6000, 1200);
  if (s.regeneration && !weakened) keep(player, "regeneration", 0);
  if (set.superSpeed && !weakened && hasPower(player, "speed")) keep(player, "speed", s.speed);
  else safe(() => player.removeEffect("speed"));
  if (!weakened) keep(player, "jump_boost", s.jump);
  else safe(() => player.removeEffect("jump_boost"));
}

/**
 * Detect mode changes (suit on/off, nano suit deployed/retracted).
 * @param {import("@minecraft/server").Player} player
 */
export function updateSuit(player) {
  const st = state(player);
  const id = chestId(player);
  st.hasCore = id === ID.NANO_CORE;
  const mode = /** @type {"super"|"iron"|"none"} */ (SUIT_MODES[id] ?? "none");
  if (mode === st.mode) return;
  const prev = st.mode;
  st.mode = mode;
  st.suited = mode !== "none";
  if (prev !== "none") leaveMode(player, prev);
  if (mode === "super") superSuitUp(player);
  else if (mode === "iron") ironOnline(player);
  else if (prev !== "none") showTitle(player, "§7Suit removed", "§8Your powers are dormant", 30);
  emit("mode_change", { player, mode, prev });
}

/** @param {import("@minecraft/server").Player} player */
function leaveMode(player, prev) {
  clearHeroEffects(player);
  safe(() => player.removeEffect("night_vision"));
  stopAction(player);
  stopPose(player, true);
  const st = state(player);
  st.xray = false;
  st.scan = false;
  st.shieldUntil = 0;
  st.bladeUntil = 0;
}

/** @param {import("@minecraft/server").Player} player */
function superSuitUp(player) {
  const st = state(player);
  const s = stats(player);
  st.energy = Math.max(st.energy, s.maxEnergy * 0.6);
  st.hintsUntil = system.currentTick + 20 * 45;
  const sub = EDITION.leveling
    ? `§7Level §e${getLevel(player)} §7hero  -  §fdouble-jump to fly`
    : `§cUNLEASHED §7- every power is yours`;
  showTitle(player, "§9§lSUIT UP!", sub, 45);
  cameraFade(player, 40, 90, 255, 0.08, 0.05, 0.45);
  playerSound(player, SOUND.SUIT_UP, 1, 1);
  sound(player.dimension, "armor.equip_netherite", player.location, 1, 1);
  particle(player.dimension, PARTICLE.AURA, player.location);
  particle(player.dimension, PARTICLE.LEVEL_RING, { x: player.location.x, y: player.location.y + 0.2, z: player.location.z });
  playPose(player, ANIM.SUIT_UP, { oneShot: true, force: true });
  applyPassives(player);
  if (!getNum(player, "tutorial", 0)) {
    setNum(player, "tutorial", 1);
    tutorial(player, "super");
  }
}

/** @param {import("@minecraft/server").Player} player */
function ironOnline(player) {
  const st = state(player);
  const s = stats(player);
  st.energy = Math.max(st.energy, s.maxEnergy * 0.6);
  st.integrity = Math.max(st.integrity, s.integrity * 0.5);
  st.hintsUntil = system.currentTick + 20 * 45;
  applyPassives(player);
  if (!getNum(player, "tutorial_iron", 0)) {
    setNum(player, "tutorial_iron", 1);
    system.runTimeout(() => tutorial(player, "iron"), 40);
  }
}

/** @param {import("@minecraft/server").Player} player @param {"super"|"iron"} mode */
export function tutorial(player, mode) {
  const lines = mode === "iron"
    ? [
      "§c§l=== NANO SUIT ONLINE ===",
      `§f${ICON.JUMP} FLY: §7jump, then press jump again in mid-air. Thrusters do the rest.`,
      `§f${ICON.ATTACK} USE POWER: §7attack (click/tap) the air with an empty hand.`,
      `§f${ICON.SNEAK}+${ICON.ATTACK} SWITCH POWER: §7sneak and attack.`,
      `§f${ICON.SNEAK}${ICON.SNEAK} POWER WHEEL: §7double-tap sneak on the ground.`,
      `§f${ICON.SNEAK}+${ICON.JUMP} RETRACT SUIT: §7hold sneak and press jump on the ground.`,
      "§7Your powers are shown on screen above the hotbar.",
    ]
    : [
      `§9§l=== ${EDITION.name} ===`,
      `§f${ICON.JUMP} FLY: §7jump, then press jump again in mid-air. Look to steer.`,
      "§fSUPERSONIC: §7sprint (or double-tap forward) while flying.",
      `§f${ICON.ATTACK} USE POWER: §7attack (click/tap) the air with an empty hand.`,
      `§f${ICON.SNEAK}+${ICON.ATTACK} SWITCH POWER: §7sneak and attack.`,
      `§f${ICON.SNEAK}${ICON.SNEAK} POWER WHEEL: §7double-tap sneak on the ground.`,
      "§fRESCUE: §7use/tap a citizen in danger to pick them up; land and sneak to set them down.",
      `§a${ICON.CRYPTO} CRYPTONITE §7(glowing green ore) drains your powers!`,
    ];
  if (EDITION.leveling) lines.push("§6LEVEL UP: §7rescue people, put out fires and beat villains to unlock more powers.");
  for (const l of lines) msg(player, l);
}

/** Legacy power items from older versions still work; they are just no longer handed out. */
export const LEGACY_ITEMS = [ID.HEAT, ID.FREEZE, ID.XRAY, ID.FLARE, ID.EMBLEM];
