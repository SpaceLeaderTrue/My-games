/* КОПЭ: one 18-storey row of two sections.
   Only the 15th-floor two-room flat is open. Its larger room is the
   photographed one: balcony on the short street wall.
   Sizes follow the series (bay 3.6 m, ceiling 2.64 m), not a site survey. */
(function () {
  const FH = 2.8;
  const H = 2.64;
  const FLOORS = 18;
  const HOME = 14;
  const FY = HOME * FH;
  const EYE = 1.62;
  const BAY = 3.6;
  const SECTIONS = 2;
  const LEN = BAY * 7 * SECTIONS;
  const DEP = 18;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7cbe0);
  scene.fog = new THREE.Fog(0xb7cbe0, 80, 220);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 400);
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("view"), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene.add(new THREE.HemisphereLight(0xf4f7fb, 0xc4b39a, 0.92));
  const sun = new THREE.DirectionalLight(0xfff4e4, 1.15);
  sun.position.set(-30, 70, -20);
  scene.add(sun);

  const facade = mat(0xd9c4a2, 0.86);
  const ribMat = mat(0xf7f4ee, 0.7);
  const white = mat(0xf4f1ec, 0.55);
  const wall = mat(0xf6f1e8, 0.9);
  const floorMat = mat(0xc4a574, 0.8);
  const tile = mat(0xe4ddd2, 0.75);
  const bathMat = mat(0xd5dde6, 0.6);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9ec3d6, roughness: 0.05, metalness: 0.05,
    transparent: true, opacity: 0.38,
  });
  const dark = mat(0x2c3338, 0.5);
  const wood = mat(0x8a6244, 0.72);
  const cloth = mat(0xded6cc, 0.92);
  const screenMat = mat(0x1c2430, 0.35);
  const floral = floralMat();
  const roofMat = mat(0xb7b1a6, 0.9);

  const root = new THREE.Group();
  scene.add(root);

  function mat(color, roughness) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  }

  function floralMat() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#efe6d4";
    g.fillRect(0, 0, 128, 256);
    g.strokeStyle = "#e4d8c2";
    for (let y = 16; y < 256; y += 28) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(128, y);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = i % 2 ? "#c46b6b" : "#d98a4a";
      g.beginPath();
      g.arc(20 + (i % 5) * 24, 20 + Math.floor(i / 5) * 28, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#7e8f62";
      g.fillRect(16 + (i % 5) * 24, 24 + Math.floor(i / 5) * 28, 8, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.2, 1.6);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  }

  function add(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  }

  function massFloors() {
    for (let f = 0; f < FLOORS; f++) {
      const y = f * FH + FH / 2;
      if (f !== HOME) {
        add(LEN - 0.2, FH, DEP - 0.2, facade, LEN / 2, y, DEP / 2);
        continue;
      }
      add(LEN - 7.35, FH, 8.15, facade, 7.25 + (LEN - 7.35) / 2, y, 4.2);
      add(LEN - 0.4, FH, DEP - 11.35, facade, LEN / 2, y, 11.2 + (DEP - 11.35) / 2);
      add(LEN - 14.2, FH, 2.7, facade, 14.15 + (LEN - 14.2) / 2, y, 9.75);
    }
    add(LEN + 0.8, 0.35, DEP + 0.8, roofMat, LEN / 2, FLOORS * FH + 0.18, DEP / 2);
    add(LEN + 0.4, 0.9, 0.28, white, LEN / 2, FLOORS * FH + 0.8, -0.05);
    add(LEN + 0.4, 0.9, 0.28, white, LEN / 2, FLOORS * FH + 0.8, DEP + 0.05);
    add(0.28, 0.9, DEP + 0.4, white, -0.05, FLOORS * FH + 0.8, DEP / 2);
    add(0.28, 0.9, DEP + 0.4, white, LEN + 0.05, FLOORS * FH + 0.8, DEP / 2);
  }

  function ribs() {
    for (let s = 0; s < SECTIONS; s++) {
      for (let i = 0; i <= 7; i++) {
        const x = s * BAY * 7 + i * BAY;
        add(0.22, FLOORS * FH, 0.55, ribMat, x, FLOORS * FH / 2, -0.12);
        add(0.22, FLOORS * FH, 0.55, ribMat, x, FLOORS * FH / 2, DEP + 0.12);
      }
    }
for (let f = 0; f < FLOORS; f++) {
    const y = f * FH + FH / 2;
    if (f === HOME) {
      const base = f * FH;
      add(0.36, FH, 5.9, white, -0.02, base + FH / 2, 2.85);
      add(0.36, FH, DEP - 7.3, white, -0.02, base + FH / 2, 7.4 + (DEP - 7.3) / 2);
      add(0.36, 0.9, 1.6, white, -0.02, base + 0.45, 6.6);
      add(0.36, FH - 2.25, 1.6, white, -0.02, base + (2.25 + FH) / 2, 6.6);
    } else {
      add(0.36, FH, DEP + 0.2, white, -0.02, y, DEP / 2);
    }
    add(0.36, FH, DEP + 0.2, white, LEN + 0.02, y, DEP / 2);
  }
}

  const glassList = [];
  const balconyList = [];

function pushGlass(x, y, z, w, h) {
  glassList.push({ x, y, z, w, h });
}

function pushBalcony(x, front, floor) {
  balconyList.push({ x, front, floor });
}

  function shellOpenings() {
    for (let s = 0; s < SECTIONS; s++) {
      for (let bay = 0; bay < 7; bay++) {
        const x = s * BAY * 7 + bay * BAY + BAY / 2;
        for (let f = 0; f < FLOORS; f++) {
          const y = f * FH + 1.45;
          const userFront = s === 0 && f === HOME && (bay === 0 || bay === 1);
          if (!userFront) pushGlass(x, y, 0.02, 1.7, 1.45);
          if (bay !== 3) pushGlass(x, y, DEP - 0.02, 1.7, 1.45);
          if (bay === 0 || bay === 1 || bay === 4 || bay === 5) {
            const skip = s === 0 && f === HOME && bay === 1;
            if (!skip) pushBalcony(x, true, f);
          }
          if (bay === 2 || bay === 6) pushBalcony(x, false, f);
        }
      }
    }
    const panes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.06), glass, glassList.length);
    const dummy = new THREE.Object3D();
    glassList.forEach((g, i) => {
      dummy.position.set(g.x, g.y, g.z);
      dummy.scale.set(g.w, g.h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      panes.setMatrixAt(i, dummy.matrix);
    });
    root.add(panes);

    const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(3.15, 0.1, 1.02), white, balconyList.length);
    const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(3.15, 0.08, 0.06), white, balconyList.length);
    balconyList.forEach((b, i) => {
      const zc = b.front ? -0.55 : DEP + 0.55;
      dummy.position.set(b.x, b.floor * FH + 0.06, zc);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      slab.setMatrixAt(i, dummy.matrix);
      dummy.position.set(b.x, b.floor * FH + 1.05, b.front ? -1.02 : DEP + 1.02);
      dummy.updateMatrix();
      rail.setMatrixAt(i, dummy.matrix);
    });
    root.add(slab);
    root.add(rail);
  }

  function apartment() {
    const y = FY + H / 2;
    add(7.2, 0.08, 8.5, floorMat, 3.6, FY + 0.04, 4.2);
    add(3.05, 0.02, 2.85, tile, 1.95, FY + 0.09, 6.5);
    add(6.8, 0.08, 2.6, tile, 10.6, FY + 0.04, 9.75);
    add(2.7, 0.08, 2.5, tile, 6.05, FY + 0.04, 9.75);
    add(7.0, 0.1, 8.0, white, 3.55, FY + H - 0.02, 4.3);
    add(3.3, 0.08, 1.15, white, 5.35, FY + 2.55, -0.5);
    add(6.9, 0.1, 2.6, white, 10.55, FY + H - 0.02, 9.75);
    add(2.7, 0.1, 2.5, white, 6.05, FY + H - 0.02, 9.75);

    frontBay(0.15, 3.45, false);
    frontBay(3.75, 6.95, true);
    endWall();
    partitionZ(8.32, 0.35, 7.05, 5.15, 6.15);
    add(0.14, H, 7.9, wall, 7.08, FY + H / 2, 4.15);

    partitionZ(6.22, 3.7, 6.95, 4.15, 5.05);
    partitionX(3.6, 0.4, 6.05, null, null);
    partitionX(3.6, 6.4, 8.2, 6.45, 7.3);
    partitionZ(4.85, 0.4, 3.45, 1.15, 2.0);

    add(1.4, 1.05, 0.08, white, 1.3, FY + 0.55, 6.2);

    entranceDoor();
    landing();
    balconyDetail();
    furnish();
  }

  function frontBay(x0, x1, balconyRoom) {
    const y0 = FY;
    const z = 0.16;
    const t = 0.18;
    if (!balconyRoom) {
      add(x1 - x0, 0.85, t, wall, (x0 + x1) / 2, y0 + 0.42, z);
      add(x1 - x0, H - 2.25, t, wall, (x0 + x1) / 2, y0 + (2.25 + H) / 2, z);
      add(0.45, 1.4, t, wall, x0 + 0.22, y0 + 1.55, z);
      add(0.45, 1.4, t, wall, x1 - 0.22, y0 + 1.55, z);
      add((x1 - x0) - 0.9, 1.4, 0.04, glass, (x0 + x1) / 2, y0 + 1.55, 0.02);
      return;
    }
    add(0.4, H, t, wall, x0 + 0.2, y0 + H / 2, z);
    add(0.4, H, t, wall, x1 - 0.2, y0 + H / 2, z);
    add(x1 - x0 - 0.8, H - 2.3, t, wall, (x0 + x1) / 2, y0 + (2.3 + H) / 2, z);
    add(1.7, 0.82, t, wall, x0 + 1.25, y0 + 0.41, z);
    add(0.08, 2.3, t, white, x0 + 2.14, y0 + 1.15, z);
    add(1.55, 1.4, 0.04, glass, x0 + 1.22, y0 + 1.55, 0.02);
    add(0.85, 2.15, 0.04, glass, x0 + 2.62, y0 + 1.08, 0.02);
  }

function endWall() {
  const x = 0.18;
  const t = 0.24;
  const y0 = FY;
  add(t, H, 5.45, wall, x, y0 + H / 2, 2.9);
  add(t, H, 0.85, wall, x, y0 + H / 2, 7.85);
  add(t, 0.9, 1.7, wall, x, y0 + 0.45, 6.6);
  add(t, H - 2.3, 1.7, wall, x, y0 + (2.3 + H) / 2, 6.6);
  add(0.06, 1.35, 1.55, glass, 0.02, y0 + 1.55, 6.6);
}

  function partitionZ(z, x0, x1, door0, door1) {
    const t = 0.12;
    const y0 = FY;
    if (door0 == null) {
      add(x1 - x0, H, t, wall, (x0 + x1) / 2, y0 + H / 2, z);
      return;
    }
    add(door0 - x0, H, t, wall, (x0 + door0) / 2, y0 + H / 2, z);
    add(x1 - door1, H, t, wall, (door1 + x1) / 2, y0 + H / 2, z);
    add(door1 - door0, H - 2.08, t, wall, (door0 + door1) / 2, y0 + (2.08 + H) / 2, z);
  }

  function partitionX(x, z0, z1, door0, door1) {
    const t = 0.12;
    const y0 = FY;
    if (door0 == null) {
      add(t, H, z1 - z0, wall, x, y0 + H / 2, (z0 + z1) / 2);
      return;
    }
    add(t, H, door0 - z0, wall, x, y0 + H / 2, (z0 + door0) / 2);
    add(t, H, z1 - door1, wall, x, y0 + H / 2, (door1 + z1) / 2);
    add(t, H - 2.08, door1 - door0, wall, x, y0 + (2.08 + H) / 2, (door0 + door1) / 2);
  }

function entranceDoor() {
  add(0.06, 2.08, 0.82, wood, 5.08, FY + 1.04, 7.75);
}

function landing() {
  const y0 = FY + 1.1;
  add(0.9, 2.2, 0.08, dark, 8.6, y0, 10.85);
  add(0.9, 2.2, 0.08, dark, 10.0, y0, 10.85);
  add(0.9, 2.2, 0.08, dark, 11.4, y0, 10.85);
  add(0.12, H, 2.6, wall, 4.85, FY + H / 2, 9.7);
  add(1.2, 0.04, 0.7, white, 12.6, FY + 0.7, 9.6);
  add(0.08, 0.7, 0.7, white, 12.05, FY + 0.4, 9.6);
  add(0.08, 0.7, 0.7, white, 13.15, FY + 0.75, 9.6);
}

  function balconyDetail() {
    add(3.2, 0.1, 1.15, white, 5.35, FY + 0.08, -0.55);
    add(3.2, 0.08, 0.06, white, 5.35, FY + 1.1, -1.08);
    add(0.06, 1.05, 0.06, white, 3.78, FY + 0.58, -1.08);
    add(0.06, 1.05, 0.06, white, 6.92, FY + 0.58, -1.08);
    add(0.06, 1.05, 1.1, white, 3.78, FY + 0.58, -0.55);
    add(0.06, 1.05, 1.1, white, 6.92, FY + 0.58, -0.55);
    add(3.2, 0.9, 0.04, glass, 5.35, FY + 0.55, -1.08);
  }

  function furnish() {
    add(0.08, H, 5.5, floral, 3.78, FY + H / 2, 3.15);
    add(0.42, 1.7, 2.4, wood, 6.72, FY + 0.85, 3.3);
    add(0.04, 0.7, 1.35, screenMat, 6.48, FY + 1.15, 3.3);
    add(2.15, 0.45, 0.9, cloth, 5.15, FY + 0.4, 2.15);
    add(2.15, 0.28, 0.22, cloth, 5.15, FY + 0.62, 2.55);
    add(0.7, 0.04, 0.7, wood, 5.5, FY + 0.48, 3.7);
    add(0.08, 0.46, 0.08, wood, 5.25, FY + 0.24, 3.45);
    add(0.08, 0.46, 0.08, wood, 5.75, FY + 0.24, 3.95);
    add(1.2, 1.55, 0.08, screenMat, 6.15, FY + 1.35, 5.85);
    add(0.08, 1.5, 0.08, dark, 5.55, FY + 0.75, 5.7);
    add(0.08, 1.5, 0.08, dark, 6.75, FY + 0.75, 5.7);
    add(1.35, 0.06, 0.4, dark, 6.15, FY + 1.5, 5.55);

    add(1.5, 0.4, 2.05, cloth, 1.7, FY + 0.38, 2.3);
    add(1.5, 0.12, 0.9, white, 1.7, FY + 0.62, 1.55);
    add(0.55, 0.85, 2.4, wood, 1.15, FY + 0.45, 6.55);
    add(0.5, 0.04, 0.5, dark, 2.4, FY + 0.9, 6.55);
  }

  function distantCity() {
    const block = mat(0xc8b89a, 0.9);
    [[-18, -48, 16, 40, 12], [30, -62, 22, 30, 14], [8, -90, 30, 52, 16]].forEach((b) => {
      add(b[2], b[3], b[4], block, b[0], b[3] / 2, b[1]);
    });
    add(LEN + 80, 0.2, 220, mat(0xb7c4a4, 1), LEN / 2, -0.1, -40);
  }

  massFloors();
  ribs();
  shellOpenings();
  apartment();
  distantCity();

const zones = [
  { x0: 0.4, x1: 3.42, z0: 0.4, z1: 4.72 },
  { x0: 0.4, x1: 3.42, z0: 5.0, z1: 6.35 },
  { x0: 0.4, x1: 3.58, z0: 6.35, z1: 7.95 },
  { x0: 3.78, x1: 6.9, z0: 0.45, z1: 6.08 },
  { x0: 3.72, x1: 6.9, z0: 6.35, z1: 8.2 },
  { x0: 1.05, x1: 2.15, z0: 4.6, z1: 5.15 },
  { x0: 4.05, x1: 5.2, z0: 5.9, z1: 6.55 },
  { x0: 3.25, x1: 4.05, z0: 6.45, z1: 7.25 },
  { x0: 5.05, x1: 6.25, z0: 8.0, z1: 8.85 },
  { x0: 4.95, x1: 13.95, z0: 8.5, z1: 10.95 },
  { x0: 3.85, x1: 6.85, z0: -1.0, z1: 0.6 },
];
  const blocks = [
    { x0: 4.3, x1: 6.3, z0: 1.7, z1: 2.7 },
    { x0: 6.4, x1: 6.95, z0: 2.2, z1: 4.5 },
    { x0: 5.45, x1: 6.85, z0: 5.4, z1: 6.02 },
    { x0: 1.05, x1: 2.4, z0: 1.4, z1: 3.3 },
    { x0: 0.85, x1: 1.5, z0: 5.5, z1: 7.6 },
  ];

  const canvas = renderer.domElement;
  const playCard = document.getElementById("play");
  const crosshair = document.getElementById("crosshair");
  const hint = document.getElementById("hint");
  const buttons = [...document.querySelectorAll("#views button")];
  const keys = {};
  const walk = { yaw: Math.PI, pitch: -0.05, x: 5.4, z: 1.5 };
  let viewName = "room";
  const orbit = { dragging: false, theta: 0.15, phi: 1.05, r: 62 };
  const target = new THREE.Vector3();

  function free(x, z) {
    if (blocks.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) return false;
    return zones.some((r) => x > r.x0 + 0.08 && x < r.x1 - 0.08 && z > r.z0 + 0.08 && z < r.z1 - 0.08);
  }

  function lookFromWalk() {
    const cos = Math.cos(walk.pitch);
    camera.position.set(walk.x, FY + EYE, walk.z);
    target.set(
      walk.x - Math.sin(walk.yaw) * cos,
      FY + EYE + Math.sin(walk.pitch),
      walk.z - Math.cos(walk.yaw) * cos
    );
    camera.lookAt(target);
  }

  function lookOutside() {
    const sp = orbit;
    camera.position.set(
      LEN / 2 + sp.r * Math.sin(sp.phi) * Math.sin(sp.theta),
      18 + sp.r * Math.cos(sp.phi),
      DEP / 2 + sp.r * Math.sin(sp.phi) * Math.cos(sp.theta)
    );
    camera.lookAt(LEN / 2, 20, DEP / 2);
  }

  function setView(name) {
    viewName = name;
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (name === "outside") {
      lookOutside();
    } else if (name === "balcony") {
      walk.x = 5.4;
      walk.z = -0.45;
      walk.yaw = 0;
      walk.pitch = -0.02;
      lookFromWalk();
    } else if (name === "kitchen") {
      walk.x = 2.1;
      walk.z = 6.5;
      walk.yaw = Math.PI / 2;
      walk.pitch = -0.04;
      lookFromWalk();
    } else {
      walk.x = 5.4;
      walk.z = 1.45;
      walk.yaw = Math.PI;
      walk.pitch = -0.04;
      lookFromWalk();
    }
    updateChrome();
  }

  function updateChrome() {
    const locked = document.pointerLockElement === canvas;
    const outside = viewName === "outside";
    playCard.style.display = locked || outside ? "none" : "flex";
    crosshair.style.display = locked ? "block" : "none";
    hint.textContent = outside
      ? "Дом снаружи: левая кнопка крутит обзор. Чтобы зайти в квартиру, выберите комнату."
      : "WASD — ходить, мышь — смотреть, Shift — бежать, Esc — отпустить мышь.";
  }

  buttons.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  canvas.addEventListener("click", () => {
    if (viewName === "outside" || document.pointerLockElement === canvas) return;
    canvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", updateChrome);
  canvas.addEventListener("pointerdown", (event) => {
    if (viewName !== "outside" || event.button !== 0) return;
    orbit.dragging = true;
  });
  window.addEventListener("pointerup", () => {
    orbit.dragging = false;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (document.pointerLockElement === canvas && viewName !== "outside") {
      walk.yaw -= event.movementX * 0.0017;
      walk.pitch -= event.movementY * 0.0017;
      walk.pitch = Math.max(-1.15, Math.min(1.15, walk.pitch));
      lookFromWalk();
      return;
    }
    if (!orbit.dragging || viewName !== "outside") return;
    orbit.theta -= event.movementX * 0.005;
    orbit.phi -= event.movementY * 0.005;
    orbit.phi = Math.max(0.35, Math.min(1.35, orbit.phi));
    lookOutside();
  });
  window.addEventListener("keydown", (event) => {
    keys[event.code] = true;
  });
  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (viewName !== "outside" && document.pointerLockElement === canvas) {
      let ix = 0;
      let iz = 0;
      if (keys.KeyW || keys.ArrowUp) iz += 1;
      if (keys.KeyS || keys.ArrowDown) iz -= 1;
      if (keys.KeyA || keys.ArrowLeft) ix -= 1;
      if (keys.KeyD || keys.ArrowRight) ix += 1;
      if (ix || iz) {
        const len = Math.hypot(ix, iz) || 1;
        const speed = (keys.ShiftLeft || keys.ShiftRight ? 4.6 : 2.3) * dt;
        const sin = Math.sin(walk.yaw);
        const cos = Math.cos(walk.yaw);
        const dx = ((-sin * iz + cos * ix) / len) * speed;
        const dz = ((-cos * iz - sin * ix) / len) * speed;
        if (free(walk.x + dx, walk.z)) walk.x += dx;
        if (free(walk.x, walk.z + dz)) walk.z += dz;
        lookFromWalk();
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener("resize", resize);
  resize();
  const initial = (location.hash || "").replace("#", "");
  setView(["room", "balcony", "kitchen", "outside"].includes(initial) ? initial : "room");
  requestAnimationFrame(frame);

  window.__kope = { setView, walk, camera, renderer, scene, free };
})();
