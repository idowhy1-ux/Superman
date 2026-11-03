// Cryptonite: the hero's weakness. Exposure comes from ore/blocks nearby,
// dropped or held cryptonite items, Viridian, cryptonite bolts and meteors.
//   0 < exposure < 1  -> weakened: half-speed flight, no boost, weaker hits
//   exposure >= 1     -> critical: no powers, cannot fly, takes damage
import { BlockVolume, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { ANIM, CRYPTONITE_BLOCKS, CRYPTONITE_ITEMS, ID, PARTICLE, SOUND } from "./constants.js";
import { flash } from "./leveling.js";
import { state } from "./store.js";
import { V, cameraFade, hasFamily, msg, particle, playerSound, safe, showTitle } from "./util.js";
import { playAction, stopAction } from "./anim.js";
import { heldItemId } from "./suit.js";

const ITEM_SET = new Set(CRYPTONITE_ITEMS);

/** @param {import("@minecraft/server").Player} player */
function inventoryExposure(player) {
  let e = 0;
  const main = heldItemId(player, EquipmentSlot.Mainhand);
  const off = heldItemId(player, EquipmentSlot.Offhand);
  if (ITEM_SET.has(main) || ITEM_SET.has(off)) e += 1.5;
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const id = safe(() => inv.getItem(i)?.typeId);
      if (id && ITEM_SET.has(id)) {
        e += 0.45;
        break;
      }
    }
  }
  return e;
}

/** @param {import("@minecraft/server").Player} player */
function measure(player) {
  const dim = player.dimension;
  const loc = player.location;
  let exposure = inventoryExposure(player);
  const R = 5;
  const range = dim.heightRange;
  const from = { x: Math.floor(loc.x - R), y: Math.max(range.min, Math.floor(loc.y - R)), z: Math.floor(loc.z - R) };
  const to = { x: Math.floor(loc.x + R), y: Math.min(range.max - 1, Math.floor(loc.y + R + 1)), z: Math.floor(loc.z + R) };
  const list = safe(() => dim.getBlocks(new BlockVolume(from, to), { includeTypes: CRYPTONITE_BLOCKS }, true));
  if (list) {
    let n = 0;
    for (const b of list.getBlockLocationIterator()) {
      if (n++ > 40) break;
      const d = V.dist(V.center(b), { x: loc.x, y: loc.y + 1, z: loc.z });
      const block = safe(() => dim.getBlock(b));
      const w = block?.typeId === ID.CRYPTO_BLOCK ? 1.3 : 0.75;
      exposure += w * Math.max(0, 1 - d / (R + 1));
    }
  }
  for (const e of safe(() => dim.getEntities({ location: loc, maxDistance: 9 }), [])) {
    if (e.id === player.id) continue;
    const d = V.dist(e.location, loc);
    if (e.typeId === "minecraft:item") {
      const item = safe(() => e.getComponent("minecraft:item")?.itemStack);
      if (item && ITEM_SET.has(item.typeId)) exposure += Math.min(2, 0.5 + item.amount * 0.1) * Math.max(0, 1 - d / 6);
    } else if (hasFamily(e, "cryptonite_source")) {
      exposure += 1.3 * Math.max(0, 1 - d / 9);
    } else if (d < 5) {
      const held = heldItemId(e, EquipmentSlot.Mainhand);
      if (held && ITEM_SET.has(held)) exposure += 1.1 * Math.max(0, 1 - d / 5);
    }
  }
  return exposure;
}

/**
 * Called every 10 ticks for suited players.
 * @param {import("@minecraft/server").Player} player
 */
export function tickCryptonite(player, now) {
  const st = state(player);
  if (st.mode !== "super") {
    if (st.krypto > 0) {
      st.krypto = 0;
      st.kryptoWarned = false;
      stopAction(player);
    }
    return;
  }
  let exposure = measure(player);
  if (now < st.poisonUntil) exposure = Math.max(exposure, 1.05);
  const prev = st.krypto;
  st.krypto = exposure < 0.08 ? 0 : exposure;

  if (st.krypto > 0) {
    const critical = st.krypto >= 1;
    safe(() => player.addEffect("weakness", 40, { amplifier: critical ? 1 : 0, showParticles: false }));
    safe(() => player.addEffect("slowness", 40, { amplifier: critical ? 1 : 0, showParticles: false }));
    if (critical) {
      safe(() => player.addEffect("mining_fatigue", 40, { amplifier: 1, showParticles: false }));
      if (st.krypto >= 1.8) safe(() => player.addEffect("nausea", 120, { amplifier: 0, showParticles: false }));
      if (now % 40 === 0) safe(() => player.applyDamage(1, { cause: EntityDamageCause.magic }));
    }
    particle(player.dimension, PARTICLE.CRYPTO_GLOW, { x: player.location.x, y: player.location.y + 1, z: player.location.z });
    if (!st.kryptoWarned) {
      st.kryptoWarned = true;
      showTitle(player, "§a§lCRYPTONITE!", critical ? "§cYour powers are gone - get away from it!" : "§eYou feel weak...", 40);
      cameraFade(player, 60, 255, 90, 0.1, 0.1, 0.8);
      playerSound(player, SOUND.CRYPTO, 1, 1);
    }
    if (!st.flying && !st.heatActive && !st.freezeActive) playAction(player, ANIM.WEAKENED);
    if (now % 60 === 0) playerSound(player, SOUND.CRYPTO, 0.5, 0.9);
  } else if (prev > 0) {
    st.kryptoWarned = false;
    if (st.action === ANIM.WEAKENED) stopAction(player);
    msg(player, "§aThe cryptonite's effect fades. Your powers return!");
    flash(player, "§aPowers restored");
  }
}
