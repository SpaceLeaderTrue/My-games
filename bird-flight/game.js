/* Искра — полёт по открытой стране. */
(function () {
  "use strict";

  const W = window.SkyWorld;
  const BIO = W.BIOME;
  const TAU = Math.PI * 2;

  const canvas = document.getElementById("view");
  const fadeEl = document.getElementById("fade");
  const statusEl = document.getElementById("menuStatus");
  const banner = document.getElementById("banner");
  const bannerName = document.getElementById("bannerName");
  const bannerLine = document.getElementById("bannerLine");
  const altStat = document.getElementById("altStat");
  const spdStat = document.getElementById("spdStat");
  const ringCountEl = document.getElementById("ringCount");
  const placeCountEl = document.getElementById("placeCount");
  const nextChip = document.getElementById("nextChip");
  const hintEl = document.getElementById("hint");
  const toastEl = document.getElementById("toast");
  const mapCanvas = document.getElementById("minimap");
  const mapCtx = mapCanvas.getContext("2d");

  const keys = new Set();
  const joy = { x: 0, y: 0, active: false };
  let flapHeld = false;
  let dragX = 0;
  let dragY = 0;
  let mode = "cinema";
  let helpUntil = 0;
  let toastUntil = 0;
  let bannerUntil = 0;
  let insideId = null;
  let cinemaU = 0.02;
  let camDist = 13;
  let muted = localStorage.getItem("iskra-mute") === "1";
  let audio = null;
  let qualityChecked = false;
  let frameCounter = 0;
  let qualityClock = 0;
  let lapStarted = 0;
  let laps = 0;
  let mapBase = null;
  let last = performance.now();
  let worldReady = false;

  const player = {
    x: 0, y: 40, z: 0,
    yaw: 0, pitch: -0.1, roll: 0,
    speed: 16, flapPhase: 0, vy: 0,
  };

  const SUN = new THREE.Vector3(-0.48, 0.74, 0.32).normalize();

  let renderer, scene, camera, bird, sky, waterMat, clockLights;
  let routeCurve, rings = [], places = [];
  let updrafts = [];
  let falls = [];
  let fields = [];
  let lookTarget = new THREE.Vector3();
  let camPos = new THREE.Vector3();
  let birdShadow;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function rngFactory(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function onHud(e) {
    return e.target && e.target.closest && e.target.closest("button, #stick, #menu, #pause");
  }
  function setStatus(text) { statusEl.textContent = text || ""; }
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    toastUntil = performance.now() + 2600;
  }
  function showBanner(place) {
    bannerName.textContent = place.name;
    bannerLine.textContent = place.line;
    banner.classList.add("show");
    bannerUntil = performance.now() + 4600;
  }

  function boot() {
    setStatus("Собираем страну…");
    setTimeout(function () {
      try {
        W.build();
        places = W.PLACES;
        updrafts = W.build().updrafts;
        falls = W.build().falls;
        setupThree();
        buildTerrain();
        buildWater();
        buildFalls();
        buildBridges();
        buildRainbow();
        buildVegetation();
        buildRoute();
        buildSky();
        buildBird();
        buildAtmosphere();
        buildMap();
        resetPlayer();
        worldReady = true;
        setStatus("");
        document.getElementById("startBtn").disabled = false;
        last = performance.now();
        requestAnimationFrame(loop);
      } catch (err) {
        console.error(err);
        setStatus("Не удалось собрать небо: " + err.message);
      }
    }, 40);
  }

  function setupThree() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0xb7e4ff, 1);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd4ecff, 160, 1050);
    camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.35, 5000);
    const hemi = new THREE.HemisphereLight(0xd6efff, 0x8fbf62, 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d2, 3.4);
    sun.position.copy(SUN).multiplyScalar(300);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc5dcff, 0.85);
    fill.position.set(220, 140, -260);
    scene.add(fill);
    clockLights = { sun: sun };
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function buildTerrain() {
    const data = W.build();
    const N = W.N;
    const positions = new Float32Array(N * N * 3);
    const colors = new Float32Array(N * N * 3);
    const indices = new Uint32Array((N - 1) * (N - 1) * 6);
    let k = 0;
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const i = iz * N + ix;
        positions[i * 3] = -W.HALF + ix * W.CELL;
        positions[i * 3 + 1] = data.height[i];
        positions[i * 3 + 2] = -W.HALF + iz * W.CELL;
        const shade = 1 - Math.min(data.slope[i], 1.3) * 0.07;
        colors[i * 3] = data.color[i * 3] * shade;
        colors[i * 3 + 1] = data.color[i * 3 + 1] * shade;
        colors[i * 3 + 2] = data.color[i * 3 + 2] * shade;
      }
    }
    for (let iz = 0; iz < N - 1; iz++) {
      for (let ix = 0; ix < N - 1; ix++) {
        const a = iz * N + ix;
        indices[k++] = a;
        indices[k++] = a + N;
        indices[k++] = a + 1;
        indices[k++] = a + 1;
        indices[k++] = a + N;
        indices[k++] = a + N + 1;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
    scene.add(new THREE.Mesh(geo, mat));
  }

  function makeWaterMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uShallow: { value: new THREE.Color("#5eecc8") },
        uDeep: { value: new THREE.Color("#0d6eb8") },
        uSun: { value: SUN.clone() },
        uCam: { value: new THREE.Vector3() },
      },
      vertexShader: [
        "uniform float uTime;",
        "varying vec3 vWorld;",
        "varying vec3 vN;",
        "void main() {",
        "  vec3 p = position;",
        "  float w = sin(p.x * 0.045 + uTime * 1.25) * 0.05 + sin(p.z * 0.038 + uTime * 0.9) * 0.04;",
        "  p.y += w;",
        "  vec4 wp = modelMatrix * vec4(p, 1.0);",
        "  vWorld = wp.xyz;",
        "  float dx = cos(p.x * 0.045 + uTime * 1.25) * 0.045 * 0.05;",
        "  float dz = cos(p.z * 0.038 + uTime * 0.9) * 0.038 * 0.04;",
        "  vN = normalize(mat3(modelMatrix) * vec3(-dx, 1.0, -dz));",
        "  gl_Position = projectionMatrix * viewMatrix * wp;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uShallow;",
        "uniform vec3 uDeep;",
        "uniform vec3 uSun;",
        "uniform vec3 uCam;",
        "uniform float uTime;",
        "varying vec3 vWorld;",
        "varying vec3 vN;",
        "void main() {",
        "  vec3 N = normalize(vN);",
        "  vec3 V = normalize(uCam - vWorld);",
        "  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.8);",
        "  float caust = 0.5 + 0.5 * sin(vWorld.x * 0.16 + uTime * 1.5) * sin(vWorld.z * 0.13 - uTime);",
        "  vec3 col = mix(uDeep, uShallow, 0.32 + 0.4 * caust);",
        "  float lake = 1.0 - smoothstep(12.0, 125.0, distance(vWorld.xz, vec2(-470.0, 26.0)));",
        "  col = mix(col, vec3(0.55, 0.82, 1.0), lake * 0.4);",
        "  col += vec3(0.35, 0.2, 0.55) * lake * fres * 0.45;",
        "  float sea = smoothstep(400.0, 680.0, vWorld.x);",
        "  col = mix(col, vec3(0.02, 0.42, 0.72), sea * 0.28);",
        "  col = mix(col, vec3(0.82, 0.94, 1.0), fres * 0.62);",
        "  float spec = pow(max(dot(N, normalize(uSun + V)), 0.0), 90.0);",
        "  col += vec3(1.0, 0.96, 0.88) * spec * 0.75;",
        "  float alpha = 0.58 + fres * 0.3;",
        "  alpha = mix(alpha, 0.8, sea * 0.5);",
        "  gl_FragColor = vec4(col, alpha);",
        "  #include <tonemapping_fragment>",
        "  #include <colorspace_fragment>",
        "}",
      ].join("\n"),
    });
  }

  function buildWater() {
    const geo = new THREE.PlaneGeometry(2600, 2600, 70, 70);
    geo.rotateX(-Math.PI / 2);
    waterMat = makeWaterMaterial();
    const mesh = new THREE.Mesh(geo, waterMat);
    mesh.position.y = W.WATER_Y;
    mesh.renderOrder = 2;
    scene.add(mesh);
  }

  function waterfallMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "varying vec2 vUv;",
        "void main() {",
        "  float x = vUv.x;",
        "  float y = vUv.y;",
        "  float shift = sin(y * 12.0 + uTime * 0.7) * 0.02;",
        "  float streaks = sin((x + shift) * 48.0 + sin(y * 7.0 + uTime) * 0.5);",
        "  streaks = smoothstep(0.05, 1.0, streaks * 0.5 + 0.5);",
        "  float scroll = fract(y * 2.4 + uTime * 1.15);",
        "  float bands = smoothstep(0.0, 0.12, scroll) * smoothstep(0.85, 0.35, scroll);",
        "  float edge = smoothstep(0.0, 0.1, x) * smoothstep(1.0, 0.9, x);",
        "  float foam = 1.0 - smoothstep(0.0, 0.16, y);",
        "  float alpha = edge * (0.62 + 0.38 * streaks) * (0.75 + 0.25 * bands);",
        "  alpha = mix(alpha, 0.95, foam * 0.75);",
        "  vec3 col = mix(vec3(0.62, 0.88, 1.0), vec3(1.0), streaks);",
        "  col = mix(col, vec3(1.0), foam);",
        "  gl_FragColor = vec4(col, alpha);",
        "  #include <tonemapping_fragment>",
        "  #include <colorspace_fragment>",
        "}",
      ].join("\n"),
    });
  }

  function buildFalls() {
    const mat = waterfallMaterial();
    waterMat.userData.fallMat = mat;
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xf7fcff, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false,
    });
    const soft = softTexture();
    for (let i = 0; i < falls.length; i++) {
      const f = falls[i];
      const height = Math.max(24, f.top - f.bot);
      const midY = (f.top + f.bot) * 0.5;
      const core = new THREE.Mesh(new THREE.PlaneGeometry(f.width * 0.5, height), coreMat);
      core.position.set(f.x, midY, f.z);
      core.renderOrder = 2;
      scene.add(core);
      const group = new THREE.Group();
      for (let layer = 0; layer < 3; layer++) {
        const geo = new THREE.PlaneGeometry(f.width * (1 - layer * 0.08), height, 1, 12);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.z = 0.6 + layer * 1.1;
        mesh.position.x = (layer - 1) * 1.2;
        mesh.renderOrder = 3;
        group.add(mesh);
      }
      group.position.set(f.x, midY, f.z);
      scene.add(group);
      const stream = new THREE.Mesh(new THREE.PlaneGeometry(f.width * 0.72, 26), mat);
      stream.rotation.x = -Math.PI / 2;
      stream.position.set(f.x, f.top + 0.55, f.z - 18);
      stream.renderOrder = 2;
      scene.add(stream);
      const mist = new THREE.Sprite(new THREE.SpriteMaterial({
        map: soft, color: 0xf4fbff, transparent: true, opacity: 0.55,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      mist.position.set(f.x, f.bot + 4, f.z + 8);
      mist.scale.set(f.width * 1.6, 18, 1);
      scene.add(mist);
    }
  }

  function buildBridges() {
    const data = W.build();
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4895c, roughness: 0.9, metalness: 0.02 });
    const matD = new THREE.MeshStandardMaterial({ color: 0xb85d38, roughness: 0.92 });
    for (let i = 0; i < data.bridges.length; i++) {
      const b = data.bridges[i];
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);
      group.rotation.y = b.yaw;
      const arch = new THREE.Mesh(new THREE.TorusGeometry(26, 3.5, 8, 22, Math.PI), mat);
      arch.position.y = 7;
      group.add(arch);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(58, 2.2, 11), matD);
      lip.position.y = 34;
      group.add(lip);
      scene.add(group);
    }
  }

  function buildRainbow() {
    const f = falls[2] || falls[0];
    const geo = new THREE.TorusGeometry(22, 1.05, 8, 48, Math.PI);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(pos.getX(i) / 44 + 0.5, 0, 1);
      c.setHSL(0.02 + t * 0.78, 0.9, 0.62);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(f.x + 6, f.bot + 18, f.z + 14);
    scene.add(mesh);
  }

  function scatterRegion(seed, count, cx, cz, rx, rz, accept) {
    const rnd = rngFactory(seed);
    const out = [];
    let guard = 0;
    while (out.length < count && guard < count * 16) {
      guard++;
      const x = cx + (rnd() * 2 - 1) * rx;
      const z = cz + (rnd() * 2 - 1) * rz;
      const h = W.sampleHeight(x, z);
      if (h < W.WATER_Y + 0.5) continue;
      const slope = W.sampleSlope(x, z);
      const biome = W.sampleBiome(x, z);
      const item = accept(x, z, h, slope, biome, rnd);
      if (item) out.push(item);
    }
    return out;
  }

  function buildInstanced(geo, mat, items, mapItem) {
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < items.length; i++) {
      const t = mapItem(items[i], dummy, color);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (t) mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }

  function buildVegetation() {
    const greens = [0x1f9d4a, 0x168a3e, 0x2fbf62, 0x0e7a48, 0x49d07a];
    const blossoms = [0xff8fab, 0xffd0dc, 0xfff1f4, 0xff7aa2, 0xffc2d4];
    const autumn = [0xe07a2f, 0xc44536, 0xf0b429, 0xffd166, 0xd8572a];
    const purple = [0x8b6cff, 0xc77dff, 0x6a5acd, 0xe0b3ff, 0x7a68e8];
    const pines = [0x1d6b45, 0x145c3a, 0x247a4e, 0x0f4d34];

    const round = [];
    const pine = [];
    const palm = [];
    const blossom = [];
    const autumnTrees = [];
    const purpleTrees = [];

    function pushTree(list, x, z, h, rnd, opts) {
      list.push({
        x: x, z: z, h: h,
        trunkH: opts.trunkH, trunkR: opts.trunkR,
        crown: opts.crown, crownH: opts.crownH,
        ry: rnd() * TAU,
        color: opts.color,
      });
    }

    function cliffFace(x, z) {
      if (x < -40 || x > 560) return false;
      const dz = z - W.edgeZ(x);
      return dz > -8 && dz < 36;
    }
    round.push.apply(round, scatterRegion(3, 620, 210, -150, 280, 230, function (x, z, h, slope, biome, rnd) {
      if (slope > 0.8 || cliffFace(x, z)) return null;
      if (biome !== BIO.FOREST && biome !== BIO.FALLS && biome !== BIO.HILLS) return null;
      if (biome === BIO.HILLS && rnd() > 0.22) return null;
      const tall = biome === BIO.FALLS ? 1.2 : 1;
      pushTree(round, x, z, h, rnd, {
        trunkH: (4.2 + rnd() * 4.2) * tall,
        trunkR: 0.22 + rnd() * 0.12,
        crown: (2.5 + rnd() * 2.1) * tall,
        crownH: 0.82 + rnd() * 0.3,
        color: greens[(rnd() * greens.length) | 0],
      });
    }));
    blossom.push.apply(blossom, scatterRegion(7, 140, 30, -350, 140, 120, function (x, z, h, slope, biome, rnd) {
      if (slope > 0.7 || (biome !== BIO.BLOSSOM && biome !== BIO.MEADOW)) return null;
      pushTree(blossom, x, z, h, rnd, {
        trunkH: 2.8 + rnd() * 2.2, trunkR: 0.16 + rnd() * 0.08,
        crown: 1.8 + rnd() * 1.4, crownH: 0.9,
        color: blossoms[(rnd() * blossoms.length) | 0],
      });
    }));
    blossom.push.apply(blossom, scatterRegion(8, 70, -150, -540, 180, 150, function (x, z, h, slope, biome, rnd) {
      if (slope > 0.55 || biome !== BIO.MEADOW || rnd() > 0.55) return null;
      pushTree(blossom, x, z, h, rnd, {
        trunkH: 3 + rnd() * 2, trunkR: 0.16, crown: 1.7 + rnd() * 1.2, crownH: 0.95,
        color: blossoms[(rnd() * blossoms.length) | 0],
      });
    }));
    pine.push.apply(pine, scatterRegion(11, 260, -180, 620, 320, 180, function (x, z, h, slope, biome, rnd) {
      if (h < 40 || h > 102 || slope > 0.95) return null;
      if (biome !== BIO.PEAK && biome !== BIO.HILLS && biome !== BIO.ROCK && biome !== BIO.PLATEAU) return null;
      pushTree(pine, x, z, h, rnd, {
        trunkH: 2.4 + rnd() * 2, trunkR: 0.16,
        crown: 1.5 + rnd() * 1.1, crownH: 2.4 + rnd() * 1.4,
        color: pines[(rnd() * pines.length) | 0],
      });
    }));
    pine.push.apply(pine, scatterRegion(12, 80, 220, 0, 200, 80, function (x, z, h, slope, biome, rnd) {
      if (biome !== BIO.PLATEAU || slope > 0.5) return null;
      pushTree(pine, x, z, h, rnd, {
        trunkH: 2.2 + rnd(), trunkR: 0.14, crown: 1.3 + rnd() * 0.7, crownH: 2.2,
        color: pines[(rnd() * pines.length) | 0],
      });
    }));
    palm.push.apply(palm, scatterRegion(15, 60, 470, -380, 180, 220, function (x, z, h, slope, biome, rnd) {
      if (biome !== BIO.BEACH || slope > 0.4) return null;
      pushTree(palm, x, z, h, rnd, {
        trunkH: 6 + rnd() * 3, trunkR: 0.12, crown: 2.4 + rnd() * 0.8, crownH: 0.45,
        color: 0x2fbf6a,
      });
    }));
    autumnTrees.push.apply(autumnTrees, scatterRegion(18, 150, -430, 40, 170, 150, function (x, z, h, slope, biome, rnd) {
      if (slope > 0.7 || (biome !== BIO.LAKE && biome !== BIO.HILLS && biome !== BIO.ISLAND)) return null;
      if (biome === BIO.HILLS && rnd() > 0.4) return null;
      pushTree(autumnTrees, x, z, h, rnd, {
        trunkH: 3.2 + rnd() * 2.4, trunkR: 0.18, crown: 2.2 + rnd() * 1.5, crownH: 0.85,
        color: autumn[(rnd() * autumn.length) | 0],
      });
    }));
    purpleTrees.push.apply(purpleTrees, scatterRegion(21, 80, -360, -230, 110, 100, function (x, z, h, slope, biome, rnd) {
      if (biome !== BIO.GROVE || slope > 0.6) return null;
      pushTree(purpleTrees, x, z, h, rnd, {
        trunkH: 3.4 + rnd() * 2.6, trunkR: 0.16, crown: 2.1 + rnd() * 1.4, crownH: 0.9,
        color: purple[(rnd() * purple.length) | 0],
      });
    }));

    const grovePlace = places.find(function (p) { return p.id === "grove"; });
    const gr = rngFactory(4);
    for (let i = 0; i < 14; i++) {
      const a = gr() * TAU;
      const rad = 6 + gr() * 34;
      const x = grovePlace.x + Math.cos(a) * rad;
      const z = grovePlace.z + Math.sin(a) * rad;
      pushTree(purpleTrees, x, z, W.sampleHeight(x, z), gr, {
        trunkH: 4.2 + gr() * 2.4, trunkR: 0.2, crown: 3.1 + gr() * 1.2, crownH: 1.05,
        color: purple[i % purple.length],
      });
    }
    const coastPlace = places.find(function (p) { return p.id === "coast"; });
    for (let i = 0; i < 8; i++) {
      const x = coastPlace.x - 10 + i * 14;
      const z = coastPlace.z - 24 + (i % 3) * 12;
      const h = W.sampleHeight(x, z);
      if (h < 2.6 || h > 12) continue;
      pushTree(palm, x, z, h, gr, {
        trunkH: 7 + (i % 3), trunkR: 0.13, crown: 2.8, crownH: 0.42, color: 0x2fbf6a,
      });
    }
    const lake = places.find(function (p) { return p.id === "lake"; });
    pushTree(blossom, lake.x, lake.z, lake.ground, rngFactory(99), {
      trunkH: 5.5, trunkR: 0.28, crown: 3.4, crownH: 1.05, color: 0xff8fb8,
    });

    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.72, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d5a34, roughness: 0.9 });
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0xd7b07a, roughness: 0.75 });
    const sphere = new THREE.SphereGeometry(1, 8, 6);
    const cone = new THREE.ConeGeometry(1, 1, 7);
    cone.translate(0, 0.5, 0);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.02 });

    function trunks(list, mat) {
      buildInstanced(trunkGeo, mat, list, function (it, dummy) {
        dummy.position.set(it.x, it.h, it.z);
        dummy.rotation.set(0, it.ry, 0);
        dummy.scale.set(it.trunkR * 2, it.trunkH, it.trunkR * 2);
      });
    }
    function crowns(list, geo) {
      buildInstanced(geo, leafMat, list, function (it, dummy, color) {
        const lift = geo === cone ? it.trunkH : it.trunkH + it.crown * 0.42;
        dummy.position.set(it.x, it.h + lift, it.z);
        dummy.rotation.set(0, it.ry, 0);
        dummy.scale.set(it.crown, it.crown * it.crownH, it.crown);
        color.setHex(it.color);
        return true;
      });
    }
    const wood = round.concat(blossom, autumnTrees, purpleTrees, pine);
    trunks(wood, trunkMat);
    trunks(palm, palmTrunkMat);
    crowns(round.concat(blossom, autumnTrees, purpleTrees), sphere);
    crowns(palm, sphere);
    crowns(pine, cone);

    const flowers = scatterRegion(30, 420, -150, -530, 200, 170, function (x, z, h, slope, biome, rnd) {
      if (biome !== BIO.MEADOW && biome !== BIO.BLOSSOM) return null;
      if (slope > 0.45) return null;
      return { x: x, z: z, h: h, s: 0.7 + rnd() * 0.8, ry: rnd() * TAU, color: [0xff7aa2, 0xffe56a, 0xc9a6ff, 0xffffff, 0xffb703][(rnd() * 5) | 0] };
    });
    const flowerGeo = crossedCard();
    const flowerMat = new THREE.MeshBasicMaterial({
      map: flowerTexture(),
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      color: 0xffffff,
    });
    buildInstanced(flowerGeo, flowerMat, flowers, function (it, dummy, color) {
      dummy.position.set(it.x, it.h + it.s * 0.45, it.z);
      dummy.rotation.set(0, it.ry, 0);
      dummy.scale.setScalar(it.s);
      color.setHex(it.color);
      return true;
    });

    const reeds = scatterRegion(33, 110, -420, 50, 130, 120, function (x, z, h, slope, biome, rnd) {
      if (biome !== BIO.LAKE || h < 2.4 || h > 7.5 || slope > 0.4) return null;
      return { x: x, z: z, h: h, s: 1.2 + rnd() * 1.4, ry: rnd() * TAU };
    });
    const reedGeo = new THREE.ConeGeometry(0.18, 1, 4);
    reedGeo.translate(0, 0.5, 0);
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x8fbf4a, roughness: 0.8 });
    buildInstanced(reedGeo, reedMat, reeds, function (it, dummy) {
      dummy.position.set(it.x, it.h, it.z);
      dummy.rotation.set(0, it.ry, 0);
      dummy.scale.set(1, it.s, 1);
    });

    const pads = scatterRegion(36, 28, -470, 26, 90, 90, function (x, z, h, slope, biome, rnd) {
      if (biome !== BIO.LAKE || h > 2.1 || h < -2) return null;
      if (Math.hypot(x + 470, z - 26) < 22) return null;
      return { x: x, z: z, s: 1.4 + rnd() * 1.6, ry: rnd() * TAU, color: rnd() > 0.7 ? 0xff8fab : 0x7ddea0 };
    });
    const padGeo = new THREE.CircleGeometry(1, 8);
    padGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 });
    buildInstanced(padGeo, padMat, pads, function (it, dummy, color) {
      dummy.position.set(it.x, W.WATER_Y + 0.18, it.z);
      dummy.rotation.set(0, it.ry, 0);
      dummy.scale.setScalar(it.s);
      color.setHex(it.color);
      return true;
    });

    const rocks = [];
    const rockRnd = rngFactory(40);
    for (let i = 0; i < W.GORGE.length - 1; i++) {
      const a = W.GORGE[i], b = W.GORGE[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      const rx = dz / len, rz = -dx / len;
      for (let t = 0.15; t < 0.9; t += 0.22) {
        for (const side of [-1, 1]) {
          const dist = 30 + rockRnd() * 10;
          const x = a[0] + dx * t + rx * dist * side;
          const z = a[1] + dz * t + rz * dist * side;
          const h = W.sampleHeight(x, z);
          if (h < 6) continue;
          rocks.push({ x: x, y: h, z: z, s: 1.6 + rockRnd() * 3.2, ry: rockRnd() * TAU, color: rockRnd() > 0.5 ? 0xe39a62 : 0xc4623c });
        }
      }
    }
    const seaStacks = [[700, -220, 16], [770, -80, 20], [690, 20, 11], [740, -360, 13]];
    for (let i = 0; i < seaStacks.length; i++) {
      const s = seaStacks[i];
      if (W.sampleHeight(s[0], s[1]) > 4) continue;
      rocks.push({ x: s[0], y: -2, z: s[1], s: s[2], ry: i, color: 0xf0d2b0, sy: 1.4 });
    }
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
    buildInstanced(rockGeo, rockMat, rocks, function (it, dummy, color) {
      dummy.position.set(it.x, it.y + it.s * 0.35, it.z);
      dummy.rotation.set(it.ry, it.ry * 0.7, 0);
      dummy.scale.set(it.s, it.s * (it.sy || 0.8), it.s * 0.9);
      color.setHex(it.color);
      return true;
    });

    const grove = places.find(function (p) { return p.id === "grove"; });
    const soft = softTexture();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const x = grove.x + Math.cos(a) * 28;
      const z = grove.z + Math.sin(a) * 24;
      const h = W.sampleHeight(x, z);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 2.2, 5),
        new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.8 })
      );
      post.position.set(x, h + 1.1, z);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd38a })
      );
      bulb.position.set(x, h + 2.35, z);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: soft, color: 0xffc56e, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.8,
      }));
      glow.position.set(x, h + 2.4, z);
      glow.scale.set(3.4, 3.4, 1);
      scene.add(post, bulb, glow);
    }
  }

  function crossedCard() {
    const a = new THREE.PlaneGeometry(1, 1).toNonIndexed();
    const b = new THREE.PlaneGeometry(1, 1).toNonIndexed();
    b.rotateY(Math.PI / 2);
    const geo = new THREE.BufferGeometry();
    const count = a.attributes.position.count + b.attributes.position.count;
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    pos.set(a.attributes.position.array, 0);
    pos.set(b.attributes.position.array, a.attributes.position.count * 3);
    uv.set(a.attributes.uv.array, 0);
    uv.set(b.attributes.uv.array, a.attributes.uv.count * 2);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.translate(0, 0.5, 0);
    return geo;
  }

  function flowerTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 64, 64);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      g.beginPath();
      g.ellipse(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9, 8, 13, a, 0, TAU);
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.fill();
    }
    g.beginPath();
    g.arc(32, 32, 5, 0, TAU);
    g.fillStyle = "#ffe08a";
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function softTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.55)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function cloudTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 128, 64);
    for (let i = 0; i < 6; i++) {
      const x = 22 + i * 16;
      const y = 30 + Math.sin(i) * 4;
      const rad = 16 + (i % 3) * 4;
      const grd = g.createRadialGradient(x, y, 2, x, y, rad);
      grd.addColorStop(0, "rgba(255,255,255,0.92)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function buildRoute() {
    const route = places.filter(function (p) { return p.route; });
    routeCurve = new THREE.CatmullRomCurve3(
      route.map(function (p) { return new THREE.Vector3(p.x, p.y, p.z); }),
      true, "catmullrom", 0.32
    );
    const pts = routeCurve.getSpacedPoints(220);
    for (let i = 0; i < pts.length; i++) {
      const g = W.sampleHeight(pts[i].x, pts[i].z);
      if (pts[i].y < g + 14) pts[i].y = g + 14;
      if (pts[i].y < W.WATER_Y + 8) pts[i].y = W.WATER_Y + 8;
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
      color: 0xffe7a3, transparent: true, opacity: 0.4,
    }));
    scene.add(line);

    const ringGeo = new THREE.TorusGeometry(12, 0.42, 8, 32);
    function addRing(place, index, onRoute) {
      const next = onRoute ? route[(index + 1) % route.length] : place;
      const yaw = onRoute ? Math.atan2(next.x - place.x, next.z - place.z) : 0;
      const pivot = new THREE.Group();
      pivot.position.set(place.x, place.y, place.z);
      pivot.rotation.y = yaw;
      const mat = new THREE.MeshBasicMaterial({
        color: onRoute ? 0xffd56a : 0xc9a6ff,
        transparent: true,
        opacity: 0.92,
      });
      const torus = new THREE.Mesh(ringGeo, mat);
      pivot.add(torus);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.55, 150, 6, 1, true),
        new THREE.MeshBasicMaterial({
          color: onRoute ? 0xffe7a8 : 0xd7c6ff,
          transparent: true,
          opacity: onRoute ? 0.1 : 0.07,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        })
      );
      beam.position.y = 20;
      pivot.add(beam);
      scene.add(pivot);
      rings.push({
        place: place, pivot: pivot, torus: torus, beam: beam,
        done: false, onRoute: onRoute, index: index, base: place.y,
      });
    }
    route.forEach(function (p, i) { addRing(p, i, true); });
    const grove = places.find(function (p) { return p.id === "grove"; });
    addRing(grove, -1, false);
  }

  function buildSky() {
    const geo = new THREE.SphereGeometry(2400, 28, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color("#3a6bff") },
        uMid: { value: new THREE.Color("#79d4ff") },
        uHor: { value: new THREE.Color("#ffe0b0") },
        uSun: { value: SUN.clone() },
      },
      vertexShader: [
        "varying vec3 vDir;",
        "void main() {",
        "  vDir = normalize(position);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vDir;",
        "uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSun;",
        "void main() {",
        "  vec3 dir = normalize(vDir);",
        "  float h = dir.y;",
        "  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.32, h));",
        "  col = mix(col, uTop, smoothstep(0.18, 0.85, h));",
        "  float sun = pow(max(dot(dir, normalize(uSun)), 0.0), 420.0);",
        "  float glow = pow(max(dot(dir, normalize(uSun)), 0.0), 7.0);",
        "  col += vec3(1.0, 0.95, 0.82) * sun;",
        "  col += vec3(1.0, 0.72, 0.42) * glow * 0.48;",
        "  gl_FragColor = vec4(col, 1.0);",
        "  #include <tonemapping_fragment>",
        "  #include <colorspace_fragment>",
        "}",
      ].join("\n"),
    });
    sky = new THREE.Mesh(geo, mat);
    scene.add(sky);

    const tex = cloudTexture();
    const rnd = rngFactory(70);
    for (let i = 0; i < 34; i++) {
      const matC = new THREE.SpriteMaterial({
        map: tex,
        color: i % 5 === 0 ? 0xffe0ea : 0xffffff,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const s = new THREE.Sprite(matC);
      const x = (rnd() * 2 - 1) * 780;
      const z = (rnd() * 2 - 1) * 780;
      const y = 145 + rnd() * 70;
      s.position.set(x, y, z);
      const sc = 70 + rnd() * 90;
      s.scale.set(sc * 1.8, sc, 1);
      s.userData.base = s.position.clone();
      s.userData.drift = 4 + rnd() * 8;
      scene.add(s);
    }
    for (let i = 0; i < 8; i++) {
      const matC = new THREE.SpriteMaterial({
        map: tex, color: 0xfff4ea, transparent: true, opacity: 0.45, depthWrite: false,
      });
      const s = new THREE.Sprite(matC);
      s.position.set(-220 + i * 40, 168 + (i % 3) * 8, 560 + (i - 4) * 24);
      s.scale.set(120, 54, 1);
      s.userData.base = s.position.clone();
      s.userData.drift = 6;
      scene.add(s);
    }
  }

  function makeBird(pal, scale) {
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    const inner = new THREE.Group();
    g.add(inner);
    const std = function (color, rough) {
      return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.45 : rough, metalness: 0.03 });
    };
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), std(pal.body, 0.4));
    body.scale.set(0.9, 0.7, 1.42);
    inner.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), std(pal.belly, 0.55));
    belly.scale.set(0.82, 0.5, 1.1);
    belly.position.set(0, -0.16, 0.05);
    inner.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), std(pal.head, 0.38));
    head.position.set(0, 0.16, 0.58);
    inner.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 8), std(pal.beak, 0.32));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.12, 0.92);
    inner.add(beak);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b140f, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
      eye.position.set(s * 0.11, 0.24, 0.76);
      inner.add(eye);
    }
    function wing(side) {
      const w = new THREE.Group();
      const cols = [pal.wingA, pal.wingB, pal.wingC];
      for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(
          new THREE.BoxGeometry(0.92, 0.04, 0.32 - i * 0.045),
          std(cols[i], 0.4)
        );
        feather.position.set(side * (0.52 + i * 0.68), 0.01 * i, -0.06 * i);
        feather.rotation.z = side * (-0.1 - i * 0.05);
        w.add(feather);
      }
      w.position.set(side * 0.22, 0.08, 0.02);
      inner.add(w);
      return w;
    }
    const tail = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.025, 0.78),
        std(i === 1 ? pal.tail : pal.tail2, 0.42)
      );
      f.position.set((i - 1) * 0.15, 0, -0.78);
      f.rotation.y = (i - 1) * 0.16;
      tail.add(f);
    }
    tail.position.set(0, 0.02, -0.28);
    inner.add(tail);
    g.userData.wingL = wing(-1);
    g.userData.wingR = wing(1);
    g.userData.tail = tail;
    g.userData.inner = inner;
    g.scale.setScalar(scale);
    return g;
  }

  function animateWings(group, phase, flapAmt) {
    const s = Math.sin(phase);
    const amp = 0.28 + flapAmt * 0.72;
    group.userData.wingL.rotation.z = -0.2 - s * amp;
    group.userData.wingR.rotation.z = 0.2 + s * amp;
    group.userData.tail.rotation.x = s * 0.12 * flapAmt;
    group.userData.inner.position.y = s * 0.05 * (0.3 + flapAmt);
  }

  function buildBird() {
    bird = makeBird({
      body: 0x14c4b4,
      belly: 0xffe08a,
      head: 0xff4f7b,
      beak: 0xffb703,
      wingA: 0xff6a3d,
      wingB: 0x7a4bff,
      wingC: 0x3ec6ff,
      tail: 0xffd23f,
      tail2: 0xff4f8b,
    }, 1);
    scene.add(bird);
    const blobGeo = new THREE.CircleGeometry(1.15, 16);
    blobGeo.rotateX(-Math.PI / 2);
    birdShadow = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({
      color: 0x16324a, transparent: true, opacity: 0.22, depthWrite: false,
    }));
    scene.add(birdShadow);

    const sites = [
      { x: 180, y: 48, z: -120, r: 40, pal: { body: 0xff5d73, belly: 0xffe08a, head: 0xffd166, beak: 0xff8c42, wingA: 0xff7a3c, wingB: 0xffd166, wingC: 0xff4f8b, tail: 0xffb703, tail2: 0xff6b6b } },
      { x: -460, y: 28, z: 40, r: 50, pal: { body: 0xf4f7fb, belly: 0xd7e2ea, head: 0xffffff, beak: 0xffb703, wingA: 0xe8eef5, wingB: 0xb7c4d4, wingC: 0xffffff, tail: 0xd5dde8, tail2: 0xffffff } },
      { x: 560, y: 30, z: -300, r: 46, pal: { body: 0xf7fbff, belly: 0xffe8a3, head: 0xffffff, beak: 0xff9f1c, wingA: 0xffffff, wingB: 0xd5e6f5, wingC: 0xfff1c9, tail: 0xe7f2ff, tail2: 0xffffff } },
      { x: -180, y: 150, z: 600, r: 55, pal: { body: 0x5b8cff, belly: 0xfff1c9, head: 0x7aa2ff, beak: 0xffd56a, wingA: 0x89b4ff, wingB: 0xffffff, wingC: 0xc9d8ff, tail: 0xffe08a, tail2: 0x9db7ff } },
    ];
    bird.userData.flock = sites.map(function (s, i) {
      const m = makeBird(s.pal, 0.55);
      scene.add(m);
      return { mesh: m, x: s.x, y: s.y, z: s.z, r: s.r, phase: i * 1.7, speed: 0.22 + i * 0.04 };
    });
  }

  function buildAtmosphere() {
    const soft = softTexture();
    function field(count, size, color, opacity, additive) {
      const pos = new Float32Array(count * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: size, map: soft, color: color, transparent: true, opacity: opacity,
        depthWrite: false, sizeAttenuation: true,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 3;
      scene.add(pts);
      return { pos: pos, geo: geo, count: count };
    }
    const mist = field(160, 22, 0xe7f7ff, 0.28, true);
    const seeds = [];
    for (let i = 0; i < mist.count; i++) {
      const f = falls[i % falls.length];
      seeds.push({
        x: f.x + ((i * 17) % 17) - 8,
        z: f.z + 6 + (i % 5) * 2,
        y0: f.bot,
        h: 16 + (i % 7),
        speed: 0.25 + (i % 5) * 0.05,
        phase: (i * 0.37) % 1,
      });
    }
    mist.seeds = seeds;
    mist.kind = "mist";
    fields.push(mist);

    const grove = places.find(function (p) { return p.id === "grove"; });
    const flies = field(90, 8, 0xe8ff9a, 0.95, true);
    flies.seeds = [];
    for (let i = 0; i < flies.count; i++) {
      flies.seeds.push({
        x: grove.x + Math.sin(i) * 40,
        z: grove.z + Math.cos(i * 1.3) * 36,
        y: grove.ground + 2 + (i % 8),
        phase: i,
      });
    }
    flies.kind = "fly";
    fields.push(flies);

    const meadow = places[0];
    const petals = field(80, 1.3, 0xff8fab, 0.85, false);
    petals.seeds = [];
    for (let i = 0; i < petals.count; i++) {
      petals.seeds.push({
        x: meadow.x + ((i * 13) % 80) - 40,
        z: meadow.z + ((i * 9) % 70) - 30,
        y: meadow.ground + 6 + (i % 12),
        phase: i * 0.2,
      });
    }
    petals.kind = "petal";
    fields.push(petals);

    const thermals = field(90, 4.5, 0xfff1c2, 0.45, true);
    thermals.seeds = [];
    for (let i = 0; i < thermals.count; i++) {
      const u = updrafts[i % updrafts.length];
      thermals.seeds.push({ u: u, phase: (i * 0.17) % 1, ang: i });
    }
    thermals.kind = "thermal";
    fields.push(thermals);
  }

  function buildMap() {
    const N = W.N;
    const off = document.createElement("canvas");
    off.width = N;
    off.height = N;
    const ctx = off.getContext("2d");
    const img = ctx.createImageData(N, N);
    const data = W.build();
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const h = data.height[iz * N + ix];
        const x = -W.HALF + ix * W.CELL;
        const z = -W.HALF + iz * W.CELL;
        let r, g, b;
        if (h < W.WATER_Y) {
          const lake = Math.hypot(x + 470, z - 26) < 120;
          r = lake ? 120 : 50;
          g = lake ? 210 : 176;
          b = lake ? 235 : 214;
        } else {
          const i = (iz * N + ix) * 3;
          r = data.color[i] * 255;
          g = data.color[i + 1] * 255;
          b = data.color[i + 2] * 255;
        }
        const row = N - 1 - iz;
        const o = (row * N + ix) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.beginPath();
    const route = places.filter(function (p) { return p.route; });
    route.forEach(function (p, i) {
      const mx = ((p.x + W.HALF) / W.SPAN) * N;
      const my = (1 - (p.z + W.HALF) / W.SPAN) * N;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 214, 96, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
    mapBase = off;
  }

  function resetPlayer() {
    const a = places.find(function (p) { return p.route; });
    const route = places.filter(function (p) { return p.route; });
    const b = route[1];
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    player.x = a.x - Math.sin(yaw) * 115;
    player.z = a.z - Math.cos(yaw) * 115;
    const ground = W.sampleHeight(player.x, player.z);
    player.y = Math.max(a.y, ground + 12, W.WATER_Y + 10);
    player.yaw = yaw;
    player.pitch = -0.08;
    player.roll = 0;
    player.speed = 20;
    player.vy = 0;
    player.flapPhase = 0;
  }

  function readInput() {
    let sx = 0;
    let sy = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) sx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) sx += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) sy += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) sy -= 1;
    if (joy.active) { sx += joy.x; sy += joy.y; }
    if (Math.abs(dragX) > 1 || Math.abs(dragY) > 1) {
      sx += clamp(dragX / 80, -1, 1);
      sy += clamp(-dragY / 80, -1, 1);
    }
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1 : 0;
    const flap = (flapHeld || keys.has("Space") || joy.flap) ? 1 : 0;
    return { sx: clamp(sx, -1, 1), sy: clamp(sy, -1, 1), flap: flap, boost: boost };
  }

  function stepFlight(dt, input) {
    player.yaw -= input.sx * (1.15 + player.speed * 0.012) * dt;
    const targetRoll = clamp(input.sx * 0.95, -1.05, 1.05);
    player.roll += (targetRoll - player.roll) * Math.min(1, dt * 4.2);
    player.pitch += input.sy * 0.95 * dt;
    if (Math.abs(input.sy) < 0.08) player.pitch += (-0.12 - player.pitch) * Math.min(1, dt * 0.5);
    player.pitch = clamp(player.pitch, -1.05, 0.92);

    const glidePitch = -0.16;
    const err = player.pitch - glidePitch;
    const efficiency = Math.exp(-err * err * 3.2);
    const targetSpeed = 21 + input.flap * 8 + Math.max(0, -player.pitch) * 16 + input.boost * 34;
    const accel = input.boost ? 3.4 : 1.35;
    player.speed += (targetSpeed - player.speed) * (1 - Math.exp(-accel * dt));
    player.speed = clamp(player.speed, 12, input.boost ? 72 : 48);

    const flapRate = input.flap > 0.2 ? 13 : 5.2 + player.speed * 0.05;
    player.flapPhase += dt * flapRate;
    const down = Math.max(0, -Math.cos(player.flapPhase));
    const flapLift = input.flap * (3.2 + down * 9);

    let thermal = 0;
    for (let i = 0; i < updrafts.length; i++) {
      const u = updrafts[i];
      const d = Math.hypot(player.x - u.x, player.z - u.z);
      if (d < u.r) {
        const k = 1 - d / u.r;
        thermal += u.power * k * k;
      }
    }
    const residual = 5.0 * (1 - 0.7 * efficiency);
    const vy = Math.sin(player.pitch) * player.speed * 0.33 + flapLift - residual + thermal * 0.32;
    const vh = Math.cos(player.pitch) * player.speed;
    player.vy = vy;
    player.x += Math.sin(player.yaw) * vh * dt;
    player.z += Math.cos(player.yaw) * vh * dt;
    player.y += vy * dt;

    const lim = 860;
    if (Math.abs(player.x) > lim || Math.abs(player.z) > lim) {
      player.x = clamp(player.x, -lim, lim);
      player.z = clamp(player.z, -lim, lim);
      const want = Math.atan2(-player.x, -player.z);
      player.yaw += wrapAngle(want - player.yaw) * Math.min(1, dt * 1.4);
      if (!player.edgeTold) {
        toast("Дальше только край неба");
        player.edgeTold = true;
      }
    } else player.edgeTold = false;

    const ground = W.sampleHeight(player.x, player.z);
    const floor = Math.max(ground + 1.25, W.WATER_Y + 1.05);
    if (player.y < floor) {
      player.y = floor;
      if (player.pitch < 0.2) player.pitch += dt * 1.1;
      player.speed *= 1 - Math.min(0.5, dt * 0.8);
    }
    if (player.y > 240) {
      player.y = 240;
      player.pitch = Math.min(player.pitch, -0.02);
    }

    if (audio && input.flap && down > 0.65 && player.prevDown <= 0.65) audio.flap();
    player.prevDown = down;
    return input;
  }

  function updateBirdVisual(flapAmt) {
    bird.position.set(player.x, player.y, player.z);
    bird.rotation.order = "YXZ";
    bird.rotation.y = player.yaw;
    bird.rotation.x = player.pitch;
    bird.rotation.z = player.roll;
    animateWings(bird, player.flapPhase, flapAmt);
    const ground = W.sampleHeight(player.x, player.z);
    const alt = player.y - Math.max(ground, W.WATER_Y);
    birdShadow.position.set(player.x, Math.max(ground, W.WATER_Y) + 0.35, player.z);
    const sc = clamp(1.1 + alt * 0.03, 1, 6);
    birdShadow.scale.setScalar(sc);
    birdShadow.material.opacity = clamp(0.28 - alt * 0.004, 0.04, 0.28);
  }

  function updateCamera(dt, cinematic) {
    const dist = cinematic ? 20 : camDist;
    const height = cinematic ? 7.2 : 4.4;
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    const rx = Math.cos(player.yaw);
    const rz = -Math.sin(player.yaw);
    let useDist = dist;
    if (!cinematic) {
      for (let t = 6; t < dist; t += 3) {
        const sx = player.x - fx * t;
        const sz = player.z - fz * t;
        if (W.sampleHeight(sx, sz) > player.y - 1) { useDist = Math.max(5.5, t - 2); break; }
      }
    }
    const desired = new THREE.Vector3(
      player.x - fx * useDist + rx * (-player.roll * 1.6),
      player.y + height,
      player.z - fz * useDist + rz * (-player.roll * 1.6)
    );
    const ground = W.sampleHeight(desired.x, desired.z);
    if (desired.y < ground + 1.6) desired.y = ground + 1.6;
    const look = new THREE.Vector3(
      player.x + fx * 12,
      player.y + 1.1 + player.pitch * 4,
      player.z + fz * 12
    );
    const k = 1 - Math.exp(-3.2 * dt);
    camPos.lerp(desired, cinematic ? 1 : k);
    lookTarget.lerp(look, cinematic ? 1 : k);
    camera.position.copy(camPos);
    camera.lookAt(lookTarget);
    camera.rotateZ(player.roll * (cinematic ? 0.15 : 0.32));
    camera.fov = cinematic ? 68 : 66 + (player.speed - 16) * 0.22;
    camera.updateProjectionMatrix();
    if (sky) sky.position.copy(camera.position);
  }

  function updateCinema(dt) {
    cinemaU = (cinemaU + dt * 0.012) % 1;
    const p = routeCurve.getPointAt(cinemaU);
    const tan = routeCurve.getTangentAt(cinemaU);
    const g = W.sampleHeight(p.x, p.z);
    p.y = Math.max(p.y, g + 16, W.WATER_Y + 8);
    player.x = p.x;
    player.y = p.y;
    player.z = p.z;
    player.yaw = Math.atan2(tan.x, tan.z);
    player.pitch = clamp(-Math.asin(clamp(tan.y, -1, 1)) * 0.8, -0.6, 0.6);
    player.roll = 0;
    player.speed = 22;
    player.flapPhase += dt * 8;
    updateBirdVisual(0.55);
    updateCamera(dt, true);
  }

  function nearestRouteRing() {
    for (let i = 0; i < rings.length; i++) {
      if (rings[i].onRoute && !rings[i].done) return rings[i];
    }
    return null;
  }

  function updateRings(dt, now) {
    const t = now * 0.001;
    const next = nearestRouteRing();
    let routeDone = 0;
    let routeTotal = 0;
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      if (ring.onRoute) {
        routeTotal++;
        if (ring.done) routeDone++;
      }
      const isNext = ring === next;
      const pulse = isNext ? 1.12 + Math.sin(t * 3.2) * 0.07 : 1;
      ring.torus.rotation.z = t * (isNext ? 0.8 : 0.25) + i;
      ring.torus.scale.setScalar(ring.done ? 0.92 : pulse);
      ring.pivot.position.y = ring.base + Math.sin(t * 1.4 + i) * 0.45;
      if (ring.done) {
        ring.torus.material.color.setHex(ring.onRoute ? 0x9ff3c9 : 0xe7d6ff);
        ring.beam.material.opacity = 0.04;
      } else if (isNext) {
        ring.torus.material.color.setHex(0xfff6c8);
        ring.beam.material.opacity = 0.34;
        ring.torus.scale.setScalar(pulse * 1.08);
      } else {
        ring.torus.material.color.setHex(ring.onRoute ? 0xffd56a : 0xc9a6ff);
        ring.beam.material.opacity = ring.onRoute ? 0.1 : 0.06;
      }
      if (mode !== "play" || ring.done) continue;
      const dx = player.x - ring.place.x;
      const dy = player.y - ring.pivot.position.y;
      const dz = player.z - ring.place.z;
      const near = dx * dx + dz * dz < 20 * 20 && dy * dy < 18 * 18;
      if (near) {
        ring.done = true;
        if (ring.onRoute && routeDone === 0) lapStarted = now;
        if (audio) audio.chime(ring.onRoute ? 523 : 392, ring.onRoute ? 784 : 620);
        if (ring.onRoute) toast("Кольцо · " + ring.place.name);
        else toast("Находка · " + ring.place.name);
      }
    }
    if (routeDone === routeTotal && routeTotal && !player.lapLock) {
      player.lapLock = true;
      laps += 1;
      const sec = lapStarted ? Math.max(0, (now - lapStarted) / 1000) : 0;
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      toast("Маршрут пройден" + (sec ? " · " + m + ":" + String(s).padStart(2, "0") : "") + " · круг " + laps);
      setTimeout(function () {
        for (let i = 0; i < rings.length; i++) if (rings[i].onRoute) rings[i].done = false;
        player.lapLock = false;
        lapStarted = 0;
      }, 2800);
    }
    const found = places.filter(function (p) { return p.found; }).length;
    ringCountEl.textContent = routeDone + "/" + routeTotal;
    placeCountEl.textContent = "места " + found + "/" + places.length;
    if (next) {
      const d = Math.hypot(player.x - next.place.x, player.z - next.place.z);
      const dy = next.pivot.position.y - player.y;
      const alt = dy > 14 ? " · выше" : dy < -14 ? " · ниже" : "";
      nextChip.textContent = "далее · " + (next.index + 1) + " " + next.place.name + " · " + Math.round(d) + " м" + alt;
    } else {
      const grove = places.find(function (p) { return p.id === "grove"; });
      nextChip.textContent = grove.found ? "маршрут пройден" : "в стороне · Сумеречная роща";
    }
  }

  function updateDiscovery() {
    let current = null;
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      const dx = player.x - p.x;
      const dz = player.z - p.z;
      if (dx * dx + dz * dz < 82 * 82 && Math.abs(player.y - p.y) < 60) {
        current = p;
        break;
      }
    }
    if (current && current.id !== insideId) {
      insideId = current.id;
      current.found = true;
      showBanner(current);
    } else if (!current) insideId = null;
  }

  function updateFields(time) {
    for (let f = 0; f < fields.length; f++) {
      const field = fields[f];
      const pos = field.pos;
      if (field.kind === "mist") {
        for (let i = 0; i < field.count; i++) {
          const s = field.seeds[i];
          const u = (time * s.speed + s.phase) % 1;
          pos[i * 3] = s.x + Math.sin(time + i) * 2;
          pos[i * 3 + 1] = s.y0 + u * s.h;
          pos[i * 3 + 2] = s.z + Math.cos(time * 0.8 + i) * 2;
        }
      } else if (field.kind === "fly") {
        for (let i = 0; i < field.count; i++) {
          const s = field.seeds[i];
          pos[i * 3] = s.x + Math.sin(time * 0.7 + s.phase) * 6;
          pos[i * 3 + 1] = s.y + Math.sin(time * 1.6 + s.phase) * 1.4;
          pos[i * 3 + 2] = s.z + Math.cos(time * 0.6 + s.phase) * 6;
        }
      } else if (field.kind === "petal") {
        for (let i = 0; i < field.count; i++) {
          const s = field.seeds[i];
          const y = s.y - ((time * 1.4 + s.phase) % 14);
          pos[i * 3] = s.x + Math.sin(time + s.phase) * 3;
          pos[i * 3 + 1] = y;
          pos[i * 3 + 2] = s.z + Math.cos(time * 0.7 + s.phase) * 2;
        }
      } else if (field.kind === "thermal") {
        for (let i = 0; i < field.count; i++) {
          const s = field.seeds[i];
          const u = (time * 0.35 + s.phase) % 1;
          const rad = s.u.r * 0.35 * (1 - u * 0.4);
          pos[i * 3] = s.u.x + Math.cos(s.ang + time) * rad;
          pos[i * 3 + 1] = 8 + u * 70;
          pos[i * 3 + 2] = s.u.z + Math.sin(s.ang + time) * rad;
        }
      }
      field.geo.attributes.position.needsUpdate = true;
    }
  }

  function updateFlock(time) {
    const flock = bird.userData.flock;
    for (let i = 0; i < flock.length; i++) {
      const b = flock[i];
      const a = time * b.speed + b.phase;
      b.mesh.position.set(b.x + Math.cos(a) * b.r, b.y + Math.sin(time * 0.8 + i) * 2.5, b.z + Math.sin(a) * b.r);
      b.mesh.rotation.y = -a + Math.PI / 2;
      animateWings(b.mesh, time * 7 + i, 0.4);
    }
  }

  function updateClouds(time) {
    scene.traverse(function (obj) {
      if (obj.userData && obj.userData.base && obj.userData.drift) {
        obj.position.x = obj.userData.base.x + Math.sin(time * 0.05 + obj.userData.base.z) * obj.userData.drift;
      }
    });
  }

  function drawMap() {
    const ctx = mapCtx;
    const S = mapCanvas.width;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, TAU);
    ctx.clip();
    ctx.drawImage(mapBase, 0, 0, S, S);
    function mx(x) { return ((x + W.HALF) / W.SPAN) * S; }
    function my(z) { return (1 - (z + W.HALF) / W.SPAN) * S; }
    const nextRing = nearestRouteRing();
    if (nextRing) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 248, 214, 0.95)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(mx(player.x), my(player.z));
      ctx.lineTo(mx(nextRing.place.x), my(nextRing.place.z));
      ctx.stroke();
      ctx.restore();
    }
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      const x = mx(ring.place.x);
      const y = my(ring.place.z);
      const isNext = ring === nextRing;
      ctx.beginPath();
      if (!ring.onRoute) {
        ctx.fillStyle = ring.done ? "#efe4ff" : "#d7b6ff";
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      } else if (ring.done) {
        ctx.fillStyle = "#9ff3c9";
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fill();
      } else if (isNext) {
        ctx.fillStyle = "rgba(255, 236, 170, " + (0.35 + pulse * 0.4) + ")";
        ctx.arc(x, y, 12 + pulse * 3, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "#ffe28a";
        ctx.arc(x, y, 8, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fffaf0";
        ctx.stroke();
      } else {
        ctx.fillStyle = "#ffd56a";
        ctx.arc(x, y, 6.5, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(90, 50, 10, 0.55)";
        ctx.stroke();
      }
      if (ring.onRoute) {
        ctx.fillStyle = ring.done ? "#145c45" : "#3a2410";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(ring.index + 1), x, y + 0.5);
      }
    }
    ctx.translate(mx(player.x), my(player.z));
    ctx.rotate(player.yaw);
    ctx.fillStyle = "#ff4f7b";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px sans-serif";
    ctx.fillText("С", S / 2 - 4, 16);
  }

  function updateHud(now) {
    const ground = Math.max(W.sampleHeight(player.x, player.z), W.WATER_Y);
    altStat.textContent = Math.round(player.y - ground) + " м";
    spdStat.textContent = Math.round(player.speed).toString();
    if (now > bannerUntil) banner.classList.remove("show");
    if (now > toastUntil) toastEl.classList.remove("show");
    if (mode === "play" && helpUntil && now > helpUntil) hintEl.style.opacity = "0";
    drawMap();
    if (audio) {
      let near = 0;
      for (let i = 0; i < falls.length; i++) {
        const d = Math.hypot(player.x - falls[i].x, player.z - falls[i].z);
        near = Math.max(near, clamp(1 - d / 180, 0, 1));
      }
      audio.wind(player.speed);
      audio.falls(near);
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!worldReady) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const time = now * 0.001;
    if (waterMat) {
      waterMat.uniforms.uTime.value = time;
      waterMat.uniforms.uCam.value.copy(camera.position);
      if (waterMat.userData.fallMat) waterMat.userData.fallMat.uniforms.uTime.value = time;
    }
    if (mode === "cinema") updateCinema(dt);
    else if (mode === "play") {
      const input = readInput();
      stepFlight(dt, input);
      dragX *= Math.exp(-7 * dt);
      dragY *= Math.exp(-7 * dt);
      updateBirdVisual(input.flap);
      updateCamera(dt, false);
      updateDiscovery();
      updateRings(dt, now);
    } else {
      updateBirdVisual(0);
      updateCamera(dt, false);
    }
    updateFields(time);
    updateFlock(time);
    updateClouds(time);
    if (mode !== "cinema") updateHud(now);
    else if (sky) sky.position.copy(camera.position);
    renderer.render(scene, camera);

    frameCounter++;
    qualityClock += dt;
    if (!qualityChecked && qualityClock > 2.4) {
      qualityChecked = true;
      const fps = frameCounter / qualityClock;
      if (fps < 30) {
        renderer.setPixelRatio(1);
        resize();
      }
    }
  }

  function fadeTo(play) {
    fadeEl.classList.add("on");
    setTimeout(function () {
      if (play) {
        resetPlayer();
        camPos.set(player.x, player.y + 6, player.z - 16);
        lookTarget.set(player.x, player.y, player.z + 10);
        mode = "play";
        document.body.classList.add("playing");
        document.body.classList.remove("paused");
        helpUntil = performance.now() + 16000;
        hintEl.style.opacity = "1";
        ensureAudio();
      }
      requestAnimationFrame(function () { fadeEl.classList.remove("on"); });
    }, 420);
  }

  function startGame() {
    if (!worldReady || mode === "play") return;
    fadeTo(true);
  }
  function pauseGame() {
    if (mode !== "play") return;
    mode = "pause";
    document.body.classList.add("paused");
  }
  function resumeGame() {
    if (mode !== "pause") return;
    mode = "play";
    document.body.classList.remove("paused");
    last = performance.now();
  }

  function ensureAudio() {
    if (audio) {
      audio.ctx.resume();
      audio.master.gain.value = muted ? 0 : 0.9;
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastN = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastN = lastN * 0.985 + white * 0.015;
      data[i] = lastN * 4;
    }
    const flapLen = Math.floor(ctx.sampleRate * 0.45);
    const flapNoise = ctx.createBuffer(1, flapLen, ctx.sampleRate);
    const flapData = flapNoise.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < flapLen; i++) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.96 + white * 0.04;
      flapData[i] = brown * 3.2;
    }
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 400;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();
    const fallSrc = ctx.createBufferSource();
    const fallBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const fd = fallBuf.getChannelData(0);
    for (let i = 0; i < len; i++) fd[i] = Math.random() * 2 - 1;
    fallSrc.buffer = fallBuf;
    fallSrc.loop = true;
    const fallFilter = ctx.createBiquadFilter();
    fallFilter.type = "bandpass";
    fallFilter.frequency.value = 900;
    fallFilter.Q.value = 0.7;
    const fallGain = ctx.createGain();
    fallGain.gain.value = 0;
    fallSrc.connect(fallFilter);
    fallFilter.connect(fallGain);
    fallGain.connect(master);
    fallSrc.start();

    function chirp() {
      const wait = 1.3 + Math.random() * 2.6;
      const t = ctx.currentTime + wait;
      const f0 = 2200 + Math.random() * 1600;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 1.4 - 0.7;
      pan.connect(master);
      const steps = 2 + Math.floor(Math.random() * 3);
      for (let n = 0; n < steps; n++) {
        const time = t + n * 0.11;
        const freq = f0 * (n % 2 ? 1.25 : 1) * (0.94 + Math.random() * 0.08);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, time);
        o.frequency.exponentialRampToValueAtTime(Math.max(180, freq * (0.82 + Math.random() * 0.22)), time + 0.09);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.045, time + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
        o.connect(g);
        g.connect(pan);
        o.start(time);
        o.stop(time + 0.12);
      }
      setTimeout(function () {
        try { pan.disconnect(); } catch (err) {}
      }, (wait + 0.8) * 1000);
      setTimeout(chirp, wait * 1000);
    }
    chirp();

    audio = {
      ctx: ctx,
      master: master,
      wind: function (speed) {
        windGain.gain.setTargetAtTime(clamp((speed - 22) / 160, 0, 0.045), ctx.currentTime, 0.25);
        windFilter.frequency.setTargetAtTime(320 + speed * 10, ctx.currentTime, 0.25);
      },
      falls: function (amt) {
        fallGain.gain.setTargetAtTime(amt * 0.08, ctx.currentTime, 0.25);
      },
      flap: function () {
        const t = ctx.currentTime;
        const dur = 0.2 + Math.random() * 0.035;
        const src = ctx.createBufferSource();
        src.buffer = flapNoise;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 0.9;
        const startF = 780 + Math.random() * 220;
        bp.frequency.setValueAtTime(startF, t);
        bp.frequency.exponentialRampToValueAtTime(190, t + dur);
        const whoosh = ctx.createGain();
        whoosh.gain.setValueAtTime(0.0001, t);
        whoosh.gain.exponentialRampToValueAtTime(0.32, t + 0.016);
        whoosh.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
        whoosh.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(bp);
        bp.connect(whoosh);
        whoosh.connect(master);
        src.onended = function () {
          src.disconnect();
          bp.disconnect();
          whoosh.disconnect();
        };
        src.start(t);
        src.stop(t + dur + 0.02);
        const body = ctx.createOscillator();
        body.type = "sine";
        body.frequency.setValueAtTime(128 + Math.random() * 22, t);
        body.frequency.exponentialRampToValueAtTime(52, t + 0.15);
        const bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(0.0001, t);
        bodyGain.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        body.connect(bodyGain);
        bodyGain.connect(master);
        body.onended = function () {
          body.disconnect();
          bodyGain.disconnect();
        };
        body.start(t);
        body.stop(t + 0.18);
      },
      chime: function (a, b) {
        [a, b].forEach(function (freq, i) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          const t0 = ctx.currentTime + i * 0.07;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
          o.connect(g); g.connect(master);
          o.start(t0);
          o.stop(t0 + 0.6);
        });
      },
    };
    paintSound();
  }

  function paintSound() {
    document.getElementById("btnSound").textContent = muted ? "✕" : "♪";
  }

  window.addEventListener("keydown", function (e) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) >= 0) e.preventDefault();
    keys.add(e.code);
    if (e.code === "Space" && mode !== "play" && mode !== "pause") startGame();
    if (e.code === "Escape") {
      if (mode === "play") pauseGame();
      else if (mode === "pause") resumeGame();
    }
    if (e.code === "KeyR" && mode === "play") {
      resetPlayer();
      toast("Снова над поляной");
    }
    if (e.code === "KeyM") toggleMute();
    if (e.code === "KeyH") {
      hintEl.style.opacity = hintEl.style.opacity === "0" ? "1" : "0";
    }
    if (e.code === "KeyC" && mode === "play") {
      camDist = camDist < 10 ? 13 : camDist < 16 ? 22 : 8;
    }
  });
  window.addEventListener("keyup", function (e) { keys.delete(e.code); });
  window.addEventListener("pointerdown", function (e) {
    if (onHud(e)) return;
    if (mode === "play" && e.pointerType !== "touch") flapHeld = true;
  });
  window.addEventListener("pointerup", function () { flapHeld = false; });
  window.addEventListener("pointermove", function (e) {
    if (mode !== "play" || onHud(e) || !(e.buttons & 1) || e.pointerType === "touch") return;
    dragX += e.movementX || 0;
    dragY += e.movementY || 0;
  });
  window.addEventListener("wheel", function (e) {
    if (mode !== "play") return;
    camDist = clamp(camDist + e.deltaY * 0.01, 6, 28);
  }, { passive: true });
  window.addEventListener("touchstart", function () {
    document.documentElement.classList.add("touch");
  }, { passive: true });

  const stick = document.getElementById("stick");
  const knob = document.getElementById("knob");
  function joyFrom(e) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const max = rect.width * 0.36;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(max, len);
    const nx = dx / len * k;
    const ny = dy / len * k;
    knob.style.transform = "translate(calc(-50% + " + nx + "px), calc(-50% + " + ny + "px))";
    joy.x = clamp(nx / max, -1, 1);
    joy.y = clamp(-ny / max, -1, 1);
    joy.active = true;
  }
  stick.addEventListener("pointerdown", function (e) {
    stick.setPointerCapture(e.pointerId);
    joyFrom(e);
    e.preventDefault();
  });
  stick.addEventListener("pointermove", function (e) {
    if (joy.active) joyFrom(e);
  });
  function joyEnd() {
    joy.active = false;
    joy.x = 0;
    joy.y = 0;
    knob.style.transform = "translate(-50%, -50%)";
  }
  stick.addEventListener("pointerup", joyEnd);
  stick.addEventListener("pointercancel", joyEnd);
  const flapBtn = document.getElementById("flapBtn");
  flapBtn.addEventListener("pointerdown", function (e) {
    joy.flap = true;
    flapHeld = true;
    e.preventDefault();
  });
  window.addEventListener("pointerup", function () { joy.flap = false; });

  document.getElementById("startBtn").disabled = true;
  document.getElementById("startBtn").addEventListener("click", startGame);
  document.getElementById("resumeBtn").addEventListener("click", resumeGame);
  document.getElementById("btnPause").addEventListener("click", function () {
    if (mode === "play") pauseGame();
    else if (mode === "pause") resumeGame();
  });
  document.getElementById("btnHelp").addEventListener("click", function () {
    hintEl.style.opacity = hintEl.style.opacity === "0" ? "1" : "0";
    helpUntil = 0;
  });
  function toggleMute() {
    muted = !muted;
    localStorage.setItem("iskra-mute", muted ? "1" : "0");
    if (audio) audio.master.gain.value = muted ? 0 : 0.9;
    paintSound();
  }
  document.getElementById("btnSound").addEventListener("click", function () {
    ensureAudio();
    toggleMute();
    if (!muted && audio) audio.ctx.resume();
  });
  document.getElementById("fsBtn").addEventListener("click", function () {
    if (!document.fullscreenElement) {
      const req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
      if (req) req.call(document.documentElement);
    } else if (document.exitFullscreen) document.exitFullscreen();
  });
  paintSound();

  window.__iskra = {
    player: player,
    get mode() { return mode; },
    places: function () { return places; },
    rings: function () { return rings; },
    snap: function (pose) {
      player.x = pose.x;
      player.y = pose.y;
      player.z = pose.z;
      if (pose.yaw != null) player.yaw = pose.yaw;
      if (pose.pitch != null) player.pitch = pose.pitch;
      const dist = pose.dist || camDist;
      const fx = Math.sin(player.yaw);
      const fz = Math.cos(player.yaw);
      camPos.set(player.x - fx * dist, player.y + (pose.height || 5), player.z - fz * dist);
      lookTarget.set(player.x + fx * 18, player.y + (pose.lookY || 2), player.z + fz * 18);
      camera.position.copy(camPos);
      camera.lookAt(lookTarget);
      if (sky) sky.position.copy(camera.position);
    },
  };

  if (!window.SkyWorld || !window.THREE) {
    setStatus("Не найден движок сцены.");
  } else {
    boot();
  }
})();
