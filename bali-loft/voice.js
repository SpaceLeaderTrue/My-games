// Shared island presence and voice.
// Positions travel even before the microphone is allowed, so people can see
// each other. Audio uses a plain <audio> element (phones stay silent if the
// remote track is played only through Web Audio).

const TOPIC = "si3d/loft/v2";
const BROKERS = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt",
  "wss://mqtt.tyckr.io:8081",
  "wss://broker.laboverwire.com:8443/mqtt",
];
const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"], username: "peerjs", credential: "peerjsp" },
  { urls: "turn:global.relay.metered.ca:80", username: "e8dd65c92f6c8e23928f4b15", credential: "K2aD1H3q0v5c8s1e" },
  { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "e8dd65c92f6c8e23928f4b15", credential: "K2aD1H3q0v5c8s1e" },
  { urls: "turn:global.relay.metered.ca:443", username: "e8dd65c92f6c8e23928f4b15", credential: "K2aD1H3q0v5c8s1e" },
  { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "e8dd65c92f6c8e23928f4b15", credential: "K2aD1H3q0v5c8s1e" },
];
const NAMES = ["Алекс", "Мира", "Ника", "Лео", "Соня", "Марк", "Кира", "Тима", "Яна", "Глеб", "Нина", "Олег"];
const COLORS = ["#3d8fd4", "#d45b3d", "#3daf6e", "#d4a03d", "#8a5ad4", "#d43d7a"];
function deviceOri() {
  const phone = ("ontouchstart" in window) || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  if (!phone) return "l";
  const vv = window.visualViewport;
  const w = vv && vv.width ? vv.width : window.innerWidth;
  const h = vv && vv.height ? vv.height : window.innerHeight;
  return h > w ? "p" : "l";
}
function camVideoConstraints() {
  const phone = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  if (!phone) return { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } };
  if (deviceOri() === "p") return { facingMode: "user", width: { ideal: 360, max: 480 }, height: { ideal: 480, max: 640 }, frameRate: { ideal: 15, max: 20 }, aspectRatio: { ideal: 0.75 } };
  return { facingMode: "user", width: { ideal: 480, max: 640 }, height: { ideal: 360, max: 480 }, frameRate: { ideal: 15, max: 20 }, aspectRatio: { ideal: 1.333 } };
}
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const enc = new TextEncoder();
const dec = new TextDecoder();
const btn = () => document.getElementById("btn-mute");
const statusEl = () => document.querySelector(".status");

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rid() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  let s = "p";
  for (const b of a) s += b.toString(16).padStart(2, "0");
  return s;
}

const myId = rid();
const myColor = COLORS[hash(myId) % COLORS.length];
const NAME_KEY = "si3d-name";

function cleanName(raw) {
  return String(raw || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
}
function fallbackName() {
  return NAMES[hash(myId) % NAMES.length];
}
let myName = fallbackName();
try {
  const saved = cleanName(localStorage.getItem(NAME_KEY));
  if (saved) myName = saved;
} catch {}

let phase = "off";
let videoPhase = "off";
let localStream = null;
let camStream = null;
let localVid = null;
window.__camFeeds = [];
window.__localCam = null;
let mqttOk = false;
let broker = "";
let lastErr = "";
let ws = null;
const links = new Map();
const remotes = {};
const pendingIce = new Map();
const sockets = new Map();
const roomStarted = Date.now();
window.__remotes = remotes;

function anyOk() {
  for (const s of sockets.values()) {
    if (s.ok && s.ws && s.ws.readyState === WebSocket.OPEN) return true;
  }
  return false;
}
function linkDown() {
  return !anyOk() && Date.now() - roomStarted > 4000;
}
function rememberBrokers() {
  const up = [];
  for (const s of sockets.values()) if (s.ok) up.push(s.url);
  broker = up.join(" | ");
  mqttOk = up.length > 0;
}

function micTrack() {
  return localStream ? localStream.getAudioTracks()[0] || null : null;
}
function camTrack() {
  return camStream ? camStream.getVideoTracks()[0] || null : null;
}
function remoteCount() {
  return Object.keys(remotes).length;
}
function heardCount() {
  let n = 0;
  for (const L of links.values()) {
    if (L.audio && (L.pc.connectionState === "connected" || L.pc.iceConnectionState === "connected" || L.pc.iceConnectionState === "completed")) n++;
  }
  return n;
}

function label() {
  const n = heardCount();
  const near = remoteCount();
  if (linkDown()) return near ? `Нет связи · ${near}` : "Нет связи";
  if (phase === "joining") return "Подключаем…";
  if (phase === "denied") return "Нет доступа";
  if (phase === "muted") return "Микрофон выкл";
  if (phase === "live") return n ? `Вас слышно · ${n}` : near ? "Ждём звук…" : "Ждём других";
  return near ? `Микрофон · ${near}` : "Микрофон";
}

function paint() {
  const b = btn();
  if (b) {
    b.textContent = label();
    b.classList.toggle("on", phase === "live");
    b.setAttribute("aria-pressed", phase === "live" || phase === "muted" ? "true" : "false");
  }
  const status = statusEl();
  if (!status) return;
  const dot = status.querySelector(".dot");
  const heard = heardCount();
  const near = remoteCount();
  const text = linkDown()
    ? "нет связи с островом"
    : phase === "live" || phase === "muted"
      ? heard
        ? `в эфире · слышно ${heard}`
        : near
          ? `в эфире · на острове ${near}`
          : "в эфире · микрофон включён"
      : near
        ? `в эфире · на острове ${near}`
        : "в эфире · 4 экрана";
  status.replaceChildren();
  if (dot) status.appendChild(dot);
  status.append(` ${text}`);
}

function encLen(n) {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 128;
    out.push(b);
  } while (n > 0);
  return out;
}
function packet(type, body) {
  const rl = encLen(body.length);
  const out = new Uint8Array(1 + rl.length + body.length);
  out[0] = type;
  out.set(rl, 1);
  out.set(body, 1 + rl.length);
  return out;
}
function u16push(arr, n) {
  arr.push((n >> 8) & 255, n & 255);
}
function bytesPush(arr, bytes) {
  u16push(arr, bytes.length);
  for (const x of bytes) arr.push(x);
}
function mqttConnect(clientId) {
  const body = [];
  bytesPush(body, enc.encode("MQTT"));
  body.push(4, 2);
  u16push(body, 30);
  bytesPush(body, enc.encode(clientId));
  return packet(0x10, new Uint8Array(body));
}
function mqttSub(topic) {
  const body = [0, 1];
  bytesPush(body, enc.encode(topic));
  body.push(0);
  return packet(0x82, new Uint8Array(body));
}
function mqttPub(topic, text) {
  const body = [];
  bytesPush(body, enc.encode(topic));
  for (const x of enc.encode(text)) body.push(x);
  return packet(0x30, new Uint8Array(body));
}
function readRL(buf, offset) {
  let value = 0;
  let mul = 1;
  let size = 0;
  for (;;) {
    if (offset + size >= buf.length) return null;
    const b = buf[offset + size];
    size++;
    value += (b & 127) * mul;
    mul *= 128;
    if (mul > 128 * 128 * 128 * 128) return null;
    if ((b & 128) === 0) return { value, size };
  }
}

let msgSeq = 0;
const seenMid = new Map();
function send(obj) {
  if (!obj.mid) obj.mid = myId + "-" + (++msgSeq);
  const pkt = mqttPub(TOPIC, JSON.stringify(obj));
  let n = 0;
  for (const s of sockets.values()) {
    if (!s.ok || !s.ws || s.ws.readyState !== WebSocket.OPEN) continue;
    try { s.ws.send(pkt); n++; } catch {}
  }
  mqttOk = n > 0;
}

function cloneTrack(track) {
  if (!track) return null;
  try {
    const copy = track.clone();
    copy.enabled = track.enabled;
    return copy;
  } catch {
    return track;
  }
}
function stopClone(track, original) {
  if (!track || track === original) return;
  if (track._stopDraw) track._stopDraw();
  try { track.stop(); } catch {}
}
function faceSpot(v) {
  const now = performance.now(), box = v._face;
  if (box && now - box.t < 480) return box;
  let x = 0.5, y = 0.4, w = 0.72, h = 0.8, found = false;
  try {
    const vw = v.videoWidth || v.naturalWidth || v.width, vh = v.videoHeight || v.naturalHeight || v.height;
    let W, H;
    if (vw >= vh) { W = 64; H = Math.max(18, Math.round(64 * vh / vw)); }
    else { H = 64; W = Math.max(18, Math.round(64 * vw / vh)); }
    const c = faceSpot.c || (faceSpot.c = document.createElement("canvas"));
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(v, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data, skin = new Uint8Array(W * H);
    for (let p = 0, i = 0; p < skin.length; p++, i += 4) {
      const r = d[i], gc = d[i + 1], b = d[i + 2];
      const cb = 128 - 0.169 * r - 0.331 * gc + 0.5 * b, cr = 128 + 0.5 * r - 0.419 * gc - 0.081 * b;
      if (cr > 138 && cr < 190 && cb > 70 && cb < 128 && cr - cb > 32 && r > 65 && r - gc > 18 && r - b > 25) skin[p] = 1;
    }
    const stride = W + 1, I = new Int32Array(stride * (H + 1));
    for (let y0 = 0; y0 < H; y0++) {
      let row = 0;
      for (let x0 = 0; x0 < W; x0++) {
        row += skin[y0 * W + x0];
        I[(y0 + 1) * stride + x0 + 1] = I[y0 * stride + x0 + 1] + row;
      }
    }
    const area = (x0, y0, fw, fh) => I[(y0 + fh) * stride + x0 + fw] - I[y0 * stride + x0 + fw] - I[(y0 + fh) * stride + x0] + I[y0 * stride + x0];
    const fracs = [0.12, 0.2, 0.28, 0.38, 0.5, 0.66];
    let pick = null, densest = null;
    for (let fi = 0; fi < fracs.length; fi++) {
      const f = fracs[fi];
      let fw = Math.round(W * f), fh = Math.round(H * Math.min(0.95, f * 1.2));
      if (fw < 6) fw = 6;
      if (fh < 6) fh = 6;
      if (fw > W) fw = W;
      if (fh > H) fh = H;
      let best = 0, bx = 0, by = 0;
      for (let y0 = 0; y0 + fh <= H; y0 += 2) for (let x0 = 0; x0 + fw <= W; x0 += 2) {
        const dens = area(x0, y0, fw, fh) / (fw * fh);
        if (dens > best) best = dens, bx = x0, by = y0;
      }
      if (!densest || best > densest.best) densest = { fw, fh, best, bx, by };
      if (best >= 0.72) pick = { fw, fh, best, bx, by };
    }
    if (!pick && densest && densest.best >= 0.4) pick = densest;
    if (pick) {
      const x0 = pick.bx, y0 = pick.by, fw = pick.fw, fh = pick.fh;
      let c0 = fw, c1 = -1, r0 = fh, r1 = -1;
      for (let yy = 0; yy < fh; yy++) {
        let rowN = 0;
        for (let xx = 0; xx < fw; xx++) if (skin[(y0 + yy) * W + x0 + xx]) rowN++;
        if (rowN / fw > 0.28) { if (yy < r0) r0 = yy; if (yy > r1) r1 = yy; }
      }
      for (let xx = 0; xx < fw; xx++) {
        let colN = 0;
        for (let yy = 0; yy < fh; yy++) if (skin[(y0 + yy) * W + x0 + xx]) colN++;
        if (colN / fh > 0.25) { if (xx < c0) c0 = xx; if (xx > c1) c1 = xx; }
      }
      if (r1 > r0 + 1 && c1 > c0 + 1) {
        x = (x0 + (c0 + c1) / 2) / W;
        y = (y0 + (r0 + r1) / 2) / H;
        w = Math.min(0.92, Math.max(0.16, (c1 - c0 + 1) / W * 1.45));
        h = Math.min(0.96, Math.max(0.22, (r1 - r0 + 1) / H * 1.4));
        if (fw / W > 0.48 || fh / H > 0.48) w = Math.max(w, 0.62), h = Math.max(h, 0.7);
        found = true;
      }
    }
  } catch (e) {}
  if (!found) {
    if (box && box.ok && now - box.t < 1600) return box;
    x = 0.5; y = 0.4; w = 0.72; h = 0.8;
  } else if (box) {
    if (Math.abs(x - box.x) < 0.015) x = box.x;
    if (Math.abs(y - box.y) < 0.015) y = box.y;
    if (Math.abs(w - box.w) < 0.025) w = box.w;
    if (Math.abs(h - box.h) < 0.025) h = box.h;
  }
  return v._face = { x, y, w, h, t: now, ok: found };
}
function faceGlide(v, target) {
  const now = performance.now();
  let view = v._view;
  if (!view) return v._view = { x: target.x, y: target.y, w: target.w, h: target.h, t: now };
  const dt = Math.min(0.08, Math.max(0, (now - view.t) / 1000));
  const k = 1 - Math.exp(-dt / 0.55), kz = 1 - Math.exp(-dt / 0.85);
  view.x += (target.x - view.x) * k;
  view.y += (target.y - view.y) * k;
  view.w += (target.w - view.w) * kz;
  view.h += (target.h - view.h) * kz;
  view.t = now;
  return view;
}
function facePlace(v, cw, ch) {
  const vw = v.videoWidth || v.naturalWidth || v.width, vh = v.videoHeight || v.naturalHeight || v.height, f = faceGlide(v, faceSpot(v));
  const cover = Math.max(cw / vw, ch / vh);
  const faceH = Math.max(8, f.h * vh);
  const headTop = f.y * vh - faceH * 0.55;
  const chin = f.y * vh + faceH * 0.46;
  const eyes = f.y * vh - faceH * 0.16;
  let zoom = cover;
  if (ch <= cw) {
    zoom = Math.max(cover, (ch * 0.8) / (faceH * 1.15));
    if (zoom > cover * 3.2) zoom = cover * 3.2;
  }
  let sw = cw / zoom, sh = ch / zoom;
  if (sw > vw || sh > vh) {
    const fit = Math.min(vw / sw, vh / sh);
    sw *= fit; sh *= fit;
  }
  let sx = f.x * vw - sw * 0.5, sy = headTop - sh * 0.06;
  if (chin > sy + sh * 0.72) sy = chin - sh * 0.72;
  if (eyes < sy + sh * 0.1) sy = eyes - sh * 0.14;
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx > vw - sw) sx = Math.max(0, vw - sw);
  if (sy > vh - sh) sy = Math.max(0, vh - sh);
  return { sx, sy, sw, sh };
}
async function forkVideo(track) {
  const vid = localVid;
  if (!track || !vid) return cloneTrack(track);
  let canvas;
  try { canvas = document.createElement("canvas"); } catch { return cloneTrack(track); }
  if (!canvas.captureStream) return cloneTrack(track);
  if (vid.readyState < 2 || !vid.videoWidth) {
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      vid.addEventListener("loadeddata", finish, { once: true });
      vid.addEventListener("resize", finish, { once: true });
      setTimeout(finish, 800);
    });
  }
  const fitFork = () => {
    const tall = deviceOri() === "p";
    const ww = tall ? 240 : 480, hh = tall ? 480 : 240;
    if (canvas.width !== ww || canvas.height !== hh) {
      canvas.width = ww;
      canvas.height = hh;
    }
  };
  fitFork();
  const ctx = canvas.getContext("2d", { alpha: false });
  const draw = () => {
    const src = localVid;
    if (!src || src.readyState < 2 || !src.videoWidth || videoPhase !== "live") return;
    fitFork();
    const fp = facePlace(src, canvas.width, canvas.height);
    ctx.fillStyle = "#0c1218";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    try { ctx.drawImage(src, fp.sx, fp.sy, fp.sw, fp.sh, 0, 0, canvas.width, canvas.height); } catch {}
    ctx.restore();
  };
  draw();
  let out = null;
  try { out = canvas.captureStream(15).getVideoTracks()[0] || null; } catch { out = null; }
  if (!out) return cloneTrack(track);
  try { out.contentHint = "motion"; } catch {}
  const timer = setInterval(draw, 66);
  out._stopDraw = () => clearInterval(timer);
  return out;
}
function linkUp(L) {
  if (!L) return false;
  const pc = L.pc;
  return pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed";
}
async function armSender(L, kind, track) {
  const tr = kind === "audio" ? audioTr(L.pc) : videoTr(L.pc);
  if (!tr || !tr.sender) return;
  const key = kind === "audio" ? "micClone" : "camClone";
  const prev = L[key];
  const next = !track ? null : kind === "video" ? await forkVideo(track) : cloneTrack(track);
  L[key] = next;
  if (prev && prev !== next) stopClone(prev, track);
  try {
    await tr.sender.replaceTrack(next);
    if (kind === "video" && next && tr.sender.getParameters) {
      const params = tr.sender.getParameters();
      if (!params.encodings || !params.encodings.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 1200000;
      params.encodings[0].maxFramerate = 24;
      await tr.sender.setParameters(params);
    }
  } catch {}
}
function closeLink(id) {
  const L = links.get(id);
  if (!L) return;
  links.delete(id);
  stopClone(L.micClone, micTrack());
  stopClone(L.camClone, camTrack());
  try { L.pc.ontrack = null; L.pc.onicecandidate = null; L.pc.close(); } catch {}
  if (L.audio) {
    try { L.audio.pause(); L.audio.srcObject = null; L.audio.remove(); } catch {}
  }
  if (L.video) {
    try { L.video.pause(); L.video.srcObject = null; L.video.remove(); } catch {}
  }
  publishFeeds();
}

function dropPeer(id) {
  if (!remotes[id] && !links.has(id)) return;
  delete remotes[id];
  closeLink(id);
  paint();
}

function kickAudio() {
  for (const L of links.values()) {
    if (L.audio) {
      const p = L.audio.play();
      if (p && p.catch) p.catch(() => {});
    }
    if (L.video && L.video.paused) {
      const p = L.video.play();
      if (p && p.catch) p.catch(() => {});
    }
  }
  if (localVid && videoPhase === "live" && localVid.paused) {
    const p = localVid.play();
    if (p && p.catch) p.catch(() => {});
  }
}

function attachAudio(id, stream) {
  let L = links.get(id);
  if (!L) return;
  if (!L.audio) {
    const el = document.createElement("audio");
    el.autoplay = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.style.cssText = "position:absolute;left:0;top:0;width:8px;height:8px;opacity:0.02;pointer-events:none";
    document.body.appendChild(el);
    L.audio = el;
  }
  if (L.audio.srcObject !== stream) L.audio.srcObject = stream;
  L.audio.volume = volumeFor(id);
  const p = L.audio.play();
  if (p && p.catch) p.catch(() => {});
}

function volumeFor(id) {
  const mine = window.__pos;
  const theirs = remotes[id];
  if (!mine || !theirs || !Number.isFinite(mine.x) || !Number.isFinite(theirs.x)) return 1;
  const d = Math.hypot(mine.x - theirs.x, (mine.z || 0) - (theirs.z || 0));
  if (!Number.isFinite(d) || d < 40) return 1;
  if (d > 220) return 0.72;
  return 1 - ((d - 40) / 180) * 0.28;
}

function audioTr(pc) {
  return pc.getTransceivers().find((t) => t.receiver && t.receiver.track && t.receiver.track.kind === "audio") || null;
}
function videoTr(pc) {
  return pc.getTransceivers().find((t) => t.receiver && t.receiver.track && t.receiver.track.kind === "video") || null;
}

function publishRoster() {
  const list = [];
  const map = {};
  for (const id of Object.keys(remotes)) {
    const p = remotes[id];
    if (!p || !p.name) continue;
    const ori = p.ori === "p" ? "p" : "l";
    list.push({ id, name: p.name, color: p.color || "#3d8fd4", ori });
    map[id] = ori;
  }
  if (myName) {
    const ori = deviceOri();
    list.push({ id: myId, name: myName, color: myColor, ori });
    map[myId] = ori;
  }
  window.__screenPeople = list;
  window.__ori = map;
}
function publishFeeds() {
  const list = [];
  for (const [id, L] of links) {
    if (!L.video) continue;
    L.video.dataset.pid = id;
    L.video.dataset.who = (remotes[id] && remotes[id].name) || L.video.dataset.who || "";
    list.push(L.video);
  }
  window.__camFeeds = list;
  window.__localCam = videoPhase === "live" && localVid ? localVid : null;
  if (localVid) {
    localVid.dataset.who = myName;
    localVid.dataset.pid = myId;
  }
  publishRoster();
}

function attachVideo(id, track) {
  const L = links.get(id);
  if (!L || !track) return;
  if (!L.video) {
    const el = document.createElement("video");
    el.autoplay = true;
    el.muted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.style.cssText = "position:absolute;left:0;top:0;width:480px;height:480px;opacity:0.02;pointer-events:none";
    document.body.appendChild(el);
    L.video = el;
    el.dataset.pid = id;
  }
  const stream = new MediaStream([track]);
  if (L.video.srcObject !== stream) L.video.srcObject = stream;
  L.video.dataset.who = (remotes[id] && remotes[id].name) || "";
  const p = L.video.play();
  if (p && p.catch) p.catch(() => {});
  publishFeeds();
}

function makePC(id) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const L = { pc, audio: null, video: null, queue: [], gen: 0, offered: false, offerAt: 0, making: false };
  links.set(id, L);
  pc.onicecandidate = (ev) => {
    if (links.get(id) !== L || !ev.candidate) return;
    send({ t: "ice", from: myId, to: id, gen: L.gen, c: ev.candidate.toJSON() });
  };
  pc.ontrack = (ev) => {
    if (links.get(id) !== L) return;
    if (ev.track && ev.track.kind === "video") {
      attachVideo(id, ev.track);
      return;
    }
    const stream = (ev.streams && ev.streams[0]) || new MediaStream([ev.track]);
    attachAudio(id, stream);
    paint();
  };
  pc.onconnectionstatechange = () => {
    if (links.get(id) !== L) return;
    if (pc.connectionState === "failed") closeLink(id);
    paint();
  };
  return L;
}

function flushIce(L, id) {
  const queued = L.queue.splice(0);
  const early = pendingIce.get(id) || [];
  pendingIce.delete(id);
  for (const item of early) if (item.gen === L.gen) queued.push(item.cand);
  for (const cand of queued) L.pc.addIceCandidate(cand).catch(() => {});
}

async function pushMic(track) {
  for (const L of links.values()) await armSender(L, "audio", track);
}

function camOutbound(L) {
  const tr = videoTr(L.pc);
  if (!tr || !tr.sender || !tr.sender.track) return false;
  const dir = tr.currentDirection;
  if (!dir) return true;
  return dir === "sendrecv" || dir === "sendonly";
}
function maybeRefreshVideo(id) {
  if (videoPhase !== "live" || !camTrack()) return;
  const L = links.get(id);
  if (!L || L.making || !linkUp(L) || camOutbound(L)) return;
  const now = Date.now();
  if (L.videoAsk && now - L.videoAsk < 5000) return;
  L.videoAsk = now;
  if (myId > id) reoffer(id);
  else send({ t: "vref", from: myId, to: id });
}
async function pushCam(track) {
  for (const L of links.values()) await armSender(L, "video", track);
  publishFeeds();
  for (const id of links.keys()) maybeRefreshVideo(id);
}

async function offerTo(id) {
  if (!(myId > id)) return;
  let L = links.get(id);
  if (L && (L.making || L.offered)) return;
  if (!L) L = makePC(id);
  L.making = true;
  try {
    L.gen += 1;
    if (!audioTr(L.pc)) L.pc.addTransceiver("audio", { direction: "sendrecv" });
    if (!videoTr(L.pc)) L.pc.addTransceiver("video", { direction: "sendrecv" });
    const tr = audioTr(L.pc);
    const vr = videoTr(L.pc);
    if (tr) tr.direction = "sendrecv";
    if (vr) vr.direction = "sendrecv";
    await armSender(L, "audio", micTrack());
    await armSender(L, "video", camTrack());
    const offer = await L.pc.createOffer();
    if (links.get(id) !== L) return;
    await L.pc.setLocalDescription(offer);
    L.offered = true;
    L.offerAt = Date.now();
    send({ t: "offer", from: myId, to: id, gen: L.gen, sdp: L.pc.localDescription.sdp });
  } catch {
    closeLink(id);
  } finally {
    if (links.get(id) === L) L.making = false;
  }
}

async function reoffer(id) {
  if (!(myId > id)) return;
  const L = links.get(id);
  if (!L || L.making || L.pc.signalingState !== "stable") return;
  L.making = true;
  try {
    L.gen += 1;
    await armSender(L, "audio", micTrack());
    await armSender(L, "video", camTrack());
    const offer = await L.pc.createOffer();
    if (links.get(id) !== L) return;
    await L.pc.setLocalDescription(offer);
    L.offered = true;
    L.offerAt = Date.now();
    send({ t: "offer", from: myId, to: id, gen: L.gen, sdp: L.pc.localDescription.sdp });
  } catch {}
  finally {
    if (links.get(id) === L) L.making = false;
  }
}

async function onOffer(msg) {
  if (msg.to !== myId || !msg.sdp) return;
  let L = links.get(msg.from);
  if (L && L.gen === msg.gen && L.pc.remoteDescription) return;
  const wasUp = !!(L && linkUp(L));
  const keep = !!(L && L.pc.signalingState !== "closed" && (wasUp || L.pc.signalingState === "stable"));
  if (L && !keep) closeLink(msg.from);
  if (!keep) L = makePC(msg.from);
  L.gen = msg.gen;
  try {
    await L.pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
    for (const tr of L.pc.getTransceivers()) tr.direction = "sendrecv";
    await armSender(L, "audio", micTrack());
    await armSender(L, "video", camTrack());
    const answer = await L.pc.createAnswer();
    if (links.get(msg.from) !== L) return;
    await L.pc.setLocalDescription(answer);
    flushIce(L, msg.from);
    send({ t: "answer", from: myId, to: msg.from, gen: L.gen, sdp: L.pc.localDescription.sdp });
  } catch {
    if (links.get(msg.from) === L && !wasUp) closeLink(msg.from);
  }
}

async function onAnswer(msg) {
  if (msg.to !== myId || !msg.sdp) return;
  const L = links.get(msg.from);
  if (!L || L.gen !== msg.gen) return;
  if (L.pc.signalingState !== "have-local-offer") return;
  await L.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
  flushIce(L, msg.from);
}

function onIce(msg) {
  if (msg.to !== myId || !msg.c) return;
  let cand;
  try { cand = new RTCIceCandidate(msg.c); } catch { return; }
  const L = links.get(msg.from);
  if (L && L.gen === msg.gen && L.pc.remoteDescription) {
    L.pc.addIceCandidate(cand).catch(() => {});
    return;
  }
  if (L && L.gen === msg.gen) {
    L.queue.push(cand);
    return;
  }
  const arr = pendingIce.get(msg.from) || [];
  arr.push({ gen: msg.gen, cand });
  pendingIce.set(msg.from, arr.slice(-40));
}

function onHi(msg) {
  if (!msg.id || msg.id === myId) return;
  const prev = remotes[msg.id];
  remotes[msg.id] = {
    x: msg.x, y: msg.y, z: msg.z,
    yaw: Number.isFinite(+msg.yaw) ? +msg.yaw : prev && prev.yaw,
    name: cleanName(msg.name) || (prev && prev.name) || NAMES[hash(msg.id) % NAMES.length],
    color: msg.color || COLORS[hash(msg.id) % COLORS.length],
    mic: !!msg.mic,
    mount: msg.mount === "horse" || msg.mount === "ski" ? msg.mount : "",
    ori: msg.o === "p" ? "p" : msg.o === "l" ? "l" : (prev && prev.ori) || "l",
    at: Date.now(),
  };
  if (myId > msg.id) ensureLinks();
  publishRoster();
  paint();
}

function onMsg(text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (!msg || typeof msg !== "object") return;
  if (msg.mid) {
    const now = Date.now();
    if (seenMid.has(msg.mid)) return;
    seenMid.set(msg.mid, now);
    if (seenMid.size > 500) {
      for (const [k, t] of seenMid) if (now - t > 20000) seenMid.delete(k);
    }
  }
  if (msg.t === "hi") onHi(msg);
  else if (msg.t === "pos") onPos(msg);
  else if (msg.t === "bye" && msg.id && msg.id !== myId) dropPeer(msg.id);
  else if (msg.t === "offer") onOffer(msg).catch(() => {});
  else if (msg.t === "answer") onAnswer(msg).catch(() => {});
  else if (msg.t === "ice") onIce(msg);
  else if (msg.t === "vref" && msg.to === myId && myId > msg.from) reoffer(msg.from);
}

function onPkt(state, pkt, rl) {
  const type = pkt[0] & 0xf0;
  if (type === 0x20) {
    const code = pkt[1 + rl.size + 1];
    if (code !== 0) {
      lastErr = "connack " + code;
      try { state.ws.close(); } catch {}
      return;
    }
    state.ok = true;
    rememberBrokers();
    try { state.ws.send(mqttSub(TOPIC)); } catch {}
    publishHi();
    paint();
    return;
  }
  if (type !== 0x30) return;
  const start = 1 + rl.size;
  const body = pkt.subarray(start, start + rl.value);
  if (body.length < 2) return;
  const tlen = (body[0] << 8) | body[1];
  let off = 2 + tlen;
  const qos = (pkt[0] >> 1) & 3;
  if (qos) off += 2;
  if (off > body.length) return;
  onMsg(dec.decode(body.subarray(off)));
}

function feed(state, buf) {
  const chunk = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const n = new Uint8Array(state.rx.length + chunk.length);
  n.set(state.rx);
  n.set(chunk, state.rx.length);
  state.rx = n;
  while (state.rx.length > 2) {
    const rl = readRL(state.rx, 1);
    if (!rl) return;
    const total = 1 + rl.size + rl.value;
    if (state.rx.length < total) return;
    const pkt = state.rx.slice(0, total);
    state.rx = state.rx.slice(total);
    onPkt(state, pkt, rl);
  }
}

function connectOne(url) {
  const prev = sockets.get(url);
  const gen = (prev && prev.gen > 0 ? prev.gen : 0) + 1;
  if (prev && prev.ws) {
    prev.gen = -1;
    try { prev.ws.onclose = null; prev.ws.close(); } catch {}
  }
  const state = { url, gen, ok: false, ws: null, rx: new Uint8Array(0) };
  sockets.set(url, state);
  let socket;
  try { socket = new WebSocket(url, "mqtt"); }
  catch {
    setTimeout(() => { const cur = sockets.get(url); if (cur && cur.gen === gen) connectOne(url); }, 1200);
    return;
  }
  state.ws = socket;
  ws = socket;
  socket.binaryType = "arraybuffer";
  const failTimer = setTimeout(() => { try { if (sockets.get(url) && sockets.get(url).gen === gen) socket.close(); } catch {} }, 8000);
  socket.onopen = () => {
    if (!sockets.get(url) || sockets.get(url).gen !== gen) return;
    const cid = "si" + Math.random().toString(36).slice(2, 12);
    try { socket.send(mqttConnect(cid)); } catch {}
  };
  socket.onmessage = (ev) => {
    if (!sockets.get(url) || sockets.get(url).gen !== gen) return;
    clearTimeout(failTimer);
    feed(state, ev.data);
  };
  socket.onerror = () => { lastErr = "ws " + url; try { socket.close(); } catch {} };
  socket.onclose = () => {
    if (!sockets.get(url) || sockets.get(url).gen !== gen) return;
    state.ok = false;
    rememberBrokers();
    paint();
    setTimeout(() => { const cur = sockets.get(url); if (cur && cur.gen === gen) connectOne(url); }, 1200);
  };
}

function connectMQTT() {
  for (const url of BROKERS) connectOne(url);
}

function pose() {
  const p = window.__pos;
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  const r = (n) => Math.round(n * 100) / 100;
  const mount = p.mount === "horse" || p.mount === "ski" ? p.mount : "";
  return {
    x: r(p.x),
    y: r(Number.isFinite(p.y) ? p.y : 0),
    z: r(p.z),
    yaw: r(Number.isFinite(p.yaw) ? p.yaw : 0),
    mount,
  };
}

function onPos(msg) {
  if (!msg.id || msg.id === myId) return;
  if (!Number.isFinite(+msg.x) || !Number.isFinite(+msg.z)) return;
  const prev = remotes[msg.id];
  remotes[msg.id] = {
    x: +msg.x,
    y: Number.isFinite(+msg.y) ? +msg.y : 0,
    z: +msg.z,
    yaw: Number.isFinite(+msg.yaw) ? +msg.yaw : prev && prev.yaw,
    name: cleanName(msg.name) || (prev && prev.name) || NAMES[hash(msg.id) % NAMES.length],
    color: (prev && prev.color) || COLORS[hash(msg.id) % COLORS.length],
    mic: prev ? !!prev.mic : false,
    mount: msg.mount === "horse" || msg.mount === "ski" ? msg.mount : (prev && prev.mount) || "",
    ori: msg.o === "p" ? "p" : msg.o === "l" ? "l" : (prev && prev.ori) || "l",
    at: Date.now(),
  };
  publishRoster();
}

function publishHi() {
  if (!mqttOk) return;
  const p = pose();
  if (!p) return;
  send({
    t: "hi",
    id: myId,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    name: myName,
    color: myColor,
    mic: phase === "live",
    mount: p.mount || "",
    o: deviceOri(),
  });
}

let lastPose = null;
function publishPos() {
  if (!mqttOk) return;
  const p = pose();
  if (!p) return;
  if (lastPose) {
    const d = Math.hypot(p.x - lastPose.x, p.z - lastPose.z);
    const turn = Math.abs(Math.atan2(Math.sin(p.yaw - lastPose.yaw), Math.cos(p.yaw - lastPose.yaw)));
    if (d < 0.04 && Math.abs(p.y - lastPose.y) < 0.04 && turn < 0.06 && lastPose.mount === p.mount) return;
  }
  lastPose = p;
  send({ t: "pos", id: myId, x: p.x, y: p.y, z: p.z, yaw: p.yaw, name: myName, mount: p.mount || "", o: deviceOri() });
}
function trackOri() {
  const o = deviceOri();
  if (o === trackOri.o) return;
  trackOri.o = o;
  publishRoster();
  try { publishHi(); } catch (e) {}
}
trackOri.o = deviceOri();
window.addEventListener("resize", trackOri);
window.addEventListener("orientationchange", trackOri);
if (window.visualViewport) window.visualViewport.addEventListener("resize", trackOri);

setInterval(publishPos, 100);

function ensureLinks() {
  const now = Date.now();
  for (const id of Object.keys(remotes)) {
    if (!(myId > id)) continue;
    const L = links.get(id);
    if (L && L.making) continue;
    if (L && linkUp(L)) continue;
    if (L) {
      const ice = L.pc.iceConnectionState;
      const cs = L.pc.connectionState;
      const age = now - (L.offerAt || 0);
      if ((ice === "checking" || cs === "connecting") && age < 25000) continue;
      const dead = ice === "failed" || ice === "disconnected" || ice === "closed" || cs === "failed" || cs === "disconnected" || cs === "closed";
      if (L.offered && age < 8000 && !dead) continue;
      closeLink(id);
    }
    offerTo(id);
  }
}

setInterval(() => {
  publishHi();
  const now = Date.now();
  for (const id of Object.keys(remotes)) {
    if (now - remotes[id].at > 12000) dropPeer(id);
  }
  const mic = micTrack();
  for (const [id, L] of links) {
    if (L.audio) L.audio.volume = volumeFor(id);
    if (L.micClone && mic) L.micClone.enabled = mic.enabled && phase === "live";
    if (L.camClone && camTrack()) L.camClone.enabled = camTrack().enabled && videoPhase === "live";
    maybeRefreshVideo(id);
  }
  ensureLinks();
  publishFeeds();
  kickAudio();
}, 800);

setInterval(() => {
  for (const s of sockets.values()) {
    if (s.ok && s.ws && s.ws.readyState === WebSocket.OPEN) {
      try { s.ws.send(new Uint8Array([0xc0, 0x00])); } catch {}
    }
  }
}, 20000);

function attachLocalCam(stream) {
  camStream = stream;
  videoPhase = "live";
  if (!localVid) {
    localVid = document.createElement("video");
    localVid.autoplay = true;
    localVid.muted = true;
    localVid.playsInline = true;
    localVid.setAttribute("playsinline", "");
    localVid.setAttribute("webkit-playsinline", "");
    localVid.style.cssText = "position:absolute;left:0;top:0;width:160px;height:120px;opacity:0.02;pointer-events:none";
    document.body.appendChild(localVid);
  }
  localVid.srcObject = camStream;
  localVid.dataset.who = myName;
  localVid.dataset.pid = myId;
  const play = localVid.play();
  if (play && play.catch) play.catch(() => {});
  window.__localCam = localVid;
}
let voyageAdopted = false;
function useVoyage(stream) {
  if (voyageAdopted || !stream) return;
  const audios = stream.getAudioTracks ? stream.getAudioTracks() : [];
  const videos = stream.getVideoTracks ? stream.getVideoTracks() : [];
  if (!audios.length && !videos.length) return;
  voyageAdopted = true;
  if (audios.length && (phase === "off" || phase === "denied" || phase === "joining")) {
    localStream = new MediaStream(audios);
    phase = "live";
    holdLocal(localStream);
    pushMic(micTrack());
    publishHi();
    ensureLinks();
    paint();
  }
  if (videos.length && videoPhase !== "live") {
    attachLocalCam(new MediaStream(videos));
    pushCam(camTrack());
    publishFeeds();
    paintCam();
  }
  kickAudio();
}
async function start() {
  if (phase === "joining" || phase === "live" || phase === "muted") return;
  if (window.__voyagePending && !voyageAdopted) {
    phase = "joining";
    paint();
    try {
      const stream = await window.__voyagePending;
      if (stream) useVoyage(stream);
      if (phase === "live") return;
    } catch {}
    if (phase === "joining") phase = "off";
  }
  kickAudio();
  phase = "joining";
  paint();
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch {
    phase = "denied";
    paint();
    return;
  }
  phase = "live";
  holdLocal(localStream);
  await pushMic(micTrack());
  kickAudio();
  publishHi();
  ensureLinks();
  paint();
}

let localAudioEl = null;
function holdLocal(stream) {
  if (!localAudioEl) {
    localAudioEl = document.createElement("audio");
    localAudioEl.muted = true;
    localAudioEl.autoplay = true;
    localAudioEl.playsInline = true;
    localAudioEl.setAttribute("playsinline", "");
    localAudioEl.setAttribute("webkit-playsinline", "");
    localAudioEl.style.cssText = "position:absolute;left:0;top:0;width:8px;height:8px;opacity:0.02;pointer-events:none";
    document.body.appendChild(localAudioEl);
  }
  localAudioEl.srcObject = stream || null;
  if (!stream) return;
  const p = localAudioEl.play();
  if (p && p.catch) p.catch(() => {});
}

function toggle() {
  kickAudio();
  if (phase === "off" || phase === "denied") { start(); return; }
  if (phase === "joining") return;
  const track = micTrack();
  if (!track) { phase = "off"; start(); return; }
  if (phase === "live") { track.enabled = false; phase = "muted"; }
  else { track.enabled = true; phase = "live"; }
  for (const L of links.values()) if (L.micClone) L.micClone.enabled = track.enabled && phase === "live";
  publishHi();
  paint();
}

function hangup() {
  const track = micTrack();
  if (localStream) {
    for (const t of localStream.getTracks()) { try { t.stop(); } catch {} }
  }
  localStream = null;
  holdLocal(null);
  pushMic(null);
  if (track) phase = "off";
  phase = "off";
  const cam = camTrack();
  if (cam) cam.stop();
  camStream = null;
  videoPhase = "off";
  window.__localCam = null;
  pushCam(null);
  const camBtn = document.getElementById("btn-cam");
  if (camBtn) {
    camBtn.classList.remove("on");
    camBtn.textContent = "Камера";
  }
  paint();
}

function commitName() {
  const input = document.getElementById("my-name");
  const typed = input ? cleanName(input.value) : "";
  try { localStorage.setItem(NAME_KEY, typed); } catch {}
  const next = typed || fallbackName();
  if (next === myName) return;
  myName = next;
  if (localVid) {
    localVid.dataset.who = myName;
    localVid.dataset.pid = myId;
  }
  publishFeeds();
  publishHi();
}
function parkName() {
  const hint = document.getElementById("lock-hint");
  const stack = document.getElementById("start-stack");
  const wrap = document.getElementById("name-wrap");
  const controls = document.querySelector(".controls");
  const top = document.querySelector(".hud-top");
  if (!hint || !wrap || !hint.classList.contains("hide")) return;
  const touch = document.body.classList.contains("touch-device") || navigator.maxTouchPoints > 0 || "ontouchstart" in window || window.matchMedia("(pointer: coarse)").matches;
  if (touch && top) {
    top.appendChild(wrap);
    wrap.classList.add("name-dock");
  } else if (controls) {
    wrap.classList.remove("name-dock");
    controls.insertBefore(wrap, controls.firstChild);
  }
  if (stack) stack.classList.add("hide");
}
function bindName() {
  const input = document.getElementById("my-name");
  if (!input || input.dataset.bound) return;
  input.dataset.bound = "1";
  try {
    const saved = cleanName(localStorage.getItem(NAME_KEY));
    if (saved) input.value = saved;
  } catch {}
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(commitName, 250);
  });
  input.addEventListener("change", commitName);
  input.addEventListener("blur", commitName);
  const hint = document.getElementById("lock-hint");
  if (hint) hint.addEventListener("pointerdown", commitName, true);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitName();
      input.blur();
    }
  });
  input.addEventListener("pointerdown", () => {
    try { document.exitPointerLock(); } catch {}
  });
  if (hint) new MutationObserver(parkName).observe(hint, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("pointerlockchange", parkName);
  parkName();
}

document.addEventListener("pointerdown", kickAudio, true);
document.addEventListener("touchend", kickAudio, true);
document.addEventListener("keydown", kickAudio, true);
window.addEventListener("pagehide", () => send({ t: "bye", id: myId }));

connectMQTT();
bindName();
paint();
publishRoster();

function paintCam() {
  const b = document.getElementById("btn-cam");
  if (!b) return;
  b.classList.toggle("on", videoPhase === "live");
  b.textContent = videoPhase === "live" ? "Вас видно" : videoPhase === "denied" ? "Нет камеры" : "Камера";
}

async function toggleVideo() {
  kickAudio();
  if (videoPhase === "live") {
    const track = camTrack();
    if (track) track.stop();
    camStream = null;
    videoPhase = "off";
    if (localVid) localVid.srcObject = null;
    window.__localCam = null;
    await pushCam(null);
    paintCam();
    return;
  }
  const tries = [
    { video: camVideoConstraints(), audio: false },
    { video: { facingMode: "user" }, audio: false },
  ];
  let stream = null;
  for (const constraints of tries) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch {
      stream = null;
    }
  }
  if (!stream) {
    videoPhase = "denied";
    paintCam();
    return;
  }
  attachLocalCam(stream);
  await pushCam(camTrack());
  publishFeeds();
  paintCam();
}

window.__spaceVoice = {
  toggle,
  toggleVideo,
  hangup,
  useVoyage,
  debug() {
    return {
      phase,
      id: myId,
      name: myName,
      mqtt: mqttOk,
      broker,
      lastErr,
      near: remoteCount(),
      heard: heardCount(),
      remotes: { ...remotes },
      links: [...links.entries()].map(([id, L]) => ({
        id,
        state: L.pc.connectionState,
        ice: L.pc.iceConnectionState,
        sig: L.pc.signalingState,
        audio: !!L.audio,
        send: L.micClone ? L.micClone.id : "",
        video: L.video ? L.video.videoWidth : 0,
        csend: L.camClone ? L.camClone.id : "",
      })),
      mic: micTrack() ? micTrack().id : "",
      cam: camTrack() ? camTrack().id : "",
    };
  },
};
if (window.__voyageStream) useVoyage(window.__voyageStream);
else if (window.__voyagePending) Promise.resolve(window.__voyagePending).then((s) => s && useVoyage(s)).catch(() => {});
