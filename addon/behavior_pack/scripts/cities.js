// Procedural cities. A city is a 3x3 grid of lots separated by roads:
// skyscrapers, offices, apartments, shops, a hospital and a central plaza
// with a fountain and the Hero Monument. Cities are built by script (no
// experimental toggles): automatically near spawn and as players explore,
// or on demand with the City Blueprint.
import { BlockVolume, system, world } from "@minecraft/server";
import { ID, PARTICLE } from "./constants.js";
import { worldGet, worldSet } from "./store.js";
import { V, blockAt, choice, clamp, msg, particle, players, rand, randInt, safe, setBlock, showTitle, valid } from "./util.js";
import { emit } from "./bus.js";

export const LOT = 17;
export const ROAD = 5;
export const GRID = 3;
export const SIZE = GRID * LOT + (GRID + 1) * ROAD; // 71
export const HALF = Math.floor(SIZE / 2);
const CITY_SPACING = 650;
const AIR = "minecraft:air";
const LIGHT = "minecraft:light_block_15";

/**
 * @typedef {{x:number,z:number,w:number,d:number,h:number,type:string}} Building
 * @typedef {{id:number,name:string,x:number,y:number,z:number,dim:string,built:boolean,buildings:Building[],created:number}} City
 */

/** @type {City[]} */
let cities = [];
let loaded = false;
let busy = false;
/** @type {Array<{cx:number,cz:number,force:boolean,requester?:string,attempts:number}>} */
const queue = [];

export function loadCities() {
  const data = worldGet("cities", []);
  cities = Array.isArray(data) ? data : [];
  loaded = true;
  // remove ticking areas left behind by an interrupted build
  for (const area of safe(() => world.tickingAreaManager.getAllTickingAreas(), [])) {
    if (area.identifier.startsWith("superhuman_city_")) safe(() => world.tickingAreaManager.removeTickingArea(area.identifier));
  }
}

function saveCities() {
  let data = cities.slice(-40);
  let json = JSON.stringify(data);
  while (json.length > 30000 && data.length > 1) {
    data = data.slice(1);
    json = JSON.stringify(data);
  }
  cities = data;
  worldSet("cities", data);
}

/** @returns {City[]} */
export function allCities() {
  if (!loaded) loadCities();
  return cities;
}

/** @param {{x:number,z:number}} loc @param {string} dimId */
export function nearestCity(loc, dimId = "minecraft:overworld") {
  let best;
  let bestD = Infinity;
  for (const c of allCities()) {
    if (!c.built || c.dim !== dimId) continue;
    const d = Math.hypot(c.x - loc.x, c.z - loc.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ? { city: best, distance: bestD } : undefined;
}

/** City whose area contains the location (with margin). */
export function cityAt(loc, dimId, margin = 6) {
  for (const c of allCities()) {
    if (!c.built || c.dim !== dimId) continue;
    if (Math.abs(loc.x - c.x) <= HALF + margin && Math.abs(loc.z - c.z) <= HALF + margin) return c;
  }
  return undefined;
}

export function isBusy() {
  return busy || queue.length > 0;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------
const PREFIX = ["Metro", "Star", "Sky", "Sun", "Harbor", "Liberty", "Crystal", "Iron", "Golden", "Silver", "Ocean",
  "Summit", "Aurora", "Valor", "Bright", "Nova", "Titan", "Beacon", "Comet", "Horizon"];
const SUFFIX = [" City", "polis", "ville", " Bay", " Heights", " Harbor", "ton", " Falls", " Point", " Central"];

function newName() {
  const used = new Set(allCities().map((c) => c.name));
  for (let i = 0; i < 40; i++) {
    const n = choice(PREFIX) + choice(SUFFIX);
    if (!used.has(n)) return n;
  }
  return `New City ${allCities().length + 1}`;
}

// ---------------------------------------------------------------------------
// Low level helpers
// ---------------------------------------------------------------------------
/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {{x:number,y:number,z:number}} a
 * @param {{x:number,y:number,z:number}} b
 * @param {string} block
 * @param {string[]} [onlyReplace]
 */
function fill(dim, a, b, block, onlyReplace) {
  const from = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) };
  const to = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) };
  try {
    /** @type {import("@minecraft/server").BlockFillOptions} */
    const opts = { ignoreChunkBoundErrors: true };
    if (onlyReplace) opts.blockFilter = { includeTypes: onlyReplace };
    dim.fillBlocks(new BlockVolume(from, to), block, opts);
    return true;
  } catch {
    return false;
  }
}

function setIfAir(dim, loc, block) {
  const b = blockAt(dim, loc);
  if (b && b.isAir) setBlock(dim, loc, block);
}

const CLUTTER_EXACT = new Set([
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:snow_layer",
  "minecraft:vine", "minecraft:bamboo", "minecraft:sweet_berry_bush", "minecraft:brown_mushroom", "minecraft:red_mushroom",
  "minecraft:pumpkin", "minecraft:melon_block", "minecraft:bee_nest", "minecraft:cactus", "minecraft:sugar_cane",
  "minecraft:mangrove_roots", "minecraft:muddy_mangrove_roots", "minecraft:brown_mushroom_block",
  "minecraft:red_mushroom_block", "minecraft:mushroom_stem", "minecraft:pointed_dripstone",
]);

function isClutter(id) {
  return CLUTTER_EXACT.has(id) || id.endsWith("_leaves") || id.endsWith("_log") || id.endsWith("_wood") ||
    id.endsWith("_sapling") || id.endsWith("_flower") || id.endsWith("_tulip") || id.includes("azalea") ||
    id.endsWith("dandelion") || id.endsWith("poppy") || id.endsWith("orchid") || id.endsWith("allium") ||
    id.endsWith("bluet") || id.endsWith("daisy") || id.endsWith("cornflower") || id.endsWith("lily_of_the_valley");
}

/** Find ground (ignoring trees and plants) at x,z. */
function surfaceAt(dim, x, z) {
  let b = safe(() => dim.getTopmostBlock({ x, z }));
  let guard = 0;
  while (b && guard++ < 48 && (b.isAir || isClutter(b.typeId))) b = safe(() => b.below());
  if (!b) return undefined;
  const water = b.isLiquid || b.typeId.includes("water") || b.typeId === "minecraft:ice" || b.typeId === "minecraft:kelp" ||
    b.typeId === "minecraft:seagrass";
  return { y: b.location.y, water };
}

/** @param {import("@minecraft/server").Dimension} dim */
function survey(dim, cx, cz) {
  const heights = [];
  let water = 0;
  let samples = 0;
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const x = Math.round(cx - HALF + (i * SIZE) / 8);
      const z = Math.round(cz - HALF + (j * SIZE) / 8);
      const s = surfaceAt(dim, x, z);
      if (!s) continue;
      samples++;
      if (s.water) water++;
      heights.push(s.y);
    }
  }
  if (samples < 40) return undefined;
  heights.sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)];
  return {
    gy: median,
    min: heights[0],
    max: heights[heights.length - 1],
    p10: heights[Math.floor(heights.length * 0.1)],
    p90: heights[Math.floor(heights.length * 0.9)],
    water: water / samples,
  };
}

/** Resolve when a generator job finishes. */
function runJobAsync(gen) {
  return new Promise((resolve) => {
    system.runJob(
      (function* () {
        try {
          yield* gen;
        } catch (e) {
          console.warn(`[superhuman] city job failed: ${e}`);
        }
        resolve(undefined);
      })()
    );
  });
}

/** Keep the city area loaded while we work on it. */
async function withArea(dim, cx, cz, fn) {
  const id = `superhuman_city_${Math.round(cx)}_${Math.round(cz)}`;
  const mgr = world.tickingAreaManager;
  /** @type {import("@minecraft/server").TickingAreaOptions} */
  const opts = {
    dimension: dim,
    from: { x: cx - HALF - 6, y: 0, z: cz - HALF - 6 },
    to: { x: cx + HALF + 6, y: 0, z: cz + HALF + 6 },
  };
  let created = false;
  try {
    if (mgr.hasCapacity(opts)) {
      await mgr.createTickingArea(id, opts);
      created = true;
    }
  } catch (e) {
    console.warn(`[superhuman] ticking area unavailable: ${e}`);
  }
  try {
    if (!created) {
      const corners = [
        { x: cx - HALF, y: 64, z: cz - HALF }, { x: cx + HALF, y: 64, z: cz - HALF },
        { x: cx - HALF, y: 64, z: cz + HALF }, { x: cx + HALF, y: 64, z: cz + HALF },
      ];
      if (!corners.every((c) => safe(() => dim.isChunkLoaded(c), false))) return undefined;
    }
    return await fn();
  } finally {
    if (created) safe(() => mgr.removeTickingArea(id));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Queue a city near (cx, cz). `force` skips the terrain suitability checks.
 * @param {number} cx @param {number} cz
 */
export function requestCity(cx, cz, force = false, requester = undefined) {
  queue.push({ cx: Math.round(cx), cz: Math.round(cz), force, requester, attempts: 0 });
  pump();
}

function pump() {
  if (busy || queue.length === 0) return;
  const job = queue.shift();
  busy = true;
  const dim = world.getDimension("overworld");
  buildAt(dim, job)
    .catch((e) => console.warn(`[superhuman] city build error: ${e}`))
    .finally(() => {
      busy = false;
      system.runTimeout(pump, 20);
    });
}

/** @param {import("@minecraft/server").Dimension} dim */
async function buildAt(dim, job) {
  const tooClose = allCities().some((c) => c.dim === dim.id && Math.hypot(c.x - job.cx, c.z - job.cz) < SIZE + 20);
  if (tooClose) {
    tell(job.requester, "§cA city already exists here - try somewhere else.");
    return;
  }
  const result = await withArea(dim, job.cx, job.cz, async () => {
    const info = survey(dim, job.cx, job.cz);
    if (!info) return "unloaded";
    const spread = info.p90 - info.p10;
    if (!job.force && (info.water > 0.25 || spread > 18 || info.gy < 55)) return "unsuitable";
    const gy = clamp(info.gy, dim.heightRange.min + 20, 250);
    const city = {
      id: Date.now() % 100000000 + randInt(0, 999),
      name: newName(),
      x: job.cx,
      y: gy,
      z: job.cz,
      dim: dim.id,
      built: false,
      buildings: [],
      created: system.currentTick,
    };
    await runJobAsync(buildCity(dim, city, info));
    city.built = true;
    cities.push(city);
    saveCities();
    announceCity(city, job.requester);
    emit("city_built", city);
    return "ok";
  });
  if (result === "ok") return;
  if (result === "unsuitable" && job.attempts < 5) {
    const ang = Math.random() * Math.PI * 2;
    const d = 120 + job.attempts * 40;
    queue.unshift({ ...job, cx: Math.round(job.cx + Math.cos(ang) * d), cz: Math.round(job.cz + Math.sin(ang) * d), attempts: job.attempts + 1, force: job.attempts >= 4 });
    return;
  }
  if (result === undefined || result === "unloaded") {
    tell(job.requester, "§eThe city site is not loaded yet - the city will be built when you get closer.");
    pendingSites.push({ cx: job.cx, cz: job.cz, force: job.force });
  }
}

/** Sites that could not be loaded; retried when a player gets near. */
const pendingSites = [];

function tell(playerId, text) {
  if (!playerId) return;
  const p = players().find((pl) => pl.id === playerId);
  if (p) msg(p, text);
}

function announceCity(city, requesterId) {
  for (const p of players()) {
    if (p.dimension.id !== city.dim) continue;
    const d = Math.round(Math.hypot(p.location.x - city.x, p.location.z - city.z));
    if (d < 400 || p.id === requesterId) {
      msg(p, `§b» A city has risen: §f${city.name} §7at §f${city.x}, ${city.y + 1}, ${city.z} §7(${d}m away)`);
      msg(p, "§7  Citizens live there - keep them safe! Use the §eHero Emblem§7 to track the nearest city.");
    }
  }
}

// ---------------------------------------------------------------------------
// Builder (generator, run with system.runJob)
// ---------------------------------------------------------------------------
const STYLES = {
  tower: [
    { wall: "minecraft:light_gray_concrete", glass: "minecraft:light_blue_stained_glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:gray_concrete", glass: "minecraft:cyan_stained_glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:quartz_block", glass: "minecraft:light_blue_stained_glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:black_concrete", glass: "minecraft:gray_stained_glass", floor: "minecraft:polished_andesite" },
  ],
  office: [
    { wall: "minecraft:white_concrete", glass: "minecraft:glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:polished_andesite", glass: "minecraft:light_blue_stained_glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:smooth_sandstone", glass: "minecraft:glass", floor: "minecraft:smooth_stone" },
  ],
  apartment: [
    { wall: "minecraft:brick_block", glass: "minecraft:glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:white_terracotta", glass: "minecraft:glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:stone_bricks", glass: "minecraft:glass", floor: "minecraft:smooth_stone" },
  ],
  shops: [
    { wall: "minecraft:light_gray_terracotta", glass: "minecraft:glass", floor: "minecraft:smooth_stone" },
    { wall: "minecraft:brown_terracotta", glass: "minecraft:glass", floor: "minecraft:smooth_stone" },
  ],
  hospital: [{ wall: "minecraft:white_concrete", glass: "minecraft:light_blue_stained_glass", floor: "minecraft:smooth_stone" }],
};

const REPLACEABLE_BELOW = ["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:snow_layer", "minecraft:seagrass", "minecraft:kelp"];

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {City} city
 */
function* buildCity(dim, city, info) {
  const gy = city.y;
  const x0 = city.x - HALF;
  const z0 = city.z - HALF;
  const x1 = x0 + SIZE - 1;
  const z1 = z0 + SIZE - 1;
  const clearTop = Math.min(dim.heightRange.max - 1, gy + Math.max(44, info.max - gy + 12));

  // 1) clear the site (terrain, trees) and lay a foundation
  for (let x = x0 - 2; x <= x1 + 2; x += 16) {
    for (let z = z0 - 2; z <= z1 + 2; z += 16) {
      const xe = Math.min(x + 15, x1 + 2);
      const ze = Math.min(z + 15, z1 + 2);
      for (let y = gy + 1; y <= clearTop; y += 24) {
        fill(dim, { x, y, z }, { x: xe, y: Math.min(y + 23, clearTop), z: ze }, AIR);
        yield;
      }
      fill(dim, { x, y: gy - 14, z }, { x: xe, y: gy - 4, z: ze }, "minecraft:stone", REPLACEABLE_BELOW);
      fill(dim, { x, y: gy - 3, z }, { x: xe, y: gy - 1, z: ze }, "minecraft:dirt");
      fill(dim, { x, y: gy, z }, { x: xe, y: gy, z: ze }, "minecraft:smooth_stone");
      yield;
    }
  }
  // grass verge around the city
  fill(dim, { x: x0 - 2, y: gy, z: z0 - 2 }, { x: x1 + 2, y: gy, z: z0 - 1 }, "minecraft:grass_block");
  fill(dim, { x: x0 - 2, y: gy, z: z1 + 1 }, { x: x1 + 2, y: gy, z: z1 + 2 }, "minecraft:grass_block");
  fill(dim, { x: x0 - 2, y: gy, z: z0 }, { x: x0 - 1, y: gy, z: z1 }, "minecraft:grass_block");
  fill(dim, { x: x1 + 1, y: gy, z: z0 }, { x: x1 + 2, y: gy, z: z1 }, "minecraft:grass_block");
  yield;

  // 2) roads with lane markings and crosswalks
  for (let i = 0; i <= GRID; i++) {
    const o = i * (LOT + ROAD);
    fill(dim, { x: x0 + o, y: gy, z: z0 }, { x: x0 + o + ROAD - 1, y: gy, z: z1 }, "minecraft:gray_concrete");
    fill(dim, { x: x0, y: gy, z: z0 + o }, { x: x1, y: gy, z: z0 + o + ROAD - 1 }, "minecraft:gray_concrete");
    yield;
  }
  for (let i = 0; i <= GRID; i++) {
    const o = i * (LOT + ROAD) + 2;
    for (let t = 0; t < SIZE; t++) {
      const inIntersection = t % (LOT + ROAD) < ROAD;
      if (inIntersection) continue;
      if (Math.floor(t / 2) % 2 === 0) {
        setBlock(dim, { x: x0 + o, y: gy, z: z0 + t }, "minecraft:yellow_concrete");
        setBlock(dim, { x: x0 + t, y: gy, z: z0 + o }, "minecraft:yellow_concrete");
      }
    }
    yield;
  }
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const ix = x0 + i * (LOT + ROAD);
      const iz = z0 + j * (LOT + ROAD);
      for (let k = 0; k < ROAD; k += 2) {
        if (j < GRID) fill(dim, { x: ix + k, y: gy, z: iz + ROAD }, { x: ix + k, y: gy, z: iz + ROAD + 1 }, "minecraft:white_concrete");
        if (i < GRID) fill(dim, { x: ix + ROAD, y: gy, z: iz + k }, { x: ix + ROAD + 1, y: gy, z: iz + k }, "minecraft:white_concrete");
      }
    }
    yield;
  }

  // 3) lots
  const kinds = ["tower", "tower", "office", "office", "apartment", "apartment", "shops", "hospital"].sort(() => Math.random() - 0.5);
  let k = 0;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const lx = x0 + ROAD + i * (LOT + ROAD);
      const lz = z0 + ROAD + j * (LOT + ROAD);
      if (i === 1 && j === 1) {
        yield* buildPlaza(dim, lx, lz, gy);
        continue;
      }
      const kind = kinds[k++];
      const doorSide = j === 0 ? "south" : j === 2 ? "north" : i === 0 ? "east" : "west";
      if (kind === "shops") {
        for (const { bz, side } of [{ bz: lz + 2, side: "north" }, { bz: lz + 9, side: "south" }]) {
          const b = { x: lx + 2, z: bz, w: 13, d: 6, h: randInt(5, 7), type: "shops" };
          city.buildings.push(b);
          yield* buildBuilding(dim, b, gy, choice(STYLES.shops), side);
        }
      } else {
        const h = kind === "tower" ? randInt(26, 38) : kind === "office" ? randInt(14, 22) : kind === "apartment" ? randInt(10, 16) : 13;
        const b = { x: lx + 2, z: lz + 2, w: 13, d: 13, h, type: kind };
        city.buildings.push(b);
        yield* buildBuilding(dim, b, gy, choice(STYLES[kind]), doorSide);
      }
      // corner street lamps
      for (const [cx, cz] of [[lx, lz], [lx + LOT - 1, lz], [lx, lz + LOT - 1], [lx + LOT - 1, lz + LOT - 1]]) {
        lamp(dim, cx, gy, cz);
      }
      yield;
    }
  }

  // 4) invisible lights so monsters do not spawn on streets and roofs
  for (let x = x0; x <= x1; x += 7) {
    for (let z = z0; z <= z1; z += 7) {
      setIfAir(dim, { x, y: gy + 2, z }, LIGHT);
    }
    yield;
  }

  // 5) parked cars
  const colors = ["minecraft:red_concrete", "minecraft:blue_concrete", "minecraft:yellow_concrete", "minecraft:white_concrete",
    "minecraft:black_concrete", "minecraft:lime_concrete", "minecraft:orange_concrete"];
  for (let n = 0; n < 7; n++) {
    const road = randInt(0, GRID);
    const seg = randInt(0, GRID - 1);
    const along = ROAD + seg * (LOT + ROAD) + randInt(2, LOT - 7);
    const lane = road * (LOT + ROAD) + (Math.random() < 0.5 ? 0 : ROAD - 2);
    const color = choice(colors);
    if (Math.random() < 0.5) car(dim, x0 + lane, gy, z0 + along, color, true);
    else car(dim, x0 + along, gy, z0 + lane, color, false);
    yield;
  }

  // 6) citizens
  for (let n = 0; n < 12; n++) {
    spawnCivilian(dim, city, randomSidewalk(city));
    yield;
  }
}

/** @param {import("@minecraft/server").Dimension} dim */
function lamp(dim, x, gy, z) {
  fill(dim, { x, y: gy + 1, z }, { x, y: gy + 3, z }, "minecraft:iron_bars");
  setBlock(dim, { x, y: gy + 4, z }, "minecraft:sea_lantern");
}

/** @param {import("@minecraft/server").Dimension} dim */
function car(dim, x, gy, z, color, alongZ) {
  const L = 4;
  const a = { x, y: gy + 1, z };
  const b = alongZ ? { x: x + 1, y: gy + 1, z: z + L - 1 } : { x: x + L - 1, y: gy + 1, z: z + 1 };
  fill(dim, a, b, color);
  const c1 = alongZ ? { x, y: gy + 2, z: z + 1 } : { x: x + 1, y: gy + 2, z };
  const c2 = alongZ ? { x: x + 1, y: gy + 2, z: z + 2 } : { x: x + 2, y: gy + 2, z: z + 1 };
  fill(dim, c1, c2, "minecraft:black_stained_glass");
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {Building} b
 */
function* buildBuilding(dim, b, gy, style, doorSide) {
  const { x, z, w, d, h } = b;
  const xe = x + w - 1;
  const ze = z + d - 1;
  const top = gy + h;
  fill(dim, { x, y: gy + 1, z }, { x: xe, y: top, z: ze }, style.wall);
  yield;
  fill(dim, { x: x + 1, y: gy + 1, z: z + 1 }, { x: xe - 1, y: top - 1, z: ze - 1 }, AIR);
  yield;
  // storeys
  for (let fy = gy + 4; fy < top - 1; fy += 4) {
    fill(dim, { x: x + 1, y: fy, z: z + 1 }, { x: xe - 1, y: fy, z: ze - 1 }, style.floor);
  }
  for (let sy = gy + 1; sy < top - 1; sy += 4) {
    setBlock(dim, { x: x + (w >> 1), y: Math.min(sy + 1, top - 1), z: z + (d >> 1) }, LIGHT);
  }
  yield;
  // windows
  const faces = [
    { fixed: "z", at: z, from: x + 1, to: xe - 1 },
    { fixed: "z", at: ze, from: x + 1, to: xe - 1 },
    { fixed: "x", at: x, from: z + 1, to: ze - 1 },
    { fixed: "x", at: xe, from: z + 1, to: ze - 1 },
  ];
  const put = (face, t0, t1, y0, y1, block) => {
    if (face.fixed === "z") fill(dim, { x: t0, y: y0, z: face.at }, { x: t1, y: y1, z: face.at }, block);
    else fill(dim, { x: face.at, y: y0, z: t0 }, { x: face.at, y: y1, z: t1 }, block);
  };
  for (let sy = gy + 1; sy < top - 1; sy += 4) {
    for (const f of faces) {
      if (b.type === "tower") {
        put(f, f.from, f.to, sy, Math.min(sy + 2, top - 1), style.glass);
        for (let t = f.from + 3; t < f.to; t += 4) put(f, t, t, sy, Math.min(sy + 2, top - 1), style.wall);
      } else if (b.type === "office" || b.type === "hospital") {
        for (let t = f.from + 1; t <= f.to - 1; t += 2) put(f, t, t, sy + 1, Math.min(sy + 2, top - 1), style.glass);
      } else if (b.type === "apartment") {
        for (let t = f.from + 1; t <= f.to - 2; t += 4) put(f, t, t + 1, sy + 1, Math.min(sy + 2, top - 1), style.glass);
      } else if (sy === gy + 1) {
        put(f, f.from + 1, f.to - 1, sy, sy + 2, style.glass);
      }
    }
    yield;
  }
  // door
  const midX = x + (w >> 1);
  const midZ = z + (d >> 1);
  if (doorSide === "north") fill(dim, { x: midX - 1, y: gy + 1, z }, { x: midX, y: gy + 3, z }, AIR);
  else if (doorSide === "south") fill(dim, { x: midX - 1, y: gy + 1, z: ze }, { x: midX, y: gy + 3, z: ze }, AIR);
  else if (doorSide === "west") fill(dim, { x, y: gy + 1, z: midZ - 1 }, { x, y: gy + 3, z: midZ }, AIR);
  else fill(dim, { x: xe, y: gy + 1, z: midZ - 1 }, { x: xe, y: gy + 3, z: midZ }, AIR);
  // roof parapet
  fill(dim, { x, y: top + 1, z }, { x: xe, y: top + 1, z }, style.wall);
  fill(dim, { x, y: top + 1, z: ze }, { x: xe, y: top + 1, z: ze }, style.wall);
  fill(dim, { x, y: top + 1, z }, { x, y: top + 1, z: ze }, style.wall);
  fill(dim, { x: xe, y: top + 1, z }, { x: xe, y: top + 1, z: ze }, style.wall);
  setBlock(dim, { x: midX, y: top + 2, z: midZ }, LIGHT);
  yield;
  // rooftop details
  if (b.type === "tower") {
    if (Math.random() < 0.5) {
      fill(dim, { x: midX - 2, y: top, z: midZ - 2 }, { x: midX + 2, y: top, z: midZ + 2 }, "minecraft:gray_concrete");
      fill(dim, { x: midX - 1, y: top, z: midZ - 1 }, { x: midX - 1, y: top, z: midZ + 1 }, "minecraft:yellow_concrete");
      fill(dim, { x: midX + 1, y: top, z: midZ - 1 }, { x: midX + 1, y: top, z: midZ + 1 }, "minecraft:yellow_concrete");
      setBlock(dim, { x: midX, y: top, z: midZ }, "minecraft:yellow_concrete");
    } else {
      fill(dim, { x: midX, y: top + 1, z: midZ }, { x: midX, y: top + 5, z: midZ }, "minecraft:iron_bars");
      setBlock(dim, { x: midX, y: top + 6, z: midZ }, "minecraft:lightning_rod");
    }
  } else if (b.type === "apartment") {
    for (const [ax, az] of [[x + 2, z + 2], [x + 4, z + 2], [x + 2, z + 4], [x + 4, z + 4]]) {
      setBlock(dim, { x: ax, y: top + 1, z: az }, "minecraft:iron_bars");
    }
    fill(dim, { x: x + 2, y: top + 2, z: z + 2 }, { x: x + 4, y: top + 4, z: z + 4 }, "minecraft:spruce_planks");
    setBlock(dim, { x: x + 3, y: top + 5, z: z + 3 }, "minecraft:barrel");
  } else if (b.type === "office") {
    fill(dim, { x: midX - 1, y: top + 1, z: midZ - 1 }, { x: midX, y: top + 1, z: midZ }, "minecraft:iron_block");
  } else if (b.type === "hospital") {
    // red cross on every side
    for (const f of faces) {
      const mid = (f.from + f.to) >> 1;
      const cy = top - 3;
      put(f, mid - 2, mid + 2, cy, cy, "minecraft:red_concrete");
      put(f, mid, mid, cy - 2, cy + 2, "minecraft:red_concrete");
    }
    fill(dim, { x: midX - 2, y: top, z: midZ - 2 }, { x: midX + 2, y: top, z: midZ + 2 }, "minecraft:white_concrete");
    fill(dim, { x: midX - 2, y: top, z: midZ }, { x: midX + 2, y: top, z: midZ }, "minecraft:red_concrete");
    fill(dim, { x: midX, y: top, z: midZ - 2 }, { x: midX, y: top, z: midZ + 2 }, "minecraft:red_concrete");
  }
  yield;
}

/** @param {import("@minecraft/server").Dimension} dim */
function* buildPlaza(dim, lx, lz, gy) {
  const cx = lx + (LOT >> 1);
  const cz = lz + (LOT >> 1);
  fill(dim, { x: lx + 1, y: gy, z: lz + 1 }, { x: lx + LOT - 2, y: gy, z: lz + LOT - 2 }, "minecraft:grass_block");
  fill(dim, { x: cx - 1, y: gy, z: lz + 1 }, { x: cx + 1, y: gy, z: lz + LOT - 2 }, "minecraft:polished_andesite");
  fill(dim, { x: lx + 1, y: gy, z: cz - 1 }, { x: lx + LOT - 2, y: gy, z: cz + 1 }, "minecraft:polished_andesite");
  yield;
  // fountain
  fill(dim, { x: cx - 3, y: gy, z: cz - 3 }, { x: cx + 3, y: gy, z: cz + 3 }, "minecraft:quartz_block");
  fill(dim, { x: cx - 3, y: gy + 1, z: cz - 3 }, { x: cx + 3, y: gy + 1, z: cz + 3 }, "minecraft:smooth_quartz");
  fill(dim, { x: cx - 2, y: gy + 1, z: cz - 2 }, { x: cx + 2, y: gy + 1, z: cz + 2 }, "minecraft:water");
  fill(dim, { x: cx, y: gy + 1, z: cz }, { x: cx, y: gy + 4, z: cz }, "minecraft:quartz_pillar");
  setBlock(dim, { x: cx, y: gy + 5, z: cz }, "minecraft:gold_block");
  setBlock(dim, { x: cx, y: gy + 6, z: cz }, "minecraft:sea_lantern");
  yield;
  // trees
  for (const [tx, tz] of [[lx + 3, lz + 3], [lx + LOT - 4, lz + 3], [lx + 3, lz + LOT - 4], [lx + LOT - 4, lz + LOT - 4]]) {
    fill(dim, { x: tx, y: gy + 1, z: tz }, { x: tx, y: gy + 4, z: tz }, "minecraft:oak_log");
    fill(dim, { x: tx - 2, y: gy + 4, z: tz - 2 }, { x: tx + 2, y: gy + 5, z: tz + 2 }, "minecraft:oak_leaves", [AIR]);
    fill(dim, { x: tx - 1, y: gy + 6, z: tz - 1 }, { x: tx + 1, y: gy + 6, z: tz + 1 }, "minecraft:oak_leaves", [AIR]);
    yield;
  }
  // benches and lamps
  for (const [bx, bz] of [[cx - 5, cz - 3], [cx + 5, cz - 3], [cx - 5, cz + 3], [cx + 5, cz + 3]]) {
    setBlock(dim, { x: bx, y: gy + 1, z: bz }, "minecraft:oak_stairs");
  }
  for (const [px, pz] of [[lx + 1, lz + 1], [lx + LOT - 2, lz + 1], [lx + 1, lz + LOT - 2], [lx + LOT - 2, lz + LOT - 2]]) {
    lamp(dim, px, gy, pz);
  }
  yield;
}

// ---------------------------------------------------------------------------
// Citizens
// ---------------------------------------------------------------------------
/** A random walkable spot on a sidewalk or the plaza. @param {City} city */
export function randomSidewalk(city) {
  const x0 = city.x - HALF;
  const z0 = city.z - HALF;
  const i = randInt(0, GRID - 1);
  const j = randInt(0, GRID - 1);
  const lx = x0 + ROAD + i * (LOT + ROAD);
  const lz = z0 + ROAD + j * (LOT + ROAD);
  if (i === 1 && j === 1) {
    return { x: lx + randInt(2, LOT - 3) + 0.5, y: city.y + 1, z: lz + (Math.random() < 0.5 ? 2 : LOT - 3) + 0.5 };
  }
  const edge = randInt(0, 3);
  const t = randInt(0, LOT - 1);
  const pos = edge === 0 ? [lx + t, lz] : edge === 1 ? [lx + t, lz + LOT - 1] : edge === 2 ? [lx, lz + t] : [lx + LOT - 1, lz + t];
  return { x: pos[0] + 0.5, y: city.y + 1, z: pos[1] + 0.5 };
}

/** @param {import("@minecraft/server").Dimension} dim @param {City} city */
export function spawnCivilian(dim, city, loc) {
  const e = safe(() => dim.spawnEntity(ID.CIVILIAN, loc, { initialPersistence: true }));
  if (e) safe(() => e.addTag(`sh_city_${city.id}`));
  return e;
}

/** Top (roof surface y) of a building. */
export function roofY(city, b) {
  return city.y + b.h + 1;
}

// ---------------------------------------------------------------------------
// Ticking: city arrivals, exploration-based generation
// ---------------------------------------------------------------------------
const lastCheck = new Map();
const cityVisit = new Map();

/** Called every 20 ticks. */
export function tickCities(now) {
  if (!loaded) loadCities();
  for (const p of players()) {
    if (p.dimension.id !== "minecraft:overworld") continue;
    const inside = cityAt(p.location, p.dimension.id, 2);
    const prevId = cityVisit.get(p.id);
    if (inside && prevId !== inside.id) {
      showTitle(p, `§f${inside.name}`, "§7Population: busy citizens  -  keep them safe!", 50);
      particle(p.dimension, PARTICLE.HAPPY, p.location);
    }
    cityVisit.set(p.id, inside ? inside.id : undefined);

    // retry sites that were not loaded
    for (let i = pendingSites.length - 1; i >= 0; i--) {
      const s = pendingSites[i];
      if (Math.hypot(p.location.x - s.cx, p.location.z - s.cz) < 140) {
        pendingSites.splice(i, 1);
        requestCity(s.cx, s.cz, s.force);
      }
    }
  }
  if (now % 600 !== 0 || isBusy()) return;
  const auto = worldGet("auto_cities", 1);
  if (!auto) return;
  for (const p of players()) {
    if (p.dimension.id !== "minecraft:overworld") continue;
    const last = lastCheck.get(p.id) ?? 0;
    if (now - last < 600) continue;
    lastCheck.set(p.id, now);
    const near = nearestCity(p.location);
    if (near && near.distance < CITY_SPACING) continue;
    const top = safe(() => p.dimension.getTopmostBlock({ x: p.location.x, z: p.location.z }));
    if (top && p.location.y < top.location.y - 12) continue; // underground
    const dir = V.hlen(safeVel(p)) > 0.1 ? V.norm({ ...safeVel(p), y: 0 }) : V.norm({ ...p.getViewDirection(), y: 0 });
    const first = allCities().length === 0;
    const dist = first ? 150 : 220;
    requestCity(p.location.x + dir.x * dist + rand(-30, 30), p.location.z + dir.z * dist + rand(-30, 30), false, first ? p.id : undefined);
    return;
  }
}

function safeVel(p) {
  return safe(() => p.getVelocity(), { x: 0, y: 0, z: 0 });
}

/** Called when a player spawns for the first time in a world without cities. */
export function ensureFirstCity(player) {
  if (!loaded) loadCities();
  if (allCities().length > 0 || isBusy()) return;
  if (!worldGet("auto_cities", 1)) return;
  if (player.dimension.id !== "minecraft:overworld") return;
  const ang = Math.random() * Math.PI * 2;
  requestCity(player.location.x + Math.cos(ang) * 150, player.location.z + Math.sin(ang) * 150, false, player.id);
}

/** City Blueprint: build a city in front of the player. @param {import("@minecraft/server").Player} player */
export function blueprint(player) {
  if (player.dimension.id !== "minecraft:overworld") {
    msg(player, "§cCities can only be built in the Overworld.");
    return;
  }
  if (isBusy()) {
    msg(player, "§eA city is already under construction - please wait.");
    return;
  }
  const dir = V.norm({ ...player.getViewDirection(), y: 0 });
  const cx = player.location.x + dir.x * (HALF + 12);
  const cz = player.location.z + dir.z * (HALF + 12);
  msg(player, "§b» Construction crews are on their way... the city will rise in front of you.");
  requestCity(cx, cz, true, player.id);
}

export function removeCityRecord(id) {
  cities = allCities().filter((c) => c.id !== id);
  saveCities();
}

