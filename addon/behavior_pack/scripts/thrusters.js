// Jet flames for the nano suit's thruster flight.
import { MolangVariableMap } from "@minecraft/server";
import { PARTICLE, SOUND } from "./constants.js";
import { V, basis, clamp, particle, safe, sound } from "./util.js";

/** Thruster flames from hands and feet while flying. @param {import("@minecraft/server").Player} player */
export function thrusterFx(player, st, horizontal, now) {
  const dim = player.dimension;
  const loc = player.location;
  const dir = safe(() => player.getViewDirection(), { x: 0, y: 0, z: 1 });
  const { right } = basis(dir);
  const vars = new MolangVariableMap();
  if (horizontal) {
    const back = V.scale(dir, -1);
    vars.setSpeedAndDirection("variable.jet", st.boost ? 3.5 : 2, back);
    const c = { x: loc.x, y: loc.y + 0.9, z: loc.z };
    particle(dim, PARTICLE.THRUSTER, V.add(c, V.scale(dir, -1.3)), vars);
    if (now % 2 === 0) {
      particle(dim, PARTICLE.THRUSTER, V.add(V.add(c, V.scale(dir, -0.6)), V.scale(right, 0.42)), vars);
      particle(dim, PARTICLE.THRUSTER, V.add(V.add(c, V.scale(dir, -0.6)), V.scale(right, -0.42)), vars);
    }
  } else {
    vars.setSpeedAndDirection("variable.jet", 2.2, { x: 0, y: -1, z: 0 });
    particle(dim, PARTICLE.THRUSTER, { x: loc.x, y: loc.y - 0.05, z: loc.z }, vars);
    if (now % 2 === 0) {
      particle(dim, PARTICLE.THRUSTER, { x: loc.x + right.x * 0.45, y: loc.y + 0.75, z: loc.z + right.z * 0.45 }, vars);
      particle(dim, PARTICLE.THRUSTER, { x: loc.x - right.x * 0.45, y: loc.y + 0.75, z: loc.z - right.z * 0.45 }, vars);
    }
  }
  if (now % 16 === 0) sound(dim, SOUND.JET, loc, 0.55, clamp(0.85 + V.len(st.vmeas) * 0.25, 0.85, 1.5));
}

