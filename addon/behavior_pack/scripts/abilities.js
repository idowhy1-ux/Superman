// On-screen ability controls - no inventory items needed.
//
//   Attack (click / tap) the air with an empty hand  -> use the selected power
//   Sneak + attack                                     -> switch to the next power
//   Double-tap sneak on the ground                     -> open the Power Wheel
//   Hold sneak + press jump on the ground              -> deploy / retract the nano suit
//
// The selected power and the whole ability bar are drawn on screen with
// custom font glyphs (resource_pack/font/glyph_E5.png).
import { ButtonState, EntitySwingSource, InputButton, system, world } from "@minecraft/server";
import { ICON, glyph } from "./constants.js";
import { POWERS, flash, hasPower, powerName } from "./leveling.js";
import { getNum, setNum, state } from "./store.js";
import { msg, playerSound, safe, valid } from "./util.js";
import { LEGACY_ITEMS } from "./suit.js";
import { emit } from "./bus.js";

/**
 * @typedef {{id:string, power:string, kind:"beam"|"toggle"|"instant", col:number}} Ability
 * @typedef {{fire:(player:any, st:any, now:number)=>boolean|void, cooldown?:number, active?:(st:any, now:number)=>boolean}} AbilityHandler
 */

/** @type {Record<string, Ability[]>} */
export const ABILITIES = {
  super: [
    { id: "heat", power: "heat", kind: "beam", col: 0 },
    { id: "freeze", power: "freeze", kind: "beam", col: 1 },
    { id: "xray", power: "xray", kind: "toggle", col: 2 },
    { id: "clap", power: "clap", kind: "instant", col: 3 },
    { id: "flare", power: "flare", kind: "instant", col: 4 },
  ],
  iron: [
    { id: "repulsor", power: "repulsor", kind: "instant", col: 0 },
    { id: "scan", power: "scan", kind: "toggle", col: 1 },
    { id: "missiles", power: "missiles", kind: "instant", col: 2 },
    { id: "shield", power: "shield", kind: "instant", col: 3 },
    { id: "blade", power: "blade", kind: "instant", col: 4 },
    { id: "unibeam", power: "unibeam", kind: "instant", col: 5 },
  ],
};

// glyph rows per mode: normal, selected, locked, cooling
const ROWS = { super: [0, 1, 2, 7], iron: [3, 4, 5, 8] };

/** @type {Record<string, AbilityHandler>} */
const handlers = {};

/** @param {string} id @param {AbilityHandler} handler */
export function registerAbility(id, handler) {
  handlers[id] = handler;
}

/** @param {import("@minecraft/server").Player} player */
export function selectedIndex(player) {
  const st = state(player);
  const list = ABILITIES[st.mode];
  if (!list) return 0;
  const i = getNum(player, `sel_${st.mode}`, 0);
  return Math.max(0, Math.min(list.length - 1, Math.floor(i)));
}

/** @param {import("@minecraft/server").Player} player */
export function selectedAbility(player) {
  const st = state(player);
  const list = ABILITIES[st.mode];
  return list ? list[selectedIndex(player)] : undefined;
}

/** @param {import("@minecraft/server").Player} player @param {number} index */
export function selectAbility(player, index, announce = true) {
  const st = state(player);
  const list = ABILITIES[st.mode];
  if (!list) return;
  const i = ((index % list.length) + list.length) % list.length;
  setNum(player, `sel_${st.mode}`, i);
  if (announce) {
    const ab = list[i];
    const locked = !hasPower(player, ab.power);
    flash(player, `${glyph(ROWS[st.mode][locked ? 2 : 1], ab.col)} §e${powerName(ab.power, st.mode)}${locked ? ` §8(locked - level ${POWERS[ab.power].level})` : ""}`, 40);
    playerSound(player, "random.click", 0.5, locked ? 0.7 : 1.4);
  }
}

/** Cycle to the next unlocked power. @param {import("@minecraft/server").Player} player */
export function cycleAbility(player, dir = 1) {
  const st = state(player);
  const list = ABILITIES[st.mode];
  if (!list) return;
  let i = selectedIndex(player);
  for (let n = 0; n < list.length; n++) {
    i = (i + dir + list.length) % list.length;
    if (hasPower(player, list[i].power)) break;
  }
  selectAbility(player, i);
}

/** Use one ability (from gestures, the Power Wheel or legacy items). */
export function useAbility(player, abilityId) {
  const st = state(player);
  const now = system.currentTick;
  const list = ABILITIES[st.mode] ?? [];
  const ab = list.find((a) => a.id === abilityId);
  if (!ab) return false;
  if (!hasPower(player, ab.power)) {
    rateLimited(player, st, now, `§7${powerName(ab.power, st.mode)} unlocks at level §e${POWERS[ab.power].level}`);
    return false;
  }
  const h = handlers[ab.id];
  if (!h) return false;
  if (st.mode === "iron" && now < st.empUntil) {
    rateLimited(player, st, now, `§e⚡ EMP! §7Suit systems rebooting §f${Math.ceil((st.empUntil - now) / 20)}s`);
    return false;
  }
  const ready = st.cooldowns[ab.id] ?? 0;
  if (now < ready) {
    rateLimited(player, st, now, `§e${powerName(ab.power, st.mode)} §7recharging §f${Math.ceil((ready - now) / 20)}s`);
    return false;
  }
  if (ab.kind === "toggle") {
    if (now - st.lastToggleTick < 8) return false;
    st.lastToggleTick = now;
  }
  const ok = safe(() => h.fire(player, st, now), false);
  if (ok !== false && h.cooldown) st.cooldowns[ab.id] = now + h.cooldown;
  if (ok !== false) emit("ability_used", { player, id: ab.id });
  return ok !== false;
}

function rateLimited(player, st, now, text) {
  if (now - st.lastAbilityMsg < 15) return;
  st.lastAbilityMsg = now;
  flash(player, text, 30);
}

/** True while a power is running (beams, toggles, shields). */
export function isAbilityActive(st, ab, now) {
  const h = handlers[ab.id];
  return !!(h && h.active && safe(() => h.active(st, now), false));
}

/** The on-screen ability bar (glyph icons + name of the selected power). */
export function abilityBar(player, now) {
  const st = state(player);
  const list = ABILITIES[st.mode];
  if (!list) return "";
  const rows = ROWS[st.mode];
  const sel = selectedIndex(player);
  let bar = "§f";
  list.forEach((ab, i) => {
    const unlocked = hasPower(player, ab.power);
    const cooling = now < (st.cooldowns[ab.id] ?? 0);
    const row = !unlocked ? rows[2] : i === sel ? rows[1] : cooling ? rows[3] : rows[0];
    bar += glyph(row, ab.col) + (i < list.length - 1 ? " " : "");
  });
  const ab = list[sel];
  const unlocked = hasPower(player, ab.power);
  const ready = st.cooldowns[ab.id] ?? 0;
  let status = "";
  if (!unlocked) status = ` §8locked (lv ${POWERS[ab.power].level})`;
  else if (isAbilityActive(st, ab, now)) status = " §aACTIVE";
  else if (now < ready) status = ` §c${Math.ceil((ready - now) / 20)}s`;
  return `${bar}  §e${powerName(ab.power, st.mode)}${status}`;
}

/** Control hints shown on screen for a while after suiting up. */
export function controlHints(st) {
  const nano = st.mode === "iron" ? `  §f${ICON.SNEAK}+${ICON.JUMP} §7retract` : "";
  return `§f${ICON.ATTACK} §7use   §f${ICON.SNEAK}+${ICON.ATTACK} §7switch   §f${ICON.SNEAK}${ICON.SNEAK} §7wheel${nano}`;
}

// ---------------------------------------------------------------------------
// Gesture input
// ---------------------------------------------------------------------------
function somethingInReach(player, swingSource) {
  const ents = safe(() => player.getEntitiesFromViewDirection({ maxDistance: 3.6 }), []);
  if (ents.some((h) => valid(h.entity) && h.entity.typeId !== "minecraft:item" && h.entity.typeId !== "minecraft:xp_orb")) return true;
  if (swingSource === EntitySwingSource.Mine || swingSource === EntitySwingSource.Attack) {
    const b = safe(() => player.getBlockFromViewDirection({ maxDistance: 4.6, includeLiquidBlocks: false, includePassableBlocks: false }));
    if (b) return true;
  }
  return false;
}

world.afterEvents.playerSwingStart.subscribe((ev) => {
  const player = ev.player;
  if (!valid(player)) return;
  const st = state(player);
  if (st.mode === "none") return;
  const held = ev.heldItemStack?.typeId;
  if (held && !LEGACY_ITEMS.includes(held)) return; // powers need an empty hand
  const src = ev.swingSource;
  if (src !== EntitySwingSource.Attack && src !== EntitySwingSource.None && src !== EntitySwingSource.Mine) return;
  if (somethingInReach(player, src)) return; // punching or mining
  const sneaking = safe(() => player.isSneaking, false) ||
    safe(() => player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed, false);
  if (sneaking) {
    cycleAbility(player, 1);
    return;
  }
  const ab = selectedAbility(player);
  if (ab) useAbility(player, ab.id);
});

world.afterEvents.playerButtonInput.subscribe((ev) => {
  const player = ev.player;
  if (!valid(player) || ev.newButtonState !== ButtonState.Pressed) return;
  const st = state(player);
  const now = system.currentTick;
  const onGround = safe(() => player.isOnGround, false);
  if (ev.button === InputButton.Sneak) {
    st.groundTaps = onGround && now - (st.lastGroundSneak ?? -100) < 8 ? (st.groundTaps ?? 0) + 1 : 1;
    st.lastGroundSneak = now;
    if (onGround && st.groundTaps >= 2 && !st.carrying && (st.mode !== "none" || st.hasCore)) {
      st.groundTaps = 0;
      emit("open_wheel", player);
    }
  } else if (ev.button === InputButton.Jump) {
    const sneakHeld = safe(() => player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed, false) ||
      safe(() => player.isSneaking, false);
    if (sneakHeld && onGround && (st.hasCore || st.mode === "iron")) emit("nano_toggle", player);
  }
});

/** Show the first-time hint about the new controls to players upgrading from item-based powers. */
export function legacyNotice(player) {
  if (getNum(player, "controls_v2", 0)) return;
  setNum(player, "controls_v2", 1);
  msg(player, `§b» Powers are now on screen! §f${ICON.ATTACK} §7attack the air to use, §f${ICON.SNEAK}+${ICON.ATTACK} §7switch, §f${ICON.SNEAK}${ICON.SNEAK} §7double-tap sneak for the Power Wheel.`);
}
