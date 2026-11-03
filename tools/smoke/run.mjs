// Smoke test: run the real add-on scripts against the mock runtime.
//   node --import ./tools/smoke/register.mjs tools/smoke/run.mjs [path/to/scripts]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ItemStack, entities, getBlockId, makePlayer, setBlockId, stats, step, system, world } from "./mock-server.mjs";

const scriptsDir = process.argv[2] ?? path.join(process.cwd(), "addon", "behavior_pack", "scripts");
const failures = [];
const check = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures.push(label);
};

const store = await import(pathToFileURL(path.join(scriptsDir, "store.js")).href);
const config = await import(pathToFileURL(path.join(scriptsDir, "config.js")).href);
await import(pathToFileURL(path.join(scriptsDir, "main.js")).href);
const leveling = config.EDITION.leveling;
console.log(`edition: ${config.EDITION.name} (leveling=${leveling})`);

const GROUND = 63;
const p = makePlayer({ x: 0, y: GROUND + 1, z: 0 });
p.health = 1e6; // the mock has no respawn; keep the test hero alive through villain fights
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
function physics(pl) {
  pl.location = add(pl.location, pl.velocity);
  if (pl.location.y <= GROUND + 1) {
    pl.location.y = GROUND + 1;
    pl.isOnGround = true;
    if (pl.velocity.y < 0) pl.velocity.y = 0;
  } else pl.isOnGround = false;
  const g = pl.effects.has("slow_falling") && pl.velocity.y < 0 ? 0.01 : 0.08;
  pl.velocity = { x: pl.velocity.x * 0.91, y: (pl.velocity.y - g) * 0.98, z: pl.velocity.z * 0.91 };
}
world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });

// --- suit up ---------------------------------------------------------------
p.chest = new ItemStack("superhuman:hero_suit");
await step(10, physics);
const st = store.state(p);
check(st.suited, "suit detected");
check(stats.anims.includes("animation.superhuman.player.suit_up"), "suit-up animation played");
check(p.inv.some((i) => i?.typeId === "superhuman:hero_emblem"), "hero emblem given");
check(p.effects.has("resistance") || leveling, "passive powers applied");
if (!leveling) check(p.inv.some((i) => i?.typeId === "superhuman:heat_vision"), "unleashed: heat vision given at once");

// --- double-jump take-off ----------------------------------------------------
p.velocity.y = 0.42;
await step(4, physics);
check(!p.isOnGround, "player airborne after jump");
world.afterEvents.playerButtonInput.fire({ player: p, button: "Jump", newButtonState: "Pressed" });
await step(1, physics);
check(st.flying, "second jump starts flight");
check(stats.anims.includes("animation.superhuman.player.takeoff"), "take-off animation");

// --- cruise & boost -----------------------------------------------------------
p.move = { x: 0, y: 1 };
p.view = { x: 0, y: 0, z: 1 };
await step(60, physics);
const cruise = Math.hypot(st.vmeas.x, st.vmeas.z);
check(cruise > 0.4, `cruising forward (${cruise.toFixed(2)} b/t)`);
check(stats.anims.includes("animation.superhuman.player.fly"), "fly pose");
p.isSprinting = true;
await step(80, physics);
const boost = Math.hypot(st.vmeas.x, st.vmeas.z);
check(boost > cruise + 0.3, `supersonic boost faster (${boost.toFixed(2)} b/t)`);
check(stats.anims.includes("animation.superhuman.player.fly_fast"), "fast-flight pose");
check(stats.commands.some((c) => c.includes("fov_set")), "speed FOV effect");
if (!leveling) check((stats.particles["superhuman:sonic_boom_particle"] ?? 0) > 0, "sonic boom");
p.isSprinting = false;
p.move = { x: 0, y: 0 };
await step(60, physics);
const hover = Math.hypot(st.vmeas.x, st.vmeas.y, st.vmeas.z);
check(hover < 0.12, `hovering when idle (${hover.toFixed(3)} b/t)`);
check(p.location.y > GROUND + 3, `still in the air (y=${p.location.y.toFixed(1)})`);
check(stats.anims.includes("animation.superhuman.player.hover"), "hover pose");

// --- descend & land -------------------------------------------------------------
p.buttons.Sneak = "Pressed";
p.isSneaking = true;
for (let i = 0; i < 400 && st.flying; i++) await step(1, physics);
p.buttons.Sneak = "Released";
p.isSneaking = false;
check(!st.flying, "landing ends flight");

// --- level up (Rising) ---------------------------------------------------------
if (leveling) {
  system.afterEvents.scriptEventReceive.fire({ id: "superhuman:level", message: "20", sourceEntity: p });
  await step(5, physics);
  check(store.getNum(p, "level", 1) === 20, "level set to 20");
  check(stats.anims.includes("animation.superhuman.player.level_up"), "level-up animation");
  check(p.inv.some((i) => i?.typeId === "superhuman:heat_vision"), "heat vision unlocked + given");
}

// --- heat vision -------------------------------------------------------------------
p.main = new ItemStack("superhuman:heat_vision");
p.view = { x: 0, y: -0.3, z: 0.95 };
world.afterEvents.itemUse.fire({ source: p, itemStack: p.main });
world.afterEvents.itemStartUse.fire({ source: p, itemStack: p.main, useDuration: 0 });
await step(20, physics);
check((stats.particles["superhuman:heat_beam_particle"] ?? 0) > 50, "heat vision beam particles");
world.afterEvents.itemStopUse.fire({ source: p, itemStack: p.main, useDuration: 0 });
await step(20, physics);

// --- freeze breath puts out fire ------------------------------------------------------
const firePos = { x: Math.floor(p.location.x), y: GROUND + 1, z: Math.floor(p.location.z) + 4 };
setBlockId(firePos, "minecraft:fire");
p.main = new ItemStack("superhuman:freeze_breath");
p.view = { x: 0, y: -0.33, z: 0.94 };
world.afterEvents.itemUse.fire({ source: p, itemStack: p.main });
world.afterEvents.itemStartUse.fire({ source: p, itemStack: p.main, useDuration: 0 });
await step(16, physics);
check(getBlockId(firePos) !== "minecraft:fire", `freeze breath extinguished the fire (now ${getBlockId(firePos)})`);
world.afterEvents.itemStopUse.fire({ source: p, itemStack: p.main, useDuration: 0 });
p.main = undefined;
await step(20, physics);

// --- city ----------------------------------------------------------------------------------
system.afterEvents.scriptEventReceive.fire({ id: "superhuman:city", message: "", sourceEntity: p });
for (let i = 0; i < 300 && !(world.getDynamicProperty("sh:cities") ?? "").includes("name"); i++) await step(1, physics);
const cities = JSON.parse(world.getDynamicProperty("sh:cities") ?? "[]");
check(cities.length === 1, "city built and saved");
check(stats.fills > 150, `city construction fills (${stats.fills})`);
check((stats.spawned["superhuman:civilian"] ?? 0) >= 10, "citizens spawned");
const city = cities[0];
check(city?.buildings?.length >= 8, "buildings recorded");

// --- fire emergency --------------------------------------------------------------------------
system.afterEvents.scriptEventReceive.fire({ id: "superhuman:event", message: "fire", sourceEntity: p });
await step(12, physics);
const victims = [...entities.values()].filter((e) => e.typeId === "superhuman:civilian" && e.props["superhuman:state"] === "danger");
check(victims.length >= 2, `citizens trapped on a burning roof (${victims.length})`);
const b = city.buildings.find((x) => [...entities.values()].some((e) => e.props["superhuman:state"] === "danger"));
let fires = 0;
for (const bb of city.buildings) {
  const top = city.y + bb.h + 1;
  for (let x = bb.x; x < bb.x + bb.w; x++) for (let z = bb.z; z < bb.z + bb.d; z++) {
    if (getBlockId({ x, y: top, z }) === "minecraft:fire") {
      fires++;
      setBlockId({ x, y: top, z }, "minecraft:ice"); // pretend the hero froze it
    }
  }
}
check(fires >= 4, `roof fire placed (${fires} blocks)`);
// carry a victim down and set them on the ground
p.location = { x: city.x + 40, y: GROUND + 1, z: city.z + 40 };
await step(15, physics);
check(victims.every((v) => v.props["superhuman:state"] !== "danger"), "fire out -> trapped citizens saved");
check(store.getNum(p, "saved", 0) >= 2, `rescues counted (${store.getNum(p, "saved", 0)})`);

// --- carrying ---------------------------------------------------------------------------------
const civ = [...entities.values()].find((e) => e.typeId === "superhuman:civilian");
world.afterEvents.playerInteractWithEntity.fire({ player: p, target: civ });
await step(3, physics);
check(st.carrying === civ.id && civ.lastEvent === "superhuman:start_carry", "pick up a citizen");
world.afterEvents.playerButtonInput.fire({ player: p, button: "Sneak", newButtonState: "Pressed" });
await step(2, physics);
check(!st.carrying && civ.lastEvent === "superhuman:stop_carry", "sneak sets the citizen down");

// --- villains & meteor ----------------------------------------------------------------------------
for (const v of ["rampager", "pyroclast", "viridian", "omega_mech"]) {
  system.afterEvents.scriptEventReceive.fire({ id: "superhuman:villain", message: v, sourceEntity: p });
}
await step(220, physics);
check((stats.spawned["superhuman:rampager"] ?? 0) === 1 && (stats.spawned["superhuman:omega_mech"] ?? 0) === 1, "supervillains spawned");
system.afterEvents.scriptEventReceive.fire({ id: "superhuman:meteor", message: "", sourceEntity: p });
await step(5, physics);
check((stats.spawned["superhuman:cryptonite_meteor"] ?? 0) === 1, "meteor launched");
const meteor = [...entities.values()].find((e) => e.typeId === "superhuman:cryptonite_meteor");
world.afterEvents.projectileHitBlock.fire({ projectile: meteor, dimension: p.dimension, location: { x: 30, y: GROUND + 1, z: 30 }, source: undefined });
await step(5, physics);
let crypto = 0;
for (let x = 27; x <= 33; x++) for (let y = GROUND - 4; y <= GROUND + 2; y++) for (let z = 27; z <= 33; z++) {
  if (getBlockId({ x, y, z }).startsWith("superhuman:crypto")) crypto++;
}
check(crypto >= 1, `meteor exposed cryptonite (${crypto} blocks)`);

// --- cryptonite --------------------------------------------------------------------------------------
p.main = new ItemStack("superhuman:cryptonite_shard");
await step(25, physics);
check(st.krypto >= 1, `holding cryptonite is critical (${st.krypto.toFixed(2)})`);
p.velocity.y = 0.42;
await step(3, physics);
world.afterEvents.playerButtonInput.fire({ player: p, button: "Jump", newButtonState: "Pressed" });
await step(2, physics);
check(!st.flying, "cannot fly near cryptonite");
p.main = undefined;
await step(25, physics);
check(st.krypto === 0, "powers return when cryptonite is gone");

// --- menu --------------------------------------------------------------------------------------------
world.afterEvents.itemUse.fire({ source: p, itemStack: new ItemStack("superhuman:hero_emblem") });
await step(3, physics);
check((globalThis.__forms ?? 0) > 0, "hero menu opens");

// --- HUD + errors ---------------------------------------------------------------------------------------
check(p.actionbar.length > 0, `HUD shown: ${JSON.stringify(p.actionbar)}`);
const errs = stats.warnings.filter((w) => !w.includes("loaded"));
check(errs.length === 0, `no runtime errors ${errs.length ? JSON.stringify(errs.slice(0, 5)) : ""}`);

console.log(`\n${failures.length ? failures.length + " FAILED" : "ALL PASSED"}`);
process.exit(failures.length ? 1 : 0);
