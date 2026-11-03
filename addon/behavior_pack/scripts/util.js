// Small helpers shared by every module. Everything that can throw at runtime
// (unloaded chunks, removed entities, missing content) is wrapped so one bad
// call never breaks the main loop.
import { MolangVariableMap, system, world } from "@minecraft/server";

/** @typedef {{x:number,y:number,z:number}} Vec */

export const V = {
  /** @param {Vec} a @param {Vec} b */
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  /** @param {Vec} a @param {Vec} b */
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  /** @param {Vec} a @param {number} s */
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  /** @param {Vec} a */
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  /** @param {Vec} a */
  hlen: (a) => Math.sqrt(a.x * a.x + a.z * a.z),
  /** @param {Vec} a @param {Vec} b */
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  /** @param {Vec} a @param {Vec} b */
  dist: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2),
  /** @param {Vec} a @param {Vec} b */
  hdist: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2),
  /** @param {Vec} a */
  norm: (a) => {
    const l = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) || 1;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  },
  /** @param {Vec} a @param {Vec} b @param {number} t */
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }),
  /** @param {Vec} a */
  floor: (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) }),
  /** @param {Vec} a */
  center: (a) => ({ x: Math.floor(a.x) + 0.5, y: Math.floor(a.y) + 0.5, z: Math.floor(a.z) + 0.5 }),
  zero: () => ({ x: 0, y: 0, z: 0 }),
  /** @param {Vec} a */
  key: (a) => `${Math.floor(a.x)},${Math.floor(a.y)},${Math.floor(a.z)}`,
};

/** Horizontal forward and right vectors for a view direction. @param {Vec} dir */
export function basis(dir) {
  let fx = dir.x;
  let fz = dir.z;
  const l = Math.sqrt(fx * fx + fz * fz);
  if (l < 1e-4) {
    fx = 0;
    fz = 1;
  } else {
    fx /= l;
    fz /= l;
  }
  return { fwd: { x: fx, y: 0, z: fz }, right: { x: -fz, y: 0, z: fx } };
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function rand(a, b) {
  return a + Math.random() * (b - a);
}
export function randInt(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}
/** @template T @param {T[]} arr @returns {T} */
export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function chance(p) {
  return Math.random() < p;
}

/** Run fn and swallow errors. @template T @param {() => T} fn @param {T} [fallback] @returns {T} */
export function safe(fn, fallback = undefined) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** @param {any} e */
export function valid(e) {
  try {
    return !!e && e.isValid;
  } catch {
    return false;
  }
}

/** @param {import("@minecraft/server").Entity | import("@minecraft/server").Dimension} source @param {string} command */
export function cmd(source, command) {
  try {
    source.runCommand(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {string} id
 * @param {Vec} loc
 * @param {MolangVariableMap} [vars]
 */
export function particle(dim, id, loc, vars) {
  try {
    if (vars) dim.spawnParticle(id, loc, vars);
    else dim.spawnParticle(id, loc);
  } catch {
    /* unloaded chunk or unknown particle */
  }
}

export function colorVars(r, g, b) {
  const m = new MolangVariableMap();
  m.setColorRGB("variable.color", { red: r, green: g, blue: b });
  return m;
}

/** @param {import("@minecraft/server").Dimension} dim @param {string} id @param {Vec} loc */
export function sound(dim, id, loc, volume = 1, pitch = 1) {
  try {
    dim.playSound(id, loc, { volume, pitch });
  } catch {
    /* ignore */
  }
}

/** @param {import("@minecraft/server").Player} player @param {string} id */
export function playerSound(player, id, volume = 1, pitch = 1) {
  try {
    player.playSound(id, { volume, pitch });
  } catch {
    /* ignore */
  }
}

/** @param {import("@minecraft/server").Dimension} dim @param {Vec} loc */
export function blockAt(dim, loc) {
  try {
    return dim.getBlock(loc);
  } catch {
    return undefined;
  }
}

/** @param {import("@minecraft/server").Dimension} dim @param {Vec} loc @param {string} type */
export function setBlock(dim, loc, type) {
  try {
    dim.setBlockType(loc, type);
    return true;
  } catch {
    return false;
  }
}

/** @param {import("@minecraft/server").Entity} e @param {string} family */
export function hasFamily(e, family) {
  try {
    return e.getComponent("minecraft:type_family")?.hasTypeFamily(family) ?? false;
  } catch {
    return false;
  }
}

/** @param {import("@minecraft/server").Player} player @param {string} text */
export function msg(player, text) {
  try {
    player.sendMessage(text);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} title
 * @param {string} [subtitle]
 */
export function showTitle(player, title, subtitle = "", stay = 50) {
  try {
    player.onScreenDisplay.setTitle(title, {
      subtitle,
      fadeInDuration: 6,
      stayDuration: stay,
      fadeOutDuration: 14,
    });
  } catch {
    /* ignore */
  }
}

/** @param {import("@minecraft/server").Player} player */
export function cameraFade(player, r, g, b, fadeIn = 0.15, hold = 0.1, fadeOut = 0.5) {
  try {
    player.camera.fade({
      fadeColor: { red: r, green: g, blue: b },
      fadeTime: { fadeInTime: fadeIn, holdTime: hold, fadeOutTime: fadeOut },
    });
  } catch {
    /* ignore */
  }
}

/** @param {import("@minecraft/server").Player} player */
export function shake(player, intensity = 0.3, seconds = 0.4) {
  cmd(player, `camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`);
}

/** Direction arrow (relative to where the player looks) toward a target. */
export function arrowTo(player, target) {
  const rot = player.getRotation();
  const dx = target.x - player.location.x;
  const dz = target.z - player.location.z;
  const targetYaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  let rel = targetYaw - rot.y;
  while (rel < -180) rel += 360;
  while (rel > 180) rel -= 360;
  const arrows = ["^", "^>", ">", "v>", "v", "<v", "<", "<^"];
  const idx = Math.round(((rel + 360) % 360) / 45) % 8;
  return arrows[idx];
}

/** @param {number} frac 0..1 */
export function bar(frac, width, on = "§a", off = "§8", glyph = "|") {
  const n = Math.round(clamp(frac, 0, 1) * width);
  return on + glyph.repeat(n) + off + glyph.repeat(width - n);
}

export function now() {
  return system.currentTick;
}

/** All players in the overworld/nether/end that are valid. */
export function players() {
  return world.getAllPlayers().filter((p) => valid(p));
}

/** @param {import("@minecraft/server").Player} player */
export function isCreative(player) {
  return safe(() => String(player.getGameMode()) === "Creative", false);
}

/** @param {import("@minecraft/server").Player} player */
export function isSpectator(player) {
  return safe(() => String(player.getGameMode()) === "Spectator", false);
}

export function fmtNum(n) {
  return Math.round(n).toLocaleString("en-US");
}

/** Find solid ground at or below a location (returns y of the first air block above ground). */
export function groundBelow(dim, loc, maxDown = 24) {
  const hit = safe(() =>
    dim.getBlockFromRay({ x: loc.x, y: loc.y, z: loc.z }, { x: 0, y: -1, z: 0 }, {
      maxDistance: maxDown,
      includeLiquidBlocks: true,
      includePassableBlocks: false,
    })
  );
  return hit ? hit.block.location.y + 1 : undefined;
}
