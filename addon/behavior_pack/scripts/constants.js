// Shared identifiers and tuning values.

export const ID = {
  SUIT: "superhuman:hero_suit",
  HEAT: "superhuman:heat_vision",
  FREEZE: "superhuman:freeze_breath",
  XRAY: "superhuman:xray_vision",
  FLARE: "superhuman:solar_flare",
  EMBLEM: "superhuman:hero_emblem",
  SHARD: "superhuman:cryptonite_shard",
  SWORD: "superhuman:cryptonite_sword",
  BLUEPRINT: "superhuman:city_blueprint",
  ORE: "superhuman:cryptonite_ore",
  DEEP_ORE: "superhuman:deepslate_cryptonite_ore",
  CRYPTO_BLOCK: "superhuman:cryptonite_block",
  CIVILIAN: "superhuman:civilian",
  THUG: "superhuman:thug",
  PYROCLAST: "superhuman:pyroclast",
  VIRIDIAN: "superhuman:viridian",
  RAMPAGER: "superhuman:rampager",
  MECH: "superhuman:omega_mech",
  BOLT: "superhuman:cryptonite_bolt",
  MISSILE: "superhuman:mech_missile",
  METEOR: "superhuman:cryptonite_meteor",
  // Iron nanotech armor
  NANO_CORE: "superhuman:nano_core",
  NANO_SUIT: "superhuman:nano_suit",
  NANO_RETRACT: "superhuman:nano_suit_retract",
  NANO_MISSILE: "superhuman:nano_missile",
  GLACIUS: "superhuman:glacius",
  VOLT: "superhuman:volt",
  ICE_SHARD: "superhuman:ice_shard",
};

/** Items that count as "wearing a hero suit" and which hero they make you. */
export const SUIT_MODES = {
  [ID.SUIT]: "super",
  [ID.NANO_SUIT]: "iron",
};

export const CRYPTONITE_ITEMS = [ID.SHARD, ID.SWORD, ID.ORE, ID.DEEP_ORE, ID.CRYPTO_BLOCK];
export const CRYPTONITE_BLOCKS = [ID.ORE, ID.DEEP_ORE, ID.CRYPTO_BLOCK];

export const PARTICLE = {
  HEAT_BEAM: "superhuman:heat_beam_particle",
  HEAT_IMPACT: "superhuman:heat_impact_particle",
  FREEZE: "superhuman:freeze_breath_particle",
  FROST: "superhuman:frost_particle",
  STEAM: "superhuman:steam_particle",
  XRAY: "superhuman:xray_marker_particle",
  SONIC: "superhuman:sonic_boom_particle",
  SHOCKWAVE: "superhuman:shockwave_particle",
  WIND: "superhuman:wind_trail_particle",
  AURA: "superhuman:power_aura_particle",
  LEVEL_RING: "superhuman:level_ring_particle",
  FLARE: "superhuman:solar_flare_particle",
  CRYPTO_GLOW: "superhuman:cryptonite_glow_particle",
  SMOKE: "superhuman:smoke_column_particle",
  METEOR_TRAIL: "superhuman:meteor_trail_particle",
  PUNCH: "superhuman:punch_burst_particle",
  THRUSTER: "superhuman:thruster_flame_particle",
  NANO: "superhuman:nano_swarm_particle",
  SHIELD: "superhuman:nano_shield_particle",
  MISSILE_TRAIL: "superhuman:missile_trail_particle",
  REPULSOR_IMPACT: "superhuman:repulsor_impact_particle",
  BLADE: "superhuman:nano_blade_particle",
  SIGNAL: "superhuman:signal_beam_particle",
  SPARK: "superhuman:spark_particle",
  // vanilla
  HEART: "minecraft:heart_particle",
  HAPPY: "minecraft:villager_happy",
  TOTEM: "minecraft:totem_particle",
  EXPLOSION: "minecraft:huge_explosion_emitter",
  FLAME: "minecraft:basic_flame_particle",
};

export const SOUND = {
  HEAT: "superhuman.heat_vision",
  FREEZE: "superhuman.freeze_breath",
  SONIC: "superhuman.sonic_boom",
  WHOOSH: "superhuman.whoosh",
  LEVEL_UP: "superhuman.level_up",
  SUIT_UP: "superhuman.suit_up",
  CHARGE: "superhuman.power_charge",
  FLARE: "superhuman.solar_flare",
  SLAM: "superhuman.ground_slam",
  CRYPTO: "superhuman.cryptonite_hum",
  RESCUE: "superhuman.rescue",
  XRAY: "superhuman.xray",
  LASER: "superhuman.mech_laser",
  NANO_ON: "superhuman.nano_assemble",
  NANO_OFF: "superhuman.nano_retract",
  REPULSOR: "superhuman.repulsor",
  MISSILES: "superhuman.missile_launch",
  UNIBEAM: "superhuman.unibeam",
  SHIELD: "superhuman.shield_up",
  JET: "superhuman.jet",
  VERA: "superhuman.vera",
  CLAP: "superhuman.thunder_clap",
  CLICK: "superhuman.ui_click",
  ZAP: "superhuman.zap",
  EMP: "superhuman.emp",
};

export const ANIM = {
  HOVER: "animation.superhuman.player.hover",
  HOVER_CARRY: "animation.superhuman.player.hover_carry",
  FLY: "animation.superhuman.player.fly",
  FLY_FAST: "animation.superhuman.player.fly_fast",
  FLY_CARRY: "animation.superhuman.player.fly_carry",
  TAKEOFF: "animation.superhuman.player.takeoff",
  LAND: "animation.superhuman.player.land",
  HEAT: "animation.superhuman.player.heat_vision",
  FREEZE: "animation.superhuman.player.freeze_breath",
  PUNCH: "animation.superhuman.player.punch",
  LEVEL_UP: "animation.superhuman.player.level_up",
  SUIT_UP: "animation.superhuman.player.suit_up",
  WEAKENED: "animation.superhuman.player.weakened",
  FLARE: "animation.superhuman.player.solar_flare",
  NONE: "animation.superhuman.player.none",
  // iron suit poses / actions
  IRON_HOVER: "animation.superhuman.player.iron_hover",
  IRON_FLY: "animation.superhuman.player.iron_fly",
  IRON_FLY_FAST: "animation.superhuman.player.iron_fly_fast",
  IRON_ASSEMBLE: "animation.superhuman.player.nano_assemble",
  REPULSOR: "animation.superhuman.player.repulsor",
  UNIBEAM: "animation.superhuman.player.unibeam",
  MISSILES: "animation.superhuman.player.missiles",
  SHIELD: "animation.superhuman.player.shield",
  BLADE: "animation.superhuman.player.blade",
  CLAP: "animation.superhuman.player.clap",
  // mobs
  RAMPAGER_POUND: "animation.superhuman.rampager.ground_pound",
  RAMPAGER_ROAR: "animation.superhuman.rampager.roar",
  MECH_LASER: "animation.superhuman.mech.laser_charge",
  MECH_STOMP: "animation.superhuman.mech.stomp",
  VILLAIN_TAUNT: "animation.superhuman.villain.taunt",
  VILLAIN_BLAST: "animation.superhuman.villain.blast",
};

// Ores highlighted by X-Ray Vision, with marker colors (0..1 RGB).
export const XRAY_ORES = {
  "minecraft:coal_ore": [0.35, 0.35, 0.35],
  "minecraft:deepslate_coal_ore": [0.35, 0.35, 0.35],
  "minecraft:iron_ore": [0.85, 0.65, 0.5],
  "minecraft:deepslate_iron_ore": [0.85, 0.65, 0.5],
  "minecraft:copper_ore": [0.9, 0.5, 0.3],
  "minecraft:deepslate_copper_ore": [0.9, 0.5, 0.3],
  "minecraft:gold_ore": [1.0, 0.85, 0.1],
  "minecraft:deepslate_gold_ore": [1.0, 0.85, 0.1],
  "minecraft:nether_gold_ore": [1.0, 0.85, 0.1],
  "minecraft:redstone_ore": [1.0, 0.1, 0.1],
  "minecraft:lit_redstone_ore": [1.0, 0.1, 0.1],
  "minecraft:deepslate_redstone_ore": [1.0, 0.1, 0.1],
  "minecraft:lit_deepslate_redstone_ore": [1.0, 0.1, 0.1],
  "minecraft:lapis_ore": [0.15, 0.3, 1.0],
  "minecraft:deepslate_lapis_ore": [0.15, 0.3, 1.0],
  "minecraft:emerald_ore": [0.1, 1.0, 0.4],
  "minecraft:deepslate_emerald_ore": [0.1, 1.0, 0.4],
  "minecraft:diamond_ore": [0.3, 1.0, 1.0],
  "minecraft:deepslate_diamond_ore": [0.3, 1.0, 1.0],
  "minecraft:ancient_debris": [0.6, 0.35, 0.25],
  "minecraft:quartz_ore": [1.0, 1.0, 0.95],
  "superhuman:cryptonite_ore": [0.2, 1.0, 0.2],
  "superhuman:deepslate_cryptonite_ore": [0.2, 1.0, 0.2],
};

export const TICKS_PER_SECOND = 20;

// Villain catalogue used by events, spawns and XP rewards.
export const VILLAINS = {
  [ID.THUG]: { name: "Thug", xp: 20, minLevel: 1 },
  [ID.PYROCLAST]: { name: "Pyroclast", xp: 180, minLevel: 4 },
  [ID.VIRIDIAN]: { name: "Viridian", xp: 200, minLevel: 5 },
  [ID.RAMPAGER]: { name: "Rampager", xp: 300, minLevel: 8 },
  [ID.MECH]: { name: "Omega Mech", xp: 300, minLevel: 8 },
  [ID.GLACIUS]: { name: "Glacius", xp: 220, minLevel: 6 },
  [ID.VOLT]: { name: "Volt", xp: 240, minLevel: 6 },
};

export const SUPERVILLAINS = [ID.PYROCLAST, ID.VIRIDIAN, ID.RAMPAGER, ID.MECH, ID.GLACIUS, ID.VOLT];

// ---------------------------------------------------------------------------
// HUD glyphs: resource_pack/font/glyph_E5.png maps U+E500..U+E5FF to icons.
// Row r, column c -> U+E5rc. Abilities have 3 variants: normal / selected / locked.
// ---------------------------------------------------------------------------
export const GLYPH_PAGE = 0xe500;
/** @param {number} row @param {number} col */
export function glyph(row, col) {
  return String.fromCharCode(GLYPH_PAGE + row * 16 + col);
}
export const ICON = {
  SUN: glyph(6, 0),
  BOLT: glyph(6, 1),
  STAR: glyph(6, 2),
  SHIELD: glyph(6, 3),
  SPEED: glyph(6, 4),
  WARN: glyph(6, 5),
  CRYPTO: glyph(6, 6),
  CITIZEN: glyph(6, 7),
  VILLAIN: glyph(6, 8),
  FIRE: glyph(6, 9),
  ATTACK: glyph(6, 10),
  SNEAK: glyph(6, 11),
  JUMP: glyph(6, 12),
  CITY: glyph(6, 13),
  HEART: glyph(6, 14),
  CHECK: glyph(6, 15),
};
