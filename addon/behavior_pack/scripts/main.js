// Superhuman add-on - entry point.
// Wires every feature module into one game loop.
import { system, world } from "@minecraft/server";
import { EDITION } from "./config.js";
import { on } from "./bus.js";
import { forget, state } from "./store.js";
import { msg, players, valid } from "./util.js";
import { resyncFor } from "./anim.js";
import { applyPassives, updateSuit } from "./suit.js";
import { loadFlightModel, saveFlightModel, stopFlight, tickFlight } from "./flight.js";
import { tickPowers } from "./powers.js";
import { legacyNotice } from "./abilities.js";
import { tickIron, tickIronGlobal } from "./iron.js";
import { tickCryptonite } from "./cryptonite.js";
import { blueprint, ensureFirstCity, loadCities, tickCities } from "./cities.js";
import { dropCarried, releaseOrphan, tickCarry, tickRescue } from "./rescue.js";
import { tickVillains } from "./villains.js";
import { openWheel, tickHud } from "./hud.js";
import "./missions.js";
import "./commands.js";

let ready = false;
let lastError = 0;

function init() {
  loadFlightModel();
  loadCities();
  ready = true;
  console.warn(`[superhuman] ${EDITION.name} loaded (leveling: ${EDITION.leveling})`);
}

function report(where, e) {
  const now = system.currentTick;
  if (now - lastError > 200) {
    lastError = now;
    console.warn(`[superhuman] ${where}: ${e}`);
  }
}

on("open_wheel", (player) => openWheel(player).catch((e) => report("wheel", e)));
on("open_menu", (player) => openWheel(player).catch((e) => report("wheel", e)));
on("blueprint", (player) => blueprint(player));
on("mode_change", ({ player, mode }) => {
  if (mode !== "none") legacyNotice(player);
});

system.runInterval(() => {
  if (!ready) init();
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    if (!valid(player)) continue;
    try {
      if (now % 4 === 0) updateSuit(player);
      const st = state(player);
      tickFlight(player, now);
      tickPowers(player, now);
      tickIron(player, now);
      tickCarry(player);
      if ((st.mode === "super" || st.krypto > 0) && now % 10 === 5) tickCryptonite(player, now);
      if (st.mode !== "none" && now % 40 === 0) applyPassives(player);
      if (now % 5 === 0) tickHud(player, now);
    } catch (e) {
      report("player tick", e);
    }
  }
  try {
    tickIronGlobal(now);
  } catch (e) {
    report("iron", e);
  }
  try {
    if (now % 10 === 0) tickRescue(now);
  } catch (e) {
    report("rescue", e);
  }
  try {
    if (now % 20 === 0) tickCities(now);
  } catch (e) {
    report("cities", e);
  }
  try {
    tickVillains(now);
  } catch (e) {
    report("villains", e);
  }
  if (now % 600 === 0) saveFlightModel();
}, 1);

world.afterEvents.playerSpawn.subscribe((ev) => {
  const player = ev.player;
  const st = state(player);
  if (st.flying) stopFlight(player, st);
  dropCarried(player);
  st.suited = false;
  st.mode = "none";
  st.lastLoc = undefined;
  if (ev.initialSpawn) {
    system.runTimeout(() => {
      if (!valid(player)) return;
      msg(player, `§9§l${EDITION.name}§r §7- craft the §9Hero Suit§7 or the §cNano Core§7 and wear it to become a hero. Double-tap sneak for the Power Wheel.`);
      resyncFor(player, players());
    }, 60);
    system.runTimeout(() => {
      if (valid(player)) ensureFirstCity(player);
    }, 200);
  }
});

world.beforeEvents.playerLeave.subscribe((ev) => {
  const id = ev.player.id;
  const carrying = state(ev.player).carrying;
  system.run(() => {
    if (carrying) releaseOrphan(carrying);
    forget(id);
  });
});
