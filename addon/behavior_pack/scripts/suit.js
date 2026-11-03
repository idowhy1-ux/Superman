// Suit detection, suit-up sequence, passive powers and power items.
import { EquipmentSlot, ItemLockMode, ItemStack } from "@minecraft/server";
import { EDITION } from "./config.js";
import { ANIM, ID, PARTICLE, SOUND } from "./constants.js";
import { POWERS, getLevel, hasPower, onLevelUp, stats } from "./leveling.js";
import { getNum, setNum, settings, state } from "./store.js";
import { cameraFade, msg, particle, playerSound, safe, showTitle, sound } from "./util.js";
import { playPose, stopAction, stopPose } from "./anim.js";

/** @param {import("@minecraft/server").Player} player */
export function isSuited(player) {
  return safe(() => player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Chest)?.typeId === ID.SUIT, false);
}

/** @param {import("@minecraft/server").Entity} entity */
export function heldItemId(entity, slot = EquipmentSlot.Mainhand) {
  return safe(() => entity.getComponent("minecraft:equippable")?.getEquipment(slot)?.typeId, undefined);
}

const suitListeners = [];
/** Register (player, suited:boolean) => void */
export function onSuitChange(fn) {
  suitListeners.push(fn);
}

const POWER_ITEMS = [
  { id: ID.EMBLEM, power: null, lore: ["§7Use: open your Hero Profile", "§7(level, powers, settings)"] },
  { id: ID.XRAY, power: "xray", lore: ["§7Use: toggle X-Ray Vision", "§7Highlights ores, villains", "§7and people behind walls"] },
  { id: ID.FREEZE, power: "freeze", lore: ["§7Hold use: Freeze Breath", "§bPuts out fire§7, freezes water,", "§7lava and enemies"] },
  { id: ID.HEAT, power: "heat", lore: ["§7Hold use: Heat Vision", "§7Burns enemies, melts ice,", "§7turns sand into glass"] },
  { id: ID.FLARE, power: "flare", lore: ["§7Use with full solar energy:", "§6massive solar blast"] },
];

/** @param {string} id @param {string[]} lore */
function makePowerItem(id, lore) {
  const item = new ItemStack(id, 1);
  safe(() => {
    item.keepOnDeath = true;
    item.lockMode = ItemLockMode.inventory;
  });
  safe(() => item.setLore(lore));
  return item;
}

/** @param {import("@minecraft/server").Player} player */
function inventoryHas(player, id) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) {
    if (safe(() => inv.getItem(i)?.typeId) === id) return true;
  }
  return heldItemId(player, EquipmentSlot.Offhand) === id;
}

/**
 * Give every unlocked power item the player does not already carry.
 * @param {import("@minecraft/server").Player} player
 * @returns {number} items given
 */
export function givePowerItems(player, announce = true) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (!inv) return 0;
  let given = 0;
  for (const def of POWER_ITEMS) {
    if (def.power && !hasPower(player, def.power)) continue;
    if (inventoryHas(player, def.id)) continue;
    const leftover = safe(() => inv.addItem(makePowerItem(def.id, def.lore)));
    if (leftover) {
      safe(() => player.dimension.spawnItem(leftover, player.location));
    }
    given++;
    if (announce && def.power) msg(player, `§b» New power in your inventory: §f${POWERS[def.power].name}`);
  }
  return given;
}

onLevelUp((player) => {
  givePowerItems(player, true);
});

const EFFECTS = ["resistance", "fire_resistance", "health_boost", "regeneration", "speed", "jump_boost", "water_breathing", "saturation", "slow_falling"];

/** Remove every effect the suit grants. */
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
 * Detect suit on/off and run the transition effects.
 * @param {import("@minecraft/server").Player} player
 */
export function updateSuit(player) {
  const st = state(player);
  const suited = isSuited(player);
  if (suited === st.suited) return;
  st.suited = suited;
  if (suited) suitUp(player);
  else suitDown(player);
  for (const fn of suitListeners) safe(() => fn(player, suited));
}

/** @param {import("@minecraft/server").Player} player */
function suitUp(player) {
  const st = state(player);
  const s = stats(player);
  st.energy = Math.max(st.energy, s.maxEnergy * 0.6);
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
  givePowerItems(player, false);
  if (!getNum(player, "tutorial", 0)) {
    setNum(player, "tutorial", 1);
    tutorial(player);
  }
}

/** @param {import("@minecraft/server").Player} player */
function suitDown(player) {
  clearHeroEffects(player);
  safe(() => player.removeEffect("night_vision"));
  stopAction(player);
  stopPose(player, true);
  showTitle(player, "§7Suit removed", "§8Your powers are dormant", 30);
}

/** @param {import("@minecraft/server").Player} player */
export function tutorial(player) {
  const lines = [
    `§9§l=== ${EDITION.name} ===`,
    "§fFLY: §7jump, then press jump again in mid-air.",
    "§fSTEER: §7look where you want to go, move forward. Jump = up, sneak = down.",
    "§fSUPERSONIC: §7sprint (or double-tap forward) while flying.",
    "§fLAND: §7sneak down to the ground. Double-tap sneak in the air to drop.",
    "§fPOWERS: §7power items appear in your inventory - hold USE to fire beams.",
    "§fRESCUE: §7walk up to a civilian in danger and USE/tap them to pick them up, carry them somewhere safe and sneak to set them down.",
    "§aCRYPTONITE §7(glowing green ore) drains your powers. Stay away from it!",
    "§eHero Emblem: §7open your profile, settings and city locator.",
  ];
  if (EDITION.leveling) lines.splice(7, 0, "§6LEVEL UP: §7rescue people, put out fires and beat villains to unlock new powers.");
  for (const l of lines) msg(player, l);
}
