import * as THREE from "https://unpkg.com/three@0.170.0/build/three.module.js";
import {
  EYE,
  L,
  inBeam,
  onDeck,
  onGangway,
  pushOut,
  supportAt,
  zoneOf,
} from "./layout.js";
import { createFeeds, createWorld } from "./world.js";

const canvas = document.querySelector("#scene");
const boot = document.querySelector("#boot");
const hintEl = document.querySelector(".hint");
const tagline = document.querySelector(".tagline");
const lockHint = document.querySelector("#lock-hint");
const mobile = document.querySelector("#mobile-ui");
const joyZone = document.querySelector("#joy-zone");
const joyBase = document.querySelector("#joy-base");
const joyKnob = document.querySelector("#joy-knob");
const lookZone = document.querySelector("#look-zone");
const btnJump = document.querySelector("#btn-jump");
const btnSprint = document.querySelector("#btn-sprint");
const pinchRing = document.querySelector("#pinch-ring");
const pinchHint = document.querySelector("#pinch-hint");
const flash = document.querySelector("#teleport-flash");

const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
if (touch) {
  document.body.classList.add("touch-device");
  mobile.hidden = false;
}

const params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touch ? 1.25 : 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);
const feeds = createFeeds();
const world = createWorld(scene, feeds);

const boat = {
  x: L.boat.x,
  z: params.has("ashore") ? L.boat.z1 : L.boat.z0,
  deckY: L.pier.y,
  phase: params.has("ashore") ? "ashore" : "sailing",
  berthed: params.has("ashore"),
};

const keys = {};
const joy = { x: 0, z: 0 };
let sprintHeld = false;
let yaw = 0;
let pitch = -0.04;
let feetY = L.pier.y;
let vx = 0;
let vz = 0;
let vy = 0;
let grounded = true;
let wantJump = false;
let looking = false;
let camOn = true;
let watch = null;
let lift = 0;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const clock = new THREE.Clock();

function place(x, y, z, nextYaw = yaw) {
  const fixed = pushOut(x, y, z, boat);
  feetY = y;
  camera.position.set(fixed.x, feetY + EYE, fixed.z);
  yaw = nextYaw;
  pitch = -0.04;
  vy = 0;
  vx = 0;
  vz = 0;
  grounded = true;
  applyLook();
}

if (params.get("at") === "bunker") place(36, 0.1, 0, Math.PI / 2);
else if (params.get("at") === "room") place(70, L.bunker.room.y, 0, -Math.PI / 2);
else if (params.get("at") === "roof") place(0, L.roofY, 4, 0);
else if (params.get("at") === "door") place(0, 0.04, 20, Math.PI);
else place(boat.x, boat.deckY, boat.z - 1.2, 0);

function applyLook() {
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
}

function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  camera.fov = w / h > 1.4 ? 58 : 64;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
resize();
addEventListener("resize", resize);

const HINTS = {
  sail: "<b>WASD</b> по палубе · мышь · <b>Пробел</b> — причалить быстрее",
  boat: "Причалили. Сойдите по трапу <b>налево</b> на пирс",
  island: "<b>WASD</b> · мышь · двойной клик — телепорт · крыша слева · бункер справа",
  villa: "Экраны на северной стене · лестница слева поднимает на антресоль",
  roof: "Бассейн и бар · встаньте в голубой луч",
  bunker: "Широкий съезд вниз · экраны на дальней стене",
  ufo: "Вы на борту. Отойдите к краю платформы, чтобы спуститься",
};

function setLockCopy() {
  const sail = boat.phase === "sailing";
  lockHint.innerHTML = sail
    ? `Кликните, чтобы выйти в море<span>вы на палубе · остров впереди · Пробел ускоряет</span>`
    : `Кликните, чтобы войти<span>WASD · мышь · двойной клик — телепорт</span>`;
}
setLockCopy();

function showHint(zone) {
  if (hintEl) hintEl.innerHTML = HINTS[zone] || HINTS.island;
  if (tagline) {
    tagline.textContent =
      zone === "sail" ? "идём к острову" : zone === "bunker" ? "бункер · экраны связи" : "вилла · крыша · бункер";
  }
}

function engage() {
  if (touch) {
    looking = true;
    lockHint.classList.add("hide");
    document.body.classList.add("looking");
    return;
  }
  canvas.requestPointerLock?.();
}

document.addEventListener("pointerlockchange", () => {
  looking = document.pointerLockElement === canvas;
  lockHint.classList.toggle("hide", looking);
  document.body.classList.toggle("looking", looking);
});

canvas.addEventListener("click", (event) => {
  if (!looking) {
    engage();
    return;
  }
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = raycaster.intersectObjects(world.screens, false)[0];
  if (hit) watch = hit.object;
  else watch = null;
});

addEventListener("mousemove", (event) => {
  if (!looking || touch) return;
  yaw -= (event.movementX || 0) * 0.0022;
  pitch -= (event.movementY || 0) * 0.0022;
  pitch = Math.max(-1.25, Math.min(1.25, pitch));
  watch = null;
});

addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  if (event.code === "Space") wantJump = true;
  if (event.code.startsWith("Key") || event.code.startsWith("Arrow")) watch = null;
});
addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

lockHint.addEventListener("click", (event) => {
  event.preventDefault();
  engage();
});

function bindHold(el, down) {
  if (!el) return;
  el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!looking) engage();
    down(true);
    el.classList.add("held");
  });
  const up = () => {
    down(false);
    el.classList.remove("held");
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}
bindHold(btnJump, () => {
  wantJump = true;
});
bindHold(btnSprint, (on) => {
  sprintHeld = on;
});

let joyId = null;
joyZone?.addEventListener("pointerdown", (event) => {
  if (!looking) engage();
  joyId = event.pointerId;
  joyZone.setPointerCapture(event.pointerId);
  moveJoy(event);
});
joyZone?.addEventListener("pointermove", (event) => {
  if (event.pointerId === joyId) moveJoy(event);
});
function moveJoy(event) {
  const rect = (joyBase || joyZone).getBoundingClientRect();
  let x = event.clientX - (rect.left + rect.width / 2);
  let z = event.clientY - (rect.top + rect.height / 2);
  const len = Math.hypot(x, z) || 1;
  const mag = Math.min(len, 46);
  x = (x / len) * mag;
  z = (z / len) * mag;
  joy.x = x / 46;
  joy.z = z / 46;
  if (joyKnob) joyKnob.style.transform = `translate(${x}px, ${z}px)`;
  watch = null;
}
function endJoy(event) {
  if (event.pointerId !== joyId) return;
  joyId = null;
  joy.x = 0;
  joy.z = 0;
  if (joyKnob) joyKnob.style.transform = "translate(0px, 0px)";
}
joyZone?.addEventListener("pointerup", endJoy);
joyZone?.addEventListener("pointercancel", endJoy);

let lookId = null;
let lastX = 0;
let lastY = 0;
let tapAt = 0;
let tapX = 0;
let tapY = 0;
lookZone?.addEventListener("pointerdown", (event) => {
  if (!looking) engage();
  lookId = event.pointerId;
  lastX = event.clientX;
  lastY = event.clientY;
  lookZone.setPointerCapture(event.pointerId);
});
lookZone?.addEventListener("pointermove", (event) => {
  if (event.pointerId !== lookId) return;
  yaw -= (event.clientX - lastX) * 0.005;
  pitch -= (event.clientY - lastY) * 0.005;
  pitch = Math.max(-1.25, Math.min(1.25, pitch));
  lastX = event.clientX;
  lastY = event.clientY;
  watch = null;
});
lookZone?.addEventListener("pointerup", (event) => {
  if (event.pointerId !== lookId) return;
  lookId = null;
  const now = performance.now();
  if (now - tapAt < 320 && Math.hypot(event.clientX - tapX, event.clientY - tapY) < 40) teleport(event.clientX, event.clientY);
  tapAt = now;
  tapX = event.clientX;
  tapY = event.clientY;
});

let lastClick = 0;
canvas.addEventListener("mousedown", (event) => {
  if (!looking || event.button !== 0 || touch) return;
  const now = performance.now();
  if (now - lastClick < 320) {
    const rect = canvas.getBoundingClientRect();
    teleport(rect.left + rect.width / 2, rect.top + rect.height * 0.52);
    lastClick = 0;
  } else lastClick = now;
});

function samplePoint(origin, dir) {
  let best = null;
  for (let t = 2; t < 80; t += 0.8) {
    const x = origin.x + dir.x * t;
    const z = origin.z + dir.z * t;
    const y = origin.y + dir.y * t - EYE;
    const s = supportAt(x, z, y, boat);
    if (s === null) continue;
    if (Math.abs(s - y) < 1.2 && (!best || t < best.t)) best = { x, y: s, z, t };
  }
  return best;
}

function teleport(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hit = samplePoint(raycaster.ray.origin, raycaster.ray.direction);
  if (pinchRing) {
    pinchRing.style.left = `${clientX}px`;
    pinchRing.style.top = `${clientY}px`;
    pinchRing.classList.add("on");
    setTimeout(() => pinchRing.classList.remove("on"), 240);
  }
  if (!hit) {
    if (pinchHint) {
      pinchHint.textContent = "нет точки";
      pinchHint.classList.add("on");
      setTimeout(() => pinchHint.classList.remove("on"), 600);
    }
    return;
  }
  place(hit.x, hit.y, hit.z);
  if (flash) {
    flash.classList.remove("on");
    void flash.offsetWidth;
    flash.classList.add("on");
  }
}

document.querySelector("#btn-mute")?.addEventListener("click", (event) => {
  const on = event.currentTarget.classList.toggle("on");
  event.currentTarget.textContent = on ? "Без звука" : "Микрофон";
});
document.querySelector("#btn-cam")?.addEventListener("click", (event) => {
  camOn = !camOn;
  event.currentTarget.classList.toggle("on", camOn);
  feeds[3].draw(0, camOn);
});
document.querySelector("#btn-leave")?.addEventListener("click", () => {
  document.exitPointerLock?.();
  document.body.innerHTML = `<div style="min-height:100dvh;display:grid;place-items:center;background:#1a222b;color:#eef3f8;font-family:Manrope,sans-serif;text-align:center"><div><p style="font-family:Syne,sans-serif;font-size:2.4rem;font-weight:800">Bali Loft</p><p style="opacity:.7">Звонок завершён</p></div></div>`;
});

const forward = new THREE.Vector3();
const right = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  const beforeZ = boat.z;
  if (boat.phase === "sailing") {
    const fast = keys.Space || wantJump;
    boat.z -= dt * (fast ? 26 : 8);
    if (boat.z <= L.boat.z1) {
      boat.z = L.boat.z1;
      boat.phase = "berthed";
      boat.berthed = true;
      setLockCopy();
    }
    boat.deckY = L.pier.y + Math.sin(time * 1.35) * 0.12;
  } else {
    boat.deckY += (L.pier.y - boat.deckY) * Math.min(1, dt * 3);
    boat.berthed = true;
  }
  wantJump = boat.phase === "sailing" ? false : wantJump;

  const riding = onDeck(camera.position.x, camera.position.z - (boat.z - beforeZ), boat) || boat.phase === "sailing";
  if (riding) camera.position.z += boat.z - beforeZ;

  if (lift > 0) {
    lift -= dt;
    feetY += dt * 10;
    camera.position.y = feetY + EYE;
    camera.position.x += (L.ufo.x - camera.position.x) * Math.min(1, dt * 2);
    camera.position.z += (L.ufo.z - camera.position.z) * Math.min(1, dt * 2);
    if (lift <= 0) place(L.ufo.x, L.ufo.floor, L.ufo.z + 1.2);
    world.update(time, boat);
    renderer.render(scene, camera);
    return;
  }

  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.z;
  const moving = Math.hypot(ix, iz) > 0.08;
  if (moving) {
    const len = Math.hypot(ix, iz);
    ix /= len;
    iz /= len;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const speed = (keys.ShiftLeft || keys.ShiftRight || sprintHeld ? 9.4 : 6.1) * (onShip && boat.phase === "sailing" ? 0.85 : 1);
    const tx = (forward.x * -iz + right.x * ix) * speed;
    const tz = (forward.z * -iz + right.z * ix) * speed;
    const k = 1 - Math.exp(-14 * dt);
    vx += (tx - vx) * k;
    vz += (tz - vz) * k;
  } else {
    const k = 1 - Math.exp(-18 * dt);
    vx += (0 - vx) * k;
    vz += (0 - vz) * k;
  }

  camera.position.x += vx * dt;
  camera.position.z += vz * dt;
  const pushed = pushOut(camera.position.x, feetY, camera.position.z, boat);
  camera.position.x = pushed.x;
  camera.position.z = pushed.z;
  if (boat.phase === "sailing") {
    camera.position.x = Math.max(boat.x - L.boat.halfX + 0.45, Math.min(boat.x + L.boat.halfX - 0.45, camera.position.x));
    camera.position.z = Math.max(boat.z + L.boat.bow + 0.45, Math.min(boat.z + L.boat.stern - 0.45, camera.position.z));
  }

  if (wantJump && grounded && boat.phase !== "sailing") {
    vy = 6.4;
    grounded = false;
    wantJump = false;
  } else wantJump = false;

  const support = supportAt(camera.position.x, camera.position.z, feetY, boat);
  if (grounded) {
    if (support === null || support < feetY - 0.72) {
      grounded = false;
      vy = 0;
    } else feetY = support;
  }
  if (!grounded) {
    vy -= 24 * dt;
    feetY += vy * dt;
    if (support !== null && feetY <= support) {
      feetY = support;
      vy = 0;
      grounded = true;
    }
  }
  camera.position.y = feetY + EYE;

  const zone = zoneOf(camera.position.x, feetY, camera.position.z, boat);
  if (boat.phase === "berthed" && zone !== "boat" && zone !== "sail") boat.phase = "ashore";
  showHint(boat.phase === "sailing" ? "sail" : zone);

  if (zone === "roof" && inBeam(camera.position.x, camera.position.z, feetY)) {
    lift = 2.1;
    watch = null;
  }
  if (zone === "ufo" && Math.hypot(camera.position.x - L.ufo.x, camera.position.z - L.ufo.z) > L.ufo.radius - 0.45) {
    place(L.beam.x, L.roofY, L.beam.z);
  }

  if (watch && !moving && grounded) {
    const target = new THREE.Vector3();
    watch.getWorldPosition(target);
    const look = new THREE.Matrix4().lookAt(camera.position, target, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(look);
    camera.quaternion.slerp(q, 1 - Math.exp(-4 * dt));
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw = e.y;
    pitch = e.x;
  } else applyLook();

  if (Math.floor(time * 8) !== Math.floor((time - dt) * 8)) {
    feeds.forEach((feed, i) => {
      if (i === 3 && !camOn) return;
      feed.draw(time, true);
    });
  }

  world.update(time, boat);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(tick);
boot?.classList.add("hide");
if (!looking) lockHint.classList.remove("hide");

window.__bali = {
  boat,
  get: () => ({ x: camera.position.x, y: feetY, z: camera.position.z, zone: zoneOf(camera.position.x, feetY, camera.position.z, boat), phase: boat.phase }),
  place,
};
