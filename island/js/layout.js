// Walkable surfaces and walls. Floors that share an XZ column are resolved
// by picking the surface closest to the feet, so the roof does not swallow
// the ground floor and the bunker does not pull you through the lawn.

export const EYE = 1.62;
export const RADIUS = 0.34;
export const STEP = 0.55;
export const DROP = 0.72;

export const L = {
  villa: { minX: -14, maxX: 14, minZ: -16, maxZ: 16, floor: 0.04, wallH: 7.02, doorHalf: 2.7 },
  mezz: { minX: -12.4, maxX: 12.4, minZ: -15.5, maxZ: -1.2, y: 3.55 },
  mezzStair: { minX: -11.4, maxX: -6.6, zTop: -1.2, zBot: 5.6, yTop: 3.55, yBot: 0.04 },
  roofY: 7.22,
  roofStair: { x: -16.75, halfW: 1.45, zBot: 16.2, zTop: -1.15, yBot: 0.04, yTop: 7.22 },
  roofLanding: { minX: -18.3, maxX: -11.2, minZ: -2.5, maxZ: 1.15, y: 7.22 },
  pool: { minX: 3.2, maxX: 12.2, minZ: -8.2, maxZ: 3.4 },
  bunker: {
    pad: { minX: 30, maxX: 44.2, minZ: -4.3, maxZ: 4.3, y: 0.1 },
    ramp: { x0: 43.4, x1: 60.8, halfW: 2.15, y0: 0.1, y1: -7.05 },
    landing: { minX: 59.6, maxX: 63.6, minZ: -2.25, maxZ: 2.25, y: -7.05 },
    room: { minX: 62.4, maxX: 80.5, minZ: -8.1, maxZ: 8.1, y: -7.05, h: 3.7 },
  },
  pier: { minX: -2.3, maxX: 2.3, z0: 56.5, z1: 100, y: -4.72 },
  boat: { x: 6.35, z0: 168, z1: 78, halfX: 2.8, bow: -6.7, stern: 6.6 },
  cabin: { minX: -1.25, maxX: 1.25, minZ: 1.6, maxZ: 4.7, h: 2.15 },
  ufo: { x: -1.4, z: 9.2, floor: 26.4, radius: 5.3 },
  beam: { x: -1.4, z: 9.2, radius: 1.25 },
  bounds: { minX: -52, maxX: 92, minZ: -34, maxZ: 190 },
};

const B = L.bunker;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function inside(x, z, box) {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

export function terrainWalk(x, z) {
  if (x > -28 && x < 86 && z > -22 && z < 32) return 0;
  let y = 0;
  if (z > 28) y = lerp(0, -4.85, clamp((z - 28) / 30, 0, 1));
  if (z > 58) y = lerp(-4.85, -5.55, clamp((z - 58) / 16, 0, 1));
  if (z < -20) y -= (-20 - z) * 0.12;
  const edge = Math.max(0, Math.abs(x) - 26);
  if (z < 36) y -= edge * 0.045;
  y += Math.sin(x * 0.17 + z * 0.05) * 0.05;
  return y;
}

function rampY(x) {
  const t = clamp((x - B.ramp.x0) / (B.ramp.x1 - B.ramp.x0), 0, 1);
  return lerp(B.ramp.y0, B.ramp.y1, t);
}

export function inRamp(x, z) {
  return x >= B.ramp.x0 && x <= B.ramp.x1 && Math.abs(z) <= B.ramp.halfW;
}

export function onDeck(x, z, boat) {
  if (!boat) return false;
  const lx = x - boat.x;
  const lz = z - boat.z;
  return Math.abs(lx) <= L.boat.halfX && lz >= L.boat.bow && lz <= L.boat.stern;
}

export function onGangway(x, z, boat) {
  if (!boat?.berthed) return false;
  const z0 = boat.z - 1.15;
  const z1 = boat.z + 1.15;
  const x0 = L.pier.maxX - 0.05;
  const x1 = boat.x - L.boat.halfX + 0.15;
  return z >= z0 && z <= z1 && x >= Math.min(x0, x1) && x <= Math.max(x0, x1);
}

export function inVilla(x, z) {
  const v = L.villa;
  return x > v.minX + 0.35 && x < v.maxX - 0.35 && z > v.minZ + 0.35 && z < v.maxZ - 0.35;
}

export function inMezz(x, z) {
  return inside(x, z, L.mezz);
}

export function inMezzStair(x, z) {
  const s = L.mezzStair;
  return x >= s.minX && x <= s.maxX && z <= s.zBot && z >= s.zTop;
}

export function mezzStairY(z) {
  const s = L.mezzStair;
  const t = clamp((s.zBot - z) / (s.zBot - s.zTop), 0, 1);
  return lerp(s.yBot, s.yTop, t);
}

export function inRoof(x, z) {
  const v = L.villa;
  if (x < v.minX + 0.2 || x > v.maxX - 0.2 || z < v.minZ + 0.2 || z > v.maxZ - 0.2) return false;
  const p = L.pool;
  if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ) return false;
  return true;
}

export function inRoofStair(x, z) {
  const s = L.roofStair;
  return Math.abs(x - s.x) <= s.halfW && z <= s.zBot && z >= s.zTop;
}

export function roofStairY(z) {
  const s = L.roofStair;
  const t = clamp((s.zBot - z) / (s.zBot - s.zTop), 0, 1);
  return lerp(s.yBot, s.yTop, t);
}

export function inRoofLanding(x, z) {
  return inside(x, z, L.roofLanding);
}

export function inBunkerRoom(x, z) {
  return inside(x, z, B.room);
}

export function inUfo(x, z) {
  const u = L.ufo;
  return Math.hypot(x - u.x, z - u.z) <= u.radius;
}

export function inBeam(x, z, feetY) {
  const b = L.beam;
  return Math.hypot(x - b.x, z - b.z) < b.radius && feetY > L.roofY - 0.4 && feetY < L.roofY + 1.6;
}

export function floorsAt(x, z, boat) {
  const out = [];
  if (boat && onDeck(x, z, boat)) out.push(boat.deckY);
  if (boat && onGangway(x, z, boat)) out.push(boat.deckY);

  if (inRamp(x, z)) {
    out.push(rampY(x));
    return out;
  }
  if (inside(x, z, B.landing)) {
    out.push(B.landing.y);
    return out;
  }

  out.push(terrainWalk(x, z));
  if (inside(x, z, { minX: L.pier.minX, maxX: L.pier.maxX, minZ: L.pier.z0, maxZ: L.pier.z1 })) out.push(L.pier.y);
  if (inside(x, z, B.pad)) out.push(B.pad.y);
  if (inVilla(x, z)) out.push(L.villa.floor);
  if (inMezz(x, z)) out.push(L.mezz.y);
  if (inMezzStair(x, z)) out.push(mezzStairY(z));
  if (inRoof(x, z) || inRoofLanding(x, z)) out.push(L.roofY);
  if (inRoofStair(x, z)) out.push(roofStairY(z));
  if (inBunkerRoom(x, z)) out.push(B.room.y);
  if (inUfo(x, z)) out.push(L.ufo.floor);
  return out;
}

export function pickSupport(floors, feetY) {
  let best = null;
  let bestDist = Infinity;
  for (const y of floors) {
    if (y > feetY + STEP) continue;
    const d = Math.abs(y - feetY);
    if (d < bestDist - 1e-4 || (Math.abs(d - bestDist) < 1e-4 && y > best)) {
      best = y;
      bestDist = d;
    }
  }
  if (best === null && floors.length) best = Math.max(...floors);
  return best;
}

export function supportAt(x, z, feetY, boat) {
  return pickSupport(floorsAt(x, z, boat), feetY);
}

function wall(minX, maxX, minZ, maxZ, minY, maxY) {
  return { minX, maxX, minZ, maxZ, minY, maxY };
}

export function staticWalls() {
  const v = L.villa;
  const h = v.wallH;
  const t = 0.42;
  const walls = [
    wall(v.minX, -v.doorHalf, v.maxZ - t, v.maxZ + 0.05, 0, h),
    wall(v.doorHalf, v.maxX, v.maxZ - t, v.maxZ + 0.05, 0, h),
    wall(v.minX, v.maxX, v.minZ - 0.05, v.minZ + t, 0, h),
    wall(v.minX - 0.05, v.minX + t, v.minZ, v.maxZ, 0, h),
    wall(v.maxX - t, v.maxX + 0.05, v.minZ, v.maxZ, 0, h),
    wall(L.mezz.minX, L.mezzStair.minX - 0.15, L.mezz.maxZ - 0.15, L.mezz.maxZ + 0.2, L.mezz.y, L.mezz.y + 1.05),
    wall(L.mezzStair.maxX + 0.15, L.mezz.maxX, L.mezz.maxZ - 0.15, L.mezz.maxZ + 0.2, L.mezz.y, L.mezz.y + 1.05),
    wall(v.minX + 0.3, L.roofLanding.maxX - 0.4, v.minZ + 0.3, v.minZ + 0.7, L.roofY, L.roofY + 1.05),
    wall(v.minX + 0.3, v.maxX - 0.3, v.maxZ - 0.7, v.maxZ - 0.25, L.roofY, L.roofY + 1.05),
    wall(-11.6, v.maxX - 0.3, v.minZ + 0.3, v.minZ + 0.7, L.roofY, L.roofY + 1.05),
    wall(v.maxX - 0.7, v.maxX - 0.25, v.minZ + 0.3, v.maxZ - 0.3, L.roofY, L.roofY + 1.05),
    wall(L.pool.minX, L.pool.maxX, L.pool.minZ - 0.28, L.pool.minZ + 0.12, L.roofY, L.roofY + 0.55),
    wall(L.pool.minX, L.pool.maxX, L.pool.maxZ - 0.12, L.pool.maxZ + 0.28, L.roofY, L.roofY + 0.55),
    wall(L.pool.minX - 0.28, L.pool.minX + 0.12, L.pool.minZ, L.pool.maxZ, L.roofY, L.roofY + 0.55),
    wall(L.pool.maxX - 0.12, L.pool.maxX + 0.28, L.pool.minZ, L.pool.maxZ, L.roofY, L.roofY + 0.55),
    wall(2.4, 6.2, 0.5, 2.5, 0, 0.85),
    wall(9.2, 12.6, -9.2, -4.2, 0, 1.05),
    wall(-6.4, -2.2, 5.2, 8.6, 0, 0.78),
    wall(B.ramp.x0 + 0.2, B.room.minX + 0.4, B.ramp.halfW + 0.05, B.ramp.halfW + 0.55, -7.2, 2.4),
    wall(B.ramp.x0 + 0.2, B.room.minX + 0.4, -B.ramp.halfW - 0.55, -B.ramp.halfW - 0.05, -7.2, 2.4),
    wall(43.6, 44.5, -4.2, -2.15, 0, 3.3),
    wall(43.6, 44.5, 2.15, 4.2, 0, 3.3),
    wall(B.room.minX - 0.3, B.room.minX + 0.25, B.room.minZ, -2.35, B.room.y, B.room.y + B.room.h),
    wall(B.room.minX - 0.3, B.room.minX + 0.25, 2.35, B.room.maxZ, B.room.y, B.room.y + B.room.h),
    wall(B.room.maxX - 0.35, B.room.maxX + 0.15, B.room.minZ, B.room.maxZ, B.room.y, B.room.y + B.room.h),
    wall(B.room.minX, B.room.maxX, B.room.minZ - 0.15, B.room.minZ + 0.3, B.room.y, B.room.y + B.room.h),
    wall(B.room.minX, B.room.maxX, B.room.maxZ - 0.3, B.room.maxZ + 0.15, B.room.y, B.room.y + B.room.h),
    wall(-46, L.pier.minX - 0.15, 73.2, 74.05, -6, 1.2),
    wall(L.pier.maxX + 0.15, 60, 73.2, 74.05, -6, 1.2),
  ];
  return walls;
}

export function boatWalls(boat) {
  if (!boat) return [];
  const c = L.cabin;
  return [
    wall(
      boat.x + c.minX,
      boat.x + c.maxX,
      boat.z + c.minZ,
      boat.z + c.maxZ,
      boat.deckY,
      boat.deckY + c.h,
    ),
  ];
}

export function pushOut(x, feetY, z, boat) {
  const r = RADIUS;
  const head = feetY + EYE;
  let px = x;
  let pz = z;
  const walls = staticWalls().concat(boatWalls(boat));
  for (let n = 0; n < 3; n++) {
    for (const w of walls) {
      if (head < w.minY + 0.05 || feetY > w.maxY - 0.02) continue;
      const minX = w.minX - r;
      const maxX = w.maxX + r;
      const minZ = w.minZ - r;
      const maxZ = w.maxZ + r;
      if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue;
      const dl = px - minX;
      const dr = maxX - px;
      const df = pz - minZ;
      const db = maxZ - pz;
      const m = Math.min(dl, dr, df, db);
      if (m === dl) px = minX;
      else if (m === dr) px = maxX;
      else if (m === df) pz = minZ;
      else pz = maxZ;
    }
  }
  const b = L.bounds;
  px = clamp(px, b.minX, b.maxX);
  pz = clamp(pz, b.minZ, b.maxZ);
  return { x: px, z: pz };
}

export function zoneOf(x, feetY, z, boat) {
  if (boat && (onDeck(x, z, boat) || onGangway(x, z, boat)) && feetY < 2) {
    return boat.phase === "sailing" ? "sail" : "boat";
  }
  if (feetY < -2 && (inRamp(x, z) || inBunkerRoom(x, z) || inside(x, z, L.bunker.landing) || inside(x, z, L.bunker.room))) return "bunker";
  if (inUfo(x, z) && feetY > 20) return "ufo";
  if (feetY > 5.2) return "roof";
  if (inVilla(x, z) && feetY < 2.4) return "villa";
  return "island";
}
