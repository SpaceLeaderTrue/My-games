// Shared voice room for everyone who opens this page and allows the microphone.
const ROOM = "spaceisland3dloft";

const btn = () => document.getElementById("btn-mute");
const statusEl = () => document.querySelector(".status");

let phase = "off";
let localStream = null;
let ctx = null;
let peer = null;
let isHost = false;
let hostConn = null;
let leaving = false;
const guests = new Map();
const calls = new Map();
const heard = new Map();
const positions = new Map();
let retries = 0;

function label() {
  const n = heard.size;
  if (phase === "joining") return "Подключаем…";
  if (phase === "muted") return "Микрофон выкл";
  if (phase === "live") return n ? `Вас слышно · ${n}` : "Ждём других";
  return "Микрофон";
}

function paint() {
  const b = btn();
  if (!b) return;
  b.textContent = label();
  b.classList.toggle("on", phase === "live");
  b.setAttribute("aria-pressed", phase === "live" || phase === "muted" ? "true" : "false");
  const status = statusEl();
  if (!status) return;
  const dot = status.querySelector(".dot");
  const text =
    phase === "off"
      ? "в эфире · 4 экрана"
      : heard.size
        ? `в эфире · слышно ${heard.size}`
        : "в эфире · микрофон включён";
  status.replaceChildren();
  if (dot) status.appendChild(dot);
  status.append(` ${text}`);
}

function safeSend(conn, msg) {
  try {
    if (conn && conn.open) conn.send(msg);
  } catch {}
}

function volumeFor(id) {
  const mine = window.__pos;
  const theirs = positions.get(id);
  if (!mine || !theirs) return 1;
  const d = Math.hypot(mine.x - theirs.x, mine.z - theirs.z);
  if (d < 28) return 1;
  if (d > 180) return 0.35;
  return 1 - ((d - 28) / 152) * 0.65;
}

function refreshGains() {
  for (const [id, rec] of heard) rec.gain.gain.value = volumeFor(id);
}

function sendPos() {
  const p = window.__pos;
  if (!p || phase === "off" || phase === "joining") return;
  if (isHost) {
    for (const oc of guests.values()) safeSend(oc, { t: "pos", id: ROOM, x: p.x, z: p.z });
  } else safeSend(hostConn, { t: "pos", x: p.x, z: p.z });
}

setInterval(() => {
  sendPos();
  refreshGains();
}, 400);

function dropAudio(id) {
  const rec = heard.get(id);
  if (!rec) return;
  try {
    rec.src.disconnect();
    rec.gain.disconnect();
  } catch {}
  heard.delete(id);
}

function dropCall(id) {
  const call = calls.get(id);
  calls.delete(id);
  positions.delete(id);
  try {
    call?.close();
  } catch {}
  dropAudio(id);
  paint();
}

function attach(id, stream) {
  if (!ctx || !stream.getAudioTracks().length) return;
  dropAudio(id);
  const src = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain();
  gain.gain.value = volumeFor(id);
  src.connect(gain);
  gain.connect(ctx.destination);
  heard.set(id, { src, gain });
  paint();
}

function watch(call, id) {
  calls.set(id, call);
  call.on("stream", (stream) => attach(id, stream));
  call.on("close", () => dropCall(id));
  call.on("error", () => dropCall(id));
}

function shouldDial(id) {
  if (!peer || id === peer.id) return false;
  if (isHost) return true;
  if (id === ROOM) return false;
  return peer.id > id;
}

function dial(id) {
  if (!peer || !localStream || !shouldDial(id) || calls.has(id)) return;
  const call = peer.call(id, localStream);
  if (call) watch(call, id);
}

function onCall(call) {
  if (!localStream) {
    try {
      call.close();
    } catch {}
    return;
  }
  call.answer(localStream);
  watch(call, call.peer);
}

function forgetGuest(id) {
  guests.delete(id);
  dropCall(id);
  for (const oc of guests.values()) safeSend(oc, { t: "leave", id });
}

function onGuest(conn) {
  const id = conn.peer;
  conn.on("data", (msg) => {
    if (!msg || msg.t !== "pos") return;
    positions.set(id, { x: msg.x, z: msg.z });
    for (const [oid, oc] of guests) {
      if (oid !== id) safeSend(oc, { t: "pos", id, x: msg.x, z: msg.z });
    }
  });
  conn.on("open", () => {
    guests.set(id, conn);
    const others = [...guests.keys()].filter((x) => x !== id);
    safeSend(conn, { t: "roster", ids: others });
    for (const [oid, oc] of guests) {
      if (oid !== id) safeSend(oc, { t: "join", id });
    }
    dial(id);
    sendPos();
  });
  conn.on("close", () => forgetGuest(id));
  conn.on("error", () => forgetGuest(id));
}

function consider(id) {
  if (id && id !== peer?.id) dial(id);
}

function onHostMsg(msg) {
  if (!msg) return;
  if (msg.t === "roster") (msg.ids || []).forEach(consider);
  else if (msg.t === "join") consider(msg.id);
  else if (msg.t === "leave") dropCall(msg.id);
  else if (msg.t === "pos") positions.set(msg.id, { x: msg.x, z: msg.z });
}

function arm(next) {
  peer = next;
  peer.on("call", onCall);
  peer.on("error", (err) => {
    if (leaving) return;
    if (err && (err.type === "network" || err.type === "server-error" || err.type === "socket-error")) fail("Нет связи");
  });
  peer.on("disconnected", () => {
    if (!leaving && peer && !peer.destroyed) {
      try {
        peer.reconnect();
      } catch {}
    }
  });
}

function linkHost() {
  if (!peer || leaving) return;
  hostConn = peer.connect(ROOM, { reliable: true });
  let opened = false;
  const timer = setTimeout(() => {
    if (!opened && !leaving) {
      try {
        hostConn?.close();
      } catch {}
      reclaim();
    }
  }, 5000);
  hostConn.on("open", () => {
    opened = true;
    clearTimeout(timer);
    retries = 0;
    sendPos();
  });
  hostConn.on("data", onHostMsg);
  hostConn.on("close", () => {
    if (!leaving && opened) reclaim();
  });
}

function reclaim() {
  if (leaving || phase === "off") return;
  if (retries++ > 4) {
    fail("Нет связи");
    return;
  }
  const stream = localStream;
  destroyPeer();
  localStream = stream;
  setTimeout(connect, 400 + Math.random() * 700);
}

function destroyPeer() {
  isHost = false;
  hostConn = null;
  guests.clear();
  for (const id of [...calls.keys()]) dropCall(id);
  try {
    peer?.destroy();
  } catch {}
  peer = null;
}

function connect() {
  if (!window.Peer || !localStream || leaving) {
    fail(window.Peer ? "Нет связи" : "Нет связи");
    return;
  }
  const contender = new window.Peer(ROOM);
  let settled = false;
  contender.on("open", () => {
    if (settled) return;
    settled = true;
    isHost = true;
    retries = 0;
    arm(contender);
    peer.on("connection", onGuest);
    phase = phase === "muted" ? "muted" : "live";
    paint();
  });
  contender.on("error", (err) => {
    if (settled || leaving) return;
    if (err && err.type === "unavailable-id") {
      settled = true;
      try {
        contender.destroy();
      } catch {}
      const guest = new window.Peer();
      guest.on("open", () => {
        isHost = false;
        arm(guest);
        linkHost();
        phase = phase === "muted" ? "muted" : "live";
        paint();
      });
      guest.on("error", (err) => {
        if (leaving || (err && err.type === "peer-unavailable")) return;
        if (err && (err.type === "network" || err.type === "server-error" || err.type === "socket-error")) fail("Нет связи");
      });
      return;
    }
    settled = true;
    try {
      contender.destroy();
    } catch {}
    fail("Нет связи");
  });
}

function fail(text) {
  leaving = true;
  destroyPeer();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  leaving = false;
  phase = "off";
  const b = btn();
  if (b) b.textContent = text;
  setTimeout(() => {
    if (phase === "off") paint();
  }, 1800);
}

async function start() {
  if (phase === "joining" || phase === "live" || phase === "muted") return;
  phase = "joining";
  leaving = false;
  paint();
  ctx = new AudioContext();
  ctx.resume();
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch {
    try {
      ctx.close();
    } catch {}
    ctx = null;
    phase = "off";
    const b = btn();
    if (b) b.textContent = "Нет доступа";
    setTimeout(paint, 1600);
    return;
  }
  phase = "live";
  paint();
  connect();
}

function mute(on) {
  if (!localStream) return;
  phase = on ? "muted" : "live";
  localStream.getAudioTracks().forEach((t) => {
    t.enabled = !on;
  });
  paint();
}

function hangup() {
  leaving = true;
  destroyPeer();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  try {
    ctx?.close();
  } catch {}
  ctx = null;
  phase = "off";
  paint();
}

window.__spaceVoice = {
  toggle() {
    if (phase === "off") start();
    else if (phase === "live") mute(true);
    else if (phase === "muted") mute(false);
  },
  hangup,
    debug() {
      return {
        phase,
        id: peer?.id || null,
        host: isHost,
        heard: [...heard.keys()],
        calls: [...calls.entries()].map(([id, call]) => ({
          id,
          state: call.peerConnection?.connectionState || null,
          ice: call.peerConnection?.iceConnectionState || null,
        })),
      };
    },
};

window.addEventListener("pagehide", () => {
  if (phase !== "off") hangup();
});
paint();
