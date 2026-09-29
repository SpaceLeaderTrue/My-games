/* Искра — открытая страна.
   Рельеф, биомы и маршрут. Без Three.js, чтобы мир можно было проверить отдельно. */
(function (root) {
  "use strict";

  const N = 241;
  const SPAN = 1800;
  const HALF = SPAN / 2;
  const CELL = SPAN / (N - 1);
  const WATER_Y = 2.2;

  const BIOME = {
    ROCK: 0,
    MEADOW: 1,
    BLOSSOM: 2,
    FOREST: 3,
    PLATEAU: 4,
    FALLS: 5,
    GORGE_FLOOR: 6,
    GORGE_WALL: 7,
    LAKE: 8,
    ISLAND: 9,
    PEAK: 10,
    SNOW: 11,
    BEACH: 12,
    SEA: 13,
    GROVE: 14,
    HILLS: 15,
  };

  const GORGE = [
    [190, 255],
    [70, 315],
    [-70, 372],
    [-210, 348],
    [-340, 268],
    [-430, 175],
    [-475, 95],
  ];

  const PEAKS = [
    { x: -210, z: 650, amp: 128, rad: 145 },
    { x: -20, z: 700, amp: 102, rad: 118 },
    { x: -370, z: 610, amp: 112, rad: 128 },
    { x: 70, z: 575, amp: 74, rad: 92 },
  ];

  const PLACES = [
    { id: "meadow", name: "Солнечная поляна", line: "Тёплый ветер пахнет мёдом", x: -150, z: -540, y: 38, route: true },
    { id: "blossom", name: "Цветущая опушка", line: "Лепестки догоняют крыло", x: 40, z: -350, y: 42, route: true },
    { id: "forest", name: "Изумрудный лес", line: "Свет ложится пятнами на мох", x: 220, z: -180, y: 52, route: true },
    { id: "falls-top", name: "Кромка водопадов", line: "Река срывается в небо", x: 250, z: 8, y: 104, route: true },
    { id: "falls-low", name: "Лес под водопадами", line: "Радуга живёт в брызгах", x: 230, z: 155, y: 36, route: true },
    { id: "gorge-gate", name: "Врата ущелья", line: "Стены из тёплого камня", x: 160, z: 270, y: 36, route: true },
    { id: "gorge-heart", name: "Сердце ущелья", line: "Узкое небо над рекой", x: -70, z: 372, y: 28, route: true },
    { id: "river", name: "Река в камне", line: "Каньон открывается к озеру", x: -340, z: 268, y: 92, route: true },
    { id: "lake", name: "Радужное озеро", line: "Зеркало облаков", x: -470, z: 28, y: 40, route: true },
    { id: "peaks", name: "Облачные вершины", line: "Крыло касается облака", x: -200, z: 630, y: 176, route: true },
    { id: "coast", name: "Золотой берег", line: "Море держит солнце", x: 430, z: -440, y: 34, route: true },
    { id: "grove", name: "Сумеречная роща", line: "Светлячки зажигают тропу", x: -360, z: -230, y: 44, route: false },
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function hash2(ix, iz) {
    let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function vnoise(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fz = z - z0;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = hash2(x0, z0);
    const b = hash2(x0 + 1, z0);
    const c = hash2(x0, z0 + 1);
    const d = hash2(x0 + 1, z0 + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }

  function fbm(x, z) {
    let amp = 0.5;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < 5; i++) {
      sum += amp * vnoise(x * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }

  function edgeZ(x) {
    return 42 + Math.sin(x * 0.0105) * 22 + Math.sin(x * 0.0042 + 1.7) * 12;
  }

  function meadowMask(x, z) {
    return 1 - smoothstep(150, 290, Math.hypot(x + 150, z + 540));
  }

  function blossomMask(x, z) {
    return 1 - smoothstep(70, 150, Math.hypot(x - 40, z + 350));
  }

  function forestMask(x, z) {
    return 1 - smoothstep(185, 330, Math.hypot(x - 220, z + 185));
  }

  function groveMask(x, z) {
    return 1 - smoothstep(62, 125, Math.hypot(x + 360, z + 230));
  }

  function coastMask(x, z) {
    const shoreX = 455 + z * 0.2;
    return smoothstep(-35, 80, x - shoreX);
  }

  function distToSegment(px, pz, ax, az, bx, bz) {
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz || 1e-6;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / len2));
    const x = ax + abx * t;
    const z = az + abz * t;
    return { d: Math.hypot(px - x, pz - z), t: t, x: x, z: z };
  }

  function gorgeQuery(x, z) {
    let best = { d: 1e9, t: 0, x: 0, z: 0, seg: 0 };
    for (let i = 0; i < GORGE.length - 1; i++) {
      const s = distToSegment(x, z, GORGE[i][0], GORGE[i][1], GORGE[i + 1][0], GORGE[i + 1][1]);
      if (s.d < best.d) best = { d: s.d, t: s.t, x: s.x, z: s.z, seg: i };
    }
    return best;
  }

  function lakeDist(x, z) {
    return Math.hypot(x + 470, z - 26);
  }

  function applyCliff(x, z, h, n1, n2) {
    const xf = smoothstep(-60, 0, x) * (1 - smoothstep(480, 570, x));
    if (xf < 0.02) return h;
    const dz = z - edgeZ(x);
    if (dz < -170 || dz > 230) return h;
    const platH = 74 + Math.sin(x * 0.017) * 5 + (n1 - 0.5) * 8;
    const lowH = 15 + (n2 - 0.5) * 6 + Math.sin(x * 0.02 + z * 0.015) * 2.2;
    let target = h;
    let inf = 0;
    if (dz < -10) {
      target = platH;
      inf = xf * smoothstep(-165, -108, dz);
    } else if (dz < 38) {
      const u = smoothstep(-4, 18, dz);
      target = lerp(platH, lowH, u);
      inf = xf;
    } else {
      target = lowH;
      inf = xf * (1 - smoothstep(150, 215, dz));
    }
    return lerp(h, target, inf);
  }

  function applyGorge(x, z, h, n2) {
    const g = gorgeQuery(x, z);
    const half = 23;
    if (g.d > half + 70) return h;
    const floor = 0.65 + n2 * 0.45;
    const wall = 72 + Math.sin(x * 0.045 + z * 0.02) * 8 + (n2 - 0.5) * 8;
    let target;
    if (g.d < half * 0.55) target = floor;
    else if (g.d < half) target = lerp(floor, 3.1, smoothstep(half * 0.55, half, g.d));
    else target = lerp(3.1, wall, smoothstep(half, half + 11, g.d));
    let inf = 1 - smoothstep(half + 24, half + 64, g.d);
    const mouth = GORGE[0];
    const mouthD = Math.hypot(g.x - mouth[0], g.z - mouth[1]);
    if (mouthD < 36 && g.seg === 0) inf *= smoothstep(0, 36, mouthD);
    return lerp(h, target, inf);
  }

  function applyLake(x, z, h) {
    const d = lakeDist(x, z);
    if (d > 168) return h;
    const inf = 1 - smoothstep(118, 166, d);
    const u = smoothstep(24, 112, d);
    const island = 18 * Math.exp(-(d * d) / (26 * 26));
    const target = lerp(-4.2, 6.8, u) + island;
    return lerp(h, target, inf);
  }

  function applyPeaks(x, z, h) {
    let add = 0;
    for (let i = 0; i < PEAKS.length; i++) {
      const p = PEAKS[i];
      const d = Math.hypot(x - p.x, z - p.z);
      add += p.amp * Math.exp(-(d * d) / (p.rad * p.rad));
    }
    return h + add;
  }

  function applyCoast(x, z, h, n2) {
    const shoreX = 455 + z * 0.2;
    const d = x - shoreX;
    if (d < -70) return h;
    if (z > -150 && z < 160) {
      const drop = smoothstep(-4, 24, d);
      const top = Math.max(h, 26 + n2 * 10);
      const target = lerp(top, -9 + n2 * 2, drop);
      const inf = smoothstep(-55, -6, d);
      return lerp(h, target, inf);
    }
    const beach = smoothstep(-18, 48, d);
    const target = lerp(Math.min(h, 16), -7.5 + n2 * 2.4, beach);
    const inf = smoothstep(-60, 0, d);
    return lerp(h, target, inf);
  }

  function edgeAdd(x, z) {
    if (coastMask(x, z) > 0.45) return 0;
    const d = Math.min(HALF - Math.abs(x), HALF - Math.abs(z));
    if (d > 160) return 0;
    const e = 1 - smoothstep(24, 160, d);
    return e * e * 120;
  }

  function heightAt(x, z) {
    const n1 = fbm(x * 0.00215, z * 0.00215);
    const n2 = fbm(x * 0.0064 + 8.2, z * 0.0064 - 3.1);
    let h = 12 + n1 * 14 + (n2 - 0.5) * 7;
    const md = meadowMask(x, z);
    if (md > 0) h = lerp(h, 17 + n2 * 3.2, md * 0.88);
    const bm = blossomMask(x, z);
    if (bm > 0) h = lerp(h, 18 + n1 * 4, bm * 0.55);
    const fm = forestMask(x, z);
    if (fm > 0) h = lerp(h, 20 + n1 * 11 + (n2 - 0.5) * 4, fm * 0.62);
    const gm = groveMask(x, z);
    if (gm > 0) h = lerp(h, 18.5 + n2 * 2.4, gm * 0.75);
    h = applyCliff(x, z, h, n1, n2);
    h = applyGorge(x, z, h, n2);
    h = applyLake(x, z, h);
    h = applyPeaks(x, z, h);
    h = applyCoast(x, z, h, n2);
    h += edgeAdd(x, z);
    return h;
  }

  function hex(v) {
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  const COL = {
    grassA: hex(0xc6ef62),
    grassB: hex(0x7ed44a),
    grassC: hex(0xf2d56b),
    flowerP: hex(0xff7aa2),
    flowerY: hex(0xffe56a),
    flowerV: hex(0xc9a6ff),
    forestA: hex(0x1eaf62),
    forestB: hex(0x0c7d45),
    moss: hex(0x14936a),
    plateau: hex(0xd7e07a),
    rock: hex(0xb7a090),
    sand: hex(0xffe0a6),
    sandstone: hex(0xf08a3c),
    sandstoneD: hex(0xd24a28),
    pebble: hex(0xd9c2a2),
    autumn: hex(0xe0a15a),
    snow: hex(0xfff8fb),
    peak: hex(0x9a7890),
    grove: hex(0x4f6f9a),
    groveG: hex(0x3d8f78),
    island: hex(0x8ed46a),
    seaBed: hex(0xe7c98a),
    cliff: hex(0xd8d0c8),
  };

  function colorAt(x, z, h, slope, biome) {
    const n = fbm(x * 0.012, z * 0.012);
    let c = mix(COL.grassB, COL.grassA, n);
    if (biome === BIOME.MEADOW) {
      c = mix(COL.grassB, COL.grassA, n * 0.7 + 0.2);
      c = mix(c, COL.grassC, smoothstep(0.62, 0.9, n) * 0.55);
      const spec = hash2(Math.floor(x * 0.35), Math.floor(z * 0.35));
      if (spec > 0.86) c = mix(c, COL.flowerP, 0.75);
      else if (spec > 0.78) c = mix(c, COL.flowerY, 0.7);
      else if (spec > 0.72) c = mix(c, COL.flowerV, 0.65);
    } else if (biome === BIOME.BLOSSOM) {
      c = mix(COL.grassA, COL.flowerP, 0.28 + n * 0.25);
    } else if (biome === BIOME.FOREST) {
      c = mix(COL.forestB, COL.forestA, n);
    } else if (biome === BIOME.FALLS) {
      c = mix(COL.forestB, COL.moss, 0.45 + n * 0.4);
    } else if (biome === BIOME.PLATEAU) {
      c = mix(COL.plateau, COL.grassA, n);
    } else if (biome === BIOME.GORGE_FLOOR) {
      c = mix(COL.pebble, COL.sandstone, n * 0.4);
    } else if (biome === BIOME.GORGE_WALL) {
      const stripe = 0.5 + 0.5 * Math.sin(h * 0.42 + x * 0.02);
      c = mix(COL.sandstoneD, COL.sandstone, stripe);
      c = mix(c, hex(0xf2c29a), (1 - Math.min(slope / 2, 1)) * 0.25);
    } else if (biome === BIOME.LAKE) {
      c = mix(COL.sand, COL.autumn, 0.35);
    } else if (biome === BIOME.ISLAND) {
      c = mix(COL.island, COL.grassC, n * 0.4);
    } else if (biome === BIOME.PEAK) {
      c = mix(COL.peak, COL.rock, n);
    } else if (biome === BIOME.SNOW) {
      c = mix(COL.peak, COL.snow, smoothstep(100, 118, h));
    } else if (biome === BIOME.BEACH) {
      c = mix(COL.sand, hex(0xfff1cc), n * 0.5);
    } else if (biome === BIOME.SEA) {
      c = mix(COL.seaBed, hex(0xf6d7a0), 0.4);
    } else if (biome === BIOME.GROVE) {
      c = mix(COL.grove, COL.groveG, n);
    } else if (biome === BIOME.ROCK) {
      c = x > 360 && z < 200 && z > -200
        ? mix(hex(0xf7e7cb), hex(0xe8b184), n)
        : mix(COL.rock, COL.cliff, n);
    } else {
      c = mix(COL.grassB, COL.forestA, n * 0.55);
    }
    if (slope > 0.85 && biome !== BIOME.GORGE_WALL && biome !== BIOME.SNOW && biome !== BIOME.SEA) {
      c = mix(c, biome === BIOME.PEAK ? COL.peak : COL.rock, smoothstep(0.85, 1.6, slope));
    }
    return c;
  }

  function classify(x, z, h, slope) {
    const g = gorgeQuery(x, z);
    const ld = lakeDist(x, z);
    const coast = coastMask(x, z);
    const dz = z - edgeZ(x);
    const xf = smoothstep(-60, 0, x) * (1 - smoothstep(480, 570, x));
    if (h > 108) return BIOME.SNOW;
    if (ld < 16) return BIOME.ISLAND;
    if (ld < 112 && h < 8.5 && slope < 0.7) return BIOME.LAKE;
    if (g.d < 23 && h < 4.2) return BIOME.GORGE_FLOOR;
    if (g.d < 60 && g.d > 16 && h > 5 && h < 96 && ld > 145) return BIOME.GORGE_WALL;
    if (coast > 0.55 && h < 2.4) return BIOME.SEA;
    if (coast > 0.15 && h < 8 && h > 1.2 && slope < 0.55 && z < -160) return BIOME.BEACH;
    if (slope > 1.15 && h > 8) return BIOME.ROCK;
    if (groveMask(x, z) > 0.45 && slope < 0.65) return BIOME.GROVE;
    if (xf > 0.4 && dz > 30 && dz < 165 && h < 32 && slope < 0.7) return BIOME.FALLS;
    if (xf > 0.4 && dz < -8 && dz > -140 && h > 55 && slope < 0.55) return BIOME.PLATEAU;
    if (h > 72 && z > 480) return BIOME.PEAK;
    if (meadowMask(x, z) > 0.45 && h < 30) return BIOME.MEADOW;
    if (blossomMask(x, z) > 0.4 && h < 36) return BIOME.BLOSSOM;
    if (forestMask(x, z) > 0.35 && h < 48 && slope < 0.75) return BIOME.FOREST;
    if (h > 48 && z > 420 && slope < 0.8) return BIOME.PEAK;
    return BIOME.HILLS;
  }

  let heightGrid = null;
  let colorGrid = null;
  let biomeGrid = null;
  let slopeGrid = null;
  let ready = null;

  function sampleGrid(grid, x, z) {
    const u = (x + HALF) / SPAN;
    const v = (z + HALF) / SPAN;
    const fx = Math.max(0, Math.min(N - 1.0001, u * (N - 1)));
    const fz = Math.max(0, Math.min(N - 1.0001, v * (N - 1)));
    let x0 = Math.floor(fx);
    let z0 = Math.floor(fz);
    if (x0 >= N - 1) x0 = N - 2;
    if (z0 >= N - 1) z0 = N - 2;
    const tx = fx - x0;
    const tz = fz - z0;
    const i00 = z0 * N + x0;
    const a = grid[i00] * (1 - tx) + grid[i00 + 1] * tx;
    const b = grid[i00 + N] * (1 - tx) + grid[i00 + N + 1] * tx;
    return a * (1 - tz) + b * tz;
  }

  function sampleHeight(x, z) {
    if (!heightGrid) return heightAt(x, z);
    if (x < -HALF || x > HALF || z < -HALF || z > HALF) return heightAt(x, z);
    return sampleGrid(heightGrid, x, z);
  }

  function sampleSlope(x, z) {
    if (!slopeGrid) return 0;
    const u = (x + HALF) / SPAN;
    const v = (z + HALF) / SPAN;
    const ix = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
    const iz = Math.max(0, Math.min(N - 1, Math.round(v * (N - 1))));
    return slopeGrid[iz * N + ix];
  }

  function sampleBiome(x, z) {
    if (!biomeGrid) return BIOME.HILLS;
    const u = (x + HALF) / SPAN;
    const v = (z + HALF) / SPAN;
    const ix = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
    const iz = Math.max(0, Math.min(N - 1, Math.round(v * (N - 1))));
    return biomeGrid[iz * N + ix];
  }

  function sampleColor(x, z) {
    if (!colorGrid) return [0.5, 0.7, 0.4];
    const u = (x + HALF) / SPAN;
    const v = (z + HALF) / SPAN;
    const ix = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
    const iz = Math.max(0, Math.min(N - 1, Math.round(v * (N - 1))));
    const i = (iz * N + ix) * 3;
    return [colorGrid[i], colorGrid[i + 1], colorGrid[i + 2]];
  }

  function snapPlace(place, test) {
    let best = null;
    for (let dz = -90; dz <= 90; dz += 8) {
      for (let dx = -90; dx <= 90; dx += 8) {
        const x = place.x + dx;
        const z = place.z + dz;
        const h = sampleHeight(x, z);
        if (!test(h, x, z)) continue;
        const d2 = dx * dx + dz * dz;
        if (!best || d2 < best.d2) best = { x: x, z: z, h: h, d2: d2 };
      }
    }
    if (best) {
      place.x = best.x;
      place.z = best.z;
      place.ground = best.h;
    } else {
      place.ground = sampleHeight(place.x, place.z);
    }
    const floor = Math.max(place.ground, WATER_Y);
    place.y = Math.max(place.y, floor + 14);
  }

  function build() {
    if (ready) return ready;
    heightGrid = new Float32Array(N * N);
    slopeGrid = new Float32Array(N * N);
    biomeGrid = new Uint8Array(N * N);
    colorGrid = new Float32Array(N * N * 3);

    for (let iz = 0; iz < N; iz++) {
      const z = -HALF + iz * CELL;
      for (let ix = 0; ix < N; ix++) {
        const x = -HALF + ix * CELL;
        heightGrid[iz * N + ix] = heightAt(x, z);
      }
    }

    for (let iz = 0; iz < N; iz++) {
      const z = -HALF + iz * CELL;
      for (let ix = 0; ix < N; ix++) {
        const x = -HALF + ix * CELL;
        const i = iz * N + ix;
        const h = heightGrid[i];
        const ix0 = Math.max(0, ix - 1);
        const ix1 = Math.min(N - 1, ix + 1);
        const iz0 = Math.max(0, iz - 1);
        const iz1 = Math.min(N - 1, iz + 1);
        const dx = Math.abs(heightGrid[iz * N + ix1] - heightGrid[iz * N + ix0]) / ((ix1 - ix0) * CELL || CELL);
        const dz = Math.abs(heightGrid[iz1 * N + ix] - heightGrid[iz0 * N + ix]) / ((iz1 - iz0) * CELL || CELL);
        const slope = Math.max(dx, dz);
        slopeGrid[i] = slope;
        const biome = classify(x, z, h, slope);
        biomeGrid[i] = biome;
        const c = colorAt(x, z, h, slope, biome);
        colorGrid[i * 3] = c[0];
        colorGrid[i * 3 + 1] = c[1];
        colorGrid[i * 3 + 2] = c[2];
      }
    }

    snapPlace(PLACES[0], function (h) { return h > 12 && h < 28; });
    snapPlace(PLACES[1], function (h) { return h > 12 && h < 32; });
    snapPlace(PLACES[2], function (h) { return h > 14 && h < 40; });
    snapPlace(PLACES[3], function (h) { return h > 64 && h < 96; });
    snapPlace(PLACES[4], function (h) { return h > 10 && h < 28; });
    snapPlace(PLACES[5], function (h) { return h < 5; });
    snapPlace(PLACES[6], function (h) { return h < 5; });
    snapPlace(PLACES[7], function (h) { return h < 5; });
    snapPlace(PLACES[8], function (h) { return h > 8 && h < 16; });
    snapPlace(PLACES[9], function (h) { return h > 90; });
    snapPlace(PLACES[10], function (h) { return h > 5.2 && h < 8.2; });
    snapPlace(PLACES[11], function (h) { return h > 12 && h < 30; });
    const peak = PLACES[9];
    peak.y = Math.max(peak.ground + 18, WATER_Y + 16);

    const falls = [];
    const fallX = [60, 145, 230, 315, 400];
    for (let i = 0; i < fallX.length; i++) {
      const x = fallX[i];
      const ez = edgeZ(x);
      const top = sampleHeight(x, ez - 14);
      const bot = sampleHeight(x, ez + 30);
      falls.push({
        x: x,
        z: ez + 20,
        top: Math.max(top, bot + 28),
        bot: bot,
        width: 26 + (i % 2) * 12,
      });
    }

    const bridges = [];
    const bridgeSegs = [1, 3];
    for (let b = 0; b < bridgeSegs.length; b++) {
      const i = bridgeSegs[b];
      const a = GORGE[i];
      const c = GORGE[i + 1];
      const x = (a[0] + c[0]) * 0.5;
      const z = (a[1] + c[1]) * 0.5;
      bridges.push({
        x: x,
        z: z,
        yaw: Math.atan2(c[0] - a[0], c[1] - a[1]),
        deck: 30 + b * 4,
      });
    }

    const updrafts = [
      { x: -190, z: 590, r: 95, power: 20 },
      { x: 210, z: -280, r: 75, power: 11 },
      { x: 620, z: -40, r: 70, power: 15 },
    ];
    for (let i = 0; i < falls.length; i++) {
      updrafts.push({ x: falls[i].x, z: falls[i].z + 18, r: 62, power: 17 });
    }

    ready = {
      height: heightGrid,
      color: colorGrid,
      biome: biomeGrid,
      slope: slopeGrid,
      falls: falls,
      bridges: bridges,
      updrafts: updrafts,
    };
    return ready;
  }

  root.SkyWorld = {
    N: N,
    SPAN: SPAN,
    HALF: HALF,
    CELL: CELL,
    WATER_Y: WATER_Y,
    BIOME: BIOME,
    GORGE: GORGE,
    PEAKS: PEAKS,
    PLACES: PLACES,
    heightAt: heightAt,
    build: build,
    sampleHeight: sampleHeight,
    sampleSlope: sampleSlope,
    sampleBiome: sampleBiome,
    sampleColor: sampleColor,
    gorgeQuery: gorgeQuery,
    edgeZ: edgeZ,
    lakeDist: lakeDist,
  };
})(typeof self !== "undefined" ? self : globalThis);
