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
};

export const SUPERVILLAINS = [ID.PYROCLAST, ID.VIRIDIAN, ID.RAMPAGER, ID.MECH];
