// /scriptevent commands for testing and server admins (requires cheats).
//   /scriptevent superhuman:help
//   /scriptevent superhuman:city                 build a city in front of you
//   /scriptevent superhuman:event fire|attack|falling
//   /scriptevent superhuman:villain pyroclast|viridian|rampager|omega_mech|glacius|volt
//   /scriptevent superhuman:meteor
//   /scriptevent superhuman:level <1-20>         (Rising edition)
//   /scriptevent superhuman:xp <amount>          (Rising edition)
//   /scriptevent superhuman:autocities on|off
//   /scriptevent superhuman:resetflight          forget the learned flight tuning
import { system } from "@minecraft/server";
import { EDITION } from "./config.js";
import { ID } from "./constants.js";
import { addXp, setLevel } from "./leveling.js";
import { worldSet } from "./store.js";
import { msg } from "./util.js";
import { blueprint } from "./cities.js";
import { forceEvent } from "./rescue.js";
import { launchMeteor, spawnSupervillainNear } from "./villains.js";

const VILLAIN_IDS = {
  pyroclast: ID.PYROCLAST,
  viridian: ID.VIRIDIAN,
  rampager: ID.RAMPAGER,
  omega_mech: ID.MECH,
  mech: ID.MECH,
  glacius: ID.GLACIUS,
  volt: ID.VOLT,
};

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (!ev.id.startsWith("superhuman:")) return;
  const player = ev.sourceEntity && ev.sourceEntity.typeId === "minecraft:player"
    ? /** @type {import("@minecraft/server").Player} */ (ev.sourceEntity)
    : undefined;
  const cmd = ev.id.slice("superhuman:".length);
  const arg = (ev.message ?? "").trim().toLowerCase();
  if (!player) {
    if (cmd === "autocities") worldSet("auto_cities", arg === "off" ? 0 : 1);
    return;
  }
  switch (cmd) {
    case "help":
      msg(player, "§b/scriptevent superhuman:city | event fire|attack|falling | villain <name> | meteor | level <n> | xp <n> | autocities on|off | resetflight");
      break;
    case "city":
      blueprint(player);
      break;
    case "event":
      forceEvent(player, ["fire", "attack", "falling"].includes(arg) ? arg : "fire");
      break;
    case "villain":
      if (!VILLAIN_IDS[arg]) msg(player, `§7Villains: ${Object.keys(VILLAIN_IDS).filter((k) => k !== "mech").join(", ")}`);
      else spawnSupervillainNear(player, VILLAIN_IDS[arg]);
      break;
    case "meteor":
      if (!launchMeteor(player)) msg(player, "§cCould not find a landing spot for the meteor.");
      break;
    case "level":
      if (!EDITION.leveling) msg(player, "§7The Unleashed edition has no levels - every power is unlocked.");
      else setLevel(player, Number(arg) || 1);
      break;
    case "xp":
      if (!EDITION.leveling) msg(player, "§7The Unleashed edition has no XP.");
      else addXp(player, Math.max(0, Number(arg) || 0), "command");
      break;
    case "autocities":
      worldSet("auto_cities", arg === "off" ? 0 : 1);
      msg(player, `§7Automatic cities: ${arg === "off" ? "§coff" : "§aon"}`);
      break;
    case "resetflight":
      worldSet("flight_model", { h: 0.25, v: 0.25, n: 0 });
      msg(player, "§7Flight tuning reset (reload the world to apply).");
      break;
    default:
      msg(player, `§cUnknown command superhuman:${cmd}. Try /scriptevent superhuman:help`);
  }
});
