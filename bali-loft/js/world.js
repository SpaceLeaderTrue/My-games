import * as THREE from "https://unpkg.com/three@0.170.0/build/three.module.js";
import { L, terrainWalk } from "./layout.js";

const geo = {
  box: new Map(),
};

function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geo.box.has(k)) geo.box.set(k, new THREE.BoxGeometry(w, h, d));
  return geo.box.get(k);
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...opts });
}

function addBox(parent, w, h, d, material, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const FEEDS = [
  { name: "Mira", hue: 205, accent: "#7eb6e2" },
  { name: "Kenji", hue: 168, accent: "#6ec8b8" },
  { name: "Sofia", hue: 28, accent: "#e0a15a" },
  { name: "You", hue: 42, accent: "#d7c39a" },
];

export function createFeeds() {
  return FEEDS.map((feed, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 216;
    const ctx = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const draw = (time, cameraOn) => {
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.3 + index);
      const g = ctx.createLinearGradient(0, 0, 384, 216);
      g.addColorStop(0, `hsl(${feed.hue} 28% ${14 + pulse * 5}%)`);
      g.addColorStop(1, `hsl(${(feed.hue + 24) % 360} 18% 9%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 384, 216);
      if (!cameraOn) {
        ctx.fillStyle = "#eef3f8";
        ctx.font = "600 28px Manrope, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Камера выкл.", 192, 108);
        texture.needsUpdate = true;
        return;
      }
      const cx = 192 + Math.sin(time * 0.6 + index) * 16;
      const cy = 86;
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fillStyle = feed.accent;
      ctx.fill();
      ctx.fillStyle = "#10161c";
      ctx.font = "700 42px Syne, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(feed.name[0], cx, cy + 2);
      ctx.fillStyle = "rgba(8,12,16,0.55)";
      ctx.fillRect(96, 156, 192, 36);
      ctx.fillStyle = "#eef3f8";
      ctx.font = "600 20px Manrope, sans-serif";
      ctx.fillText(feed.name, 192, 174);
      texture.needsUpdate = true;
    };
    draw(0, true);
    return { ...feed, index, canvas, texture, draw };
  });
}

function screenPanel(parent, feed, x, y, z, rotY) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  const frame = new THREE.Mesh(boxGeo(1.78, 1.12, 0.08), mat("#1a1e24", { roughness: 0.45, metalness: 0.4 }));
  group.add(frame);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 0.92),
    new THREE.MeshBasicMaterial({ map: feed.texture, toneMapped: false }),
  );
  face.position.z = 0.05;
  face.name = "screen";
  face.userData.feedIndex = feed.index;
  group.add(face);
  parent.add(group);
  return face;
}

function person(parent, x, y, z, shirt, yaw) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  const skin = mat("#e0b090", { roughness: 0.7 });
  const cloth = mat(shirt, { roughness: 0.75 });
  addBox(g, 0.36, 0.55, 0.22, cloth, 0, 1.05, 0);
  addBox(g, 0.22, 0.22, 0.22, skin, 0, 1.48, 0);
  addBox(g, 0.12, 0.55, 0.12, cloth, -0.12, 0.45, 0);
  addBox(g, 0.12, 0.55, 0.12, cloth, 0.12, 0.45, 0);
  parent.add(g);
  return g;
}

function palm(parent, x, z, s = 1) {
  const trunk = mat("#6a4a2c", { roughness: 0.9 });
  const leaf = mat("#2f6b3a", { roughness: 0.85 });
  addBox(parent, 0.22 * s, 2.4 * s, 0.22 * s, trunk, x, 1.2 * s, z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = addBox(parent, 0.16 * s, 0.06 * s, 1.5 * s, leaf, x + Math.cos(a) * 0.55 * s, 2.35 * s, z + Math.sin(a) * 0.55 * s, false);
    m.lookAt(x, 1.5 * s, z);
  }
}

function sign(parent, text, x, y, z, rotY) {
  const tex = canvasTex(512, 160, (ctx) => {
    ctx.fillStyle = "#142028";
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = "#e0a15a";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = "#f4efe4";
    ctx.font = "700 64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 84);
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  parent.add(mesh);
  addBox(parent, 0.08, 1.5, 0.08, mat("#5c4632"), x, y - 0.9, z);
}

export function createWorld(scene, feeds) {
  const wood = mat("#8d5a32", { roughness: 0.62 });
  const plaster = mat("#f4efe6", { roughness: 0.9 });
  const stone = mat("#c9bba6", { roughness: 0.92 });
  const metal = mat("#8d98a3", { roughness: 0.32, metalness: 0.72 });
  const glass = new THREE.MeshStandardMaterial({
    color: "#c5e6f6",
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.15,
    depthWrite: false,
  });
  const concrete = mat("#6a7076", { roughness: 0.9 });
  const dark = mat("#2a2e32", { roughness: 0.86 });
  const hazard = mat("#d7a41a", { roughness: 0.55 });

  scene.background = new THREE.Color("#8ecddd");
  scene.fog = new THREE.Fog("#b7dbe3", 70, 230);
  scene.add(new THREE.HemisphereLight("#d5ecff", "#6d8a48", 0.85));
  const sun = new THREE.DirectionalLight("#fff1d4", 2.35);
  sun.position.set(36, 58, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const grassTex = canvasTex(64, 64, (ctx) => {
    ctx.fillStyle = "#6e9450";
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 ? "#628848" : "#7ea45c";
      ctx.fillRect((i * 17) % 64, (i * 13) % 64, 2, 2);
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(28, 28);

  const groundGeo = new THREE.PlaneGeometry(180, 170, 70, 64);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainWalk(x, z);
    pos.setY(i, y);
    if (y < -4.4) c.set("#d9c395");
    else if (y < -1.2) c.set("#c6b07a");
    else c.set("#6d944e");
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const oceanGeo = new THREE.PlaneGeometry(420, 260, 80, 40);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshStandardMaterial({ color: "#1c9aaf", roughness: 0.22, metalness: 0.45, transparent: true, opacity: 0.92 }),
  );
  ocean.position.set(0, -6.15, 150);
  scene.add(ocean);

  const v = L.villa;
  const villa = new THREE.Group();
  scene.add(villa);
  addBox(villa, 28.4, 0.16, 32.4, wood, 0, 0.08, 0);
  addBox(villa, v.maxX - v.minX + 0.4, 7, 0.36, plaster, 0, 3.5, v.minZ);
  addBox(villa, 0.36, 7, 32, plaster, v.minX, 3.5, 0);
  addBox(villa, 0.36, 7, 32, plaster, v.maxX, 3.5, 0);
  addBox(villa, (v.maxX - v.doorHalf) - 0.1, 7, 0.36, plaster, (v.doorHalf + v.maxX) / 2, 3.5, v.maxZ);
  addBox(villa, (v.maxX - v.doorHalf) - 0.1, 7, 0.36, plaster, (-v.doorHalf + v.minX) / 2, 3.5, v.maxZ);
  addBox(villa, v.doorHalf * 2, 1.15, 0.28, plaster, 0, 6.35, v.maxZ);
  addBox(villa, 28.6, 0.22, 32.6, stone, 0, L.roofY, 0);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.4), glass);
  win.position.set(8, 2.2, v.maxZ + 0.2);
  villa.add(win);
  const win2 = win.clone();
  win2.position.x = -8;
  villa.add(win2);

  const slab = L.mezz;
  addBox(villa, slab.maxX - slab.minX, 0.16, slab.maxZ - slab.minZ, wood, (slab.minX + slab.maxX) / 2, slab.y, (slab.minZ + slab.maxZ) / 2);
  const stair = L.mezzStair;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const z = stair.zBot + (stair.zTop - stair.zBot) * t;
    const y = stair.yBot + (stair.yTop - stair.yBot) * t;
    addBox(villa, stair.maxX - stair.minX, 0.12, 0.42, stone, (stair.minX + stair.maxX) / 2, y, z);
  }

  addBox(villa, 3.6, 0.45, 1.7, mat("#f7f1e6"), 4.2, 0.4, 1.5);
  addBox(villa, 3.4, 0.4, 0.25, mat("#f7f1e6"), 4.2, 0.7, 0.7);
  addBox(villa, 3.2, 0.9, 0.7, wood, 10.8, 0.55, -6.6);
  addBox(villa, 3.3, 0.08, 0.8, stone, 10.8, 1.05, -6.6);
  addBox(villa, 2.2, 0.1, 1.3, wood, -4.2, 0.72, 6.8);
  addBox(villa, 0.12, 0.7, 0.12, wood, -5.1, 0.35, 6.2);
  addBox(villa, 0.12, 0.7, 0.12, wood, -3.3, 0.35, 6.2);
  const screenZ = v.minZ + 0.55;
  feeds.forEach((feed, i) => {
    screenPanel(villa, feed, -4.6 + i * 3.05, 1.7, screenZ, 0);
  });
  const lamp = new THREE.PointLight("#ffe6c4", 1.4, 16, 2);
  lamp.position.set(0, 3.1, 2);
  villa.add(lamp);

  const rs = L.roofStair;
  const roofSteps = 22;
  for (let i = 0; i < roofSteps; i++) {
    const t = (i + 0.5) / roofSteps;
    const z = rs.zBot + (rs.zTop - rs.zBot) * t;
    const y = rs.yBot + (rs.yTop - rs.yBot) * t;
    addBox(scene, rs.halfW * 2, 0.12, 0.62, stone, rs.x, y, z);
    if (i % 2 === 0) {
      addBox(scene, 0.08, 0.9, 0.08, metal, rs.x - rs.halfW, y + 0.5, z, false);
      addBox(scene, 0.08, 0.9, 0.08, metal, rs.x + rs.halfW, y + 0.5, z, false);
    }
  }
  const land = L.roofLanding;
  addBox(scene, land.maxX - land.minX, 0.16, land.maxZ - land.minZ, stone, (land.minX + land.maxX) / 2, land.y, (land.minZ + land.maxZ) / 2);

  const pool = L.pool;
  addBox(villa, pool.maxX - pool.minX, 0.7, pool.maxZ - pool.minZ, mat("#d5ebe8", { roughness: 0.35 }), (pool.minX + pool.maxX) / 2, L.roofY - 0.15, (pool.minZ + pool.maxZ) / 2, false);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(pool.maxX - pool.minX - 0.5, pool.maxZ - pool.minZ - 0.5),
    new THREE.MeshStandardMaterial({ color: "#1aa0b8", transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.2 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((pool.minX + pool.maxX) / 2, L.roofY + 0.22, (pool.minZ + pool.maxZ) / 2);
  villa.add(water);
  addBox(villa, 3.2, 1.05, 0.8, wood, -8.2, L.roofY + 0.6, -10);
  addBox(villa, 3.3, 0.08, 0.9, metal, -8.2, L.roofY + 1.15, -10);
  const dancers = [];
  dancers.push(person(villa, -6, L.roofY, 2, "#e05078", 0.4));
  dancers.push(person(villa, -3.2, L.roofY, 3.4, "#3a6ad4", -0.6));
  dancers.push(person(villa, -7.4, L.roofY, -8.6, "#222", 0.2));
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 1.15, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: "#9cf3ff", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.set(L.beam.x, L.roofY + 9.2, L.beam.z);
  scene.add(beam);

  const ufo = new THREE.Group();
  ufo.position.set(L.ufo.x, L.ufo.floor + 2.2, L.ufo.z);
  const hullMat = mat("#d5dee8", { roughness: 0.28, metalness: 0.82 });
  const disc = new THREE.Mesh(new THREE.SphereGeometry(6.2, 28, 16), hullMat);
  disc.scale.y = 0.28;
  ufo.add(disc);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#c8f4ff", transparent: true, opacity: 0.35, roughness: 0.05 }),
  );
  dome.position.y = 0.7;
  ufo.add(dome);
  scene.add(ufo);
  addBox(scene, 10.2, 0.16, 10.2, mat("#9fd0dc", { roughness: 0.25, metalness: 0.4 }), L.ufo.x, L.ufo.floor, L.ufo.z);

  const bunker = new THREE.Group();
  scene.add(bunker);
  const pad = L.bunker.pad;
  addBox(bunker, pad.maxX - pad.minX, 0.18, pad.maxZ - pad.minZ, concrete, (pad.minX + pad.maxX) / 2, pad.y, 0);
  addBox(bunker, 0.7, 3.3, 2.1, concrete, 44, 1.65, -3.2);
  addBox(bunker, 0.7, 3.3, 2.1, concrete, 44, 1.65, 3.2);
  addBox(bunker, 2.4, 0.45, 0.35, hazard, 44.1, 3.15, 0);
  const ramp = L.bunker.ramp;
  const rampLen = ramp.x1 - ramp.x0;
  const rampDrop = ramp.y0 - ramp.y1;
  const rampMesh = addBox(bunker, rampLen, 0.16, ramp.halfW * 2, concrete, (ramp.x0 + ramp.x1) / 2, (ramp.y0 + ramp.y1) / 2, 0, false);
  rampMesh.rotation.z = Math.atan2(rampDrop, rampLen);
  addBox(bunker, rampLen, 0.8, 0.28, dark, (ramp.x0 + ramp.x1) / 2, -2.2, ramp.halfW + 0.3);
  addBox(bunker, rampLen, 0.8, 0.28, dark, (ramp.x0 + ramp.x1) / 2, -2.2, -ramp.halfW - 0.3);
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    const x = ramp.x0 + rampLen * t;
    const y = ramp.y0 - rampDrop * t + 1.15;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: "#ffd9a0" }),
    );
    bulb.position.set(x, y, 0);
    bunker.add(bulb);
  }
  const room = L.bunker.room;
  addBox(bunker, room.maxX - room.minX, 0.2, room.maxZ - room.minZ, mat("#4a5058"), (room.minX + room.maxX) / 2, room.y, 0);
  addBox(bunker, room.maxX - room.minX, room.h, 0.3, dark, (room.minX + room.maxX) / 2, room.y + room.h / 2, room.minZ);
  addBox(bunker, room.maxX - room.minX, room.h, 0.3, dark, (room.minX + room.maxX) / 2, room.y + room.h / 2, room.maxZ);
  addBox(bunker, 0.3, room.h, room.maxZ - room.minZ, dark, room.maxX, room.y + room.h / 2, 0);
  addBox(bunker, room.maxX - room.minX, 0.28, room.maxZ - room.minZ, dark, (room.minX + room.maxX) / 2, room.y + room.h, 0, false);
  addBox(bunker, 18, 2.4, 14, mat("#5c6560"), 66, 1.3, 0, false);
  const bunkerScreens = feeds.map((feed, i) => screenPanel(bunker, feed, room.maxX - 0.4, room.y + 1.85, -4.6 + i * 3.05, -Math.PI / 2));
  const bunkerLight = new THREE.PointLight("#d7e6ff", 2.2, 18, 2);
  bunkerLight.position.set(71, room.y + 3, 0);
  bunker.add(bunkerLight);
  const villaScreens = villa.children.filter((obj) => obj.userData?.feedIndex !== undefined);
  // screens live on nested groups; collect properly below

  const pier = L.pier;
  for (let z = pier.z0; z < pier.z1; z += 0.7) {
    addBox(scene, pier.maxX - pier.minX, 0.14, 0.62, z % 1.4 < 0.7 ? wood : mat("#6b4528"), 0, pier.y, z);
  }
  for (let z = pier.z0 + 1; z < pier.z1; z += 3.2) {
    addBox(scene, 0.16, 2.2, 0.16, mat("#5a3a22"), pier.minX + 0.1, pier.y - 1.1, z, false);
    addBox(scene, 0.16, 2.2, 0.16, mat("#5a3a22"), pier.maxX - 0.1, pier.y - 1.1, z, false);
  }

  const boat = new THREE.Group();
  const hull = mat("#24384a", { roughness: 0.55, metalness: 0.25 });
  addBox(boat, 5.4, 1.15, 12.4, hull, 0, 0.55, 0);
  addBox(boat, 4.6, 0.12, 12.8, wood, 0, 1.15, 0);
  addBox(boat, 2.4, 1.7, 3, mat("#e7e1d6"), 0, 2.05, 3.2);
  addBox(boat, 1.3, 0.7, 0.08, glass, 0, 2.3, 1.72, false);
  addBox(boat, 0.08, 0.7, 0.08, metal, -2.5, 1.7, -2, false);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 16), metal);
  wheel.position.set(0, 1.7, -4.4);
  boat.add(wheel);
  scene.add(boat);

  const gangway = addBox(scene, 1.6, 0.08, 2.2, wood, (pier.maxX + L.boat.x - L.boat.halfX) / 2, L.pier.y + 0.06, L.boat.z1, false);
  gangway.visible = false;

  sign(scene, "КРЫША  ↑", -14.2, 1.7, 15.2, -0.6);
  sign(scene, "БУНКЕР  →", 20.5, 1.7, 6.5, -Math.PI / 2);

  const palms = [
    [-24, 10], [-22, -6], [22, 20], [26, -14], [-18, 40], [16, 46], [-10, 50], [36, 18], [58, 20], [-40, 8], [10, -24], [-30, 24],
  ];
  for (const [x, z] of palms) palm(scene, x, z, 1.15);

  addBox(scene, 4.2, 1.3, 1.8, mat("#3d4a3a", { metalness: 0.35, roughness: 0.55 }), 9.2, 0.7, 22, true);
  addBox(scene, 8, 0.2, 6, wood, -18, 0.2, 48);
  addBox(scene, 6, 0.12, 4.5, mat("#e6d3a2"), -18, 2.5, 48, false);
  const rocket = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 8, 12), mat("#e8eef2", { metalness: 0.45, roughness: 0.35 }));
  rocket.position.set(-42, 4, -8);
  rocket.castShadow = true;
  scene.add(rocket);

  const screens = [];
  scene.traverse((obj) => {
    if (obj.userData?.feedIndex !== undefined) screens.push(obj);
  });

  const oceanPos = oceanGeo.attributes.position;
  const oceanBase = new Float32Array(oceanPos.count);
  for (let i = 0; i < oceanPos.count; i++) oceanBase[i] = oceanPos.getY(i);

  return {
    boat,
    gangway,
    screens,
    bunkerScreens,
    villaScreens,
    dancers,
    beam,
    ufo,
    sun,
    update(time, pose) {
      boat.position.set(pose.x, pose.deckY - 1.15, pose.z);
      boat.rotation.z = Math.sin(time * 0.8) * (pose.phase === "sailing" ? 0.03 : 0.008);
      gangway.visible = pose.berthed;
      gangway.position.set((L.pier.maxX + pose.x - L.boat.halfX) / 2, pose.deckY + 0.05, pose.z);
      for (let i = 0; i < oceanPos.count; i++) {
        const x = oceanPos.getX(i);
        const z = oceanPos.getZ(i);
        oceanPos.setY(i, oceanBase[i] + Math.sin(x * 0.08 + time) * 0.18 + Math.cos(z * 0.06 + time * 0.8) * 0.14);
      }
      oceanPos.needsUpdate = true;
      for (let i = 0; i < dancers.length; i++) {
        dancers[i].position.y = L.roofY + Math.abs(Math.sin(time * 2.2 + i)) * 0.18;
      }
      beam.material.opacity = 0.14 + Math.sin(time * 2) * 0.04;
      ufo.position.y = L.ufo.floor + 2.2 + Math.sin(time * 0.7) * 0.25;
      ufo.rotation.y = time * 0.15;
    },
  };
}
