// Player pose animations are played with Entity.playAnimation on named
// controllers, so the add-on never overrides the vanilla player files and
// stays compatible with other packs and custom skins.
import { system } from "@minecraft/server";
import { ANIM } from "./constants.js";
import { state } from "./store.js";
import { safe } from "./util.js";

const POSE_CTRL = "superhuman_pose";
const ACTION_CTRL = "superhuman_action";
const SUIT_MISSING = "!query.is_item_name_any('slot.armor.chest', 0, 'superhuman:hero_suit')";

const LOOP_POSES = new Set([ANIM.HOVER, ANIM.HOVER_CARRY, ANIM.FLY, ANIM.FLY_FAST, ANIM.FLY_CARRY]);
const ONE_SHOT_TICKS = {
  [ANIM.TAKEOFF]: 10,
  [ANIM.LAND]: 26,
  [ANIM.LEVEL_UP]: 52,
  [ANIM.SUIT_UP]: 36,
  [ANIM.FLARE]: 44,
};

/** @type {Map<string, number>} */
const oneShotUntil = new Map();

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} anim
 * @param {string} controller
 * @param {string|undefined} stopExpression
 * @param {number} blendOutTime
 * @param {import("@minecraft/server").Player[]} [players]
 */
function play(entity, anim, controller, stopExpression, blendOutTime, players) {
  /** @type {import("@minecraft/server").PlayAnimationOptions} */
  const opts = { controller, blendOutTime };
  if (stopExpression) opts.stopExpression = stopExpression;
  if (players) opts.players = players;
  safe(() => entity.playAnimation(anim, opts));
}

/** @param {string} name */
export function isLoopPose(name) {
  return LOOP_POSES.has(name);
}

/** True while a one-shot pose (landing, level-up...) is still playing. */
export function poseLocked(player) {
  const until = oneShotUntil.get(player.id) ?? 0;
  return system.currentTick < until;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} anim
 * @param {{force?: boolean, oneShot?: boolean, blend?: number}} [opts]
 */
export function playPose(player, anim, opts = {}) {
  const st = state(player);
  if (!opts.force && st.pose === anim) return;
  if (!opts.force && poseLocked(player) && !ONE_SHOT_TICKS[anim]) return;
  st.pose = anim;
  if (ONE_SHOT_TICKS[anim]) oneShotUntil.set(player.id, system.currentTick + ONE_SHOT_TICKS[anim]);
  const stop = LOOP_POSES.has(anim) ? `query.is_on_ground || !query.is_alive || ${SUIT_MISSING}` : "!query.is_alive";
  play(player, anim, POSE_CTRL, stop, opts.blend ?? 0.25);
}

/** Clear whatever pose is active (unless a one-shot is still running). */
export function stopPose(player, force = false) {
  const st = state(player);
  if (!st.pose) return;
  if (!force && poseLocked(player)) {
    st.pose = "";
    return;
  }
  st.pose = "";
  oneShotUntil.delete(player.id);
  play(player, ANIM.NONE, POSE_CTRL, undefined, 0.2);
}

/** Overlay actions (heat vision stance, freeze breath, punches). */
export function playAction(player, anim) {
  const st = state(player);
  if (st.action === anim) return;
  st.action = anim;
  play(player, anim, ACTION_CTRL, "!query.is_alive", 0.15);
}

export function stopAction(player) {
  const st = state(player);
  if (!st.action) return;
  st.action = "";
  play(player, ANIM.NONE, ACTION_CTRL, undefined, 0.15);
}

/** One-off animation that should not disturb the current action loop. */
export function punchAnim(player) {
  play(player, ANIM.PUNCH, "superhuman_punch", "!query.is_alive", 0.1);
}

/** Re-send looping poses of every hero to a player who just joined. */
export function resyncFor(viewer, heroes) {
  for (const hero of heroes) {
    if (hero.id === viewer.id) continue;
    const st = state(hero);
    if (st.pose && LOOP_POSES.has(st.pose)) {
      play(hero, st.pose, POSE_CTRL, `query.is_on_ground || !query.is_alive || ${SUIT_MISSING}`, 0.25, [viewer]);
    }
  }
}

/** Animation on a mob (villains). */
export function mobAnim(entity, anim) {
  play(entity, anim, "superhuman_mob", "!query.is_alive", 0.2);
}
