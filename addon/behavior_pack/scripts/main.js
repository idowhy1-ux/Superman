// Superhuman add-on - entry point.
// Wires every feature module into one game loop.
import { system, world } from "@minecraft/server";
import { EDITION } from "./config.js";
import { on } from "./bus.js";
import { forget, state } from "./store.js";
import { valid, msg, players } from "./util.js";
import { resyncFor } from "./anim.js";
import { applyPassives, updateSuit } from "./suit.js";
import { loadFlightModel, saveFlightModel, stopFlight, tickFlight } from "./flight.js";
import { tickPowers } from "./powers.js";
import { tickCryptonite } from "./cryptonite.js";
import { blueprint, ensureFirstCity, loadCities, tickCities } from "./cities.js";
import { dropCarried, releaseOrphan, tickCarry, tickRescue } from "./rescue.js";
import { tickVillains } from "./villains.js";
import { openMenu, tickHud } from "./hud.js";
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

on("open_menu", (player) => openMenu(player).catch((e) => report("menu", e)));
on("blueprint", (player) => blueprint(player));

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
      tickCarry(player);
      if ((st.suited || st.krypto > 0) && now % 10 === 5) tickCryptonite(player, now);
      if (st.suited && now % 40 === 0) applyPassives(player);
      if (now % 5 === 0) tickHud(player, now);
    } catch (e) {
      report("player tick", e);
    }
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
  st.lastLoc = undefined;
  if (ev.initialSpawn) {
    system.runTimeout(() => {
      if (!valid(player)) return;
      msg(player, `§9§l${EDITION.name}§r §7- craft the §9Hero Suit§7 (red wool, gold, diamond, blue wool) and put it on to gain your powers.`);
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
