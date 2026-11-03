// Per-player runtime state (not saved) and persistent data (dynamic properties).
import { world } from "@minecraft/server";
import { safe } from "./util.js";

/**
 * @typedef {Object} HeroState
 * @property {boolean} suited
 * @property {boolean} flying
 * @property {boolean} creativeFlight
 * @property {{x:number,y:number,z:number}} vref        ramped desired velocity (blocks/tick)
 * @property {{x:number,y:number,z:number}} vmeas       measured velocity (blocks/tick)
 * @property {{x:number,y:number,z:number}|undefined} lastLoc
 * @property {number} lastGroundTick
 * @property {number} takeoffTick
 * @property {number} lastJumpPress
 * @property {number} lastSneakPress
 * @property {number} sneakTaps
 * @property {boolean} boost
 * @property {boolean} boostLatch
 * @property {number} lastFwdPress
 * @property {boolean} fwdDown
 * @property {boolean} sonic
 * @property {boolean} fovBoost
 * @property {number} steadyTicks
 * @property {number} flightDist
 * @property {string} pose
 * @property {string} poseCandidate
 * @property {number} poseCandidateTicks
 * @property {string} action
 * @property {number} energy
 * @property {{hold:boolean, until:number}} heat
 * @property {{hold:boolean, until:number}} freeze
 * @property {boolean} heatActive
 * @property {boolean} freezeActive
 * @property {boolean} xray
 * @property {number} flareReadyAt
 * @property {number} flareBlastAt
 * @property {number} slamReadyAt
 * @property {number} krypto            current cryptonite exposure (0 = none, >=1 critical)
 * @property {number} poisonUntil
 * @property {boolean} kryptoWarned
 * @property {string|undefined} carrying  civilian entity id
 * @property {boolean} inSun
 * @property {string} hudExtra
 * @property {number} hudExtraUntil
 * @property {number} lastCheerLine
 * @property {number|undefined} cityId    city the player is currently inside
 * @property {number} airMinVy            most negative vertical speed during the current fall/dive
 * @property {Map<string, number>} heatSpots
 * @property {Map<string, number>} freezeHits
 * @property {Map<string, number>} frozenTicks
 * @property {number} xrayCount
 * @property {string} xraySummary
 * @property {number} lastStrafeSample
 * @property {number} ybias             vertical integral term of the flight controller
 * @property {number} lastHudTick
 * @property {"none"|"super"|"iron"} mode   which hero the player currently is
 * @property {boolean} hasCore           wearing the (undeployed) nano core
 * @property {Record<string, number>} cooldowns  ability id -> tick when ready again
 * @property {number} lastToggleTick
 * @property {number} lastAbilityMsg
 * @property {number} hintsUntil        show control hints on the HUD until this tick
 * @property {number} integrity         iron suit integrity (absorbs damage)
 * @property {number} lastHitTick
 * @property {number} shieldUntil
 * @property {number} bladeUntil
 * @property {number} unibeamStart
 * @property {number} unibeamEnd
 * @property {boolean} scan
 * @property {number} nanoBusyUntil     deploy/retract animation in progress
 * @property {number} lastVera
 * @property {number} wheelOpen
 * @property {number} groundTaps
 * @property {number} lastGroundSneak
 */

/** @type {Map<string, HeroState>} */
const runtime = new Map();

/** @param {import("@minecraft/server").Player} player @returns {HeroState} */
export function state(player) {
  let s = runtime.get(player.id);
  if (!s) {
    s = {
      suited: false,
      flying: false,
      creativeFlight: false,
      vref: { x: 0, y: 0, z: 0 },
      vmeas: { x: 0, y: 0, z: 0 },
      lastLoc: undefined,
      lastGroundTick: 0,
      takeoffTick: 0,
      lastJumpPress: -100,
      lastSneakPress: -100,
      sneakTaps: 0,
      boost: false,
      boostLatch: false,
      lastFwdPress: -100,
      fwdDown: false,
      sonic: false,
      fovBoost: false,
      steadyTicks: 0,
      flightDist: 0,
      pose: "",
      poseCandidate: "",
      poseCandidateTicks: 0,
      action: "",
      energy: 100,
      heat: { hold: false, until: 0 },
      freeze: { hold: false, until: 0 },
      heatActive: false,
      freezeActive: false,
      xray: false,
      flareReadyAt: 0,
      flareBlastAt: 0,
      slamReadyAt: 0,
      krypto: 0,
      poisonUntil: 0,
      kryptoWarned: false,
      carrying: undefined,
      inSun: false,
      hudExtra: "",
      hudExtraUntil: 0,
      lastCheerLine: -10000,
      cityId: undefined,
      airMinVy: 0,
      heatSpots: new Map(),
      freezeHits: new Map(),
      frozenTicks: new Map(),
      xrayCount: 0,
      xraySummary: "",
      lastStrafeSample: 0,
      ybias: 0,
      lastHudTick: 0,
      mode: "none",
      hasCore: false,
      cooldowns: {},
      lastToggleTick: -100,
      lastAbilityMsg: -100,
      hintsUntil: 0,
      integrity: 60,
      lastHitTick: -1000,
      shieldUntil: 0,
      bladeUntil: 0,
      unibeamStart: 0,
      unibeamEnd: 0,
      scan: false,
      nanoBusyUntil: 0,
      lastVera: -1000,
      wheelOpen: 0,
      groundTaps: 0,
      lastGroundSneak: -100,
    };
    runtime.set(player.id, s);
  }
  return s;
}

export function forget(playerId) {
  runtime.delete(playerId);
}

// ---------------------------------------------------------------------------
// Persistent player data
// ---------------------------------------------------------------------------
const PREFIX = "sh:";

/** @param {import("@minecraft/server").Player} player */
export function getNum(player, key, def = 0) {
  const v = safe(() => player.getDynamicProperty(PREFIX + key));
  return typeof v === "number" ? v : def;
}

/** @param {import("@minecraft/server").Player} player */
export function setNum(player, key, value) {
  safe(() => player.setDynamicProperty(PREFIX + key, value));
}

/** @param {import("@minecraft/server").Player} player */
export function getJSON(player, key, def) {
  const v = safe(() => player.getDynamicProperty(PREFIX + key));
  if (typeof v !== "string") return def;
  return safe(() => JSON.parse(v), def);
}

/** @param {import("@minecraft/server").Player} player */
export function setJSON(player, key, value) {
  safe(() => player.setDynamicProperty(PREFIX + key, JSON.stringify(value)));
}

export const DEFAULT_SETTINGS = {
  hud: true,
  hints: true,
  fov: true,
  heatFire: true,
  superSpeed: true,
  cheers: true,
};

/** @param {import("@minecraft/server").Player} player @returns {typeof DEFAULT_SETTINGS} */
export function settings(player) {
  return Object.assign({}, DEFAULT_SETTINGS, getJSON(player, "settings", {}));
}

// ---------------------------------------------------------------------------
// World data
// ---------------------------------------------------------------------------
export function worldGet(key, def) {
  const v = safe(() => world.getDynamicProperty(PREFIX + key));
  if (v === undefined) return def;
  if (typeof v === "string") {
    const parsed = safe(() => JSON.parse(v), undefined);
    return parsed === undefined ? v : parsed;
  }
  return v;
}

export function worldSet(key, value) {
  safe(() => world.setDynamicProperty(PREFIX + key, typeof value === "number" ? value : JSON.stringify(value)));
}
