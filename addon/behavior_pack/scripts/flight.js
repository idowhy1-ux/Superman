// Flight: double-jump take-off, look-to-steer cruising, supersonic boost,
// hover bob, banking poses, sonic booms and superhero landings.
//
// The server cannot set a player's velocity directly; it can only send
// knockback. Different engine versions retain a different share of the
// previous velocity when knockback is applied, so the controller learns that
// share online (model.alphaH / alphaV) and stores it per world.
import { ButtonState, InputButton, system, world } from "@minecraft/server";
import { ANIM, PARTICLE, SOUND } from "./constants.js";
import { addXp, flash, hasPower, stats } from "./leveling.js";
import { settings, state, worldGet, worldSet } from "./store.js";
import { V, basis, clamp, cmd, isCreative, isSpectator, particle, playerSound, safe, shake, sound, valid } from "./util.js";
import { isLoopPose, playPose, poseLocked, stopPose } from "./anim.js";

const model = { alphaH: 0.25, alphaV: 0.25, samples: 0, dirty: false };
let strafeVotes = -2; // prior: movement vector x > 0 means "left"
let strafeSign = -1; // multiply movement x by this to get "+ = right"

const landingListeners = [];
/** Register (player, impactSpeed:number, wasFlying:boolean) => boolean (true = handled as ground slam) */
export function onLanding(fn) {
  landingListeners.push(fn);
}

export function loadFlightModel() {
  const m = worldGet("flight_model", undefined);
  if (m && typeof m === "object") {
    model.alphaH = clamp(Number(m.h ?? 0.25), 0, 0.6);
    model.alphaV = clamp(Number(m.v ?? 0.25), 0, 0.6);
    model.samples = Number(m.n ?? 0);
  }
  const sv = worldGet("strafe_votes", undefined);
  if (typeof sv === "number") {
    strafeVotes = clamp(sv, -6, 6);
    strafeSign = strafeVotes > 0 ? 1 : -1;
  }
}

export function saveFlightModel() {
  if (!model.dirty) return;
  model.dirty = false;
  worldSet("flight_model", { h: Number(model.alphaH.toFixed(3)), v: Number(model.alphaV.toFixed(3)), n: model.samples });
  worldSet("strafe_votes", strafeVotes);
}

// ---------------------------------------------------------------------------
// Input events
// ---------------------------------------------------------------------------
world.afterEvents.playerButtonInput.subscribe((ev) => {
  const player = ev.player;
  if (!valid(player) || ev.newButtonState !== ButtonState.Pressed) return;
  const st = state(player);
  const now = system.currentTick;
  if (ev.button === InputButton.Jump) {
    st.lastJumpPress = now;
    tryTakeoff(player, st, now);
  } else if (ev.button === InputButton.Sneak) {
    st.sneakTaps = now - st.lastSneakPress < 8 ? st.sneakTaps + 1 : 1;
    st.lastSneakPress = now;
    if (st.flying && st.sneakTaps >= 2 && !safe(() => player.isOnGround, true)) {
      stopFlight(player, st);
      flash(player, "§7Flight off - falling");
    }
  }
});

/** @param {import("@minecraft/server").Player} player */
function tryTakeoff(player, st, now) {
  if (!st.suited || st.flying || isSpectator(player) || isCreative(player)) return;
  if (!hasPower(player, "flight")) return;
  if (safe(() => player.isOnGround, true)) return;
  if (now - st.lastGroundTick < 2) return;
  if (safe(() => player.isGliding || player.isFlying, false)) return;
  if (safe(() => player.getComponent("minecraft:riding"), undefined)) return;
  if (st.krypto >= 1) {
    flash(player, "§a☢ Cryptonite! §cYou can't fly!");
    return;
  }
  startFlight(player, st, now);
}

/** @param {import("@minecraft/server").Player} player */
export function startFlight(player, st, now) {
  st.flying = true;
  st.takeoffTick = now;
  st.boost = false;
  st.boostLatch = false;
  st.sonic = false;
  st.steadyTicks = 0;
  st.airMinVy = 0;
  st.vref = { x: st.vmeas.x, y: Math.max(st.vmeas.y, 0) + 0.55, z: st.vmeas.z };
  st.ybias = 0;
  playPose(player, ANIM.TAKEOFF, { oneShot: true, force: true });
  sound(player.dimension, SOUND.WHOOSH, player.location, 0.8, 1.1);
  particle(player.dimension, PARTICLE.SHOCKWAVE, player.location);
  safe(() => player.addEffect("slow_falling", 60, { amplifier: 0, showParticles: false }));
}

/** @param {import("@minecraft/server").Player} player */
export function stopFlight(player, st) {
  if (!st.flying) return;
  st.flying = false;
  st.boost = false;
  st.boostLatch = false;
  st.sonic = false;
  setBoostFov(player, st, false);
  safe(() => player.removeEffect("slow_falling"));
  stopPose(player);
}

/** @param {import("@minecraft/server").Player} player */
function setBoostFov(player, st, on) {
  if (on === st.fovBoost) return;
  st.fovBoost = on;
  if (on) {
    if (settings(player).fov) cmd(player, "camera @s fov_set 92 0.6 out_quad");
  } else {
    cmd(player, "camera @s fov_clear 0.6 in_out_quad");
  }
}

// ---------------------------------------------------------------------------
// Per-tick update
// ---------------------------------------------------------------------------
function readInput(player, st, now) {
  const mv = safe(() => player.inputInfo.getMovementVector(), { x: 0, y: 0 });
  const fwd = clamp(mv.y, -1, 1);
  const strafe = clamp(mv.x * strafeSign, -1, 1);
  const up = safe(() => player.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed, false) ||
    safe(() => player.isJumping, false);
  const down = safe(() => player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed, false) ||
    safe(() => player.isSneaking, false);
  const sprint = safe(() => player.isSprinting, false);
  const fdown = fwd > 0.5;
  if (fdown && !st.fwdDown) {
    if (now - st.lastFwdPress < 8) st.boostLatch = true;
    st.lastFwdPress = now;
  }
  if (fwd < 0.2) st.boostLatch = false;
  st.fwdDown = fdown;
  return { fwd, strafe, up, down, sprint, any: Math.abs(fwd) > 0.05 || Math.abs(strafe) > 0.05 || up || down };
}

/** Learn whether movement-vector x means left or right from normal walking. */
function calibrateStrafe(player, st, now) {
  if (now - st.lastStrafeSample < 10) return;
  const mv = safe(() => player.inputInfo.getMovementVector());
  if (!mv || Math.abs(mv.x) < 0.6 || Math.abs(mv.y) > 0.25) return;
  const { right } = basis(safe(() => player.getViewDirection(), { x: 0, y: 0, z: 1 }));
  const d = st.vmeas.x * right.x + st.vmeas.z * right.z;
  if (Math.abs(d) < 0.04) return;
  st.lastStrafeSample = now;
  const vote = d > 0 === mv.x > 0 ? 1 : -1;
  strafeVotes = clamp(strafeVotes + vote, -6, 6);
  const sign = strafeVotes > 0 ? 1 : -1;
  if (sign !== strafeSign) {
    strafeSign = sign;
  }
  model.dirty = true;
}

/** Update the learned engine response while cruising steadily in open air. */
function adapt(st, target) {
  const tH = Math.hypot(st.vref.x, st.vref.z);
  const mH = Math.hypot(st.vmeas.x, st.vmeas.z);
  const steady = Math.abs(Math.hypot(target.x, target.z) - tH) < 0.02;
  st.steadyTicks = steady && tH > 0.35 ? st.steadyTicks + 1 : 0;
  if (st.steadyTicks > 10 && mH > 0.05) {
    const cos = (st.vref.x * st.vmeas.x + st.vref.z * st.vmeas.z) / (tH * mH);
    const err = (mH - tH) / tH;
    if (cos > 0.97 && Math.abs(err) < 0.85) {
      model.alphaH = clamp(model.alphaH + 0.02 * err, 0, 0.6);
      model.samples++;
      model.dirty = true;
    }
  }
  const tV = st.vref.y;
  if (Math.abs(tV) > 0.3 && Math.abs(target.y - tV) < 0.02 && Math.abs(st.vmeas.y) > 0.05 && Math.sign(st.vmeas.y) === Math.sign(tV)) {
    const errV = (Math.abs(st.vmeas.y) - Math.abs(tV)) / Math.abs(tV);
    if (Math.abs(errV) < 0.85) {
      model.alphaV = clamp(model.alphaV + 0.01 * errV, 0, 0.6);
      model.dirty = true;
    }
  }
}

/**
 * Called every tick for every player.
 * @param {import("@minecraft/server").Player} player
 */
export function tickFlight(player, now) {
  const st = state(player);
  const onGround = safe(() => player.isOnGround, true);
  const loc = player.location;
  if (st.lastLoc) {
    const d = V.sub(loc, st.lastLoc);
    st.vmeas = V.len(d) > 8 ? V.zero() : V.lerp(st.vmeas, d, 0.65);
  }
  st.lastLoc = { x: loc.x, y: loc.y, z: loc.z };
  if (onGround) st.lastGroundTick = now;

  if (!st.flying) {
    if (onGround) {
      calibrateStrafe(player, st, now);
      if (st.suited && st.airMinVy < -0.75) landed(player, st, -st.airMinVy, false);
      st.airMinVy = 0;
    } else {
      st.airMinVy = Math.min(st.airMinVy, st.vmeas.y);
    }
    if (st.suited && isCreative(player)) creativePoses(player, st);
    return;
  }

  if (!st.suited || st.krypto >= 1 || isSpectator(player) || safe(() => player.isGliding, false)) {
    if (st.krypto >= 1) flash(player, "§a☢ Cryptonite! §cYour flight fails!");
    stopFlight(player, st);
    return;
  }

  const s = stats(player);
  const input = readInput(player, st, now);

  if (onGround && now - st.takeoffTick > 8 && !input.up) {
    const impact = -Math.min(st.airMinVy, st.vmeas.y);
    stopFlight(player, st);
    landed(player, st, impact, true);
    st.airMinVy = 0;
    return;
  }
  st.airMinVy = Math.min(st.airMinVy * 0.9, st.vmeas.y);

  // --- desired velocity ------------------------------------------------------
  const dir = safe(() => player.getViewDirection(), { x: 0, y: 0, z: 1 });
  const { right } = basis(dir);
  const weakened = st.krypto > 0;
  const wantsBoost = (input.sprint || st.boostLatch) && input.fwd > 0.3 && st.energy > 1 && !weakened;
  if (wantsBoost && !st.boost) sound(player.dimension, SOUND.WHOOSH, player.location, 0.9, 1);
  st.boost = wantsBoost;
  let speed = wantsBoost ? s.boost : s.cruise;
  if (weakened) speed *= 0.5;
  if (safe(() => player.isInWater, false)) speed *= 0.55;

  let tx = 0;
  let ty = 0;
  let tz = 0;
  if (Math.abs(input.fwd) > 0.05) {
    tx += dir.x * input.fwd * speed;
    ty += dir.y * input.fwd * speed;
    tz += dir.z * input.fwd * speed;
  }
  if (Math.abs(input.strafe) > 0.05) {
    const sp = Math.min(speed, s.cruise) * 0.85;
    tx += right.x * input.strafe * sp;
    tz += right.z * input.strafe * sp;
  }
  if (input.up) ty += s.cruise * 0.8;
  if (input.down) ty -= s.cruise * 0.95;
  if (!input.any) ty += Math.sin(now * 0.12) * 0.015;
  const maxS = wantsBoost ? s.boost : s.cruise * 1.15;
  const tl = Math.hypot(tx, ty, tz);
  if (tl > maxS) {
    tx *= maxS / tl;
    ty *= maxS / tl;
    tz *= maxS / tl;
  }
  // gentle ceiling: do not fly into the build limit
  if (loc.y > 315 && ty > 0) ty = 0;
  const target = { x: tx, y: ty, z: tz };

  // --- smooth acceleration ---------------------------------------------------
  const accel = wantsBoost ? 0.07 : 0.09;
  const decel = 0.11;
  for (const k of ["x", "y", "z"]) {
    const diff = target[k] - st.vref[k];
    const step = Math.abs(target[k]) > Math.abs(st.vref[k]) ? accel : decel;
    st.vref[k] += clamp(diff, -step, step);
  }

  // --- command with learned engine response ---------------------------------
  st.ybias = clamp((st.ybias ?? 0) + 0.04 * (st.vref.y - st.vmeas.y), -0.15, 0.15);
  const cx = st.vref.x - model.alphaH * st.vmeas.x;
  const cz = st.vref.z - model.alphaH * st.vmeas.z;
  const cy = st.vref.y - model.alphaV * st.vmeas.y + st.ybias;
  const cap = maxS * 2 + 0.4;
  safe(() => player.applyKnockback({ x: clamp(cx, -cap, cap), z: clamp(cz, -cap, cap) }, clamp(cy, -cap, cap)));
  adapt(st, target);

  // --- upkeep -----------------------------------------------------------------
  if (now % 10 === 0) {
    const sf = safe(() => player.getEffect("slow_falling"));
    if (!sf || sf.duration < 25) safe(() => player.addEffect("slow_falling", 60, { amplifier: 0, showParticles: false }));
  }
  const speedNow = V.len(st.vmeas);
  if (st.boost && speedNow > s.cruise * 1.05) st.energy = Math.max(0, st.energy - 0.15);
  if (st.boost && st.energy <= 1) flash(player, "§eOut of solar energy - find some sunlight!");

  fastFlightFx(player, st, s, dir, speedNow, now);
  selectPose(player, st, speedNow);

  st.flightDist += V.hlen(st.vmeas);
  if (st.flightDist >= 250) {
    st.flightDist -= 250;
    addXp(player, 3, "flying");
  }
}

function fastFlightFx(player, st, s, dir, speedNow, now) {
  const dim = player.dimension;
  const loc = player.location;
  if (st.boost && speedNow > 0.9) {
    setBoostFov(player, st, true);
    if (now % 2 === 0) {
      particle(dim, PARTICLE.WIND, { x: loc.x - dir.x * 1.2, y: loc.y + 0.9 - dir.y * 1.2, z: loc.z - dir.z * 1.2 });
    }
    if (now % 24 === 0) sound(dim, SOUND.WHOOSH, loc, 0.5, 1.3);
    if (!st.sonic && hasPower(player, "sonic") && speedNow > s.boost * 0.82) {
      st.sonic = true;
      sonicBoom(player, dir);
    }
  } else {
    if (speedNow < 0.8) setBoostFov(player, st, false);
    if (st.sonic && speedNow < s.boost * 0.55) st.sonic = false;
  }
}

/** @param {import("@minecraft/server").Player} player */
function sonicBoom(player, dir) {
  const dim = player.dimension;
  const loc = player.location;
  const at = { x: loc.x - dir.x * 1.5, y: loc.y + 0.9 - dir.y * 1.5, z: loc.z - dir.z * 1.5 };
  particle(dim, PARTICLE.SONIC, at);
  particle(dim, PARTICLE.SONIC, { x: at.x - dir.x, y: at.y - dir.y, z: at.z - dir.z });
  sound(dim, SOUND.SONIC, at, 1.2, 1);
  shake(player, 0.25, 0.35);
  flash(player, "§f§lSONIC BOOM!", 30);
  for (const e of safe(() => dim.getEntities({ location: at, maxDistance: 5, excludeTypes: ["minecraft:player", "minecraft:item"] }), [])) {
    const away = V.norm(V.sub(e.location, at));
    safe(() => e.applyKnockback({ x: away.x * 1.2, z: away.z * 1.2 }, 0.35));
  }
}

/** @param {import("@minecraft/server").Player} player */
function selectPose(player, st, speedNow) {
  if (poseLocked(player)) return;
  const hs = V.hlen(st.vmeas);
  let want;
  if (st.carrying) want = hs > 0.3 ? ANIM.FLY_CARRY : ANIM.HOVER_CARRY;
  else if (st.boost && speedNow > 0.95) want = ANIM.FLY_FAST;
  else if (hs > 0.26) want = ANIM.FLY;
  else want = ANIM.HOVER;
  if (want === st.pose) {
    st.poseCandidateTicks = 0;
    return;
  }
  if (want === st.poseCandidate) st.poseCandidateTicks++;
  else {
    st.poseCandidate = want;
    st.poseCandidateTicks = 1;
  }
  if (st.poseCandidateTicks >= 4 || !st.pose || !isLoopPose(st.pose)) {
    playPose(player, want);
    st.poseCandidateTicks = 0;
  }
}

/** Creative players already fly natively; we only add the hero poses. */
function creativePoses(player, st) {
  const flyingNow = safe(() => player.isFlying, false);
  if (!flyingNow) {
    if (st.creativeFlight) {
      st.creativeFlight = false;
      stopPose(player);
    }
    return;
  }
  st.creativeFlight = true;
  st.boost = safe(() => player.isSprinting, false);
  selectPose(player, st, V.len(st.vmeas));
}

/** @param {import("@minecraft/server").Player} player */
function landed(player, st, impact, wasFlying) {
  for (const fn of landingListeners) {
    if (safe(() => fn(player, impact, wasFlying), false)) return;
  }
  if (impact > 0.75) {
    playPose(player, ANIM.LAND, { oneShot: true, force: true });
    particle(player.dimension, PARTICLE.SHOCKWAVE, player.location);
    sound(player.dimension, "mace.smash_ground", player.location, 0.8, 1.1);
    shake(player, Math.min(0.5, impact * 0.25), 0.35);
  } else if (wasFlying) {
    playerSound(player, "step.cloth", 0.6, 1);
  }
}
