// Hero missions: long-term goals tracked from gameplay statistics.
// Rising: completing a mission gives XP. Unleashed: missions give titles and
// the final "Legend" mission unlocks a golden flight trail.
import { world } from "@minecraft/server";
import { EDITION } from "./config.js";
import { ICON, ID, PARTICLE, SOUND } from "./constants.js";
import { addXp } from "./leveling.js";
import { getJSON, setJSON } from "./store.js";
import { msg, particle, playerSound, safe, showTitle, sound, valid } from "./util.js";
import { on } from "./bus.js";

export const MISSIONS = [
  { id: "first_flight", name: "First Flight", desc: "Fly 200 blocks", key: "flown", goal: 200, xp: 50 },
  { id: "sound_barrier", name: "Sound Barrier", desc: "Break the sound barrier", key: "sonic", goal: 1, xp: 80 },
  { id: "firefighter", name: "Firefighter", desc: "Put out 25 fires", key: "fires", goal: 25, xp: 120 },
  { id: "guardian", name: "Guardian", desc: "Save 10 citizens", key: "saved", goal: 10, xp: 150 },
  { id: "safe_hands", name: "Safe Hands", desc: "Catch 3 falling citizens", key: "catches", goal: 3, xp: 120 },
  { id: "city_hero", name: "City Hero", desc: "Resolve 5 city emergencies", key: "emergencies", goal: 5, xp: 200 },
  { id: "crime_fighter", name: "Crime Fighter", desc: "Defeat 25 thugs", key: "thugs", goal: 25, xp: 150 },
  { id: "villain_hunter", name: "Villain Hunter", desc: "Defeat 3 supervillains", key: "supervillains", goal: 3, xp: 300 },
  { id: "nanotech", name: "Nanotech", desc: "Deploy the nano suit", key: "nano_deploys", goal: 1, xp: 50 },
  { id: "sharpshooter", name: "Sharpshooter", desc: "Hit 50 enemies with repulsors", key: "repulsor_hits", goal: 50, xp: 150 },
  { id: "heavy_hitter", name: "Heavy Hitter", desc: "Perform 10 ground slams", key: "slams", goal: 10, xp: 120 },
  { id: "meteor_hunter", name: "Meteor Hunter", desc: "Mine 10 cryptonite", key: "cryptonite_mined", goal: 10, xp: 100 },
  { id: "legend", name: "Legend", desc: "Complete every other mission", key: "missions_done", goal: 12, xp: 500 },
];

/** @param {import("@minecraft/server").Player} player */
function statsOf(player) {
  return getJSON(player, "stats", {});
}

/** @param {import("@minecraft/server").Player} player */
function doneOf(player) {
  return getJSON(player, "missions", {});
}

/** @param {import("@minecraft/server").Player} player */
export function isLegend(player) {
  return !!doneOf(player).legend;
}

/** Add to a statistic and complete missions that reach their goal. */
export function bump(player, key, amount = 1) {
  if (!valid(player)) return;
  const stats = statsOf(player);
  stats[key] = (stats[key] ?? 0) + amount;
  setJSON(player, "stats", stats);
  const done = doneOf(player);
  let changed = false;
  for (const m of MISSIONS) {
    if (done[m.id] || m.key !== key) continue;
    if (stats[key] >= m.goal) {
      done[m.id] = true;
      changed = true;
      complete(player, m);
    }
  }
  if (changed) {
    setJSON(player, "missions", done);
    const count = MISSIONS.filter((m) => m.id !== "legend" && done[m.id]).length;
    const prev = stats.missions_done ?? 0;
    if (count > prev) bump(player, "missions_done", count - prev);
  }
}

function complete(player, m) {
  showTitle(player, "§6§lMISSION COMPLETE", `§f${m.name}`, 50);
  playerSound(player, SOUND.RESCUE, 1, 1.2);
  sound(player.dimension, "random.levelup", player.location, 0.6, 1.4);
  particle(player.dimension, PARTICLE.TOTEM, player.location);
  msg(player, `§6${ICON.CHECK} Mission complete: §f${m.name} §7(${m.desc})`);
  if (EDITION.leveling) addXp(player, m.xp, `mission: ${m.name}`);
  if (m.id === "legend") msg(player, "§6You are a true LEGEND. §eYour flight now leaves a golden trail!");
}

/** Lines for the profile page. @param {import("@minecraft/server").Player} player */
export function missionLines(player) {
  const stats = statsOf(player);
  const done = doneOf(player);
  return MISSIONS.map((m) => {
    if (done[m.id]) return `§a${ICON.CHECK} ${m.name} §7- ${m.desc}`;
    const have = Math.min(m.goal, Math.floor(stats[m.key] ?? 0));
    return `§f- ${m.name} §7- ${m.desc} §8(${have}/${m.goal})`;
  });
}

on("stat", ({ player, key, amount }) => bump(player, key, amount ?? 1));
on("nano_deployed", (player) => bump(player, "nano_deploys", 1));
on("fire_out", ({ player }) => bump(player, "fires", 1));

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const id = safe(() => ev.brokenBlockPermutation.type.id);
  if (id === ID.ORE || id === ID.DEEP_ORE) bump(ev.player, "cryptonite_mined", 1);
});
