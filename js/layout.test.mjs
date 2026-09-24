import assert from "node:assert/strict";
import {
  L,
  floorsAt,
  inRamp,
  inVilla,
  pickSupport,
  pushOut,
  supportAt,
} from "./layout.js";

const boat = { x: L.boat.x, z: L.boat.z1, deckY: L.pier.y, berthed: true, phase: "berthed" };

const ground = supportAt(0, 0, 0.04, null);
assert.ok(Math.abs(ground - L.villa.floor) < 0.02, `villa floor ${ground}`);

const roof = supportAt(0, 4, L.roofY, null);
assert.ok(Math.abs(roof - L.roofY) < 0.05, `roof ${roof}`);

const aboveBunker = supportAt(70, 0, 0, null);
assert.ok(aboveBunker > -0.2, `lawn above bunker collapsed to ${aboveBunker}`);

const room = supportAt(72, 0, L.bunker.room.y, null);
assert.ok(Math.abs(room - L.bunker.room.y) < 0.05, `bunker floor ${room}`);

const midX = (L.bunker.ramp.x0 + L.bunker.ramp.x1) / 2;
assert.ok(inRamp(midX, 0));
const rampFloors = floorsAt(midX, 0, null);
assert.equal(rampFloors.length, 1);
const rampAtFeet = supportAt(midX, 0, rampFloors[0], null);
assert.ok(rampAtFeet < -2 && rampAtFeet > -6, `ramp height ${rampAtFeet}`);

assert.ok(!inVilla(36, 0), "bunker pad must sit outside the villa");
assert.ok(L.bunker.pad.minX > L.villa.maxX + 10, "gap between villa and bunker");

const stair = supportAt(L.roofStair.x, 8, 3, null);
assert.ok(stair > 1.5 && stair < 6, `roof stair ${stair}`);

const deck = supportAt(boat.x, boat.z, boat.deckY, boat);
assert.ok(Math.abs(deck - boat.deckY) < 0.05, `deck ${deck}`);

const door = pushOut(0, 0.04, L.villa.maxZ, null);
assert.ok(Math.abs(door.z - L.villa.maxZ) < 1.2, `door blocked ${door.z}`);

const west = pushOut(L.villa.minX, 0.04, 0, null);
assert.ok(west.x < L.villa.minX - 0.2, `west wall did not push ${west.x}`);

const high = pickSupport([0, 7.2], 0);
assert.equal(high, 0);
const up = pickSupport([0, 7.2], 7.1);
assert.equal(up, 7.2);

console.log("layout ok");
