// Action-bar HUD and the Hero Emblem menu.
import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { EDITION } from "./config.js";
import { MAX_LEVEL, POWERS, getLevel, getXp, hasPower, setLevel, stats, xpToNext } from "./leveling.js";
import { DEFAULT_SETTINGS, getNum, setJSON, setNum, settings, state, worldGet, worldSet } from "./store.js";
import { V, arrowTo, bar, isCreative, msg, safe, showTitle } from "./util.js";
import { givePowerItems, tutorial } from "./suit.js";
import { dangerTarget, forceEvent } from "./rescue.js";
import { blueprint, nearestCity } from "./cities.js";
import { launchMeteor, spawnSupervillainNear } from "./villains.js";
import { ID } from "./constants.js";

/** @param {import("@minecraft/server").Player} player */
export function tickHud(player, now) {
  const st = state(player);
  const extra = now < st.hudExtraUntil ? st.hudExtra : "";
  if (!st.suited) {
    if (extra) safe(() => player.onScreenDisplay.setActionBar(extra));
    return;
  }
  if (!settings(player).hud) {
    if (extra) safe(() => player.onScreenDisplay.setActionBar(extra));
    return;
  }
  const s = stats(player);
  const parts = [];
  if (EDITION.leveling) {
    const L = s.level;
    parts.push(L >= MAX_LEVEL ? `§6§lLV ${L} §r§6MAX` : `§6§lLV ${L}§r ${bar(getXp(player) / xpToNext(L), 10, "§a", "§8")}`);
  } else {
    parts.push("§c§lUNLEASHED§r");
  }
  parts.push(`${st.inSun ? "§e" : "§6"}SUN ${bar(st.energy / s.maxEnergy, 10, st.inSun ? "§e" : "§6", "§8")}`);
  if (st.flying || st.creativeFlight) {
    const kmh = Math.round(V.len(st.vmeas) * 20 * 3.6);
    parts.push(`${st.sonic ? "§f§l" : st.boost ? "§b" : "§f"}${kmh} km/h`);
  }
  if (st.krypto > 0) parts.push(st.krypto >= 1 ? "§2§lCRYPTONITE!" : "§aweakened");
  let line2 = extra;
  if (!line2 && st.carrying) line2 = "§bCarrying a citizen §7- land and sneak to set them down";
  if (!line2 && st.xray) line2 = st.xraySummary || "§aX-RAY";
  if (!line2) {
    const d = dangerTarget(player);
    if (d) {
      const tag = hasPower(player, "hearing") ? "§cSuper Hearing:" : "§c!";
      line2 = `${tag} §fcry for help ${arrowTo(player, d.entity.location)} ${Math.round(d.distance)}m`;
    }
  }
  safe(() => player.onScreenDisplay.setActionBar(parts.join(" §8| ") + (line2 ? "\n" + line2 : "")));
}

// ---------------------------------------------------------------------------
// Hero menu
// ---------------------------------------------------------------------------
/** @param {import("@minecraft/server").Player} player */
export async function openMenu(player) {
  const st = state(player);
  const s = stats(player);
  const lines = [`§l${EDITION.name}§r`];
  if (EDITION.leveling) {
    const L = getLevel(player);
    lines.push(L >= MAX_LEVEL ? `§6Level ${L} (MAX)` : `§6Level ${L}  §7XP ${getXp(player)} / ${xpToNext(L)}`);
  } else {
    lines.push("§cUnleashed: every power unlocked, maximum stats");
  }
  lines.push(`§fCitizens saved: §a${getNum(player, "saved", 0)}   §fVillains defeated: §c${getNum(player, "villains", 0)}`);
  lines.push(`§fSolar energy: §e${Math.floor(st.energy)} / ${s.maxEnergy}${st.inSun ? " §7(charging in sunlight)" : ""}`);
  lines.push(st.suited ? "§9Suit: equipped" : "§7Suit: not equipped (wear the Hero Suit in the chest slot)");
  lines.push("");
  lines.push("§lPowers");
  for (const [key, p] of Object.entries(POWERS)) {
    const ok = hasPower(player, key);
    lines.push(ok ? `§a+ ${p.name}§7 - ${p.desc}` : `§8- ${p.name} (unlocks at level ${p.level})`);
  }
  const form = new ActionFormData().title("Hero Profile").body(lines.join("\n"));
  const actions = [];
  form.button("Controls & Tips");
  actions.push(() => controls(player));
  form.button("Settings");
  actions.push(() => settingsForm(player));
  form.button("Find Nearest City");
  actions.push(() => findCity(player));
  form.button("Restore Power Items");
  actions.push(() => {
    const n = givePowerItems(player, true);
    if (!n) msg(player, "§7You already carry every power item you have unlocked.");
  });
  if (isCreative(player)) {
    form.button("Creative / Test Tools");
    actions.push(() => creativeTools(player));
  }
  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  actions[res.selection]?.();
}

/** @param {import("@minecraft/server").Player} player */
async function controls(player) {
  const body = [
    "§lFlying",
    "§f- Jump, then press §ejump again§f in mid-air to take off.",
    "§f- Look where you want to go and hold §eforward§f.",
    "§f- §eJump§f = go up, §esneak§f = go down. Sneak into the ground to land.",
    "§f- §eSprint§f (or double-tap forward) = supersonic flight.",
    "§f- Double-tap §esneak§f in the air to drop.",
    "§f- Dive into the ground fast for a §6Ground Slam§f (when unlocked).",
    "",
    "§lPowers",
    "§f- Hold USE with §cHeat Vision§f or §bFreeze Breath§f to fire.",
    "§f- §bFreeze Breath§f puts out fire, freezes water and lava, and chills enemies.",
    "§f- Tap USE with §aX-Ray Vision§f to toggle it.",
    "§f- Punch while flying fast for a devastating flying punch.",
    "§f- Powers use §eSolar Energy§f - it recharges fastest in sunlight.",
    "",
    "§lSaving People",
    "§f- Cities have emergencies: fires, villain attacks, falling citizens.",
    "§f- USE / tap a citizen to pick them up. Land and sneak to set them down somewhere safe.",
    "§f- Fly into a falling citizen to catch them.",
    "",
    "§aCryptonite§f (green crystals, Viridian, cryptonite weapons) weakens you and can stop your powers completely.",
  ];
  const form = new ActionFormData().title("Controls & Tips").body(body.join("\n")).button("Show tips in chat").button("Back");
  const res = await form.show(player);
  if (res.selection === 0) tutorial(player);
  else if (res.selection === 1) openMenu(player);
}

/** @param {import("@minecraft/server").Player} player */
async function settingsForm(player) {
  const cur = settings(player);
  const keys = Object.keys(DEFAULT_SETTINGS);
  const labels = {
    hud: "Show hero HUD",
    fov: "Speed FOV effect when flying fast",
    heatFire: "Heat Vision can set blocks on fire",
    superSpeed: "Super speed while running",
    cheers: "Citizens shout when you fly by",
  };
  const form = new ModalFormData().title("Hero Settings");
  for (const k of keys) form.toggle(labels[k] ?? k, { defaultValue: !!cur[k] });
  const op = isCreative(player);
  if (op) form.toggle("World: build cities automatically", { defaultValue: !!worldGet("auto_cities", 1) });
  const res = await form.show(player);
  if (res.canceled || !res.formValues) return;
  const vals = res.formValues.filter((v) => v !== undefined);
  const next = {};
  keys.forEach((k, i) => (next[k] = !!vals[i]));
  setJSON(player, "settings", next);
  if (op) worldSet("auto_cities", vals[keys.length] ? 1 : 0);
  if (!next.fov) safe(() => player.runCommand("camera @s fov_clear"));
  msg(player, "§aSettings saved.");
}

/** @param {import("@minecraft/server").Player} player */
function findCity(player) {
  const near = nearestCity(player.location, player.dimension.id);
  if (!near) {
    msg(player, "§7No city discovered yet. Keep exploring - cities appear as you travel the Overworld.");
    return;
  }
  const c = near.city;
  showTitle(player, `§f${c.name}`, `§7${arrowTo(player, c)}  §f${Math.round(near.distance)}m`, 60);
  msg(player, `§bNearest city: §f${c.name} §7at §f${c.x}, ${c.y + 1}, ${c.z} §7(${Math.round(near.distance)}m ${arrowTo(player, c)})`);
}

/** @param {import("@minecraft/server").Player} player */
async function creativeTools(player) {
  /** @type {Array<{label: string, fn: () => any}>} */
  const opts = [
    { label: "Build a city in front of me", fn: () => blueprint(player) },
    { label: "Emergency: building fire", fn: () => forceEvent(player, "fire") },
    { label: "Emergency: villain attack", fn: () => forceEvent(player, "attack") },
    { label: "Emergency: falling citizen", fn: () => forceEvent(player, "falling") },
    { label: "Spawn Pyroclast", fn: () => spawnSupervillainNear(player, ID.PYROCLAST) },
    { label: "Spawn Viridian", fn: () => spawnSupervillainNear(player, ID.VIRIDIAN) },
    { label: "Spawn Rampager", fn: () => spawnSupervillainNear(player, ID.RAMPAGER) },
    { label: "Spawn Omega Mech", fn: () => spawnSupervillainNear(player, ID.MECH) },
    { label: "Call a cryptonite meteor", fn: () => launchMeteor(player) },
  ];
  if (EDITION.leveling) {
    opts.push({ label: "Level up (+1)", fn: () => setLevel(player, getLevel(player) + 1) });
    opts.push({ label: "Max level", fn: () => setLevel(player, MAX_LEVEL) });
    opts.push({
      label: "Reset my level",
      fn: () => {
        setNum(player, "level", 1);
        setNum(player, "xp", 0);
        msg(player, "§7Progress reset to level 1.");
      },
    });
  }
  const form = new ActionFormData().title("Creative / Test Tools");
  for (const o of opts) form.button(o.label);
  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  const fn = opts[res.selection]?.fn;
  if (typeof fn === "function") system.run(() => fn());
}

export function worldReady() {
  return !!world;
}
