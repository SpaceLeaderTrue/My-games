/* Approximate living room from four photos. Units are meters. */
(function () {
  const THREE = window.THREE;
  const W = 4.05;
  const D = 5.45;
  const H = 2.62;
  const SOFA = { x0: 0.22, x1: 2.77, z0: 1.78, z1: 2.9 };
  const TABLE = { x: 1.7, z: 1.14, r: 0.46, top: 0.76 };
  const UNIT_Z1 = 4.02;
  const SCREEN = { x: 2.25, z: 4.96, w: 2.16, h: 1.26, bottom: 0.72 };
  const WIN = { x0: 0.18, x1: 2.4, y0: 0.78, y1: 2.18 };

  const canvas = document.getElementById("view");
  const hint = document.getElementById("hint");
  const pickEl = document.getElementById("pick");
  const errEl = document.getElementById("err");

  function fail(message) {
    errEl.style.display = "block";
    errEl.textContent = message;
  }

  window.addEventListener("error", (event) => fail(event.message));

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(20260329);

  function canvasTexture(draw, wrapX, wrapY) {
    const canvasEl = document.createElement("canvas");
    draw(canvasEl);
    const tex = new THREE.CanvasTexture(canvasEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (wrapX) tex.repeat.x = wrapX;
    if (wrapY) tex.repeat.y = wrapY;
    return tex;
  }

  function makeTextures() {
    const floral = canvasTexture((c) => {
      c.width = 512;
      c.height = 512;
      const g = c.getContext("2d");
      g.fillStyle = "#e5ddcf";
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "rgba(150, 142, 126, 0.45)";
      g.fillStyle = "rgba(168, 160, 142, 0.28)";
      g.lineWidth = 1.4;
      for (let i = 0; i < 16; i++) {
        const x = 16 + ((i * 67) % 500);
        g.beginPath();
        g.moveTo(x, 520);
        g.bezierCurveTo(x + 28, 360, x - 36, 220, x + 8, -10);
        g.stroke();
        for (let k = 0; k < 7; k++) {
          const y = 36 + k * 68;
          g.beginPath();
          g.ellipse(x + (k % 2 ? 16 : -16), y, 12, 5, k % 2 ? 0.7 : -0.7, 0, Math.PI * 2);
          g.fill();
        }
      }
    }, 2.1, 1.5);

    const wood = canvasTexture((c) => {
      c.width = 256;
      c.height = 512;
      const g = c.getContext("2d");
      const local = mulberry32(7);
      for (let i = 0; i < 4; i++) {
        const shade = 138 + Math.floor(local() * 36);
        g.fillStyle = "rgb(" + (shade + 42) + "," + (shade - 8) + "," + (shade - 48) + ")";
        g.fillRect(i * 64, 0, 62, 512);
        g.fillStyle = "rgba(90, 48, 24, 0.16)";
        for (let k = 0; k < 18; k++) {
          g.fillRect(i * 64 + 4, local() * 512, 40 + local() * 18, 1.5);
        }
      }
    }, W / 0.56, D / 1.35);

    const fabric = canvasTexture((c) => {
      c.width = 256;
      c.height = 256;
      const g = c.getContext("2d");
      const local = mulberry32(11);
      g.fillStyle = "#e6d3b8";
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3500; i++) {
        const v = 190 + Math.floor(local() * 50);
        g.fillStyle = "rgba(" + v + "," + (v - 16) + "," + (v - 38) + ",0.18)";
        g.fillRect(local() * 256, local() * 256, 2, 2);
      }
    }, 3, 2);

    function artCanvas(paint) {
      return canvasTexture((c) => {
        c.width = 320;
        c.height = 400;
        paint(c.getContext("2d"), c);
      });
    }

    const stillLife = artCanvas((g) => {
      g.fillStyle = "#d8b56a";
      g.fillRect(0, 0, 320, 400);
      g.fillStyle = "#f2e2c4";
      g.fillRect(36, 40, 248, 250);
      g.fillStyle = "#8d4b32";
      g.beginPath();
      g.ellipse(160, 250, 70, 28, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c4493a";
      g.beginPath();
      g.arc(130, 210, 28, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e0b03a";
      g.beginPath();
      g.arc(190, 200, 22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#6a8f4a";
      g.beginPath();
      g.ellipse(168, 168, 16, 8, -0.6, 0, Math.PI * 2);
      g.fill();
    });

    const landscape = artCanvas((g) => {
      g.fillStyle = "#d5dee6";
      g.fillRect(0, 0, 320, 180);
      g.fillStyle = "#b9cfe0";
      g.fillRect(0, 0, 320, 150);
      g.fillStyle = "#c2b48a";
      g.fillRect(0, 150, 320, 250);
      g.fillStyle = "#8d8578";
      g.fillRect(40, 168, 240, 8);
      g.fillStyle = "#6d624f";
      g.fillRect(150, 90, 90, 70);
      g.fillStyle = "#3e3830";
      g.beginPath();
      g.moveTo(140, 100);
      g.lineTo(195, 58);
      g.lineTo(250, 100);
      g.fill();
      g.fillStyle = "#6f8fa8";
      for (let i = 0; i < 5; i++) g.fillRect(18 + i * 28, 188, 16, 6);
    });

    const smallPic = artCanvas((g) => {
      g.fillStyle = "#efe6d4";
      g.fillRect(0, 0, 320, 400);
      g.fillStyle = "#7f8f62";
      g.fillRect(0, 220, 320, 180);
      g.fillStyle = "#d2c2a4";
      g.fillRect(70, 120, 180, 140);
    });

    const sign = canvasTexture((c) => {
      c.width = 256;
      c.height = 340;
      const g = c.getContext("2d");
      g.fillStyle = "#1e6a48";
      g.fillRect(0, 0, 256, 340);
      g.fillStyle = "#f4f1e6";
      g.textAlign = "center";
      g.font = "700 34px Georgia, serif";
      ["KEEP", "CALM", "AND", "PROVIDE", "EXCELLENT", "SERVICE"].forEach((line, i) => {
        g.fillText(line, 128, 58 + i * 46);
      });
    });

    const laptop = canvasTexture((c) => {
      c.width = 320;
      c.height = 200;
      const g = c.getContext("2d");
      g.fillStyle = "#f4f1ea";
      g.fillRect(0, 0, 320, 200);
      g.fillStyle = "#d9d3c8";
      g.fillRect(16, 18, 200, 12);
      for (let i = 0; i < 8; i++) g.fillRect(16, 44 + i * 16, 250 - (i % 3) * 30, 6);
    });

    return { floral, wood, fabric, stillLife, landscape, smallPic, sign, laptop };
  }

  function mat(params) {
    return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.86, metalness: 0 }, params));
  }

  function group(parent, label, x, y, z) {
    const g = new THREE.Group();
    g.name = label;
    g.userData.label = label;
    g.position.set(x || 0, y || 0, z || 0);
    parent.add(g);
    return g;
  }

  function box(parent, material, w, h, d, x, y, z, opt) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    const o = opt || {};
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    if (o.name) {
      mesh.name = o.name;
      mesh.userData.label = o.name;
    }
    parent.add(mesh);
    return mesh;
  }

  function cyl(parent, material, rt, rb, h, seg, x, y, z, opt) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), material);
    mesh.position.set(x, y, z);
    const o = opt || {};
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    parent.add(mesh);
    return mesh;
  }

  function rod(parent, material, from, to, radius) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const length = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 7), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function buildRoom(textures) {
    const room = group(new THREE.Group(), "Гостиная");
    const shellMats = [];

    const wallPaint = mat({ color: 0xf3efe6, roughness: 0.92, side: THREE.DoubleSide });
    const floralMat = mat({ map: textures.floral, color: 0xffffff, roughness: 0.93, side: THREE.DoubleSide });
    const trimMat = mat({ color: 0xf7f4ee, roughness: 0.7 });
    const floorMat = mat({ map: textures.wood, color: 0xffffff, roughness: 0.78 });
    const ceilMat = mat({ color: 0xf6f4f0, roughness: 0.95 });
    const woodMat = mat({ color: 0x7a4e32, roughness: 0.62 });
    const woodDark = mat({ color: 0x5c3a28, roughness: 0.7 });
    const cream = mat({ color: 0xf4f0e6, roughness: 0.42 });
    const creamGloss = mat({ color: 0xf7f3ea, roughness: 0.32, metalness: 0.04 });
    const fabricMat = mat({ map: textures.fabric, color: 0xffffff, roughness: 1 });
    const sofaDark = mat({ color: 0xd5c6b0, roughness: 0.95 });
    const frameGold = mat({ color: 0xc6a15a, roughness: 0.4, metalness: 0.35 });
    const frameDark = mat({ color: 0x2c241c, roughness: 0.55 });
    const metal = mat({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 });
    const white = mat({ color: 0xf7f7f5, roughness: 0.55 });
    const screenMat = mat({ color: 0xf7f8f6, emissive: 0xf3f5f4, emissiveIntensity: 0.45, roughness: 0.35 });
    const alu = mat({ color: 0xb9bdc2, roughness: 0.35, metalness: 0.55 });
    const glassMat = mat({
      color: 0xc5ddf2,
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      metalness: 0.02,
      depthWrite: false,
    });
    const shadeMat = mat({ color: 0xfff6e8, emissive: 0xffe6c4, emissiveIntensity: 0.55, roughness: 0.7, side: THREE.DoubleSide });
    shellMats.push(wallPaint, floralMat);

    const floor = box(room, floorMat, W, 0.08, D, W / 2, -0.04, D / 2, { cast: false });
    floor.userData.label = "Пол";
    const ceiling = box(room, ceilMat, W + 0.28, 0.08, D + 0.28, W / 2, H + 0.04, D / 2, { cast: false, receive: false });
    ceiling.userData.label = "Потолок";

    box(room, floralMat, 0.12, H, D, -0.06, H / 2, D / 2, { name: "Стена с обоями" });
    box(room, wallPaint, 0.12, H, D, W + 0.06, H / 2, D / 2, { name: "Стена со стенкой" });
    box(room, wallPaint, W, H, 0.12, W / 2, H / 2, D + 0.06, { name: "Дальняя стена" });

    const south = group(room, "Стена у окна");
    const t = 0.12;
    const zc = -t / 2;
    box(south, wallPaint, WIN.x0 + 0.06, H, t, (WIN.x0 - 0.06) / 2, H / 2, zc);
    box(south, wallPaint, W - WIN.x1 + 0.06, H, t, (WIN.x1 + W + 0.06) / 2, H / 2, zc);
    box(south, wallPaint, WIN.x1 - WIN.x0, WIN.y0, t, (WIN.x0 + WIN.x1) / 2, WIN.y0 / 2, zc);
    box(south, wallPaint, WIN.x1 - WIN.x0, H - WIN.y1, t, (WIN.x0 + WIN.x1) / 2, (WIN.y1 + H) / 2, zc);

    function molding(y, h, depth, material) {
      box(room, material, W, h, depth, W / 2, y, depth / 2, { cast: false });
      box(room, material, W, h, depth, W / 2, y, D - depth / 2, { cast: false });
      box(room, material, depth, h, D, depth / 2, y, D / 2, { cast: false });
      box(room, material, depth, h, D, W - depth / 2, y, D / 2, { cast: false });
    }
    molding(H - 0.035, 0.07, 0.05, trimMat);
    molding(0.04, 0.08, 0.018, trimMat);

    buildWindow(room, white, glassMat);
    buildCurtain(room);
    buildOutside(room);
    buildWallUnit(room, woodMat, woodDark, cream, white, metal);
    buildWardrobe(room, creamGloss, woodMat, metal);
    buildSofa(room, fabricMat, sofaDark);
    buildTable(room, woodMat, alu, textures.laptop);
    buildScreen(room, metal, screenMat, white);
    buildArt(room, textures, frameGold, frameDark);
    buildChandelier(room, shadeMat, metal);
    buildSillGear(room, white, metal, shadeMat);

    const person = buildPerson(room);
    return { room, ceiling, shellMats, person };
  }

  function buildWindow(room, white, glassMat) {
    const g = group(room, "Окно", 0, 0, 0.04);
    const x0 = WIN.x0;
    const x1 = WIN.x1;
    const y0 = WIN.y0;
    const y1 = WIN.y1;
    const span = x1 - x0;
    const height = y1 - y0;
    box(g, white, span + 0.08, 0.06, 0.08, (x0 + x1) / 2, y0 - 0.01, 0);
    box(g, white, span + 0.08, 0.05, 0.07, (x0 + x1) / 2, y1, 0);
    box(g, white, 0.05, height, 0.07, x0, (y0 + y1) / 2, 0);
    box(g, white, 0.05, height, 0.07, x1, (y0 + y1) / 2, 0);
    const cols = [0.3, 0.28, 0.22, 0.2];
    let cursor = x0;
    const midY = y0 + height * 0.5;
    cols.forEach((share, index) => {
      const w = span * share;
      const cx = cursor + w / 2;
      if (index > 0) box(g, white, 0.035, height, 0.05, cursor, (y0 + y1) / 2, 0.01);
      box(g, glassMat, w - 0.05, height * 0.5 - 0.04, 0.01, cx, y0 + height * 0.25, 0.02, { cast: false });
      box(g, glassMat, w - 0.05, height * 0.5 - 0.04, 0.01, cx, y0 + height * 0.75, 0.02, { cast: false });
      cursor += w;
    });
    box(g, white, span, 0.035, 0.05, (x0 + x1) / 2, midY, 0.01);
    box(g, white, span + 0.16, 0.045, 0.28, (x0 + x1) / 2, y0 - 0.03, 0.12, { name: "Подоконник" });
  }

  function buildCurtain(room) {
    const g = group(room, "Штора", 0.32, 0, 0.12);
    const cloth = mat({ color: 0xe6dccb, roughness: 0.9, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      box(g, cloth, 0.055, 1.9, 0.035, i * 0.04, 1.22, Math.sin(i * 1.3) * 0.03);
    }
  }

  function buildOutside(room) {
    const g = group(room, "Вид из окна");
    const sky = mat({ color: 0xb7d4ee, roughness: 1 });
    const far = mat({ color: 0x9aafc2, roughness: 1 });
    const near = mat({ color: 0xc5cdd4, roughness: 1 });
    box(g, sky, 40, 16, 0.2, 0, 6, -12, { cast: false, receive: false });
    const blocks = [
      [-6, 4, -8, 8, 10, 5, far],
      [2, 6, -9, 7, 16, 4, far],
      [8, 3.5, -7, 6, 9, 5, near],
      [-1, 2.2, -5.5, 5, 6, 3, near],
    ];
    blocks.forEach((b) => box(g, b[6], b[3], b[4], b[5], b[0], b[1], b[2], { cast: false, receive: false }));
    const ground = mat({ color: 0xb7c3ae, roughness: 1 });
    box(g, ground, 40, 0.05, 20, 0, -0.04, -10, { cast: false, receive: false });
  }

  function buildWallUnit(room, woodMat, woodDark, cream, white, metal) {
    const g = group(room, "Стенка");
    const depth = 0.46;
    const x = depth / 2;
    const sections = [
      { z0: 0.16, z1: 0.98, kind: "tall" },
      { z0: 0.98, z1: 1.98, kind: "books" },
      { z0: 1.98, z1: 3.08, kind: "tv" },
      { z0: 3.08, z1: UNIT_Z1, kind: "books" },
    ];
    const bookColors = [0xc4554a, 0x315c8a, 0xe6dcc4, 0x2f6b4f, 0x8a6239, 0xf0ece4, 0x6b3a4a, 0x3d4a6b, 0xd8c06a];
    const bookMats = bookColors.map((color) => mat({ color, roughness: 0.8 }));

    sections.forEach((s) => {
      const zw = s.z1 - s.z0;
      const zc = (s.z0 + s.z1) / 2;
      box(g, woodDark, depth - 0.04, 2.32, zw - 0.04, ux(x - 0.02), 1.24, zc, { cast: false });
      if (s.kind === "tall") {
        box(g, cream, depth, 2.42, zw, ux(x), 1.25, zc);
        box(g, woodMat, 0.012, 2.2, 0.008, ux(depth - 0.01), 1.25, zc, { cast: false });
        return;
      }
      box(g, woodMat, depth, 0.42, zw, ux(x), 0.29, zc);
      box(g, woodDark, depth - 0.02, 0.08, zw, ux(x), 0.04, zc, { cast: false });
      box(g, woodMat, 0.02, 2.4, 0.02, ux(x), 1.24, s.z0);
      box(g, woodMat, 0.02, 2.4, 0.02, ux(x), 1.24, s.z1);
      if (s.kind === "tv") {
        const tvW = Math.min(0.92, zw - 0.16);
        box(g, metal, 0.045, 0.56, tvW + 0.04, ux(depth - 0.03), 1.08, zc);
        const display = mat({ color: 0x101820, emissive: 0x1b3044, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1 });
        box(g, display, 0.02, 0.48, tvW, ux(depth + 0.01), 1.08, zc, { cast: false });
        box(g, white, depth - 0.04, 0.72, zw - 0.06, ux(x), 2.05, zc);
        shelf(g, woodMat, 1.5, s.z0 + 0.04, s.z1 - 0.04, depth);
        return;
      }
      [0.62, 1.02, 1.4, 1.82, 2.2].forEach((y) => shelf(g, woodMat, y, s.z0 + 0.03, s.z1 - 0.03, depth));
      if (s.z0 < 2) {
        box(g, white, depth - 0.05, 0.16, zw - 0.08, ux(x + 0.01), 1.58, zc);
        box(g, white, depth - 0.05, 0.16, zw - 0.08, ux(x + 0.01), 1.76, zc);
        books(g, bookMats, 0.64, s.z0 + 0.05, s.z1 - 0.05, 0.34, depth);
        books(g, bookMats, 1.04, s.z0 + 0.05, s.z1 - 0.05, 0.32, depth);
        books(g, bookMats, 1.96, s.z0 + 0.08, s.z1 - 0.08, 0.28, depth);
      } else {
        box(g, white, depth - 0.04, 0.58, zw - 0.08, ux(x), 2.12, zc);
        books(g, bookMats, 0.64, s.z0 + 0.05, s.z1 - 0.05, 0.34, depth);
        books(g, bookMats, 1.04, s.z0 + 0.05, s.z1 - 0.05, 0.3, depth);
        books(g, bookMats, 1.42, s.z0 + 0.05, s.z1 - 0.05, 0.28, depth);
      }
    });
    box(g, woodMat, depth, 0.04, UNIT_Z1 - 0.16, ux(x), 2.46, (0.16 + UNIT_Z1) / 2, { cast: false });
  }

  function ux(x) {
    return W - x;
  }

  function shelf(parent, material, y, z0, z1, depth) {
    box(parent, material, depth - 0.06, 0.018, z1 - z0, ux(depth / 2), y, (z0 + z1) / 2, { cast: false });
  }

  function books(parent, materials, y, z0, z1, maxH, depth) {
    let z = z0;
    while (z < z1 - 0.02) {
      const bw = 0.016 + rand() * 0.03;
      if (z + bw > z1) break;
      const bh = maxH * (0.78 + rand() * 0.22);
      const m = materials[Math.floor(rand() * materials.length)];
      box(parent, m, 0.2, bh, bw, ux(depth / 2 + 0.02), y + bh / 2, z + bw / 2, { cast: false });
      z += bw + 0.004;
    }
  }

  function buildWardrobe(room, cream, woodMat, metal) {
    const g = group(room, "Радиусный шкаф");
    const radius = 0.76;
    const height = 2.46;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 36, 1, false, Math.PI / 2, Math.PI / 2),
      cream
    );
    mesh.position.set(0.004, 0.06 + height / 2, D - 0.004);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    const lip = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.02, radius + 0.02, 0.045, 36, 1, false, Math.PI / 2, Math.PI / 2),
      woodMat
    );
    lip.position.set(0.004, 0.06 + height + 0.01, D - 0.004);
    lip.castShadow = true;
    g.add(lip);
    const hx = Math.sin(Math.PI * 0.75) * (radius + 0.01);
    const hz = D + Math.cos(Math.PI * 0.75) * (radius + 0.01);
    box(g, metal, 0.012, 0.16, 0.035, hx, 1.15, hz);
    box(g, metal, 0.012, 0.16, 0.035, hx, 1.55, hz);
  }

  function buildSofa(room, fabric, shadowMat) {
    const g = group(room, "Диван", (SOFA.x0 + SOFA.x1) / 2, 0, (SOFA.z0 + SOFA.z1) / 2);
    const len = SOFA.x1 - SOFA.x0;
    const dep = SOFA.z1 - SOFA.z0;
    box(g, shadowMat, len, 0.16, dep - 0.08, 0, 0.12, 0.02);
    box(g, fabric, len - 0.16, 0.2, dep - 0.34, 0, 0.3, 0.06);
    for (let i = 0; i < 3; i++) {
      const cx = -len / 2 + len * (i + 0.5) / 3;
      box(g, fabric, len / 3 - 0.06, 0.16, dep - 0.4, cx, 0.4, 0.08);
      box(g, fabric, len / 3 - 0.08, 0.48, 0.24, cx, 0.66, -dep / 2 + 0.18);
    }
    box(g, fabric, 0.2, 0.36, dep - 0.08, -len / 2 + 0.1, 0.4, 0);
    box(g, fabric, 0.2, 0.36, dep - 0.08, len / 2 - 0.1, 0.4, 0);
    cyl(g, fabric, 0.1, 0.1, dep - 0.12, 12, -len / 2 + 0.1, 0.58, 0).rotation.x = Math.PI / 2;
    cyl(g, fabric, 0.1, 0.1, dep - 0.12, 12, len / 2 - 0.1, 0.58, 0).rotation.x = Math.PI / 2;
  }

  function buildTable(room, woodMat, alu, laptopTex) {
    const g = group(room, "Круглый стол", TABLE.x, 0, TABLE.z);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.r, TABLE.r, 0.04, 40), woodMat);
    top.position.y = TABLE.top;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    cyl(g, woodMat, 0.07, 0.08, TABLE.top - 0.08, 12, 0, (TABLE.top - 0.08) / 2, 0);
    cyl(g, woodMat, 0.22, 0.22, 0.03, 20, 0, 0.02, 0);

    const laptop = group(g, "Ноутбук", 0.02, TABLE.top, -0.02);
    box(laptop, alu, 0.34, 0.014, 0.24, 0, 0.007, 0);
    const screen = mat({ map: laptopTex, roughness: 0.3, metalness: 0.15, emissive: 0xb9c0c8, emissiveIntensity: 0.25 });
    const lid = box(laptop, screen, 0.34, 0.22, 0.008, 0, 0.12, -0.1);
    lid.rotation.x = -0.35;

    const mugMat = mat({ color: 0x7eafc4, roughness: 0.45 });
    cyl(g, mugMat, 0.04, 0.038, 0.09, 16, 0.2, TABLE.top + 0.06, 0.12);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 14), mugMat);
    handle.position.set(0.248, TABLE.top + 0.06, 0.12);
    handle.rotation.y = Math.PI / 2;
    g.add(handle);
  }

  function buildScreen(room, metal, screenMat, white) {
    const g = group(room, "Экран", SCREEN.x, 0, SCREEN.z);
    g.rotation.y = Math.PI;
    const w = SCREEN.w;
    const h = SCREEN.h;
    const bottom = SCREEN.bottom;
    const cy = bottom + h / 2;
    box(g, metal, w, 0.045, 0.06, 0, bottom + 0.02, 0);
    box(g, metal, w, 0.045, 0.06, 0, bottom + h - 0.02, 0);
    box(g, metal, 0.045, h, 0.06, -w / 2 + 0.02, cy, 0);
    box(g, metal, 0.045, h, 0.06, w / 2 - 0.02, cy, 0);
    box(g, screenMat, w - 0.08, h - 0.08, 0.02, 0, cy, 0.025, { cast: false });
    box(g, metal, 0.04, 0.7, 0.04, 0, bottom - 0.28, -0.08);

    const stand = group(room, "Штатив экрана", SCREEN.x, 0, SCREEN.z + 0.12);
    const foot = [
      new THREE.Vector3(0.55, 0, 0.28),
      new THREE.Vector3(-0.55, 0, 0.28),
      new THREE.Vector3(0, 0, -0.42),
    ];
    const hub = new THREE.Vector3(0, bottom - 0.05, 0);
    foot.forEach((p) => rod(stand, metal, hub, p, 0.012));
    cyl(stand, metal, 0.015, 0.015, bottom - 0.05, 8, 0, (bottom - 0.05) / 2, 0);

    const rad = group(room, "Батарея у экрана", 2.55, 0.34, D - 0.06);
    for (let i = 0; i < 8; i++) box(rad, metal, 0.08, 0.52, 0.025, -0.32 + i * 0.09, 0, 0, { cast: false });
  }

  function buildArt(room, textures, gold, dark) {
    painting(room, "Натюрморт", gold, textures.stillLife, 0.03, 1.62, 3.05, 0.52, 0.7);
    painting(room, "Пейзаж", dark, textures.landscape, 0.03, 1.5, 2.05, 0.68, 0.48);
    painting(room, "Маленькая картина", dark, textures.smallPic, 0.03, 1.48, 3.8, 0.26, 0.32);
    const signMat = mat({ map: textures.sign, roughness: 0.8 });
    const sign = box(room, signMat, 0.02, 0.32, 0.2, 0.02, 1.22, 0.72, { name: "Табличка" });
    sign.userData.label = "Табличка Keep Calm";
  }

  function painting(room, label, frameMat, artTex, x, y, z, w, h) {
    const g = group(room, label, x, y, z);
    g.rotation.y = Math.PI / 2;
    const art = mat({ map: artTex, roughness: 0.85 });
    const ft = 0.03;
    box(g, frameMat, w + ft * 2, ft, 0.03, 0, h / 2 + ft / 2, 0, { cast: false });
    box(g, frameMat, w + ft * 2, ft, 0.03, 0, -h / 2 - ft / 2, 0, { cast: false });
    box(g, frameMat, ft, h, 0.03, -w / 2 - ft / 2, 0, 0, { cast: false });
    box(g, frameMat, ft, h, 0.03, w / 2 + ft / 2, 0, 0, { cast: false });
    box(g, art, w, h, 0.012, 0, 0, 0.012, { cast: false });
  }

  function buildChandelier(room, shadeMat, metal) {
    const g = group(room, "Люстра", 1.7, H, 2.35);
    const brass = mat({ color: 0xe6dcc8, roughness: 0.45, metalness: 0.25 });
    cyl(g, brass, 0.012, 0.012, 0.34, 8, 0, -0.17, 0);
    cyl(g, brass, 0.04, 0.04, 0.08, 10, 0, -0.4, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const end = new THREE.Vector3(Math.sin(a) * 0.38, -0.68, Math.cos(a) * 0.38);
      rod(g, brass, new THREE.Vector3(0, -0.42, 0), end, 0.012);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), shadeMat);
      flower.position.copy(end).multiplyScalar(0.55);
      flower.position.y = -0.5;
      g.add(flower);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.11, 12, 1, true), shadeMat);
      shade.position.copy(end);
      shade.position.y -= 0.02;
      shade.castShadow = false;
      g.add(shade);
    }
    const bulb = new THREE.PointLight(0xffc98a, 28, 6.5, 2);
    bulb.position.set(0, -0.62, 0);
    g.add(bulb);
    void metal;
  }

  function buildSillGear(room, white, metal, shadeMat) {
    const g = group(room, "Проектор", 1.28, WIN.y0 + 0.02, 0.18);
    box(g, white, 0.28, 0.08, 0.18, 0, 0.08, 0);
    cyl(g, metal, 0.035, 0.035, 0.04, 12, 0, 0.08, 0.1).rotation.x = Math.PI / 2;
    const tri = group(g, "", 0, 0, 0);
    rod(tri, metal, new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0.12, -0.02, 0.08), 0.008);
    rod(tri, metal, new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(-0.12, -0.02, 0.08), 0.008);
    rod(tri, metal, new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0, -0.02, -0.1), 0.008);

    const lamp = group(room, "Лампа", 1.78, WIN.y0, 0.2);
    cyl(lamp, white, 0.006, 0.006, 0.32, 8, 0, 0.2, 0);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.1, 12, 1, true), shadeMat);
    shade.position.y = 0.36;
    lamp.add(shade);

    const radMat = mat({ color: 0xf3f3f0, roughness: 0.55, metalness: 0.15 });
    const rad = group(room, "Батарея у окна", 0.07, 0.36, 0.85);
    for (let i = 0; i < 10; i++) box(rad, radMat, 0.03, 0.5, 0.07, 0, 0, -0.4 + i * 0.09, { cast: false });
  }

  function buildPerson(room) {
    const g = group(room, "Человек 175 см", 3.15, 0, 3.2);
    const body = mat({ color: 0x6e90b8, roughness: 0.55, transparent: true, opacity: 0.9 });
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.39, 4, 12), body);
    capsule.position.y = 0.875;
    capsule.castShadow = true;
    g.add(capsule);
    g.visible = false;
    return g;
  }

  function environment(renderer) {
    const scene = new THREE.Scene();
    const boxGeo = new THREE.BoxGeometry();
    boxGeo.deleteAttribute("uv");
    const roomMat = new THREE.MeshStandardMaterial({ side: THREE.BackSide, color: 0xffffff, roughness: 1 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 1 });
    scene.add(new THREE.Mesh(boxGeo, roomMat)).scale.set(30, 28, 28);
    const fill = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    fill.position.set(0, 12, 0);
    fill.scale.set(8, 0.2, 8);
    scene.add(fill);
    const side = new THREE.Mesh(boxGeo, boxMat);
    side.position.set(-8, 2, 0);
    side.scale.set(2, 8, 6);
    scene.add(side);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const texture = pmrem.fromScene(scene, 0.04).texture;
    pmrem.dispose();
    return texture;
  }

  function labelOf(object) {
    let node = object;
    while (node) {
      if (node.userData && node.userData.label) return node.userData.label;
      node = node.parent;
    }
    return "";
  }

  function exportModel(root) {
    const obj = ["# Гостиная — оценочная модель по фото", "mtllib gostinaya.mtl"];
    const mtl = ["# цвета без текстур"];
    const known = new Set();
    let offset = 1;
    const v = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse((child) => {
      if (!child.isMesh || !child.geometry || !child.geometry.attributes.position) return;
      let shown = child;
      while (shown) {
        if (!shown.visible) return;
        shown = shown.parent;
      }
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      const color = material.color || new THREE.Color(0x888888);
      const name = "c" + color.getHexString();
      if (!known.has(name)) {
        known.add(name);
        mtl.push("newmtl " + name, "Kd " + color.r.toFixed(4) + " " + color.g.toFixed(4) + " " + color.b.toFixed(4), "d " + (material.opacity == null ? 1 : material.opacity));
      }
      const label = (labelOf(child) || child.name || "part").replace(/\s+/g, "_");
      obj.push("o " + label, "usemtl " + name);
      const pos = child.geometry.attributes.position;
      const index = child.geometry.index;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
        obj.push("v " + v.x.toFixed(4) + " " + v.y.toFixed(4) + " " + v.z.toFixed(4));
      }
      const face = (a, b, c) => obj.push("f " + (a + offset) + " " + (b + offset) + " " + (c + offset));
      if (index) {
        for (let i = 0; i < index.count; i += 3) face(index.getX(i), index.getX(i + 1), index.getX(i + 2));
      } else {
        for (let i = 0; i < pos.count; i += 3) face(i, i + 1, i + 2);
      }
      offset += pos.count;
    });
    return { obj: obj.join("\n"), mtl: mtl.join("\n") };
  }

  function download(filename, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7d4ee);
  scene.fog = new THREE.Fog(0xb7d4ee, 16, 36);
  scene.environment = environment(renderer);

  const textures = makeTextures();
  const built = buildRoom(textures);
  scene.add(built.room);

  scene.add(new THREE.HemisphereLight(0xd5e6f6, 0xe7d4bc, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1df, 2.6);
  sun.position.set(1.4, 5.2, -2.4);
  sun.target.position.set(2, 0.8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 0.4;
  sun.shadow.camera.far = 16;
  sun.shadow.bias = -0.00035;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xfff6ee, 1.25);
  fill.position.set(-1.5, 3.2, 4);
  scene.add(fill);

  const EYE = 1.62;
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 80);
  const views = {
    window: { pos: [2.55, 1.45, 0.48], target: [1.45, 1.12, 3.35] },
    sofa: { pos: [0.72, 1.08, 1.38], target: [1.35, 1.15, 4.55] },
    wall: { pos: [1.85, 1.4, 1.15], target: [0.2, 1.2, 3.4] },
    back: { pos: [3.25, 1.55, 4.05], target: [1.35, 1.0, 0.7] },
    top: { pos: [2.05, 5.6, 0.15], target: [2.05, 0.4, 3.15] },
  };

  const target = new THREE.Vector3();
  let viewName = "window";
  const orbit = { spherical: new THREE.Spherical(), dragging: false };
  const walk = { yaw: 0, pitch: 0, keys: {} };
  const playCard = document.getElementById("play");
  const crosshair = document.getElementById("crosshair");

  function placeCamera(pos, aim, instant) {
    fly.fromP.copy(camera.position);
    fly.toP.set(pos[0], pos[1], pos[2]);
    fly.fromT.copy(target);
    fly.toT.set(aim[0], aim[1], aim[2]);
    fly.t = instant ? 1 : 0;
    if (instant) {
      camera.position.copy(fly.toP);
      target.copy(fly.toT);
      camera.lookAt(target);
    }
  }

  const fly = {
    fromP: new THREE.Vector3(),
    toP: new THREE.Vector3(),
    fromT: new THREE.Vector3(),
    toT: new THREE.Vector3(),
    t: 1,
  };

  function aimFromDirection() {
    const dx = target.x - camera.position.x;
    const dz = target.z - camera.position.z;
    walk.yaw = Math.atan2(-dx, -dz);
    walk.pitch = Math.atan2(target.y - camera.position.y, Math.hypot(dx, dz));
    walk.pitch = Math.max(-1.15, Math.min(1.15, walk.pitch));
  }

  function lookFromWalk() {
    const cosPitch = Math.cos(walk.pitch);
    target.set(
      camera.position.x - Math.sin(walk.yaw) * cosPitch,
      camera.position.y + Math.sin(walk.pitch),
      camera.position.z - Math.cos(walk.yaw) * cosPitch
    );
    camera.lookAt(target);
  }

  placeCamera(
    [views.window.pos[0], EYE, views.window.pos[2]],
    views.window.target,
    true
  );
  aimFromDirection();
  camera.position.y = EYE;
  lookFromWalk();
  const blockers = [
    { minX: SOFA.x0 - 0.05, maxX: SOFA.x1 + 0.05, minZ: SOFA.z0 - 0.05, maxZ: SOFA.z1 + 0.05 },
    { minX: TABLE.x - TABLE.r, maxX: TABLE.x + TABLE.r, minZ: TABLE.z - TABLE.r, maxZ: TABLE.z + TABLE.r },
    { minX: W - 0.55, maxX: W, minZ: 0.1, maxZ: UNIT_Z1 },
    { minX: 0, maxX: 0.82, minZ: D - 0.82, maxZ: D },
    { minX: SCREEN.x - SCREEN.w / 2, maxX: SCREEN.x + SCREEN.w / 2, minZ: SCREEN.z - 0.25, maxZ: SCREEN.z + 0.35 },
  ];

  function free(x, z) {
    if (x < 0.22 || x > W - 0.22 || z < 0.22 || z > D - 0.22) return false;
    return !blockers.some((b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
  }

  const LOOK = 0.0017;

  function lookBy(dx, dy) {
    walk.yaw -= dx * LOOK;
    walk.pitch -= dy * LOOK;
    walk.pitch = Math.max(-1.15, Math.min(1.15, walk.pitch));
    lookFromWalk();
  }

  function updateChrome() {
    const locked = document.pointerLockElement === canvas;
    const overhead = viewName === "top";
    playCard.style.display = locked || overhead ? "none" : "flex";
    crosshair.style.display = locked ? "block" : "none";
    hint.textContent = overhead
      ? "Сверху можно крутить левой кнопкой. Выберите точку, чтобы снова ходить"
      : "WASD — ходить, мышь — смотреть, Shift — бежать, Esc — отпустить мышь";
    pickEl.textContent = locked ? "Мышь захвачена. Esc отпускает её." : "Клик по комнате захватывает мышь.";
  }

  canvas.addEventListener("click", () => {
    if (viewName === "top" || document.pointerLockElement === canvas) return;
    canvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", updateChrome);
  canvas.addEventListener("pointerdown", (event) => {
    if (viewName !== "top" || event.button !== 0) return;
    orbit.dragging = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", () => {
    orbit.dragging = false;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (document.pointerLockElement === canvas && viewName !== "top") {
      lookBy(event.movementX, event.movementY);
      return;
    }
    if (!orbit.dragging || viewName !== "top" || fly.t < 1) return;
    const offset = camera.position.clone().sub(target);
    orbit.spherical.setFromVector3(offset);
    orbit.spherical.theta -= event.movementX * 0.005;
    orbit.spherical.phi -= event.movementY * 0.005;
    orbit.spherical.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.04, orbit.spherical.phi));
    camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(orbit.spherical));
    camera.lookAt(target);
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  function setView(name) {
    viewName = name;
    document.querySelectorAll("#views button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    const view = views[name];
    if (name === "top") {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      placeCamera(view.pos, view.target, false);
    } else {
      placeCamera([view.pos[0], EYE, view.pos[2]], view.target, false);
    }
    applyShell();
    updateChrome();
  }

  document.getElementById("views").addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (btn) setView(btn.dataset.view);
  });

  function applyShell() {
    const doll = document.getElementById("dollhouse").checked;
    built.shellMats.forEach((material) => {
      material.transparent = doll;
      material.opacity = doll ? 0.16 : 1;
      material.depthWrite = !doll;
      material.needsUpdate = true;
    });
    built.ceiling.visible = !(doll || viewName === "top");
  }

  document.getElementById("dollhouse").addEventListener("change", applyShell);

  document.getElementById("person").addEventListener("change", (event) => {
    built.person.visible = event.target.checked;
  });

  const GAME_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"];
  window.addEventListener("keydown", (event) => {
    walk.keys[event.code] = true;
    if (GAME_KEYS.includes(event.code) && viewName !== "top") event.preventDefault();
    if (event.code === "Digit1") setView("window");
    if (event.code === "Digit2") setView("sofa");
    if (event.code === "Digit3") setView("wall");
    if (event.code === "Digit4") setView("back");
    if (event.code === "Digit5") setView("top");
  });
  window.addEventListener("keyup", (event) => {
    walk.keys[event.code] = false;
  });

  document.getElementById("export").addEventListener("click", () => {
    const files = exportModel(built.room);
    download("gostinaya.mtl", files.mtl);
    setTimeout(() => download("gostinaya.obj", files.obj), 250);
    pickEl.textContent = "Скачиваются gostinaya.obj и gostinaya.mtl. Масштаб — метры.";
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function finishFly() {
    fly.t = 1;
    camera.position.copy(fly.toP);
    target.copy(fly.toT);
    if (viewName === "top") {
      camera.lookAt(target);
      return;
    }
    camera.position.y = EYE;
    aimFromDirection();
    lookFromWalk();
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (fly.t < 1) {
      fly.t = Math.min(1, fly.t + dt / 0.55);
      const k = fly.t * fly.t * (3 - 2 * fly.t);
      camera.position.lerpVectors(fly.fromP, fly.toP, k);
      target.lerpVectors(fly.fromT, fly.toT, k);
      if (fly.t === 1) finishFly();
      else camera.lookAt(target);
    } else if (viewName !== "top") {
      const speed = (walk.keys.ShiftLeft || walk.keys.ShiftRight ? 3.6 : 2.15) * dt;
      const sin = Math.sin(walk.yaw);
      const cos = Math.cos(walk.yaw);
      let x = camera.position.x;
      let z = camera.position.z;
      let dx = 0;
      let dz = 0;
      if (walk.keys.KeyW || walk.keys.ArrowUp) {
        dx -= sin * speed;
        dz -= cos * speed;
      }
      if (walk.keys.KeyS || walk.keys.ArrowDown) {
        dx += sin * speed;
        dz += cos * speed;
      }
      if (walk.keys.KeyA || walk.keys.ArrowLeft) {
        dx += cos * speed;
        dz -= sin * speed;
      }
      if (walk.keys.KeyD || walk.keys.ArrowRight) {
        dx -= cos * speed;
        dz += sin * speed;
      }
      if (free(x + dx, z)) x += dx;
      if (free(x, z + dz)) z += dz;
      camera.position.set(x, EYE, z);
      lookFromWalk();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  updateChrome();
  frame();
  document.body.dataset.ready = "1";

  window.__room = {
    setView,
    exportModel: () => exportModel(built.room),
    camera,
    target,
    views,
    walk,
    finishFly,
    lookBy,
    THREE,
  };
})();
