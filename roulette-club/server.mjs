import { createHash, randomInt as secureRandomInt, randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { RouletteGame, WEAPON_SKINS } from "./src/game.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.PORT || process.argv[2] || 5174);
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PLAYER_COLORS = ["#62d7c5", "#ff5d66", "#f3b84d", "#9ddc7c"];
const DISCONNECT_TURN_MS = 15_000;
const CONNECTED_TURN_MS = 45_000;
const LOBBY_DISCONNECT_MS = 60_000;
const ROOM_IDLE_MS = 5 * 60_000;
const PEER_PING_MS = 15_000;
const PEER_TIMEOUT_MS = 45_000;
const MESSAGE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 80;
const MAX_MESSAGE_BYTES = 32_768;
const MAX_SOCKET_QUEUE_BYTES = 256 * 1024;
const MAX_PEERS = 2_000;
const MAX_ROOMS = 1_000;
const SHOT_AIM_MS = 420;
const SHOT_FLIGHT_MS = 380;
const SHOT_RECOVERY_MS = 360;
const ROUND_INTRO_MS = 2_700;

export function createRouletteServer({ root = ROOT } = {}) {
  const rooms = new Map();
  const peers = new Set();
  const server = createServer((request, response) => serveHttp(root, request, response));

  server.on("upgrade", (request, socket) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname !== "/socket" || !isAllowedWebSocketOrigin(request)) {
      rejectUpgrade(socket, 403, "Forbidden");
      return;
    }
    if (peers.size >= MAX_PEERS) {
      rejectUpgrade(socket, 503, "Server busy");
      return;
    }
    acceptWebSocket(request, socket, rooms, peers);
  });

  const maintenanceTimer = setInterval(() => {
    maintainRooms(rooms);
    maintainPeers(peers, rooms);
  }, 1000);
  maintenanceTimer.unref?.();

  return {
    server,
    rooms,
    listen(port = DEFAULT_PORT, host = process.env.HOST || "127.0.0.1") {
      return new Promise((resolveListen, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolveListen(server.address());
        });
      });
    },
    async close() {
      clearInterval(maintenanceTimer);
      for (const peer of peers) disconnectPeer(peer, rooms, { intentional: true });
      if (!server.listening) return;
      await new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
    },
  };
}

function serveHttp(root, request, response) {
  const parsed = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (parsed.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }
  const cleanPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const absolute = resolve(join(root, cleanPath));
  const safePath = absolute === root || absolute.startsWith(`${root}${sep}`) ? absolute : null;
  const filePath = safePath && existsSync(safePath) && statSync(safePath).isDirectory() ? join(safePath, "index.html") : safePath;
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const fileStats = statSync(filePath);
  response.writeHead(200, {
    "content-type": contentType(filePath),
    "content-length": fileStats.size,
    "cache-control": "no-store",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
  stream.pipe(response);
}

function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
  }[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function isAllowedWebSocketOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function rejectUpgrade(socket, status, message) {
  try {
    socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } catch {
    socket.destroy();
  }
}

function acceptWebSocket(request, socket, rooms, peers) {
  const key = request.headers["sec-websocket-key"];
  if (!key || request.headers["sec-websocket-version"] !== "13") {
    rejectUpgrade(socket, 400, "Bad WebSocket handshake");
    return;
  }

  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n"));

  const peer = {
    id: randomUUID().slice(0, 10),
    socket,
    buffer: Buffer.alloc(0),
    alive: true,
    roomCode: null,
    playerId: null,
    registry: peers,
    fragmented: null,
    lastPongAt: Date.now(),
    lastPingAt: 0,
    messageWindowAt: Date.now(),
    messageCount: 0,
    send(payload) {
      if (!this.alive) return;
      try {
        if (this.socket.writableLength > MAX_SOCKET_QUEUE_BYTES) {
          this.socket.destroy();
          return;
        }
        this.socket.write(encodeFrame(JSON.stringify(payload)));
      } catch {
        this.alive = false;
      }
    },
  };
  peers.add(peer);

  socket.on("data", (chunk) => readFrames(peer, chunk, rooms));
  socket.on("close", () => disconnectPeer(peer, rooms));
  socket.on("error", () => disconnectPeer(peer, rooms));
}

function readFrames(peer, chunk, rooms) {
  peer.buffer = Buffer.concat([peer.buffer, chunk]);
  while (peer.buffer.length >= 2) {
    const first = peer.buffer[0];
    const second = peer.buffer[1];
    const fin = Boolean(first & 0x80);
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    if ((first & 0x70) !== 0 || !masked) {
      peer.socket.destroy();
      return;
    }
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (peer.buffer.length < offset + 2) return;
      length = peer.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (peer.buffer.length < offset + 8) return;
      length = Number(peer.buffer.readBigUInt64BE(offset));
      offset += 8;
    }
    if (length > MAX_MESSAGE_BYTES || (opcode >= 8 && (!fin || length > 125))) {
      peer.socket.destroy();
      return;
    }
    const maskOffset = masked ? offset : -1;
    if (masked) offset += 4;
    if (peer.buffer.length < offset + length) return;
    let payload = peer.buffer.subarray(offset, offset + length);
    if (masked) {
      const mask = peer.buffer.subarray(maskOffset, maskOffset + 4);
      payload = Buffer.from(payload);
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    }
    peer.buffer = peer.buffer.subarray(offset + length);
    peer.lastPongAt = Date.now();
    if (opcode === 8) {
      disconnectPeer(peer, rooms);
      return;
    }
    if (opcode === 9) {
      peer.socket.write(encodeFrame(payload, 10));
      continue;
    }
    if (opcode === 10) continue;

    if (opcode === 1) {
      if (peer.fragmented) {
        peer.socket.destroy();
        return;
      }
      if (fin) handleTextPayload(peer, payload, rooms);
      else peer.fragmented = { chunks: [payload], length: payload.length };
      continue;
    }

    if (opcode === 0 && peer.fragmented) {
      peer.fragmented.chunks.push(payload);
      peer.fragmented.length += payload.length;
      if (peer.fragmented.length > MAX_MESSAGE_BYTES) {
        peer.socket.destroy();
        return;
      }
      if (fin) {
        const complete = Buffer.concat(peer.fragmented.chunks, peer.fragmented.length);
        peer.fragmented = null;
        handleTextPayload(peer, complete, rooms);
      }
      continue;
    }

    peer.socket.destroy();
    return;
  }
}

function handleTextPayload(peer, payload, rooms) {
  if (!consumeMessageBudget(peer)) {
    peer.send({ type: "error", message: "Слишком много команд" });
    peer.socket.destroy();
    return;
  }
  try {
    handleMessage(peer, JSON.parse(payload.toString("utf8")), rooms);
  } catch {
    peer.send({ type: "error", message: "Некорректная команда" });
  }
}

function consumeMessageBudget(peer) {
  const now = Date.now();
  if (now - peer.messageWindowAt >= MESSAGE_WINDOW_MS) {
    peer.messageWindowAt = now;
    peer.messageCount = 0;
  }
  peer.messageCount += 1;
  return peer.messageCount <= MAX_MESSAGES_PER_WINDOW;
}

function encodeFrame(data, opcode = 1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

function handleMessage(peer, message, rooms) {
  if (!message || typeof message.type !== "string") return;
  if (message.type === "join") return joinRoom(peer, message, rooms);
  if (message.type === "leave") return leaveRoom(peer, rooms, { remove: true });

  const room = rooms.get(peer.roomCode);
  const player = room?.players.get(peer.playerId);
  if (!room || !player || player.peer !== peer) {
    peer.send({ type: "error", message: "Сначала войдите в комнату" });
    return;
  }
  room.lastTouchedAt = Date.now();

  if (message.type === "configure") configureRoom(room, player, message);
  else if (message.type === "ready") setReady(room, player, message.ready);
  else if (message.type === "start") startRoom(room, player);
  else if (message.type === "rematch") returnRoomToLobby(room, player);
  else if (message.type === "action") performAction(room, player, message);
}

function joinRoom(peer, message, rooms) {
  leaveRoom(peer, rooms, { remove: true });
  const requestedCode = sanitizeCode(message.roomCode);
  let room = requestedCode ? rooms.get(requestedCode) : null;
  if (!room && requestedCode && message.create !== true) {
    peer.send({ type: "error", message: "Комната не найдена" });
    return;
  }
  if (!room) {
    if (rooms.size >= MAX_ROOMS) {
      peer.send({ type: "error", message: "Сейчас нет свободных игровых столов" });
      return;
    }
    const code = requestedCode || makeRoomCode(rooms);
    room = createRoom(code, message);
    rooms.set(code, room);
  }

  const token = sanitizeToken(message.resumeToken);
  let player = token ? [...room.players.values()].find((candidate) => candidate.resumeToken === token) : null;
  if (player) {
    player.peer?.socket.destroy();
    player.peer = peer;
    player.connected = true;
    player.disconnectedAt = 0;
    if (sanitizeName(message.name)) player.name = sanitizeName(message.name);
  } else {
    if (room.phase !== "lobby") {
      peer.send({ type: "error", message: "Матч уже идёт" });
      return;
    }
    if (room.players.size >= room.playerCount) {
      peer.send({ type: "error", message: "За столом нет свободных мест" });
      return;
    }
    const playerId = firstFreeSeat(room);
    player = {
      id: playerId,
      name: sanitizeName(message.name) || `Игрок ${room.players.size + 1}`,
      color: PLAYER_COLORS[Number(playerId.slice(1))],
      resumeToken: randomUUID(),
      peer,
      ready: false,
      connected: true,
      joinedAt: Date.now(),
      disconnectedAt: 0,
    };
    room.players.set(playerId, player);
    if (!room.hostId) room.hostId = playerId;
  }

  peer.roomCode = room.code;
  peer.playerId = player.id;
  room.lastTouchedAt = Date.now();
  peer.send({ type: "welcome", roomCode: room.code, playerId: player.id, resumeToken: player.resumeToken });
  broadcast(room);
}

function createRoom(code, message) {
  return {
    code,
    phase: "lobby",
    playerCount: Number(message.playerCount) === 4 ? 4 : 2,
    weaponSkin: WEAPON_SKINS[message.weaponSkin] ? message.weaponSkin : "revolver",
    hostId: null,
    players: new Map(),
    game: null,
    lockUntil: 0,
    turnStartedAt: Date.now(),
    lastTouchedAt: Date.now(),
  };
}

function configureRoom(room, player, message) {
  if (room.phase !== "lobby" || room.hostId !== player.id) return;
  const requestedCount = Number(message.playerCount) === 4 ? 4 : 2;
  if (requestedCount < room.players.size) {
    player.peer.send({ type: "error", message: "Сначала освободите лишние места" });
    return;
  }
  room.playerCount = requestedCount;
  room.weaponSkin = WEAPON_SKINS[message.weaponSkin] ? message.weaponSkin : room.weaponSkin;
  for (const participant of room.players.values()) participant.ready = false;
  broadcast(room);
}

function setReady(room, player, ready) {
  if (room.phase !== "lobby") return;
  player.ready = ready !== false;
  broadcast(room);
}

function startRoom(room, player) {
  if (room.phase !== "lobby" || room.hostId !== player.id) return;
  const connected = [...room.players.values()].filter((participant) => participant.connected);
  if (connected.length !== room.playerCount) {
    player.peer.send({ type: "error", message: `Нужно игроков: ${room.playerCount}` });
    return;
  }
  if (connected.some((participant) => !participant.ready)) {
    player.peer.send({ type: "error", message: "Не все игроки готовы" });
    return;
  }

  room.game = new RouletteGame({ playerCount: room.playerCount, weaponSkin: room.weaponSkin });
  for (const gamePlayer of room.game.state.players) {
    const participant = room.players.get(gamePlayer.id);
    gamePlayer.name = participant?.name || gamePlayer.name;
    gamePlayer.color = participant?.color || gamePlayer.color;
    gamePlayer.isHuman = false;
  }
  room.phase = "playing";
  room.lockUntil = Date.now() + ROUND_INTRO_MS;
  room.turnStartedAt = room.lockUntil;
  broadcast(room);
}

function returnRoomToLobby(room, player) {
  if (room.phase !== "finished" || room.hostId !== player.id) return;
  room.phase = "lobby";
  room.game = null;
  room.lockUntil = 0;
  room.turnStartedAt = Date.now();
  for (const participant of room.players.values()) participant.ready = false;
  broadcast(room);
}

function performAction(room, player, message) {
  if (room.phase !== "playing" || !room.game) return;
  if (room.game.state.currentPlayerId !== player.id) {
    player.peer.send({ type: "error", message: "Сейчас ход другого игрока" });
    return;
  }
  if (Date.now() < room.lockUntil) {
    player.peer.send({ type: "error", message: "Предыдущий ход ещё заканчивается" });
    return;
  }

  let result;
  if (message.action === "shoot") {
    result = room.game.shoot(sanitizePlayerId(message.targetId));
  } else if (message.action === "item") {
    result = room.game.useItem(String(message.itemId || ""), sanitizePlayerId(message.targetId));
  } else {
    return;
  }
  if (!result.ok) {
    player.peer.send({ type: "error", message: result.error || "Ход отклонён" });
    return;
  }

  const now = Date.now();
  room.turnStartedAt = now;
  if (message.action === "shoot") {
    room.lockUntil = now + shotLockDuration(room.game.state.lastEvent);
  }
  if (room.game.state.winnerId) room.phase = "finished";
  broadcast(room);
}

function buildRoomState(room, viewer) {
  return {
    code: room.code,
    phase: room.phase,
    selfId: viewer.id,
    isHost: room.hostId === viewer.id,
    playerCount: room.playerCount,
    weaponSkin: room.weaponSkin,
    canStart: room.phase === "lobby"
      && room.players.size === room.playerCount
      && [...room.players.values()].every((player) => player.connected && player.ready),
    players: [...room.players.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((player) => ({
        id: player.id,
        name: player.name,
        color: player.color,
        ready: player.ready,
        connected: player.connected,
        isHost: player.id === room.hostId,
        isSelf: player.id === viewer.id,
      })),
    game: room.game ? gameViewFor(room.game.state, viewer.id) : null,
  };
}

function gameViewFor(state, viewerId) {
  const lastEvent = state.lastEvent ? { ...state.lastEvent } : null;
  if (lastEvent?.itemId === "tarot" && lastEvent.actorId !== viewerId) {
    delete lastEvent.peekedShell;
  }
  return {
    ...state,
    shells: undefined,
    peekedShell: state.peekedBy === viewerId ? state.peekedShell : null,
    peekedBy: state.peekedBy === viewerId ? viewerId : null,
    players: state.players.map((player) => ({ ...player, isHuman: player.id === viewerId })),
    log: state.log.slice(0, 8),
    lastEvent,
  };
}

function broadcast(room) {
  room.lastTouchedAt = Date.now();
  for (const player of room.players.values()) {
    if (player.connected && player.peer) {
      player.peer.send({ type: "state", room: buildRoomState(room, player) });
    }
  }
}

function disconnectPeer(peer, rooms, { intentional = false } = {}) {
  if (!peer.alive && !intentional) return;
  peer.alive = false;
  peer.registry?.delete(peer);
  const room = rooms.get(peer.roomCode);
  const player = room?.players.get(peer.playerId);
  if (room && player?.peer === peer) {
    player.peer = null;
    player.connected = false;
    player.disconnectedAt = Date.now();
    ensureHost(room);
    broadcast(room);
  }
  try {
    peer.socket.destroy();
  } catch {
    // Socket is already gone.
  }
}

function leaveRoom(peer, rooms, { remove = false } = {}) {
  const room = rooms.get(peer.roomCode);
  if (!room) return;
  const player = room.players.get(peer.playerId);
  if (player?.peer === peer) {
    if (remove && room.phase === "lobby") {
      room.players.delete(player.id);
      compactRoomSeats(room);
    }
    else {
      player.peer = null;
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
  }
  peer.roomCode = null;
  peer.playerId = null;
  ensureHost(room);
  if (room.players.size === 0) rooms.delete(room.code);
  else broadcast(room);
}

function maintainRooms(rooms) {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === "lobby") {
      let removedPlayer = false;
      for (const player of room.players.values()) {
        if (!player.connected && now - player.disconnectedAt > LOBBY_DISCONNECT_MS) {
          room.players.delete(player.id);
          removedPlayer = true;
        }
      }
      if (removedPlayer) compactRoomSeats(room);
      ensureHost(room);
    }

    if (room.phase === "playing" && room.game && now >= room.lockUntil) {
      const active = room.players.get(room.game.state.currentPlayerId);
      const disconnectedTooLong = active && !active.connected && now - active.disconnectedAt > DISCONNECT_TURN_MS;
      const connectedTooLong = active?.connected && now - room.turnStartedAt > CONNECTED_TURN_MS;
      if (disconnectedTooLong || connectedTooLong) {
        const targets = room.game.alivePlayers().filter((candidate) => candidate.id !== active.id);
        const target = targets.sort((a, b) => a.hp - b.hp)[0] ?? room.game.activePlayer;
        room.game.shoot(target.id);
        room.lockUntil = now + shotLockDuration(room.game.state.lastEvent);
        room.turnStartedAt = now;
        if (room.game.state.winnerId) room.phase = "finished";
        broadcast(room);
      }
    }

    if (room.players.size === 0 || ([...room.players.values()].every((player) => !player.connected) && now - room.lastTouchedAt > ROOM_IDLE_MS)) {
      rooms.delete(room.code);
    }
  }
}

function maintainPeers(peers, rooms) {
  const now = Date.now();
  for (const peer of peers) {
    if (!peer.alive) {
      peers.delete(peer);
      continue;
    }
    if (now - peer.lastPongAt > PEER_TIMEOUT_MS) {
      disconnectPeer(peer, rooms);
      continue;
    }
    if (now - peer.lastPingAt >= PEER_PING_MS) {
      if (peer.socket.writableLength > MAX_SOCKET_QUEUE_BYTES) {
        disconnectPeer(peer, rooms);
        continue;
      }
      try {
        peer.socket.write(encodeFrame(Buffer.alloc(0), 9));
        peer.lastPingAt = now;
      } catch {
        disconnectPeer(peer, rooms);
      }
    }
  }
}

function ensureHost(room) {
  const current = room.players.get(room.hostId);
  if (current?.connected) return;
  room.hostId = [...room.players.values()].find((player) => player.connected)?.id
    ?? [...room.players.keys()][0]
    ?? null;
}

function compactRoomSeats(room) {
  if (room.phase !== "lobby" || room.players.size === 0) return;
  const previousHostId = room.hostId;
  const ordered = [...room.players.values()].sort((a, b) => a.id.localeCompare(b.id));
  const compacted = new Map();
  let nextHostId = null;

  ordered.forEach((player, index) => {
    const previousId = player.id;
    const nextId = `p${index}`;
    player.id = nextId;
    player.color = PLAYER_COLORS[index];
    if (player.peer) player.peer.playerId = nextId;
    if (previousId === previousHostId) nextHostId = nextId;
    compacted.set(nextId, player);
  });

  room.players = compacted;
  room.hostId = nextHostId ?? ordered.find((player) => player.connected)?.id ?? ordered[0]?.id ?? null;
}

function shotLockDuration(event) {
  const flight = event?.shell === "live" ? SHOT_FLIGHT_MS : 0;
  const nextRound = event?.nextRound ? ROUND_INTRO_MS : 0;
  return SHOT_AIM_MS + flight + SHOT_RECOVERY_MS + nextRound;
}

function firstFreeSeat(room) {
  for (let index = 0; index < room.playerCount; index += 1) {
    const id = `p${index}`;
    if (!room.players.has(id)) return id;
  }
  return null;
}

function makeRoomCode(rooms) {
  let code;
  do {
    code = Array.from({ length: 5 }, () => ROOM_ALPHABET[secureRandomInt(ROOM_ALPHABET.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function sanitizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

function sanitizeName(value) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 18);
}

function sanitizeToken(value) {
  return /^[a-f0-9-]{16,64}$/i.test(String(value || "")) ? String(value) : "";
}

function sanitizePlayerId(value) {
  return /^p[0-3]$/.test(String(value || "")) ? String(value) : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createRouletteServer();
  app.listen().then((address) => {
    const port = typeof address === "object" && address ? address.port : DEFAULT_PORT;
    console.log(`Build Ways Duel Club online: http://127.0.0.1:${port}/`);
  });
}
