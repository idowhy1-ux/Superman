// On-screen HUD (above the hotbar) and the Power Wheel menu.
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { EDITION } from "./config.js";
import { ICON, ID } from "./constants.js";
import { MAX_LEVEL, POWERS, getLevel, getXp, hasPower, powerName, setLevel, stats, xpToNext } from "./leveling.js";
import { DEFAULT_SETTINGS, getNum, setJSON, setNum, settings, state, worldGet, worldSet } from "./store.js";
import { V, arrowTo, bar, isCreative, msg, safe, showTitle } from "./util.js";
import { tutorial } from "./suit.js";
import { dangerTarget, forceEvent } from "./rescue.js";
import { blueprint, nearestCity } from "./cities.js";
import { launchMeteor, spawnSupervillainNear } from "./villains.js";
import { ABILITIES, abilityBar, controlHints, isAbilityActive, selectAbility, selectedIndex, useAbility } from "./abilities.js";
import { integrityPct, toggleNano } from "./iron.js";
import { missionLines } from "./missions.js";

/** @param {import("@minecraft/server").Player} player */
export function tickHud(player, now) {
  const st = state(player);
  const extra = now < st.hudExtraUntil ? st.hudExtra : "";
  if (st.mode === "none") {
    if (extra) safe(() => player.onScreenDisplay.setActionBar(extra));
    else if (st.hasCore && now % 40 === 0) {
      safe(() => player.onScreenDisplay.setActionBar(`§cNano Core ready §7- hold §f${ICON.SNEAK}§7 sneak + press §f${ICON.JUMP}§7 jump to deploy`));
    }
    return;
  }
  const set = settings(player);
  if (!set.hud) {
    if (extra) safe(() => player.onScreenDisplay.setActionBar(extra));
    return;
  }
  const s = stats(player);
  const parts = [];
  if (EDITION.leveling) {
    const L = s.level;
    parts.push(L >= MAX_LEVEL ? `§f${ICON.STAR}§6§l${L} §r§6MAX` : `§f${ICON.STAR}§6§l${L}§r ${bar(getXp(player) / xpToNext(L), 8, "§a", "§8")}`);
  } else {
    parts.push("§c§lUNLEASHED§r");
  }
  if (st.mode === "iron") {
    parts.push(`§f${ICON.BOLT}${bar(st.energy / s.maxEnergy, 8, "§b", "§8")}`);
    parts.push(`§f${ICON.SHIELD}${bar(integrityPct(player), 6, "§c", "§8")}`);
  } else {
    parts.push(`§f${ICON.SUN}${bar(st.energy / s.maxEnergy, 8, st.inSun ? "§e" : "§6", "§8")}`);
  }
  if (st.flying || st.creativeFlight) {
    const kmh = Math.round(V.len(st.vmeas) * 20 * 3.6);
    parts.push(`§f${ICON.SPEED}${st.sonic ? "§f§l" : st.boost ? "§b" : "§f"}${kmh}§r§7 km/h`);
  }
  if (st.krypto > 0) parts.push(`§f${ICON.CRYPTO}${st.krypto >= 1 ? "§2§lCRYPTONITE!" : "§aweakened"}`);
  const lines = [parts.join(" §8| "), abilityBar(player, now)];
  let line3 = extra;
  if (!line3 && st.carrying) line3 = `§f${ICON.CITIZEN}§bCarrying a citizen §7- land and sneak to set them down`;
  if (!line3 && (st.xray || st.scan)) line3 = st.xraySummary;
  if (!line3) {
    const d = dangerTarget(player);
    if (d) {
      const tag = hasPower(player, "hearing") ? (st.mode === "iron" ? "§bDistress signal" : "§cSuper Hearing") : "§cCry for help";
      line3 = `§f${ICON.WARN}${tag} §f${arrowTo(player, d.entity.location)} ${Math.round(d.distance)}m`;
    }
  }
  if (!line3 && now < st.hintsUntil && set.hints) line3 = controlHints(st);
  if (line3) lines.push(line3);
  safe(() => player.onScreenDisplay.setActionBar(lines.join("\n")));
}

// ---------------------------------------------------------------------------
// Power Wheel
// ---------------------------------------------------------------------------
const ICON_PATH = "textures/ui/superhuman/";

/** @param {import("@minecraft/server").Player} player */
export async function openWheel(player) {
  const st = state(player);
  const now = system.currentTick;
  if (now - st.wheelOpen < 10) return;
  st.wheelOpen = now;
  const s = stats(player);
  const form = new ActionFormData();
  /** @type {Array<() => any>} */
  const actions = [];
  const mode = st.mode;
  form.title(mode === "iron" ? "§c§lNANO SUIT SYSTEMS" : mode === "super" ? "§9§lHERO POWERS" : "§lHERO");
  const body = [];
  if (EDITION.leveling) body.push(`§6Level ${getLevel(player)}${getLevel(player) < MAX_LEVEL ? `  §7XP ${getXp(player)} / ${xpToNext(getLevel(player))}` : " (MAX)"}`);
  if (mode !== "none") body.push(`${mode === "iron" ? "§bReactor" : "§eSolar"} energy: §f${Math.floor(st.energy)} / ${s.maxEnergy}`);
  if (mode === "iron") body.push(`§cSuit integrity: §f${Math.round(integrityPct(player) * 100)}%`);
  body.push("§7Pick a power to make it your active power.");
  body.push(`§7Then attack the air (${ICON.ATTACK}) to use it - or sneak + attack to switch.`);
  form.body(body.join("\n"));

  const list = ABILITIES[mode];
  if (list) {
    const sel = selectedIndex(player);
    list.forEach((ab, i) => {
      const unlocked = hasPower(player, ab.power);
      const ready = st.cooldowns[ab.id] ?? 0;
      const status = !unlocked ? `§8locked - level ${POWERS[ab.power].level}`
        : i === sel ? "§2SELECTED" : isAbilityActive(st, ab, now) ? "§2active" : now < ready ? `§4${Math.ceil((ready - now) / 20)}s` : "§8ready";
      form.button(`${unlocked ? "§0" : "§8"}${powerName(ab.power, mode)}\n${status}`, ICON_PATH + ab.id);
      actions.push(() => {
        if (!unlocked) {
          msg(player, `§7${powerName(ab.power, mode)} unlocks at level §e${POWERS[ab.power].level}§7.`);
          return;
        }
        selectAbility(player, i);
        // touch players get the power fired right away
        const touch = safe(() => String(player.inputInfo.lastInputModeUsed) === "Touch", false);
        if (touch) {
          if (ab.kind === "beam") {
            const b = ab.id === "heat" ? st.heat : st.freeze;
            b.until = system.currentTick + 50;
          } else useAbility(player, ab.id);
        }
      });
    });
  }
  const chestIsCore = st.hasCore;
  if (chestIsCore || mode === "iron") {
    form.button(chestIsCore ? "§4Deploy Nano Suit" : "§4Retract Nano Suit", ICON_PATH + "nano_core");
    actions.push(() => toggleNano(player));
  }
  form.button("Hero Profile & Missions", ICON_PATH + "profile");
  actions.push(() => profile(player));
  form.button("Find Nearest City", ICON_PATH + "city");
  actions.push(() => findCity(player));
  form.button("Controls & Tips", ICON_PATH + "controls");
  actions.push(() => controls(player));
  form.button("Settings", ICON_PATH + "settings");
  actions.push(() => settingsForm(player));
  if (isCreative(player)) {
    form.button("Creative / Test Tools", ICON_PATH + "tools");
    actions.push(() => creativeTools(player));
  }
  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  const fn = actions[res.selection];
  if (fn) system.run(() => fn());
}

/** @param {import("@minecraft/server").Player} player */
async function profile(player) {
  const st = state(player);
  const lines = [`§l${EDITION.name}§r`];
  if (EDITION.leveling) {
    const L = getLevel(player);
    lines.push(L >= MAX_LEVEL ? `§6Level ${L} (MAX)` : `§6Level ${L}  §7XP ${getXp(player)} / ${xpToNext(L)}`);
  } else {
    lines.push("§cUnleashed: every power unlocked, maximum stats");
  }
  lines.push(`§fCitizens saved: §a${getNum(player, "saved", 0)}   §fVillains defeated: §c${getNum(player, "villains", 0)}`);
  lines.push("");
  for (const [suit, label] of [["super", "§9Hero Suit"], ["iron", "§cNano Suit"]]) {
    lines.push(`§l${label}`);
    for (const [key, p] of Object.entries(POWERS)) {
      if (p.suit !== suit && p.suit !== "both") continue;
      const ok = hasPower(player, key);
      lines.push(ok ? `§a+ ${powerName(key, suit)}§7 - ${p.desc}` : `§8- ${powerName(key, suit)} (level ${p.level})`);
    }
    lines.push("");
  }
  lines.push("§lMissions");
  lines.push(...missionLines(player));
  const form = new ActionFormData().title("Hero Profile").body(lines.join("\n")).button("Back");
  const res = await form.show(player);
  if (res.selection === 0 && (st.mode !== "none" || st.hasCore)) openWheel(player);
}

/** @param {import("@minecraft/server").Player} player */
async function controls(player) {
  const body = [
    "§lOn-screen controls (no items needed)",
    `§f${ICON.ATTACK} Attack the air with an empty hand: §euse your selected power`,
    `§f${ICON.SNEAK} + ${ICON.ATTACK} Sneak + attack: §eswitch power`,
    `§f${ICON.SNEAK}${ICON.SNEAK} Double-tap sneak on the ground: §ePower Wheel`,
    `§f${ICON.SNEAK} + ${ICON.JUMP} Hold sneak, press jump (Nano Core): §edeploy / retract the nano suit`,
    "§7Your powers, energy and alerts are shown above the hotbar.",
    "",
    "§lFlying",
    `§f${ICON.JUMP} Jump, then jump again in mid-air to take off.`,
    "§fLook where you want to go and hold forward. Jump = up, sneak = down.",
    "§fSprint (or double-tap forward) for supersonic speed.",
    "§fSneak down onto the ground to land; double-tap sneak in the air to drop.",
    "",
    "§lSaving people",
    "§fUse/tap a citizen in danger to pick them up. Land and sneak to set them down.",
    "§fFly into a falling citizen to catch them.",
    "",
    `§a${ICON.CRYPTO} Cryptonite§f weakens the Hero Suit - the Nano Suit is immune.`,
  ];
  const form = new ActionFormData().title("Controls & Tips").body(body.join("\n")).button("Show tips in chat").button("Back");
  const res = await form.show(player);
  if (res.selection === 0) tutorial(player, state(player).mode === "iron" ? "iron" : "super");
  else if (res.selection === 1) openWheel(player);
}

/** @param {import("@minecraft/server").Player} player */
async function settingsForm(player) {
  const cur = settings(player);
  const keys = Object.keys(DEFAULT_SETTINGS);
  const labels = {
    hud: "Show hero HUD",
    hints: "Show control hints on screen",
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
