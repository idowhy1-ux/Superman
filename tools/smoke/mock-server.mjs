// A small in-memory imitation of the @minecraft/server API - just enough to
// execute the add-on's scripts in Node and catch runtime errors.
export const stats = { fills: 0, setBlocks: 0, particles: {}, sounds: 0, anims: [], knockbacks: 0, spawned: {}, commands: [], warnings: [] };

export const ButtonState = { Pressed: "Pressed", Released: "Released" };
export const InputButton = { Jump: "Jump", Sneak: "Sneak" };
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const ItemLockMode = { inventory: "inventory", none: "none", slot: "slot" };
export const GameMode = { Survival: "Survival", Creative: "Creative", Adventure: "Adventure", Spectator: "Spectator" };
export const Direction = { Up: "Up", Down: "Down", North: "North", South: "South", East: "East", West: "West" };
export const EntityDamageCause = new Proxy({}, { get: (_t, k) => String(k) });
export const EasingType = new Proxy({}, { get: (_t, k) => String(k) });

class Signal {
  constructor() { this.fns = []; }
  subscribe(fn) { this.fns.push(fn); return fn; }
  unsubscribe(fn) { this.fns = this.fns.filter((f) => f !== fn); }
  fire(ev) { for (const f of this.fns) f(ev); return ev; }
}
const signalBag = () => new Proxy({}, { get: (t, k) => (t[k] ??= new Signal()) });

export class MolangVariableMap {
  setColorRGB() {} setColorRGBA() {} setFloat() {} setSpeedAndDirection() {} setVector3() {}
}
export class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.keepOnDeath = false; this.lockMode = "none"; this.lore = []; }
  setLore(l) { this.lore = l; } getLore() { return this.lore; }
}
export class BlockVolume {
  constructor(from, to) { this.from = from; this.to = to; }
  getBlockLocationIterator() { return [][Symbol.iterator](); }
}
export const BlockPermutation = { resolve: (id, states = {}) => new Permutation(id, states) };
class Permutation {
  constructor(id, states) { this.type = { id }; this.states = { ...states }; }
  getState(k) { return this.states[k]; }
  withState(k, v) { return new Permutation(this.type.id, { ...this.states, [k]: v }); }
}

// --- world storage -------------------------------------------------------------
const blocks = new Map(); // "x,y,z" -> id
const key = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;
const GROUND = 63;
function blockIdAt(l) {
  const k = key(l);
  if (blocks.has(k)) return blocks.get(k);
  return Math.floor(l.y) <= GROUND ? (Math.floor(l.y) === GROUND ? "minecraft:grass_block" : "minecraft:stone") : "minecraft:air";
}

class Block {
  constructor(dim, loc) { this.dimension = dim; this.location = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) }; }
  get typeId() { return blockIdAt(this.location); }
  get isAir() { return this.typeId === "minecraft:air"; }
  get isLiquid() { return this.typeId.includes("water") || this.typeId.includes("lava"); }
  get isValid() { return true; }
  get permutation() { return new Permutation(this.typeId, {}); }
  setType(id) { stats.setBlocks++; blocks.set(key(this.location), typeof id === "string" ? id : id.id); }
  setPermutation(p) { blocks.set(key(this.location), p.type.id); }
  below(n = 1) { return new Block(this.dimension, { ...this.location, y: this.location.y - n }); }
  above(n = 1) { return new Block(this.dimension, { ...this.location, y: this.location.y + n }); }
}

let entitySeq = 1;
export const entities = new Map();

class Entity {
  constructor(typeId, dim, loc) {
    this.typeId = typeId;
    this.id = String(entitySeq++);
    this.dimension = dim;
    this.location = { ...loc };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.tags = new Set();
    this.props = {};
    this.nameTag = "";
    this.effects = new Map();
    this.dyn = new Map();
    this.health = 20;
    this.isValid = true;
    this.isOnGround = loc.y <= GROUND + 1.01;
    this.isSneaking = false;
    this.isInWater = false;
    this.isFalling = false;
    entities.set(this.id, this);
  }
  getComponent(name) {
    const self = this;
    if (name === "minecraft:health") return { currentValue: self.health, effectiveMax: 20, setCurrentValue(v) { self.health = v; } };
    if (name === "minecraft:type_family") {
      const fam = { "superhuman:civilian": ["civilian", "mob"], "superhuman:thug": ["thug", "villain", "monster", "mob"] }[self.typeId] ??
        (self.typeId.startsWith("superhuman:") ? ["villain", "supervillain", "monster", "mob"] : ["mob"]);
      return { hasTypeFamily: (f) => fam.includes(f) };
    }
    if (name === "minecraft:projectile") return { shoot(v) { self.velocity = v; } };
    if (name === "minecraft:item") return undefined;
    if (name === "minecraft:equippable") return { getEquipment: () => undefined };
    if (name === "minecraft:riding") return undefined;
    return undefined;
  }
  addTag(t) { this.tags.add(t); return true; } removeTag(t) { return this.tags.delete(t); } hasTag(t) { return this.tags.has(t); }
  setProperty(k, v) { this.props[k] = v; } getProperty(k) { return this.props[k]; }
  triggerEvent(e) { this.lastEvent = e; }
  teleport(loc) { this.location = { ...loc }; }
  applyImpulse(v) { this.velocity = v; }
  applyKnockback(h, v) { stats.knockbacks++; this.velocity = { x: h.x, y: v, z: h.z }; }
  clearVelocity() { this.velocity = { x: 0, y: 0, z: 0 }; }
  getVelocity() { return { ...this.velocity }; }
  applyDamage(n) { this.health -= n; if (this.health <= 0) this.kill(); return true; }
  kill() { this.isValid = false; entities.delete(this.id); }
  remove() { this.isValid = false; entities.delete(this.id); }
  addEffect(t, d, o = {}) { this.effects.set(String(t), { typeId: String(t), duration: d, amplifier: o.amplifier ?? 0 }); }
  removeEffect(t) { return this.effects.delete(String(t)); }
  getEffect(t) { return this.effects.get(String(t)); }
  setOnFire() { return true; } extinguishFire() { return true; }
  playAnimation(a, o) { stats.anims.push(a); }
  getDynamicProperty(k) { return this.dyn.get(k); } setDynamicProperty(k, v) { this.dyn.set(k, v); }
  getHeadLocation() { return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z }; }
  getViewDirection() { return this.view ?? { x: 0, y: 0, z: 1 }; }
  getRotation() { return { x: 0, y: 0 }; }
  runCommand(c) { stats.commands.push(c); return { successCount: 1 }; }
  matches() { return true; }
}

class Player extends Entity {
  constructor(dim, loc) {
    super("minecraft:player", dim, loc);
    this.name = "Hero";
    this.chest = undefined;
    this.main = undefined;
    this.inv = new Array(36).fill(undefined);
    this.move = { x: 0, y: 0 };
    this.buttons = { Jump: "Released", Sneak: "Released" };
    this.isSprinting = false;
    this.isJumping = false;
    this.isFlying = false;
    this.isGliding = false;
    this.messages = [];
    this.actionbar = "";
    this.mode = "Survival";
    const self = this;
    this.inputInfo = { getMovementVector: () => self.move, getButtonState: (b) => self.buttons[b] };
    this.onScreenDisplay = { setActionBar(t) { self.actionbar = t; }, setTitle(t) { self.lastTitle = t; }, updateSubtitle() {} };
    this.camera = { fade() {}, setFov() {}, clear() {} };
  }
  getComponent(name) {
    const self = this;
    if (name === "minecraft:equippable") {
      return {
        getEquipment: (slot) => (slot === "Chest" ? self.chest : slot === "Mainhand" ? self.main : undefined),
        setEquipment: (slot, item) => { if (slot === "Chest") self.chest = item; else self.main = item; },
      };
    }
    if (name === "minecraft:inventory") {
      return {
        container: {
          size: 36,
          getItem: (i) => self.inv[i],
          setItem: (i, it) => { self.inv[i] = it; },
          addItem: (it) => { const i = self.inv.findIndex((x) => !x); if (i < 0) return it; self.inv[i] = it; return undefined; },
        },
      };
    }
    return super.getComponent(name);
  }
  getGameMode() { return this.mode; }
  sendMessage(m) { this.messages.push(String(m)); }
  playSound() { stats.sounds++; }
}

class Dimension {
  constructor(id) { this.id = id; this.heightRange = { min: -64, max: 320 }; }
  getBlock(l) { return new Block(this, l); }
  getBlocks() { return new BlockVolume({}, {}); }
  getTopmostBlock({ x, z }) {
    for (let y = 120; y > -64; y--) if (blockIdAt({ x, y, z }) !== "minecraft:air") return new Block(this, { x, y, z });
    return undefined;
  }
  getBlockFromRay(loc, dir, opts = {}) {
    const max = opts.maxDistance ?? 64;
    for (let d = 0; d <= max; d += 0.25) {
      const p = { x: loc.x + dir.x * d, y: loc.y + dir.y * d, z: loc.z + dir.z * d };
      const id = blockIdAt(p);
      if (id !== "minecraft:air" && !id.startsWith("minecraft:light_block")) {
        const b = new Block(this, p);
        return { block: b, face: dir.y < 0 ? "Up" : "North", faceLocation: { x: 0.5, y: dir.y < 0 ? 1 : 0.5, z: 0.5 } };
      }
    }
    return undefined;
  }
  getEntities(opts = {}) {
    return [...entities.values()].filter((e) => e.dimension === this && e.isValid &&
      (!opts.type || e.typeId === opts.type) &&
      (!opts.excludeTypes || !opts.excludeTypes.includes(e.typeId)) &&
      (!opts.location || Math.hypot(e.location.x - opts.location.x, e.location.y - opts.location.y, e.location.z - opts.location.z) <= (opts.maxDistance ?? 1e9)));
  }
  getPlayers(opts = {}) { return this.getEntities(opts).filter((e) => e.typeId === "minecraft:player"); }
  getEntitiesFromRay() { return []; }
  spawnEntity(id, loc, opts) {
    stats.spawned[id] = (stats.spawned[id] ?? 0) + 1;
    const e = new Entity(id, this, loc);
    return e;
  }
  spawnItem(item, loc) { return new Entity("minecraft:item", this, loc); }
  spawnParticle(id) { stats.particles[id] = (stats.particles[id] ?? 0) + 1; }
  playSound() { stats.sounds++; }
  fillBlocks(vol, block, opts = {}) {
    stats.fills++;
    const { from, to } = vol;
    const n = (Math.abs(to.x - from.x) + 1) * (Math.abs(to.y - from.y) + 1) * (Math.abs(to.z - from.z) + 1);
    if (n > 40000) throw new Error(`fill too large: ${n}`);
    const id = typeof block === "string" ? block : block.id;
    if (n <= 4096) {
      for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++)
        for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++)
          for (let z = Math.min(from.z, to.z); z <= Math.max(from.z, to.z); z++) {
            const cur = blockIdAt({ x, y, z });
            if (opts.blockFilter?.includeTypes && !opts.blockFilter.includeTypes.includes(cur)) continue;
            blocks.set(`${x},${y},${z}`, id);
          }
    }
    return new BlockVolume(from, to);
  }
  setBlockType(loc, id) { stats.setBlocks++; blocks.set(key(loc), id); }
  setBlockPermutation(loc, p) { blocks.set(key(loc), p.type.id); }
  createExplosion() { return true; }
  isChunkLoaded() { return true; }
  getSkyLightLevel() { return 15; }
  runCommand(c) { stats.commands.push(c); return { successCount: 1 }; }
}

const overworld = new Dimension("minecraft:overworld");
const worldDyn = new Map();
let tick = 0;
const intervals = [];
const timeouts = [];
const jobs = [];

export const system = {
  get currentTick() { return tick; },
  runInterval(fn, every = 1) { intervals.push({ fn, every }); return intervals.length; },
  runTimeout(fn, delay = 1) { timeouts.push({ fn, at: tick + delay }); return timeouts.length; },
  run(fn) { timeouts.push({ fn, at: tick + 1 }); return timeouts.length; },
  runJob(gen) { jobs.push(gen); return jobs.length; },
  clearRun() {},
  afterEvents: signalBag(),
  beforeEvents: signalBag(),
};

export const world = {
  afterEvents: signalBag(),
  beforeEvents: signalBag(),
  gameRules: { mobGriefing: true, doFireTick: true },
  getAllPlayers: () => [...entities.values()].filter((e) => e.typeId === "minecraft:player" && e.isValid),
  getDimension: () => overworld,
  getEntity: (id) => entities.get(id),
  getDynamicProperty: (k) => worldDyn.get(k),
  setDynamicProperty: (k, v) => worldDyn.set(k, v),
  getTimeOfDay: () => 6000,
  sendMessage: () => {},
  tickingAreaManager: {
    hasCapacity: () => true,
    createTickingArea: async () => {},
    removeTickingArea: () => {},
    getAllTickingAreas: () => [],
  },
};

globalThis.console.warn = (...a) => { stats.warnings.push(a.join(" ")); };

export function makePlayer(loc = { x: 0, y: GROUND + 1, z: 0 }) {
  return new Player(overworld, loc);
}
export function getBlockId(l) { return blockIdAt(l); }
export function setBlockId(l, id) { blocks.set(key(l), id); }

/** Advance the simulation. `physics(player)` lets the test move players. */
export async function step(n = 1, physics) {
  for (let i = 0; i < n; i++) {
    tick++;
    for (const p of world.getAllPlayers()) physics?.(p);
    for (const iv of intervals) if (tick % iv.every === 0) iv.fn();
    for (const t of timeouts.splice(0).filter((t) => { if (t.at > tick) { timeouts.push(t); return false; } return true; })) t.fn();
    for (let j = 0; j < jobs.length; j++) {
      const g = jobs[j];
      for (let k = 0; k < 200; k++) {
        const r = g.next();
        if (r.done) { jobs.splice(j--, 1); break; }
      }
    }
    await Promise.resolve();
  }
}
