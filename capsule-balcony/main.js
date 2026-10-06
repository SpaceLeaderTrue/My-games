/* Капсульный балкон.
   Внутренний размер каждой капсулы: 2.20 × 1.20 × 1.136363… м = 3 м³.
   Нижняя без окон. Верхняя — панорама на многоэтажный дом и город.
   Пропорции лоджии сняты с фото: узкая, розовая стена, белые рамы, подоконник. */
(function () {
  const CAP_L = 2.2;
  const CAP_W = 1.2;
  const CAP_H = 3 / (CAP_L * CAP_W);
  const SHELL = 0.04;
  const DECK = 0.07;
  const BAL_L = 4.4;
  const BAL_H = 2.54;
  const GLASS_Z = 1.3;
  const CAP_X2 = BAL_L - SHELL;
  const CAP_X1 = CAP_X2 - CAP_L;
  const CAP_X0 = CAP_X1 - SHELL;
  const CAP_Z0 = 0.08;
  const CAP_Z1 = CAP_Z0 + CAP_W;
  const Y0 = 0.045;
  const Y_LO1 = Y0 + CAP_H;
  const Y_UP0 = Y_LO1 + DECK;
  const Y_UP1 = Y_UP0 + CAP_H;
  const SILL_Y = 0.9;
  const HATCH_Z0 = CAP_Z0 + 0.5;
  const HATCH_Z1 = CAP_Z0 + 1.12;
  const LADDER_Z0 = CAP_Z0 + 0.08;
  const LADDER_Z1 = CAP_Z0 + 0.46;
  const DOOR_X0 = 0.38;
  const DOOR_X1 = 1.16;
  const ROOM_Z = -2.35;
  const GROUND = -8;
  const R = 0.16;
  const STAND_H = 1.7;
  const CROUCH_H = 1.02;
  const HOLE_TOP = 1.06;

  const params = new URLSearchParams(location.search);
  const shotName = params.get("shot");
  const selfTest = params.has("selftest");

  const canvas = document.getElementById("view");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.useLegacyLights = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc5ccd1);
  scene.fog = new THREE.FogExp2(0xc5ccd1, 0.016);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 220);
  camera.rotation.order = "YXZ";

  const colliders = [];
  function solid(x0, x1, z0, z1, y0, y1) {
    colliders.push({ x0, x1, z0, z1, y0, y1 });
  }
  function hits(x, z, h) {
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (h <= b.y0 || b.y1 <= 0.02) continue;
      if (x + R > b.x0 && x - R < b.x1 && z + R > b.z0 && z - R < b.z1) return true;
    }
    return false;
  }

  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  }

  const texWall = canvasTex(128, 256, (g, w, h) => {
    const stripe = 5;
    for (let x = 0; x < w; x += stripe) {
      g.fillStyle = (x / stripe) % 2 === 0 ? "#f4e2e4" : "#ebd5d8";
      g.fillRect(x, 0, stripe, h);
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = "rgba(120,70,70,0.035)";
      g.fillRect(Math.random() * w, Math.random() * h, 1, 2);
    }
  }, [1.2, 2.4]);

  const texMarble = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#e8d6c9";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(${150 + (i % 3) * 20}, ${110 + (i % 4) * 8}, ${96}, ${0.18 + (i % 5) * 0.06})`;
      g.lineWidth = 1 + (i % 3);
      g.beginPath();
      let x = Math.random() * w;
      let y = Math.random() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (Math.random() - 0.4) * 180;
        y += (Math.random() - 0.5) * 90;
        g.quadraticCurveTo(x, y, x + 40, y + (Math.random() - 0.5) * 30);
      }
      g.stroke();
    }
    g.fillStyle = "rgba(255,248,242,0.18)";
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 70, 18 + Math.random() * 24, Math.random(), 0, 6.28);
      g.fill();
    }
  }, [3.2, 1.1]);

  const texWood = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = "#d9c4a6";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const n = 80 + Math.floor(Math.random() * 50);
      g.strokeStyle = `rgba(${n}, ${n - 30}, ${n - 55}, 0.18)`;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + Math.sin(y * 0.4) * 1.5);
      g.stroke();
    }
  }, [2, 1]);

  const texCeil = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#f4f2ed";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(180,176,168,0.85)";
    g.lineWidth = 3;
    for (let y = 0; y <= h; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }, [2, 2]);

  const texFabric = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#cbb8a6";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(90,60,40,${Math.random() * 0.07})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });

  const texFabricDark = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#8d7368";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      g.fillStyle = `rgba(40,24,18,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });

  const texConcrete = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#c9c6bf";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      const v = 140 + Math.random() * 40;
      g.fillStyle = `rgba(${v}, ${v}, ${v - 4}, 0.25)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = "rgba(90,88,82,0.25)";
    g.strokeRect(8, 8, w - 16, h - 16);
  });

  function facade({ floors, cols, wall, stripe, lit, win }) {
    return canvasTex(512, 1024, (g, w, h) => {
      g.fillStyle = wall;
      g.fillRect(0, 0, w, h);
      if (stripe) {
        for (let i = 0; i < cols; i++) {
          if (i % 2 === 0) continue;
          g.fillStyle = stripe;
          g.fillRect((i * w) / cols, 0, w / cols, h);
        }
      }
      g.strokeStyle = "rgba(60,55,45,0.13)";
      g.lineWidth = 2;
      for (let f = 0; f <= floors; f++) {
        const y = (f / floors) * h;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      for (let f = 0; f < floors; f++) {
        for (let k = 0; k < cols; k++) {
          const cw = w / cols;
          const ch = h / floors;
          const ww = cw * 0.46;
          const hh = ch * 0.42;
          const x = k * cw + (cw - ww) * 0.5;
          const y = f * ch + ch * 0.22;
          const on = Math.random() < lit;
          g.fillStyle = on ? "#e6c27a" : win;
          g.fillRect(x, y, ww, hh);
          if (!on) {
            g.fillStyle = "rgba(255,255,255,0.22)";
            g.fillRect(x, y, ww * 0.42, hh * 0.55);
          }
          g.strokeStyle = "rgba(40,36,30,0.45)";
          g.lineWidth = 2;
          g.strokeRect(x + 0.5, y + 0.5, ww, hh);
        }
      }
    });
  }

  const texSlab = facade({ floors: 16, cols: 18, wall: "#e7e2d8", lit: 0.08, win: "#7f93a0" });
  const texTower = facade({ floors: 22, cols: 6, wall: "#ddd8d0", stripe: "#c9c3b8", lit: 0.12, win: "#6f8494" });
  const texYellow = facade({ floors: 12, cols: 8, wall: "#e6d7b0", stripe: "#d2b15a", lit: 0.1, win: "#80909a" });
  const texFar = facade({ floors: 14, cols: 12, wall: "#ddd9d2", lit: 0.06, win: "#8aa0ab" });
  const texLow = facade({ floors: 5, cols: 7, wall: "#d9cbb8", lit: 0.05, win: "#8d8174" });

  const texPlaque = canvasTex(1024, 768, (g, w, h) => {
    g.fillStyle = "#f6f1e8";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8895c";
    g.lineWidth = 16;
    g.strokeRect(28, 28, w - 56, h - 56);
    g.fillStyle = "#2a241f";
    g.textAlign = "center";
    g.font = "600 58px 'Liberation Sans', 'Noto Sans', 'DejaVu Sans', sans-serif";
    g.fillText("КАПСУЛЬНЫЙ БАЛКОН", w / 2, 130);
    g.font = "400 34px 'Liberation Sans', 'Noto Sans', 'DejaVu Sans', sans-serif";
    g.fillStyle = "#6a5b50";
    g.fillText("каждая капсула ровно 3 м³", w / 2, 190);
    g.textAlign = "left";
    g.fillStyle = "#9a6236";
    g.font = "700 40px 'Liberation Sans', 'Noto Sans', 'DejaVu Sans', sans-serif";
    g.fillText("01   НИЖНЯЯ", 90, 300);
    g.fillStyle = "#2a241f";
    g.font = "400 36px 'Liberation Sans', 'Noto Sans', 'DejaVu Sans', sans-serif";
    g.fillText("2,20 × 1,20 × 1,136 м", 90, 355);
    g.fillText("без окон  ·  тёплый свет", 90, 408);
    g.fillStyle = "#9a6236";
    g.font = "700 40px 'Liberation Sans', 'Noto Sans', 'DejaVu Sans', sans-serif";
    g.fillText("02   ВЕРХНЯЯ", 90, 510);
    g.fillStyle = "#2a241f";
    g.font = "400 36px 'Liberation Sans', 'Noto Sans', 'DejaVu Sans', sans-serif";
    g.fillText("2,20 × 1,20 × 1,136 м", 90, 565);
    g.fillText("панорама на дом и город", 90, 618);
  });

  function mat(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.86, metalness: 0 }, extra || {}));
  }

  const M = {
    wall: mat(0xffffff, { map: texWall, roughness: 0.92 }),
    floor: mat(0xffffff, { map: texMarble, roughness: 0.72 }),
    ceil: mat(0xffffff, { map: texCeil, roughness: 0.9 }),
    wood: mat(0xffffff, { map: texWood, roughness: 0.62 }),
    frame: mat(0xf7f4ef, { roughness: 0.45 }),
    shell: mat(0xf3eee6, { roughness: 0.55 }),
    edge: mat(0xc4a27a, { roughness: 0.5 }),
    lower: mat(0xffffff, { map: texFabricDark, roughness: 0.94 }),
    lowerCeil: mat(0xe7d9cc, { roughness: 0.9 }),
    linen: mat(0xf4efe6, { roughness: 0.9 }),
    bed: mat(0xffffff, { map: texFabric, roughness: 0.95 }),
    bedHi: mat(0xf7f4ee, { roughness: 0.92 }),
    bronze: mat(0x5e4a3e, { roughness: 0.42, metalness: 0.35 }),
    mirror: mat(0xc5d0d4, { roughness: 0.08, metalness: 0.85 }),
    metal: mat(0x6a625c, { roughness: 0.4, metalness: 0.5 }),
    rad: mat(0x4a443f, { roughness: 0.55, metalness: 0.25 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xe7eef3, transparent: true, opacity: 0.08, roughness: 0.06, metalness: 0.05, depthWrite: false
    }),
    curtain: mat(0xcbb59a, { roughness: 0.96, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffc08a, emissive: 0xffb06a, emissiveIntensity: 1.4, roughness: 0.5 }),
    leafA: mat(0xc4a04a, { roughness: 1 }),
    leafB: mat(0x8f9a48, { roughness: 1 }),
    leafC: mat(0xd2b15e, { roughness: 1 }),
    trunk: mat(0x6d5644, { roughness: 1 }),
    concrete: mat(0xffffff, { map: texConcrete, roughness: 0.95 }),
    city: (map) => mat(0xffffff, { map, roughness: 0.94 }),
    roof: mat(0xb7b2a8, { roughness: 0.9 }),
    ground: mat(0x8e8a80, { roughness: 1 }),
    road: mat(0x6e6a64, { roughness: 1 }),
    roomWall: mat(0xd5d0c8, { roughness: 0.92 }),
    roomFloor: mat(0x8d6848, { roughness: 0.7 }),
    shade: mat(0xf4f1ea, { roughness: 0.6 }),
    black: mat(0x1c1a18, { roughness: 0.5 }),
    slipper: mat(0x3d4f86, { roughness: 0.7 }),
    plaque: mat(0xffffff, { map: texPlaque, roughness: 0.6 })
  };

  const boxGeo = {};
  function box(w, h, d) {
    const key = w + "x" + h + "x" + d;
    if (!boxGeo[key]) boxGeo[key] = new THREE.BoxGeometry(w, h, d);
    return boxGeo[key];
  }
  function add(w, h, d, material, x, y, z, opt) {
    const m = new THREE.Mesh(box(w, h, d), material);
    m.position.set(x, y, z);
    const o = opt || {};
    if (o.ry) m.rotation.y = o.ry;
    if (o.shadow === false) {
      m.castShadow = false;
      m.receiveShadow = false;
    } else {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    scene.add(m);
    return m;
  }
  function addMesh(mesh, opt) {
    const o = opt || {};
    if (o.shadow === false) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    } else {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    scene.add(mesh);
    return mesh;
  }

  // --- shell of the loggia ---
  add(BAL_L, 0.05, GLASS_Z, M.floor, BAL_L / 2, 0.025, GLASS_Z / 2);
  add(BAL_L, 0.04, GLASS_Z, M.ceil, BAL_L / 2, BAL_H - 0.02, GLASS_Z / 2);
  // mirror end
  add(SHELL, BAL_H, GLASS_Z, M.wall, SHELL / 2, BAL_H / 2, GLASS_Z / 2);
  solid(-0.2, SHELL, 0, GLASS_Z, 0, BAL_H);
  // wardrobe end, behind the capsule
  add(SHELL, BAL_H, GLASS_Z, M.wall, BAL_L - SHELL / 2, BAL_H / 2, GLASS_Z / 2);
  solid(BAL_L - SHELL, BAL_L + 0.2, 0, GLASS_Z + 0.1, 0, BAL_H);

  // parapet under the vestibule windows
  add(CAP_X0 - 0.06, SILL_Y - 0.04, 0.08, M.wall, (CAP_X0 - 0.06) / 2, (SILL_Y - 0.04) / 2, GLASS_Z - 0.04);
  // wooden sill
  add(CAP_X0 - 0.02, 0.045, 0.28, M.wood, (CAP_X0 - 0.02) / 2, SILL_Y, GLASS_Z - 0.16);
  solid(0.05, CAP_X0 - 0.28, GLASS_Z - 0.32, GLASS_Z, SILL_Y - 0.04, SILL_Y + 0.06);
  // radiator
  add(CAP_X0 - 0.35, 0.48, 0.09, M.rad, (CAP_X0 - 0.2) / 2, 0.28, GLASS_Z - 0.22);
  solid(0.12, CAP_X0 - 0.36, GLASS_Z - 0.3, GLASS_Z - 0.12, 0, 0.55);

  function windowRun(x0, x1, y0, y1, z, cols, rows, depth) {
    const t = 0.035;
    const d = depth || 0.05;
    add(x1 - x0, t, d, M.frame, (x0 + x1) / 2, y1 - t / 2, z);
    add(x1 - x0, t, d, M.frame, (x0 + x1) / 2, y0 + t / 2, z);
    add(t, y1 - y0, d, M.frame, x0 + t / 2, (y0 + y1) / 2, z);
    add(t, y1 - y0, d, M.frame, x1 - t / 2, (y0 + y1) / 2, z);
    const innerW = (x1 - x0 - t * 2) / cols;
    const innerH = (y1 - y0 - t * 2) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const px = x0 + t + innerW * c + innerW / 2;
        const py = y0 + t + innerH * r + innerH / 2;
        if (c < cols - 1) add(t * 0.7, innerH, d * 0.7, M.frame, x0 + t + innerW * (c + 1), py, z);
        if (r < rows - 1) add(innerW, t * 0.7, d * 0.7, M.frame, px, y0 + t + innerH * (r + 1), z);
        const g = add(innerW - t, innerH - t, 0.01, M.glass, px, py, z, { shadow: false });
        g.castShadow = false;
      }
    }
  }
  windowRun(0.08, CAP_X0 - 0.04, SILL_Y + 0.04, BAL_H - 0.08, GLASS_Z - 0.02, 2, 2);

  // room-side glazing, aside from the door
  function roomWindows(x0, x1) {
    add(x1 - x0, SILL_Y - 0.02, 0.06, M.wall, (x0 + x1) / 2, (SILL_Y - 0.02) / 2, 0.03);
    add(x1 - x0, 0.04, 0.22, M.wood, (x0 + x1) / 2, SILL_Y - 0.01, -0.08);
    windowRun(x0, x1, SILL_Y + 0.03, BAL_H - 0.08, 0.03, Math.max(1, Math.round((x1 - x0) / 0.85)), 2, 0.05);
    solid(x0, x1, -0.02, 0.08, 0, BAL_H);
  }
  roomWindows(0.06, DOOR_X0 - 0.02);
  roomWindows(DOOR_X1 + 0.02, CAP_X0 - 0.02);
  // door frame
  add(0.05, 2.28, 0.08, M.frame, DOOR_X0, 1.14, 0.02);
  add(0.05, 2.28, 0.08, M.frame, DOOR_X1, 1.14, 0.02);
  add(DOOR_X1 - DOOR_X0, 0.05, 0.08, M.frame, (DOOR_X0 + DOOR_X1) / 2, 2.26, 0.02);
  solid(DOOR_X0 - 0.04, DOOR_X0 + 0.02, -0.02, 0.08, 0, 2.3);
  solid(DOOR_X1 - 0.02, DOOR_X1 + 0.04, -0.02, 0.08, 0, 2.3);
  solid(DOOR_X0, DOOR_X1, -0.02, 0.08, 2.24, 2.54);
  // open door leaf, swung into the room
  add(0.72, 2.18, 0.04, M.frame, DOOR_X0 - 0.22, 1.09, -0.42, { ry: -0.7 });

  // baseboards in the vestibule
  add(CAP_X0, 0.07, 0.02, M.edge, CAP_X0 / 2, 0.06, 0.02);
  add(0.02, 0.07, GLASS_Z, M.edge, 0.03, 0.06, GLASS_Z / 2);

  // --- capsules ---
  // front shell around the two mouths
  add(SHELL, Y_LO1, LADDER_Z1 - CAP_Z0, M.shell, CAP_X0 + SHELL / 2, Y_LO1 / 2, CAP_Z0 + (LADDER_Z1 - CAP_Z0) / 2);
  add(SHELL, HOLE_TOP, 0.06, M.shell, CAP_X0 + SHELL / 2, HOLE_TOP / 2, HATCH_Z0 - 0.03);
  add(SHELL, Y_LO1, CAP_Z1 - HATCH_Z1, M.shell, CAP_X0 + SHELL / 2, Y_LO1 / 2, (HATCH_Z1 + CAP_Z1) / 2);
  add(SHELL, Y_LO1 - HOLE_TOP, HATCH_Z1 - HATCH_Z0, M.shell, CAP_X0 + SHELL / 2, (HOLE_TOP + Y_LO1) / 2, (HATCH_Z0 + HATCH_Z1) / 2);
  // oak mouth lining, lower
  add(0.02, HOLE_TOP, 0.025, M.edge, CAP_X1 + 0.01, HOLE_TOP / 2, HATCH_Z0);
  add(0.02, HOLE_TOP, 0.025, M.edge, CAP_X1 + 0.01, HOLE_TOP / 2, HATCH_Z1);
  add(0.02, 0.025, HATCH_Z1 - HATCH_Z0, M.edge, CAP_X1 + 0.01, HOLE_TOP, (HATCH_Z0 + HATCH_Z1) / 2);

  // upper front shell
  const upHoleTop = Y_UP0 + 0.84;
  add(SHELL, Y_UP0 - Y_LO1, CAP_W + SHELL, M.shell, CAP_X0 + SHELL / 2, (Y_LO1 + Y_UP0) / 2, CAP_Z0 + CAP_W / 2);
  add(SHELL, upHoleTop - Y_UP0, CAP_Z0 + LADDER_Z0 - CAP_Z0, M.shell, CAP_X0 + SHELL / 2, (Y_UP0 + upHoleTop) / 2, CAP_Z0 + 0.04);
  add(SHELL, upHoleTop - Y_UP0, CAP_Z1 - LADDER_Z1, M.shell, CAP_X0 + SHELL / 2, (Y_UP0 + upHoleTop) / 2, (LADDER_Z1 + CAP_Z1) / 2);
  add(SHELL, Y_UP1 - upHoleTop, CAP_W, M.shell, CAP_X0 + SHELL / 2, (upHoleTop + Y_UP1) / 2, (CAP_Z0 + CAP_Z1) / 2);
  add(SHELL, 0.04, CAP_W + SHELL, M.shell, CAP_X0 + SHELL / 2, Y_UP1 + 0.02, CAP_Z0 + CAP_W / 2);

  // room-side wall of both capsules
  add(CAP_L, Y_UP1 - Y0 + 0.04, SHELL, M.shell, (CAP_X1 + CAP_X2) / 2, (Y0 + Y_UP1) / 2, CAP_Z0 - SHELL / 2);
  // end wall
  add(SHELL, Y_UP1 - Y0 + 0.04, CAP_W + SHELL, M.shell, CAP_X2 + SHELL / 2, (Y0 + Y_UP1) / 2, CAP_Z0 + CAP_W / 2);
  // lower city wall — solid, no glass
  add(CAP_L, Y_UP0 - Y0, SHELL, M.shell, (CAP_X1 + CAP_X2) / 2, (Y0 + Y_UP0) / 2, CAP_Z1 + SHELL / 2);
  // deck
  add(CAP_L, DECK, CAP_W, M.shell, (CAP_X1 + CAP_X2) / 2, (Y_LO1 + Y_UP0) / 2, (CAP_Z0 + CAP_Z1) / 2);
  // roof
  add(CAP_L + SHELL, 0.035, CAP_W + SHELL, M.shell, (CAP_X0 + CAP_X2) / 2 + 0.01, Y_UP1 + 0.02, (CAP_Z0 + CAP_Z1) / 2);

  solid(CAP_X0, CAP_X1, CAP_Z0, LADDER_Z1, 0, Y_LO1);
  solid(CAP_X0, CAP_X1, HATCH_Z0 - 0.02, HATCH_Z0 + 0.02, 0, HOLE_TOP);
  solid(CAP_X0, CAP_X1, HATCH_Z1, CAP_Z1 + 0.02, 0, Y_LO1);
  solid(CAP_X0, CAP_X1, HATCH_Z0, HATCH_Z1, HOLE_TOP, Y_UP0);
  solid(CAP_X0, CAP_X1, CAP_Z0, LADDER_Z0, Y_UP0, upHoleTop);
  solid(CAP_X0, CAP_X1, LADDER_Z1, CAP_Z1 + 0.02, Y_UP0, Y_UP1);
  solid(CAP_X0, CAP_X1, CAP_Z0, CAP_Z1, upHoleTop, Y_UP1 + 0.05);
  solid(CAP_X1, CAP_X2, CAP_Z0 - SHELL, CAP_Z0, 0, Y_UP1);
  solid(CAP_X2, CAP_X2 + SHELL, CAP_Z0 - SHELL, CAP_Z1 + SHELL, 0, Y_UP1);
  solid(CAP_X1, CAP_X2, CAP_Z1, CAP_Z1 + SHELL, 0, Y_UP0);
  solid(CAP_X1, CAP_X2, CAP_Z0, CAP_Z1, Y_LO1, Y_UP0);

  // lower interior
  add(CAP_L - 0.02, CAP_H - 0.02, 0.02, M.lower, (CAP_X1 + CAP_X2) / 2, Y0 + CAP_H / 2, CAP_Z0 + 0.02, { shadow: false });
  add(CAP_L - 0.02, CAP_H - 0.02, 0.02, M.lower, (CAP_X1 + CAP_X2) / 2, Y0 + CAP_H / 2, CAP_Z1 - 0.02, { shadow: false });
  add(0.02, CAP_H - 0.02, CAP_W - 0.06, M.lower, CAP_X2 - 0.03, Y0 + CAP_H / 2, (CAP_Z0 + CAP_Z1) / 2, { shadow: false });
  add(CAP_L - 0.04, 0.02, CAP_W - 0.04, M.lowerCeil, (CAP_X1 + CAP_X2) / 2, Y_LO1 - 0.02, (CAP_Z0 + CAP_Z1) / 2, { shadow: false });
  // mattress, pillow, blanket
  add(1.92, 0.1, 0.92, M.bed, CAP_X1 + 1.08, Y0 + 0.07, (CAP_Z0 + CAP_Z1) / 2 + 0.02);
  add(0.42, 0.1, 0.62, M.bedHi, CAP_X2 - 0.38, Y0 + 0.15, (CAP_Z0 + CAP_Z1) / 2 + 0.02);
  add(0.7, 0.06, 0.42, M.edge, CAP_X1 + 0.7, Y0 + 0.14, CAP_Z0 + 0.38);
  // vent and reading lamp at the blind end
  add(0.02, 0.08, 0.28, M.black, CAP_X2 - 0.04, Y0 + 0.72, CAP_Z1 - 0.28);
  add(0.12, 0.05, 0.12, M.lamp, CAP_X2 - 0.12, Y0 + 0.78, CAP_Z0 + 0.22);
  const lowerLamp = new THREE.PointLight(0xffb27a, 1.15, 2.6, 2);
  lowerLamp.position.set(CAP_X2 - 0.2, Y0 + 0.74, CAP_Z0 + 0.28);
  scene.add(lowerLamp);
  // curtain, pulled to the room side of the mouth
  add(0.02, 0.78, 0.22, M.curtain, CAP_X1 + 0.03, 0.5, HATCH_Z0 + 0.12, { shadow: false });

  // upper interior
  add(CAP_L - 0.02, CAP_H - 0.04, 0.02, M.linen, (CAP_X1 + CAP_X2) / 2, Y_UP0 + CAP_H / 2, CAP_Z0 + 0.02, { shadow: false });
  add(0.02, CAP_H - 0.04, CAP_W - 0.08, M.linen, CAP_X2 - 0.03, Y_UP0 + CAP_H / 2, (CAP_Z0 + CAP_Z1) / 2, { shadow: false });
  add(CAP_L - 0.04, 0.02, CAP_W - 0.08, M.linen, (CAP_X1 + CAP_X2) / 2, Y_UP1 - 0.03, (CAP_Z0 + CAP_Z1) / 2 - 0.02, { shadow: false });
  add(1.92, 0.1, 0.92, M.bedHi, CAP_X1 + 1.08, Y_UP0 + 0.07, (CAP_Z0 + CAP_Z1) / 2 - 0.06);
  add(0.42, 0.08, 0.55, M.bed, CAP_X2 - 0.38, Y_UP0 + 0.15, (CAP_Z0 + CAP_Z1) / 2 - 0.08);
  // lip under the panorama
  add(CAP_L - 0.08, 0.03, 0.06, M.edge, (CAP_X1 + CAP_X2) / 2, Y_UP0 + 0.04, CAP_Z1 - 0.04);
  // panoramic frame — one pane
  const px0 = CAP_X1 + 0.06;
  const px1 = CAP_X2 - 0.05;
  const py0 = Y_UP0 + 0.08;
  const py1 = Y_UP1 - 0.06;
  windowRun(px0, px1, py0, py1, CAP_Z1 - 0.01, 1, 1, 0.045);

  // plaque on the solid front, beside the ladder
  add(0.02, 0.42, 0.36, M.plaque, CAP_X0 - 0.01, 1.28, CAP_Z0 + 0.28);

  // numbers
  function numberPlate(text, x, y, z) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#f3eee6";
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#9a6236";
    g.font = "700 72px 'Liberation Sans', 'Noto Sans', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 128, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    add(0.012, 0.1, 0.16, mat(0xffffff, { map: t, roughness: 0.5 }), x, y, z);
  }
  numberPlate("01", CAP_X0 - 0.005, 0.62, (HATCH_Z0 + HATCH_Z1) / 2);
  numberPlate("02", CAP_X0 - 0.005, Y_UP0 + 0.42, (LADDER_Z0 + LADDER_Z1) / 2);

  // ladder
  const ladderX = CAP_X0 - 0.22;
  for (let i = 0; i < 5; i++) {
    const y = 0.22 + i * 0.22;
    add(0.08, 0.03, LADDER_Z1 - LADDER_Z0 - 0.04, M.edge, ladderX, y, (LADDER_Z0 + LADDER_Z1) / 2);
  }
  add(0.04, Y_UP0 + 0.15, 0.03, M.metal, ladderX, (Y_UP0 + 0.15) / 2, LADDER_Z0 + 0.02);
  add(0.04, Y_UP0 + 0.15, 0.03, M.metal, ladderX, (Y_UP0 + 0.15) / 2, LADDER_Z1 - 0.02);
  solid(ladderX - 0.06, ladderX + 0.08, LADDER_Z0, LADDER_Z1, 0, 0.35);
  // grab rail inside the upper mouth
  add(0.28, 0.02, 0.02, M.metal, CAP_X1 + 0.2, Y_UP0 + 0.62, CAP_Z0 + 0.12);

  // glass you cannot walk through, whole city side
  solid(0, BAL_L, GLASS_Z - 0.02, GLASS_Z + 0.08, 0, BAL_H);

  // mirror etagere at the near end
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), M.mirror);
  mirror.scale.set(1, 1.35, 1);
  mirror.position.set(0.07, 1.42, 0.72);
  mirror.rotation.y = Math.PI / 2;
  addMesh(mirror);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 8, 28), M.bronze);
  ring.scale.set(1, 1.28, 1);
  ring.position.copy(mirror.position);
  ring.rotation.y = Math.PI / 2;
  addMesh(ring);
  add(0.04, 0.9, 0.42, M.bronze, 0.1, 0.85, 0.72);
  add(0.16, 0.02, 0.4, M.edge, 0.14, 0.58, 0.72);
  add(0.16, 0.02, 0.4, M.edge, 0.14, 0.38, 0.72);
  // a tidy pair of slippers where the blue ones were
  add(0.1, 0.04, 0.22, M.slipper, 0.28, 0.04, 0.62);
  add(0.1, 0.04, 0.22, M.slipper, 0.28, 0.04, 0.86);
  // the little black sensor from the photo
  add(0.04, 0.07, 0.05, M.black, 0.08, 1.92, 0.72);
  solid(0.04, 0.24, 0.5, 0.96, 0, 1.7);

  // ceiling lamp in the vestibule
  add(0.28, 0.03, 0.18, M.shade, 1.15, BAL_H - 0.05, 0.62);
  const hallLamp = new THREE.PointLight(0xfff4e4, 0.45, 4.5, 2);
  hallLamp.position.set(1.15, BAL_H - 0.18, 0.62);
  scene.add(hallLamp);

  // --- room, so the door still opens into the same квартира ---
  add(BAL_L + 0.4, 0.06, -ROOM_Z, M.roomFloor, BAL_L / 2, 0.03, ROOM_Z / 2);
  add(BAL_L + 0.4, 0.05, -ROOM_Z, M.ceil, BAL_L / 2, BAL_H - 0.02, ROOM_Z / 2, { shadow: false });
  add(0.08, BAL_H, -ROOM_Z, M.roomWall, -0.1, BAL_H / 2, ROOM_Z / 2);
  add(0.08, BAL_H, -ROOM_Z, M.roomWall, BAL_L + 0.1, BAL_H / 2, ROOM_Z / 2);
  add(BAL_L + 0.5, BAL_H, 0.08, M.roomWall, BAL_L / 2, BAL_H / 2, ROOM_Z);
  solid(-0.4, BAL_L + 0.4, ROOM_Z - 0.1, ROOM_Z + 0.06, 0, BAL_H);
  solid(-0.2, 0.02, ROOM_Z, 0.05, 0, BAL_H);
  solid(BAL_L - 0.02, BAL_L + 0.3, ROOM_Z, 0.05, 0, BAL_H);
  // desk lamp on the room sill, as in the photo
  add(0.16, 0.03, 0.16, M.shade, 1.85, SILL_Y + 0.02, -0.28);
  add(0.03, 0.28, 0.03, M.metal, 1.7, SILL_Y + 0.18, -0.28);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 16, 1, true), M.shade);
  shade.position.set(1.55, SILL_Y + 0.36, -0.28);
  addMesh(shade);
  add(0.08, 0.06, 0.08, M.black, 2.15, SILL_Y + 0.05, -0.32);
  const roomFill = new THREE.PointLight(0xfff1dd, 0.35, 5, 2);
  roomFill.position.set(1.6, 1.8, -1.1);
  scene.add(roomFill);

  // --- city: the view from these windows ---
  const skyTex = canvasTex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#d7dee3");
    grd.addColorStop(0.55, "#c5ced4");
    grd.addColorStop(1, "#c5ccd1");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.16)";
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse(Math.random() * w, h * (0.15 + Math.random() * 0.45), 70 + Math.random() * 150, 16 + Math.random() * 18, 0, 0, 6.28);
      g.fill();
    }
  });
  skyTex.wrapS = THREE.RepeatWrapping;
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(96, 96, 70, 28, 1, true), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  sky.position.y = 8;
  scene.add(sky);

  add(80, 0.2, 80, M.ground, 6, GROUND - 0.1, 24, { shadow: false });
  add(8, 0.05, 36, M.road, 2.2, GROUND + 0.02, 20, { shadow: false });

  function tower(x, z, w, d, h, map) {
    add(w, h, d, M.city(map), x, GROUND + h / 2, z, { shadow: false });
    add(w + 0.3, 0.4, d + 0.3, M.roof, x, GROUND + h + 0.2, z, { shadow: false });
  }
  // the long panel house straight out the window
  tower(2.2, 22, 26, 11, 30, texSlab);
  // close high-rise at the capsule end of the view
  tower(6.1, 6.4, 5.2, 6.2, 62, texTower);
  // yellow striped house to the side, as in the center pane of the photo
  tower(-3.2, 18, 9, 8, 24, texYellow);
  tower(12, 34, 16, 10, 28, texFar);
  tower(-8, 30, 14, 9, 20, texFar);
  // low roofs under the trees
  tower(0.4, 12.5, 9, 6, 8, texLow);

  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.3, 5);
  const leafMats = [M.leafA, M.leafB, M.leafC];
  const treePos = [
    [-2.2, 9.5, 1.1], [0.6, 8.8, 1.3], [2.4, 10.2, 0.9], [4.2, 9.2, 1.15],
    [-4.5, 11, 1.4], [7.2, 10.5, 1], [1.2, 13, 1.5], [5.5, 12.4, 1.2],
    [-1, 14, 0.8], [8.8, 13.5, 1.3], [3.4, 7.6, 0.85]
  ];
  for (let i = 0; i < treePos.length; i++) {
    const p = treePos[i];
    const s = p[2];
    const trunk = new THREE.Mesh(trunkGeo, M.trunk);
    trunk.position.set(p[0], GROUND + 0.65 * s, p[1]);
    trunk.scale.setScalar(s);
    const crown = new THREE.Mesh(leafGeo, leafMats[i % 3]);
    crown.position.set(p[0], GROUND + 1.7 * s, p[1]);
    crown.scale.setScalar(0.95 * s);
    const crown2 = new THREE.Mesh(leafGeo, leafMats[(i + 1) % 3]);
    crown2.position.set(p[0] + 0.35 * s, GROUND + 1.45 * s, p[1] + 0.15);
    crown2.scale.setScalar(0.7 * s);
    scene.add(trunk, crown, crown2);
  }

  // concrete cheek just past the capsule end, the close grey wall in the lengthwise photo
  add(0.7, 14, 0.55, M.concrete, BAL_L + 0.45, 4, GLASS_Z + 0.55, { shadow: false });

  // --- light ---
  scene.add(new THREE.HemisphereLight(0xd5dee6, 0xd9c8b8, 0.72));
  const sun = new THREE.DirectionalLight(0xf2f0ea, 1.25);
  sun.position.set(2.2, 7.5, 8);
  sun.target.position.set(2.1, 1.1, 0.4);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 18;
  sun.shadow.camera.left = -4.5;
  sun.shadow.camera.right = 4.5;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -3;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // --- body ---
  const player = { x: 1.05, z: 0.58, yaw: -0.85, pitch: -0.04 };
  let crouched = false;
  let mode = "walk";
  let berth = null;
  let tween = null;
  const keys = new Set();
  const joy = { active: false, x: 0, y: 0 };
  const whereEl = document.getElementById("where");
  const promptEl = document.getElementById("prompt");
  const enterEl = document.getElementById("enter");

  function eyeHeight() {
    return crouched ? 0.86 : 1.58;
  }
  function bodyHeight() {
    return crouched ? CROUCH_H : STAND_H;
  }
  function poseFromLook(x, y, z, look) {
    const dx = look.x - x;
    const dy = look.y - y;
    const dz = look.z - z;
    const horiz = Math.hypot(dx, dz) || 0.0001;
    return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, horiz) };
  }
  function berthPose(name) {
    if (name === "lower") {
      return poseFromLook(
        CAP_X2 - 0.85,
        Y0 + 0.3,
        (CAP_Z0 + CAP_Z1) / 2,
        { x: CAP_X1 + 0.15, y: Y0 + 0.48, z: (CAP_Z0 + CAP_Z1) / 2 }
      );
    }
    return poseFromLook(
      (CAP_X1 + CAP_X2) / 2 - 0.05,
      Y_UP0 + 0.32,
      CAP_Z0 + 0.42,
      { x: (CAP_X1 + CAP_X2) / 2 + 0.15, y: Y_UP0 + 1.05, z: CAP_Z1 + 6 }
    );
  }
  function standPose(name) {
    if (name === "upper") {
      return { x: ladderX - 0.28, y: 1.58, z: (LADDER_Z0 + LADDER_Z1) / 2, yaw: -Math.PI / 2, pitch: 0.05 };
    }
    return { x: CAP_X0 - 0.42, y: 1.58, z: (HATCH_Z0 + HATCH_Z1) / 2, yaw: -Math.PI / 2, pitch: 0 };
  }
  let returnPose = standPose("lower");

  function shortest(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d;
  }
  function startTween(to, nextMode, nextBerth) {
    const from = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      yaw: player.yaw,
      pitch: player.pitch
    };
    to = Object.assign({}, to, { yaw: shortest(from.yaw, to.yaw) });
    tween = { from, to, t: 0, nextMode, nextBerth };
    mode = "tween";
  }
  function enterBerth(name) {
    returnPose = {
      x: player.x,
      y: eyeHeight(),
      z: player.z,
      yaw: player.yaw,
      pitch: player.pitch
    };
    if (hits(returnPose.x, returnPose.z, STAND_H)) {
      const safe = standPose(name);
      returnPose.x = safe.x;
      returnPose.z = safe.z;
    }
    startTween(berthPose(name), "berth", name);
  }
  function exitBerth() {
    crouched = false;
    startTween(returnPose, "walk", null);
  }
  function nearLadder() {
    const dx = player.x - (ladderX - 0.05);
    const dz = player.z - (LADDER_Z0 + LADDER_Z1) / 2;
    return dx * dx + dz * dz < 0.42 * 0.42 && Math.abs(player.z - (LADDER_Z0 + LADDER_Z1) / 2) < 0.45;
  }
  function inLower() {
    return player.x > CAP_X1 - 0.02 && player.x < CAP_X2 - 0.05 && player.z > CAP_Z0 + 0.02 && player.z < CAP_Z1 - 0.02;
  }
  function nearHatch() {
    const dx = player.x - (CAP_X0 - 0.2);
    const dz = player.z - (HATCH_Z0 + HATCH_Z1) / 2;
    return dx * dx + dz * dz < 0.55 * 0.55;
  }
  function useAction() {
    if (mode === "tween") return;
    if (mode === "berth") {
      exitBerth();
      return;
    }
    if (inLower() || nearHatch()) {
      if (!crouched && nearHatch() && !inLower()) crouched = true;
      enterBerth("lower");
      return;
    }
    if (nearLadder()) enterBerth("upper");
  }
  function currentPrompt() {
    if (mode === "berth") return "E — встать";
    if (mode !== "walk") return "";
    if (inLower()) return "E — лечь. Здесь нет окна";
    if (nearHatch()) return "E — нижняя капсула, 3 м³, без окон";
    if (nearLadder()) return "E — верхняя капсула, 3 м³, панорама";
    return "";
  }
  function placeLabel() {
    if (mode === "berth" && berth === "lower") return "01 · нижняя · без окон";
    if (mode === "berth" && berth === "upper") return "02 · верхняя · дом и город";
    if (inLower()) return "внутри нижней";
    if (player.z < 0) return "комната";
    return "тамбур";
  }

  function tryMove(nx, nz) {
    const h = bodyHeight();
    if (!hits(nx, player.z, h)) player.x = nx;
    if (!hits(player.x, nz, h)) player.z = nz;
  }

  const codeMap = {
    KeyW: "f", KeyS: "b", KeyA: "l", KeyD: "r",
    ArrowUp: "f", ArrowDown: "b", ArrowLeft: "l", ArrowRight: "r"
  };
  window.addEventListener("keydown", (e) => {
    if (selfTest) return;
    const dir = codeMap[e.code];
    if (dir) {
      keys.add(dir);
      e.preventDefault();
    }
    if (e.code === "KeyC") {
      crouched = !crouched;
      if (!crouched && hits(player.x, player.z, STAND_H)) crouched = true;
    }
    if (e.code === "KeyE") useAction();
  });
  window.addEventListener("keyup", (e) => {
    const dir = codeMap[e.code];
    if (dir) keys.delete(dir);
  });

  function onLook(dx, dy) {
    if (mode === "tween") return;
    player.yaw -= dx * 0.0022;
    player.pitch -= dy * 0.0022;
    player.pitch = Math.max(-1.15, Math.min(1.2, player.pitch));
  }
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== canvas) return;
    onLook(e.movementX, e.movementY);
  });
  enterEl.addEventListener("click", () => {
    document.body.classList.add("playing");
    if (matchMedia("(pointer: fine)").matches) canvas.requestPointerLock();
  });
  canvas.addEventListener("click", () => {
    if (!document.body.classList.contains("playing")) return;
    if (matchMedia("(pointer: fine)").matches && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement) {
      /* keep playing; click the picture to look again */
    }
  });

  const joyZone = document.getElementById("joy-zone");
  const joyKnob = document.getElementById("joy-knob");
  const lookZone = document.getElementById("look-zone");
  let lookId = null;
  let lookX = 0;
  let lookY = 0;
  joyZone.addEventListener("pointerdown", (e) => {
    joy.active = true;
    joy.id = e.pointerId;
    joyZone.setPointerCapture(e.pointerId);
    moveJoy(e);
  });
  function moveJoy(e) {
    const base = document.getElementById("joy-base").getBoundingClientRect();
    const cx = base.left + base.width / 2;
    const cy = base.top + base.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = 42;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) {
      dx *= max / len;
      dy *= max / len;
    }
    joy.x = dx / max;
    joy.y = dy / max;
    joyKnob.style.transform = "translate(" + dx + "px," + dy + "px)";
  }
  joyZone.addEventListener("pointermove", (e) => {
    if (joy.active && e.pointerId === joy.id) moveJoy(e);
  });
  function endJoy(e) {
    if (e.pointerId !== joy.id) return;
    joy.active = false;
    joy.x = 0;
    joy.y = 0;
    joyKnob.style.transform = "translate(0,0)";
  }
  joyZone.addEventListener("pointerup", endJoy);
  joyZone.addEventListener("pointercancel", endJoy);
  lookZone.addEventListener("pointerdown", (e) => {
    lookId = e.pointerId;
    lookX = e.clientX;
    lookY = e.clientY;
    lookZone.setPointerCapture(e.pointerId);
  });
  lookZone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== lookId) return;
    onLook(e.clientX - lookX, e.clientY - lookY);
    lookX = e.clientX;
    lookY = e.clientY;
  });
  lookZone.addEventListener("pointerup", () => { lookId = null; });
  document.getElementById("btn-use").addEventListener("click", (e) => { e.stopPropagation(); useAction(); });
  document.getElementById("btn-crouch").addEventListener("click", (e) => {
    e.stopPropagation();
    crouched = !crouched;
    if (!crouched && hits(player.x, player.z, STAND_H)) crouched = true;
  });

  function applyPose(p) {
    camera.position.set(p.x, p.y, p.z);
    player.yaw = p.yaw;
    player.pitch = p.pitch;
    camera.rotation.y = p.yaw;
    camera.rotation.x = p.pitch;
  }

  const shots = {
    door: () => poseFromLook(1.35, 1.55, -1.25, { x: 2.4, y: 1.35, z: 1.2 }),
    hall: () => poseFromLook(1.05, 1.58, 0.5, { x: 2.5, y: 1.25, z: 0.85 }),
    window: () => poseFromLook(1.15, 1.55, 0.62, { x: 1.15, y: 1.7, z: 8 }),
    front: () => poseFromLook(CAP_X0 - 0.95, 1.35, 0.62, { x: CAP_X0 + 0.2, y: 1.15, z: 0.7 }),
    lower: () => berthPose("lower"),
    upper: () => berthPose("upper")
  };

  if (shotName && shots[shotName]) {
    document.body.classList.add("shot", "playing");
    const p = shots[shotName]();
    player.x = p.x;
    player.z = p.z;
    player.yaw = p.yaw;
    player.pitch = p.pitch;
    if (shotName === "lower" || shotName === "upper") {
      mode = "berth";
      berth = shotName;
    }
    applyPose(p);
  }

  function runSelfTest() {
    const lines = [];
    function check(name, ok) {
      lines.push((ok ? "ok  " : "FAIL") + "  " + name);
      return ok;
    }
    let good = true;
    good = check("volume is 3 m3", Math.abs(CAP_L * CAP_W * CAP_H - 3) < 1e-9) && good;
    good = check("upper floor is above lower ceiling", Y_UP0 > Y_LO1 - 0.001 && Math.abs(Y_UP0 - Y_LO1 - DECK) < 1e-9) && good;
    good = check("stack fits under the ceiling", Y_UP1 + 0.04 < BAL_H) && good;
    good = check("panorama is only on the upper city wall", py0 >= Y_UP0 - 0.001 && py1 <= Y_UP1 + 0.001) && good;
    good = check("start is free", !hits(1.05, 0.58, STAND_H)) && good;
    const x = 1.05;
    const z = 0.58;
    good = check("mirror wall blocks", hits(0.02, z, STAND_H)) && good;
    good = check("glass blocks", hits(x, GLASS_Z, STAND_H)) && good;
    good = check("room back wall blocks", hits(x, ROOM_Z + 0.05, STAND_H)) && good;
    const hz = (HATCH_Z0 + HATCH_Z1) / 2;
    good = check("standing at the mouth is blocked", hits(CAP_X0 + 0.02, hz, STAND_H)) && good;
    good = check("crouch passes the mouth", !hits(CAP_X0 + 0.02, hz, CROUCH_H)) && good;
    const insideX = (CAP_X1 + CAP_X2) / 2;
    const insideZ = (CAP_Z0 + CAP_Z1) / 2;
    good = check("crouch fits inside the lower capsule", !hits(insideX, insideZ, CROUCH_H)) && good;
    good = check("cannot stand inside the lower capsule", hits(insideX, insideZ, STAND_H)) && good;
    good = check("lower city side is solid", hits(insideX, CAP_Z1 + 0.01, CROUCH_H)) && good;
    document.title = good ? "SELFTEST_OK" : "SELFTEST_FAIL";
    const pre = document.createElement("pre");
    pre.id = "selftest";
    pre.textContent = lines.join("\n");
    document.body.appendChild(pre);
    document.body.classList.add("shot", "playing");
  }
  if (selfTest) runSelfTest();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    sky.rotation.y += dt * 0.008;

    if (mode === "walk" && !selfTest && !(shotName && (shotName === "lower" || shotName === "upper"))) {
      let ix = 0;
      let iz = 0;
      if (keys.has("f")) iz -= 1;
      if (keys.has("b")) iz += 1;
      if (keys.has("l")) ix -= 1;
      if (keys.has("r")) ix += 1;
      if (joy.active) {
        ix += joy.x;
        iz += joy.y;
      }
      const len = Math.hypot(ix, iz);
      if (len > 0) {
        ix /= len;
        iz /= len;
        const speed = (keys.has("Shift") ? 1.7 : 1.15) * (crouched ? 0.55 : 1);
        const sin = Math.sin(player.yaw);
        const cos = Math.cos(player.yaw);
        // yaw 0 looks down -Z. Forward is ( -sin(yaw), -cos(yaw) ).
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;
        const mx = (fx * -iz + rx * ix) * speed * dt;
        const mz = (fz * -iz + rz * ix) * speed * dt;
        tryMove(player.x + mx, player.z + mz);
      }
      if (!crouched && hits(player.x, player.z, STAND_H)) crouched = true;
      camera.position.set(player.x, eyeHeight(), player.z);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
    } else if (mode === "tween") {
      tween.t += dt / 0.7;
      const k = tween.t >= 1 ? 1 : tween.t * tween.t * (3 - 2 * tween.t);
      const a = tween.from;
      const b = tween.to;
      camera.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      player.yaw = a.yaw + (b.yaw - a.yaw) * k;
      player.pitch = a.pitch + (b.pitch - a.pitch) * k;
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      if (tween.t >= 1) {
        mode = tween.nextMode;
        berth = tween.nextBerth;
        if (mode === "walk") {
          player.x = tween.to.x;
          player.z = tween.to.z;
          camera.position.y = eyeHeight();
        }
        tween = null;
      }
    } else if (mode === "berth") {
      const p = berthPose(berth);
      const bob = Math.sin(now * 0.0015) * 0.004;
      camera.position.set(p.x, p.y + bob, p.z);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
    }

    const prompt = currentPrompt();
    promptEl.textContent = prompt;
    promptEl.classList.toggle("on", !!prompt && document.body.classList.contains("playing"));
    whereEl.textContent = placeLabel();
    const useBtn = document.getElementById("btn-use");
    if (useBtn) useBtn.textContent = mode === "berth" ? "встать" : "лечь";

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
