// Shared island presence and voice.
// Positions travel even before the microphone is allowed, so people can see
// each other. Audio uses a plain <audio> element (phones stay silent if the
// remote track is played only through Web Audio).

const TOPIC = "si3d/loft/v1";
const BROKERS = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081",
  "wss://mqtt.eclipseprojects.io/mqtt",
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
const myName = NAMES[hash(myId) % NAMES.length];
const myColor = COLORS[hash(myId) % COLORS.length];

let phase = "off";
let localStream = null;
let mqttOk = false;
let broker = "";
let lastErr = "";
let sockGen = 0;
let ws = null;
let rx = new Uint8Array(0);
const links = new Map();
const remotes = {};
const pendingIce = new Map();
window.__remotes = remotes;

function micTrack() {
  return localStream ? localStream.getAudioTracks()[0] || null : null;
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
  const text =
    phase === "live" || phase === "muted"
      ? heard
        ? `в эфире · слышно ${heard}`
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

function send(obj) {
  if (!mqttOk || !ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(mqttPub(TOPIC, JSON.stringify(obj)));
  } catch {}
}

function closeLink(id) {
  const L = links.get(id);
  if (!L) return;
  links.delete(id);
  try { L.pc.ontrack = null; L.pc.onicecandidate = null; L.pc.close(); } catch {}
  if (L.audio) {
    try { L.audio.pause(); L.audio.srcObject = null; L.audio.remove(); } catch {}
  }
}

function dropPeer(id) {
  if (!remotes[id] && !links.has(id)) return;
  delete remotes[id];
  closeLink(id);
  paint();
}

function kickAudio() {
  for (const L of links.values()) {
    if (!L.audio) continue;
    const p = L.audio.play();
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

function makePC(id) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const L = { pc, audio: null, queue: [], gen: 0, offered: false, offerAt: 0, making: false };
  links.set(id, L);
  pc.onicecandidate = (ev) => {
    if (links.get(id) !== L || !ev.candidate) return;
    send({ t: "ice", from: myId, to: id, gen: L.gen, c: ev.candidate.toJSON() });
  };
  pc.ontrack = (ev) => {
    if (links.get(id) !== L) return;
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
  let reopen = false;
  for (const L of links.values()) {
    const tr = L.pc.getTransceivers()[0];
    if (!tr || !tr.sender) continue;
    const cur = tr.currentDirection;
    try { await tr.sender.replaceTrack(track || null); } catch {}
    if (track && cur && cur !== "sendrecv" && cur !== "sendonly") reopen = true;
  }
  if (reopen) for (const id of [...links.keys()]) closeLink(id);
}

async function offerTo(id) {
  if (!(myId > id)) return;
  let L = links.get(id);
  if (L && (L.making || L.offered)) return;
  if (!L) L = makePC(id);
  L.making = true;
  try {
    L.gen += 1;
    if (L.pc.getTransceivers().length === 0) L.pc.addTransceiver("audio", { direction: "sendrecv" });
    const tr = L.pc.getTransceivers()[0];
    if (tr) tr.direction = "sendrecv";
    const track = micTrack();
    if (tr && track) await tr.sender.replaceTrack(track);
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

async function onOffer(msg) {
  if (msg.to !== myId || !msg.sdp) return;
  let L = links.get(msg.from);
  if (L && L.gen === msg.gen && L.pc.remoteDescription) return;
  if (L) closeLink(msg.from);
  L = makePC(msg.from);
  L.gen = msg.gen;
  await L.pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
  const tr = L.pc.getTransceivers()[0];
  if (tr) tr.direction = "sendrecv";
  const track = micTrack();
  if (tr && track) await tr.sender.replaceTrack(track);
  const answer = await L.pc.createAnswer();
  if (links.get(msg.from) !== L) return;
  await L.pc.setLocalDescription(answer);
  flushIce(L, msg.from);
  send({ t: "answer", from: myId, to: msg.from, gen: L.gen, sdp: L.pc.localDescription.sdp });
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
  remotes[msg.id] = {
    x: msg.x, y: msg.y, z: msg.z,
    name: msg.name || NAMES[hash(msg.id) % NAMES.length],
    color: msg.color || COLORS[hash(msg.id) % COLORS.length],
    mic: !!msg.mic,
    at: Date.now(),
  };
  if (myId > msg.id) {
    const L = links.get(msg.id);
    const stale = L && L.offered && Date.now() - L.offerAt > 20000 && L.pc.connectionState !== "connected" && L.pc.iceConnectionState !== "connected" && L.pc.iceConnectionState !== "completed";
    if (stale) closeLink(msg.id);
    offerTo(msg.id);
  }
  paint();
}

function onMsg(text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (!msg || typeof msg !== "object") return;
  if (msg.t === "hi") onHi(msg);
  else if (msg.t === "bye" && msg.id && msg.id !== myId) dropPeer(msg.id);
  else if (msg.t === "offer") onOffer(msg).catch(() => {});
  else if (msg.t === "answer") onAnswer(msg).catch(() => {});
  else if (msg.t === "ice") onIce(msg);
}

function onPkt(pkt, rl) {
  const type = pkt[0] & 0xf0;
  if (type === 0x20) {
    const code = pkt[1 + rl.size + 1];
    if (code !== 0) {
      lastErr = "connack " + code;
      try { ws.close(); } catch {}
      return;
    }
    mqttOk = true;
    try { ws.send(mqttSub(TOPIC)); } catch {}
    publishHi();
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

function feed(buf) {
  const chunk = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const n = new Uint8Array(rx.length + chunk.length);
  n.set(rx);
  n.set(chunk, rx.length);
  rx = n;
  while (rx.length > 2) {
    const rl = readRL(rx, 1);
    if (!rl) return;
    const total = 1 + rl.size + rl.value;
    if (rx.length < total) return;
    const pkt = rx.slice(0, total);
    rx = rx.slice(total);
    onPkt(pkt, rl);
  }
}

function connectMQTT() {
  const gen = ++sockGen;
  const url = BROKERS[(gen - 1) % BROKERS.length];
  broker = url;
  mqttOk = false;
  rx = new Uint8Array(0);
  let socket;
  try { socket = new WebSocket(url, "mqtt"); }
  catch { setTimeout(() => { if (gen === sockGen) connectMQTT(); }, 900); return; }
  ws = socket;
  socket.binaryType = "arraybuffer";
  const failTimer = setTimeout(() => { try { if (gen === sockGen) socket.close(); } catch {} }, 9000);
  socket.onopen = () => {
    if (gen !== sockGen) return;
    const cid = "si" + Math.random().toString(36).slice(2, 12);
    try { socket.send(mqttConnect(cid)); } catch {}
  };
  socket.onmessage = (ev) => {
    if (gen !== sockGen) return;
    clearTimeout(failTimer);
    feed(ev.data);
  };
  socket.onerror = () => { lastErr = "ws " + url; try { socket.close(); } catch {} };
  socket.onclose = () => {
    if (gen !== sockGen) return;
    mqttOk = false;
    for (const id of [...links.keys()]) closeLink(id);
    setTimeout(() => { if (gen === sockGen) connectMQTT(); }, 800);
  };
}

function publishHi() {
  if (!mqttOk) return;
  const p = window.__pos;
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
  send({
    t: "hi",
    id: myId,
    x: p.x,
    y: Number.isFinite(p.y) ? p.y : 0,
    z: p.z,
    name: myName,
    color: myColor,
    mic: phase === "live",
  });
}

setInterval(() => {
  publishHi();
  const now = Date.now();
  for (const id of Object.keys(remotes)) {
    if (now - remotes[id].at > 12000) dropPeer(id);
  }
  for (const [id, L] of links) if (L.audio) L.audio.volume = volumeFor(id);
}, 800);

setInterval(() => {
  if (mqttOk && ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(new Uint8Array([0xc0, 0x00])); } catch {}
  }
}, 20000);

async function start() {
  if (phase === "joining" || phase === "live" || phase === "muted") return;
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
  await pushMic(micTrack());
  kickAudio();
  publishHi();
  paint();
}

function toggle() {
  kickAudio();
  if (phase === "off" || phase === "denied") { start(); return; }
  if (phase === "joining") return;
  const track = micTrack();
  if (!track) { phase = "off"; start(); return; }
  if (phase === "live") { track.enabled = false; phase = "muted"; }
  else { track.enabled = true; phase = "live"; }
  publishHi();
  paint();
}

function hangup() {
  const track = micTrack();
  if (localStream) {
    for (const t of localStream.getTracks()) { try { t.stop(); } catch {} }
  }
  localStream = null;
  pushMic(null);
  if (track) phase = "off";
  phase = "off";
  paint();
}

document.addEventListener("pointerdown", kickAudio, true);
document.addEventListener("touchend", kickAudio, true);
document.addEventListener("keydown", kickAudio, true);
window.addEventListener("pagehide", () => send({ t: "bye", id: myId }));

connectMQTT();
paint();

window.__spaceVoice = {
  toggle,
  hangup,
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
      })),
    };
  },
};
