import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 4173);

const ROLES = [
  { id: "operator", name: "Operator", color: "#ffd15c" },
  { id: "lookout", name: "Lookout", color: "#6ee7f2" },
  { id: "scribe", name: "Scribe", color: "#ff7aa8" }
];

const MODULES = {
  wires: { id: "wires", name: "СКЛАД", x: 106, y: 86, radius: 48 },
  glyphs: { id: "glyphs", name: "ПУЛЬТ", x: 363, y: 88, radius: 48 },
  coolant: { id: "coolant", name: "СЕРВИС", x: 238, y: 198, radius: 54 }
};

const INCIDENTS = [
  {
    id: "feed",
    title: "РЕАКТОР ПРОГОЛОДАЛСЯ",
    alert: "Ядро требует свежую порцию топлива.",
    station: "wires",
    choices: [
      { id: "banana", symbol: "◆", label: "БАНАН" },
      { id: "orange", symbol: "●", label: "АПЕЛЬСИН" },
      { id: "berries", symbol: "✦", label: "ЯГОДЫ" }
    ]
  },
  {
    id: "leak",
    title: "ТРУБУ ПРОРВАЛО",
    alert: "Давление падает, по полу идёт пар.",
    station: "coolant",
    choices: [
      { id: "valve", symbol: "◎", label: "КЛАПАН" },
      { id: "foam", symbol: "■", label: "ПЕНА" },
      { id: "tape", symbol: "═", label: "ЛЕНТА" }
    ]
  },
  {
    id: "overload",
    title: "ПУЛЬТ ИСКРИТ",
    alert: "Контур питания ушёл в перегрузку.",
    station: "glyphs",
    choices: [
      { id: "breaker", symbol: "↯", label: "РУБИЛЬНИК" },
      { id: "fuse", symbol: "▣", label: "ПРЕДОХРАНИТЕЛЬ" },
      { id: "ground", symbol: "↓", label: "ЗАЗЕМЛЕНИЕ" }
    ]
  },
  {
    id: "fire",
    title: "ВОЗГОРАНИЕ",
    alert: "Один из узлов вспыхнул.",
    station: "coolant",
    choices: [
      { id: "water", symbol: "◆", label: "ВОДА" },
      { id: "foam", symbol: "☁", label: "ПЕНА" },
      { id: "sand", symbol: "▲", label: "ПЕСОК" }
    ]
  },
  {
    id: "bomb",
    title: "УБЕЖАЛА БОМБА",
    alert: "Нестабильный заряд застрял у терминала.",
    station: "glyphs",
    choices: [
      { id: "freeze", symbol: "❄", label: "ЗАМОРОЗИТЬ" },
      { id: "eject", symbol: "➜", label: "ВЫБРОСИТЬ" },
      { id: "disarm", symbol: "✓", label: "РАЗРЯДИТЬ" }
    ]
  }
];

const CHAOS_EFFECTS = [
  { id: "steam", label: "ПАР ЗАКРЫЛ ОБЗОР" },
  { id: "blackout", label: "СВЕТ МИГАЕТ" },
  { id: "slip", label: "ПОЛ СТАЛ СКОЛЬЗКИМ" },
  { id: "alarm", label: "ЛОЖНАЯ ТРЕВОГА" }
];

const SCENARIOS = [
  {
    id: "reactor",
    name: "БИОРЕАКТОР",
    subtitle: "Удержите активную зону",
    background: "./assets/reactor-room-v2.png",
    accent: "#ffd85a",
    music: "reactor",
    durationSec: 240,
    maxMistakes: 6,
    moduleOrder: ["wires", "glyphs", "coolant"],
    moduleNames: { wires: "СКЛАД", glyphs: "ПУЛЬТ", coolant: "СЕРВИС" },
    glyphLength: 3,
    coolantRule: "hot-first",
    coolantManual: "Горячий бак = 1, средний = 2, холодный = 3."
  },
  {
    id: "cryo",
    name: "КРИОХРАНИЛИЩЕ",
    subtitle: "Спасите замороженный образец",
    background: "./assets/cryo-vault-v1.png",
    accent: "#8cecff",
    music: "cryo",
    durationSec: 240,
    maxMistakes: 6,
    moduleOrder: ["coolant", "wires", "glyphs"],
    moduleNames: { wires: "ХОЛОДНЫЙ СКЛАД", glyphs: "КРИОПУЛЬТ", coolant: "ТЕРМОУЗЕЛ" },
    glyphLength: 4,
    coolantRule: "cold-first",
    coolantManual: "Холодный бак = 1, средний = 2, горячий = 3."
  },
  {
    id: "signal",
    name: "УЗЕЛ ДАЛЬНЕЙ СВЯЗИ",
    subtitle: "Поймайте уходящий сигнал",
    background: "./assets/signal-array-v1.png",
    accent: "#70ec8c",
    music: "signal",
    durationSec: 240,
    maxMistakes: 6,
    moduleOrder: ["glyphs", "coolant", "wires"],
    moduleNames: { wires: "СКЛАД АНТЕННЫ", glyphs: "ПУЛЬТ СВЯЗИ", coolant: "РЕТРАНСЛЯТОР" },
    glyphLength: 3,
    coolantRule: "phase-shift",
    coolantManual: "Холодный бак = 2, средний = 3, горячий = 1."
  }
];

const COLOR_BOOK = [
  { id: "red", name: "красный", hex: "#f05252" },
  { id: "blue", name: "голубой", hex: "#4aa3ff" },
  { id: "lime", name: "зелёный", hex: "#7be36d" },
  { id: "gold", name: "жёлтый", hex: "#f7cf4d" },
  { id: "pink", name: "розовый", hex: "#ff78ba" },
  { id: "white", name: "белый", hex: "#f3f0dc" }
];

const SYMBOL_BOOK = [
  { id: "spark", name: "искра" },
  { id: "crown", name: "корона" },
  { id: "coil", name: "спираль" },
  { id: "drop", name: "капля" },
  { id: "eye", name: "глаз" },
  { id: "arrow", name: "стрела" }
];

const RELAY_SYMBOLS = new Set([
  "🟥", "🟦", "🟩", "🟨", "🩷", "⬜",
  "✦", "♛", "◎", "◆", "◉", "➜",
  "A", "B", "C", "1", "2", "3", "4",
  "←", "↑", "↓", "→", "✓", "✕"
]);

const rooms = new Map();
const peers = new Map();

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  filePath = filePath.replaceAll("\\", "/");

  if (filePath.includes("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const absolute = path.join(PUBLIC_DIR, filePath);
  try {
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(absolute);
    res.writeHead(200, {
      "Content-Type": mimeFor(absolute),
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/socket") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
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
    ""
  ].join("\r\n"));

  const peer = {
    id: randomUUID().slice(0, 8),
    socket,
    buffer: Buffer.alloc(0),
    roomCode: null,
    alive: true,
    send(payload) {
      if (!this.alive) return;
      try {
        this.socket.write(encodeFrame(JSON.stringify(payload), 1));
      } catch {
        this.alive = false;
      }
    }
  };

  peers.set(peer.id, peer);
  peer.send({ type: "hello", peerId: peer.id });

  socket.on("data", chunk => readFrames(peer, chunk));
  socket.on("close", () => disconnectPeer(peer));
  socket.on("error", () => disconnectPeer(peer));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Core Below is running at http://localhost:${PORT}`);
});

setInterval(tickRooms, 50);
setInterval(cleanEmptyRooms, 30_000);

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function readFrames(peer, chunk) {
  peer.buffer = Buffer.concat([peer.buffer, chunk]);

  while (peer.buffer.length >= 2) {
    const b0 = peer.buffer[0];
    const b1 = peer.buffer[1];
    const opcode = b0 & 0x0f;
    const masked = Boolean(b1 & 0x80);
    let length = b1 & 0x7f;
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

    const maskOffset = masked ? offset : -1;
    if (masked) offset += 4;
    if (peer.buffer.length < offset + length) return;

    let payload = peer.buffer.subarray(offset, offset + length);
    if (masked) {
      const mask = peer.buffer.subarray(maskOffset, maskOffset + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }

    peer.buffer = peer.buffer.subarray(offset + length);

    if (opcode === 8) {
      disconnectPeer(peer);
      return;
    }

    if (opcode === 9) {
      peer.socket.write(encodeFrame(payload, 10));
      continue;
    }

    if (opcode !== 1) continue;

    try {
      handleMessage(peer, JSON.parse(payload.toString("utf8")));
    } catch {
      peer.send({ type: "error", message: "Bad message" });
    }
  }
}

function encodeFrame(data, opcode = 1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

function handleMessage(peer, message) {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "join") {
    joinRoom(peer, message);
    return;
  }

  const room = rooms.get(peer.roomCode);
  const player = room?.players.get(peer.id);
  if (!room || !player) {
    peer.send({ type: "error", message: "Join a room first" });
    return;
  }

  if (message.type === "start") {
    requestRoomStart(room, player);
  } else if (message.type === "setRole") {
    setRole(room, player, String(message.role || ""));
  } else if (message.type === "tutorialRole") {
    setTutorialRole(room, player, String(message.role || ""));
  } else if (message.type === "input") {
    player.input = normalizeInput(message.input);
  } else if (message.type === "interact") {
    handleInteraction(room, player, message);
  } else if (message.type === "chat") {
    if (player.role === "scribe") {
      player.peer.send({ type: "error", message: "Голосовой модуль архивариуса отключен: используйте сигналы" });
      return;
    }
    triggerPlayerAction(player, "communicate");
    addLog(room, `${player.nick}: ${sanitize(message.text, 140)}`, "chat");
  } else if (message.type === "ping") {
    if (player.role === "scribe") {
      player.peer.send({ type: "error", message: "Архивариус передает только символы" });
      return;
    }
    triggerPlayerAction(player, "communicate");
    addLog(room, `${player.nick}: ${sanitize(message.text, 70)}`, "ping");
  } else if (message.type === "symbol") {
    sendSymbolRelay(room, player, message.tokens);
  }
}

function joinRoom(peer, message) {
  leaveRoom(peer);

  const tutorial = message.tutorial === true;
  const requested = tutorial ? "" : sanitizeCode(message.roomCode);
  const code = requested || makeRoomCode();
  let room = tutorial ? null : rooms.get(code);

  if (!room) {
    room = createRoom(code, tutorial);
    rooms.set(code, room);
  }

  const role = tutorial ? "lookout" : firstFreeRole(room) || "observer";
  const spawn = spawnFor(role, room.players.size);
  const player = {
    id: peer.id,
    peer,
    nick: sanitize(message.name, 18) || `Player ${room.players.size + 1}`,
    role,
    x: spawn.x,
    y: spawn.y,
    facing: "down",
    action: null,
    actionSeq: 0,
    actionStartedAt: 0,
    actionUntil: 0,
    input: normalizeInput({}),
    connectedAt: Date.now()
  };

  peer.roomCode = code;
  room.players.set(peer.id, player);
  if (!room.hostId) room.hostId = player.id;
  addLog(room, tutorial ? "Учебный канал открыт." : `${player.nick} вошел в смену как ${roleName(role)}.`, "system");
  if (tutorial) startRoom(room);
  else broadcast(room);
}

function createRoom(code, tutorial = false) {
  return {
    code,
    tutorial,
    phase: "lobby",
    hostId: null,
    players: new Map(),
    puzzle: null,
    shiftId: null,
    mistakes: 0,
    maxMistakes: 3,
    startedAt: 0,
    deadline: 0,
    endedAt: 0,
    outcomeReason: null,
    timeLeftAtEnd: 0,
    scenarioId: null,
    scenario: null,
    scenarioQueue: [],
    logs: [],
    lastTick: Date.now()
  };
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function sanitizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function sanitize(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, max);
}

function firstFreeRole(room) {
  const taken = new Set([...room.players.values()].map(player => player.role));
  return ROLES.find(role => !taken.has(role.id))?.id;
}

function setRole(room, player, roleId) {
  if (room.phase !== "lobby") return;
  if (!ROLES.some(role => role.id === roleId)) return;
  const occupied = [...room.players.values()].some(other => other.id !== player.id && other.role === roleId);
  if (occupied) return;

  player.role = roleId;
  const spawn = spawnFor(roleId, 0);
  player.x = spawn.x;
  player.y = spawn.y;
  player.facing = "down";
  addLog(room, `${player.nick} сменил роль: ${roleName(roleId)}.`, "system");
  broadcast(room);
}

function setTutorialRole(room, player, roleId) {
  if (!room.tutorial || room.phase !== "playing") return;
  if (!ROLES.some(role => role.id === roleId)) return;

  player.role = roleId;
  const spawn = spawnFor(roleId, 0);
  player.x = spawn.x;
  player.y = spawn.y;
  player.facing = "down";
  player.input = normalizeInput({});
  triggerPlayerAction(player, roleId === "lookout" ? "scan" : roleId === "scribe" ? "record" : "communicate");
  addLog(room, `Куратор: режим «${roleName(roleId)}».`, "system");
  broadcast(room);
}

function sendSymbolRelay(room, player, rawTokens) {
  if (player.role !== "scribe") {
    player.peer.send({ type: "error", message: "Символьный канал доступен только архивариусу" });
    return;
  }

  const tokens = Array.isArray(rawTokens)
    ? rawTokens.slice(0, 7).map(token => String(token)).filter(token => RELAY_SYMBOLS.has(token))
    : [];
  if (tokens.length === 0) return;
  triggerPlayerAction(player, "communicate");
  addLog(room, `${player.nick}: ${tokens.join(" ")}`, "symbol");
}

function requestRoomStart(room, player) {
  if (room.tutorial) return;
  if (room.hostId !== player.id) {
    player.peer.send({ type: "error", message: "Только командир комнаты может начать смену" });
    return;
  }
  if (!['lobby', 'won', 'lost'].includes(room.phase)) {
    player.peer.send({ type: "error", message: "Текущая смена еще не завершена" });
    return;
  }
  if (!crewIsReady(room)) {
    player.peer.send({ type: "error", message: "Для старта нужны оператор, наблюдатель и архивариус" });
    return;
  }
  startRoom(room);
}

function crewIsReady(room) {
  const occupied = new Set([...room.players.values()].map(player => player.role));
  return ROLES.every(role => occupied.has(role.id));
}

function startRoom(room) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const scenario = room.tutorial ? SCENARIOS[0] : chooseScenario(room);
  room.phase = "playing";
  room.shiftId = randomUUID();
  room.scenarioId = scenario.id;
  room.scenario = scenario;
  room.puzzle = makePartyShift(seed, scenario, room.tutorial);
  room.mistakes = 0;
  room.maxMistakes = room.tutorial ? 99 : scenario.maxMistakes;
  room.startedAt = Date.now();
  room.deadline = room.startedAt + (room.tutorial ? 90_000 : scenario.durationSec * 1000);
  room.endedAt = 0;
  room.outcomeReason = null;
  room.timeLeftAtEnd = 0;

  for (const player of room.players.values()) {
    const spawn = spawnFor(player.role, 0);
    player.x = spawn.x;
    player.y = spawn.y;
    player.facing = "down";
    player.action = null;
    player.actionStartedAt = 0;
    player.actionUntil = 0;
    player.input = normalizeInput({});
  }

  addLog(room, room.tutorial ? "Куратор: нажмите «Сканировать аварию»." : `${scenario.name}: началась весёлая аварийная смена.`, "system");
  broadcast(room);
}

function makePartyShift(seed, scenario, tutorial = false) {
  const rng = mulberry32(seed);
  const source = tutorial ? [INCIDENTS[0]] : shuffle(INCIDENTS, rng).slice(0, 4);
  const incidents = source.map((blueprint, index) => {
    const solutionIndex = tutorial ? 0 : Math.floor(rng() * blueprint.choices.length);
    return {
      ...blueprint,
      id: `${blueprint.id}-${index + 1}`,
      choices: blueprint.choices.map(choice => ({ ...choice })),
      solutionId: blueprint.choices[solutionIndex].id
    };
  });

  return {
    seed,
    serial: tutorial ? "TRY-01" : `${scenario.id.toUpperCase()}-${100 + Math.floor(rng() * 900)}`,
    incidents,
    currentIndex: 0,
    resolvedCount: 0,
    lookoutScanned: false,
    routeReady: false,
    signalReady: false,
    signalId: null,
    incidentStartedAt: Date.now(),
    incidentDurationSec: tutorial ? 90 : 55,
    chaos: null,
    chaosUntil: 0,
    lastResolved: null,
    lastResolvedAt: 0
  };
}

function chooseScenario(room) {
  if (room.scenarioQueue.length === 0) {
    room.scenarioQueue = shuffle(SCENARIOS.map(scenario => scenario.id), Math.random);
    if (room.scenarioQueue[0] === room.scenarioId) {
      const swapIndex = room.scenarioQueue.findIndex(id => id !== room.scenarioId);
      [room.scenarioQueue[0], room.scenarioQueue[swapIndex]] = [room.scenarioQueue[swapIndex], room.scenarioQueue[0]];
    }
  }

  const nextId = room.scenarioQueue.shift();
  return SCENARIOS.find(scenario => scenario.id === nextId) || SCENARIOS[0];
}

function tickRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    const dt = Math.min(0.08, (now - room.lastTick) / 1000);
    room.lastTick = now;

    if (room.phase === "playing") {
      for (const player of room.players.values()) {
        movePlayer(room, player, dt);
      }

      if (!room.tutorial && now >= room.deadline) {
        finishRoom(room, "lost", "timeout", "Время вышло. Реактор разрушен.", "danger");
      } else if (!room.tutorial && room.puzzle && now - room.puzzle.incidentStartedAt >= room.puzzle.incidentDurationSec * 1000) {
        room.puzzle.incidentStartedAt = now;
        addChaos(room, "Команда слишком долго ждала: авария усилилась.", "alarm");
      }
    }

    broadcast(room);
  }
}

function movePlayer(room, player, dt) {
  if (player.role === "lookout") {
    player.input = normalizeInput({});
    return;
  }
  const input = player.input || normalizeInput({});
  let vx = 0;
  let vy = 0;
  if (input.left) vx -= 1;
  if (input.right) vx += 1;
  if (input.up) vy -= 1;
  if (input.down) vy += 1;
  if (Math.abs(vx) > Math.abs(vy)) player.facing = vx < 0 ? "left" : "right";
  else if (vy < 0) player.facing = "up";
  else if (vy > 0) player.facing = "down";
  const length = Math.hypot(vx, vy) || 1;
  const slowed = room.puzzle?.chaosUntil > Date.now() && ["steam", "slip"].includes(room.puzzle.chaos?.id);
  const speed = (player.role === "scribe" ? 58 : 76) * (slowed ? 0.72 : 1);
  player.x = clamp(player.x + (vx / length) * speed * dt, 22, 458);
  player.y = clamp(player.y + (vy / length) * speed * dt, 34, 242);
}

function normalizeInput(input) {
  return {
    up: Boolean(input?.up),
    down: Boolean(input?.down),
    left: Boolean(input?.left),
    right: Boolean(input?.right)
  };
}

function handleInteraction(room, player, message) {
  if (room.phase !== "playing" || !room.puzzle) return;
  const incident = currentIncident(room.puzzle);
  if (!incident) return;

  if (message.action === "scan") {
    if (player.role !== "lookout" || room.puzzle.lookoutScanned) return;
    room.puzzle.lookoutScanned = true;
    triggerPlayerAction(player, "scan");
    addLog(room, `${player.nick}: авария найдена — ${room.scenario.moduleNames[incident.station]}.`, "success");
    return;
  }

  if (message.action === "route") {
    if (player.role !== "lookout" || !room.puzzle.lookoutScanned || room.puzzle.routeReady) return;
    room.puzzle.routeReady = true;
    triggerPlayerAction(player, "communicate");
    addLog(room, `${player.nick}: маршрут отмечен. Архивариус, дайте символ.`, "ping");
    if (room.tutorial) setTutorialRole(room, player, "scribe");
    return;
  }

  if (message.action === "signal") {
    if (player.role !== "scribe" || !room.puzzle.routeReady || room.puzzle.signalReady) return;
    const choice = incident.choices.find(item => item.id === String(message.choice || ""));
    if (!choice) return;
    triggerPlayerAction(player, "communicate");
    if (choice.id !== incident.solutionId) {
      addChaos(room, `${player.nick} передал неверный символ.`, null);
      return;
    }
    room.puzzle.signalReady = true;
    room.puzzle.signalId = choice.id;
    addLog(room, `${player.nick}: ${choice.symbol} — сигнал передан оператору.`, "symbol");
    if (room.tutorial) setTutorialRole(room, player, "operator");
    return;
  }

  if (message.action === "resolve") {
    if (player.role !== "operator") return;
    if (!room.puzzle.routeReady || !room.puzzle.signalReady) {
      player.peer.send({ type: "error", message: "Сначала дождитесь маршрута и символа команды" });
      return;
    }
    const module = MODULES[incident.station];
    if (!module || distance(player, module) > module.radius) return;
    const choice = incident.choices.find(item => item.id === String(message.choice || ""));
    if (!choice) return;
    triggerPlayerAction(player, incident.station);
    if (choice.id !== incident.solutionId) {
      addChaos(room, `${player.nick} применил не тот инструмент.`, null);
      return;
    }
    resolveIncident(room, player, incident, choice);
  }
}

function currentIncident(puzzle) {
  return puzzle?.incidents?.[puzzle.currentIndex] || null;
}

function resolveIncident(room, player, incident, choice) {
  const now = Date.now();
  room.puzzle.resolvedCount += 1;
  room.puzzle.lastResolved = { title: incident.title, symbol: choice.symbol, label: choice.label };
  room.puzzle.lastResolvedAt = now;
  addLog(room, `${player.nick}: ${incident.title.toLowerCase()} устранена!`, "success");

  if (room.puzzle.resolvedCount >= room.puzzle.incidents.length) {
    finishRoom(room, "won", "crew_saved", "Все аварии устранены. Экипаж спас смену!", "success");
    return;
  }

  room.puzzle.currentIndex += 1;
  room.puzzle.lookoutScanned = false;
  room.puzzle.routeReady = false;
  room.puzzle.signalReady = false;
  room.puzzle.signalId = null;
  room.puzzle.incidentStartedAt = now;
  addLog(room, "Новая авария! Наблюдатель, запускайте сканер.", "system");
}

function addChaos(room, text, forcedEffect = null) {
  if (room.phase !== "playing") return;
  room.mistakes += 1;
  const effect = CHAOS_EFFECTS.find(item => item.id === forcedEffect)
    || CHAOS_EFFECTS[Math.floor(Math.random() * CHAOS_EFFECTS.length)];
  room.puzzle.chaos = effect;
  room.puzzle.chaosUntil = Date.now() + 4200;
  addLog(room, `${text} ${effect.label}. Сбой ${room.mistakes}/${room.maxMistakes}.`, "danger");
  if (!room.tutorial && room.mistakes >= room.maxMistakes) {
    finishRoom(room, "lost", "mistakes", "Слишком много сбоев. Реактор разрушен.", "danger");
  }
}

function triggerPlayerAction(player, action) {
  const now = Date.now();
  player.action = String(action || "interact");
  player.actionSeq = (player.actionSeq || 0) + 1;
  player.actionStartedAt = now;
  player.actionUntil = now + 900;
}

function cutWire(room, player, slot) {
  const wires = room.puzzle.modules.wires;
  if (wires.solved || !Number.isInteger(slot)) return;
  const wire = wires.items.find(item => item.slot === slot);
  if (!wire || wire.cut) return;
  wire.cut = true;

  if (slot === wires.solutionSlot) {
    wires.solved = true;
    addLog(room, `${player.nick}: нужный провод отключен.`, "success");
  } else {
    addMistake(room, `Неверный провод: гнездо ${slot}.`);
  }
}

function pressGlyph(room, player, slot) {
  const glyphs = room.puzzle.modules.glyphs;
  if (glyphs.solved || !Number.isInteger(slot)) return;
  const glyph = glyphs.items.find(item => item.slot === slot);
  if (!glyph) return;

  const needed = glyphs.solution[glyphs.pressed.length];
  if (glyph.symbol === needed) {
    glyphs.pressed.push(glyph.symbol);
    addLog(room, `${player.nick}: пластина ${slot}.`, "system");
    if (glyphs.pressed.length === glyphs.solution.length) {
      glyphs.solved = true;
      addLog(room, "Замок знаков открыт.", "success");
    }
  } else {
    glyphs.pressed = [];
    addMistake(room, `Пластина ${slot} сбила последовательность.`);
  }
}

function cycleCoolant(room, label) {
  const coolant = room.puzzle.modules.coolant;
  if (coolant.solved) return;
  const tank = coolant.tanks.find(item => item.label === label);
  if (!tank) return;
  tank.value = (tank.value + 1) % 4;
  addLog(room, `Клапан ${label}: ${tank.value}.`, "system");
}

function commitCoolant(room, player) {
  const coolant = room.puzzle.modules.coolant;
  if (coolant.solved) return;
  const correct = coolant.tanks.every(tank => tank.value === coolant.target[tank.label]);
  if (correct) {
    coolant.solved = true;
    addLog(room, `${player.nick}: контур охлаждения сбалансирован.`, "success");
  } else {
    addMistake(room, "Неверный баланс контура.");
  }
}

function addMistake(room, text) {
  room.mistakes += 1;
  addLog(room, `${text} Ошибка ${room.mistakes}/${room.maxMistakes}.`, "danger");
  if (room.mistakes >= room.maxMistakes) {
    finishRoom(room, "lost", "mistakes", "Слишком много ошибок. Реактор разрушен.", "danger");
  }
}

function checkWin(room) {
  if (!room.puzzle || room.phase !== "playing") return;
  const modules = room.puzzle.modules;
  if (modules.wires.solved && modules.glyphs.solved && modules.coolant.solved) {
    finishRoom(room, "won", "stabilized", "Реактор стабилен. Смена завершена.", "success");
  }
}

function finishRoom(room, phase, reason, message, tone) {
  if (room.phase !== "playing") return;
  const now = Date.now();
  room.phase = phase;
  room.endedAt = now;
  room.outcomeReason = reason;
  room.timeLeftAtEnd = Math.max(0, Math.ceil((room.deadline - now) / 1000));
  for (const player of room.players.values()) player.input = normalizeInput({});
  addLog(room, message, tone);
}

function makeTutorialPuzzle(scenario) {
  const wires = [
    { slot: 1, color: "red", colorName: "красный", colorHex: "#ff3535", cut: false },
    { slot: 2, color: "blue", colorName: "голубой", colorHex: "#62e5e5", cut: false },
    { slot: 3, color: "lime", colorName: "зелёный", colorHex: "#6eea87", cut: false },
    { slot: 4, color: "gold", colorName: "жёлтый", colorHex: "#f4d85a", cut: false }
  ];
  const glyphs = [
    { slot: 1, symbol: "spark", symbolName: "искра" },
    { slot: 2, symbol: "crown", symbolName: "корона" },
    { slot: 3, symbol: "coil", symbolName: "спираль" },
    { slot: 4, symbol: "drop", symbolName: "капля" }
  ];
  const tanks = [
    { label: "A", temp: 2, value: 0 },
    { label: "B", temp: 6, value: 0 },
    { label: "C", temp: 4, value: 0 }
  ];

  return {
    seed: 1,
    serial: "TR-001",
    moduleOrder: [...scenario.moduleOrder],
    rules: {
      wire: "Отключить провод цвета: голубой.",
      glyph: "Порядок: спираль, искра, корона.",
      coolant: scenario.coolantManual
    },
    modules: {
      wires: { solved: false, items: wires, targetColor: "blue", targetColorName: "голубой", solutionSlot: 2 },
      glyphs: { solved: false, items: glyphs, solution: ["coil", "spark", "crown"], pressed: [] },
      coolant: { solved: false, tanks, target: { A: 3, B: 1, C: 2 } }
    }
  };
}

function makePuzzle(seed, scenario) {
  const rng = mulberry32(seed);
  const colors = shuffle(COLOR_BOOK, rng).slice(0, 4);
  const targetColor = colors[Math.floor(rng() * colors.length)];
  const serial = `${pick("BCDFGHJKLMNPQRSTVWXYZ", rng)}${pick("AEIOU", rng)}-${100 + Math.floor(rng() * 900)}`;
  const wires = colors.map((color, index) => ({
    slot: index + 1,
    color: color.id,
    colorName: color.name,
    colorHex: color.hex,
    cut: false
  }));

  const glyphs = shuffle(SYMBOL_BOOK, rng).slice(0, 4).map((symbol, index) => ({
    slot: index + 1,
    symbol: symbol.id,
    symbolName: symbol.name
  }));
  const solution = shuffle(glyphs, rng).slice(0, scenario.glyphLength).map(glyph => glyph.symbol);

  const temps = shuffle([2, 4, 6], rng);
  const tanks = ["A", "B", "C"].map((label, index) => ({
    label,
    temp: temps[index],
    value: 0
  }));
  const target = coolantTargetFor(tanks, scenario.coolantRule);

  return {
    seed,
    serial,
    moduleOrder: [...scenario.moduleOrder],
    rules: {
      wire: wireRuleText(scenario, targetColor.name),
      glyph: glyphRuleText(scenario, solution),
      coolant: scenario.coolantManual
    },
    modules: {
      wires: {
        solved: false,
        items: wires,
        targetColor: targetColor.id,
        targetColorName: targetColor.name,
        solutionSlot: wires.find(wire => wire.color === targetColor.id).slot
      },
      glyphs: {
        solved: false,
        items: glyphs,
        solution,
        pressed: []
      },
      coolant: {
        solved: false,
        tanks,
        target
      }
    }
  };
}

function coolantTargetFor(tanks, rule) {
  const ascending = [...tanks].sort((a, b) => a.temp - b.temp);
  const values = rule === "hot-first" ? [3, 2, 1] : rule === "phase-shift" ? [2, 3, 1] : [1, 2, 3];
  return Object.fromEntries(ascending.map((tank, index) => [tank.label, values[index]]));
}

function wireRuleText(scenario, targetColor) {
  if (scenario.id === "cryo") return `Разморозить контур цвета: ${targetColor}.`;
  if (scenario.id === "signal") return `Отключить волновод цвета: ${targetColor}.`;
  return `Отключить провод цвета: ${targetColor}.`;
}

function glyphRuleText(scenario, solution) {
  const sequence = solution.map(symbolName).join(", ");
  if (scenario.id === "cryo") return `Порядок криопечатей: ${sequence}.`;
  if (scenario.id === "signal") return `Частотная последовательность: ${sequence}.`;
  return `Порядок: ${sequence}.`;
}

function buildState(room, player) {
  const now = Date.now();
  return {
    type: "state",
    selfId: player.id,
    room: {
      code: room.code,
      tutorial: room.tutorial,
      phase: room.phase,
      shiftId: room.shiftId,
      isHost: room.hostId === player.id,
      crewReady: crewIsReady(room),
      elapsedSeconds: room.startedAt
        ? Math.max(0, Math.floor(((room.endedAt || now) - room.startedAt) / 1000))
        : 0,
      timer: room.phase === "playing"
        ? Math.max(0, Math.ceil((room.deadline - now) / 1000))
        : room.phase === "won" ? room.timeLeftAtEnd : 0,
      mistakes: room.mistakes,
      maxMistakes: room.maxMistakes,
      outcomeReason: room.outcomeReason,
      outcomeAgeMs: room.endedAt ? Math.max(0, now - room.endedAt) : 0,
      scenario: room.scenario ? {
        id: room.scenario.id,
        name: room.scenario.name,
        subtitle: room.scenario.subtitle,
        background: room.scenario.background,
        accent: room.scenario.accent,
        music: room.scenario.music,
        durationSec: room.tutorial ? 90 : room.scenario.durationSec
      } : null,
      modules: Object.fromEntries(Object.entries(MODULES).map(([id, module]) => [id, {
        ...module,
        name: room.scenario?.moduleNames[id] || module.name
      }])),
      roles: ROLES,
      logs: room.logs.slice(-18),
      players: [...room.players.values()].map(other => ({
        id: other.id,
        nick: other.nick,
        role: other.role,
        roleName: roleName(other.role),
        isHost: other.id === room.hostId,
        x: Math.round(other.x),
        y: Math.round(other.y),
        facing: other.facing || "down",
        moving: Object.values(other.input || {}).some(Boolean),
        action: other.action && now < other.actionUntil ? other.action : null,
        actionSeq: other.actionSeq || 0,
        actionAgeMs: other.action && now < other.actionUntil ? now - other.actionStartedAt : 0
      })),
      puzzleView: room.puzzle ? partyViewFor(room.puzzle, player.role, room.tutorial) : null
    }
  };
}

function partyViewFor(puzzle, role, tutorial = false) {
  const now = Date.now();
  const incident = currentIncident(puzzle);
  const common = {
    role,
    progress: {
      resolvedCount: puzzle.resolvedCount,
      totalIncidents: puzzle.incidents.length,
      incidentIndex: puzzle.currentIndex,
      activeModule: incident?.station || null,
      moduleOrder: puzzle.incidents.map(item => item.station)
    },
    phase: !puzzle.lookoutScanned
      ? "scan"
      : !puzzle.routeReady
        ? "route"
        : !puzzle.signalReady ? "signal" : "action",
    team: {
      scanned: puzzle.lookoutScanned,
      routeReady: puzzle.routeReady,
      signalReady: puzzle.signalReady,
      signalId: puzzle.signalId
    },
    incidentTimer: Math.max(0, Math.ceil((puzzle.incidentDurationSec * 1000 - (now - puzzle.incidentStartedAt)) / 1000)),
    chaos: puzzle.chaosUntil > now ? { ...puzzle.chaos, remainingMs: puzzle.chaosUntil - now } : null,
    lastResolved: puzzle.lastResolvedAt && now - puzzle.lastResolvedAt < 1800 ? puzzle.lastResolved : null,
    incident: incident ? {
      id: incident.id,
      title: incident.title,
      alert: incident.alert,
      station: incident.station
    } : null
  };

  if (!incident) return common;

  if (role === "lookout") {
    return {
      ...common,
      scanner: puzzle.lookoutScanned ? {
        station: incident.station,
        alert: incident.alert
      } : null
    };
  }

  if (role === "scribe") {
    const solution = incident.choices.find(choice => choice.id === incident.solutionId);
    return {
      ...common,
      manual: puzzle.routeReady ? {
        solution: { ...solution },
        choices: incident.choices.map(choice => ({ ...choice }))
      } : null
    };
  }

  if (role === "operator") {
    const solution = incident.choices.find(choice => choice.id === incident.solutionId);
    return {
      ...common,
      choices: incident.choices.map(choice => ({ ...choice })),
      training: tutorial ? { solution: { ...solution } } : undefined
    };
  }

  return { ...common, observer: true };
}

function puzzleViewFor(puzzle, role, tutorial = false) {
  const activeModule = puzzle.moduleOrder.find(id => !puzzle.modules[id].solved) || null;
  const progress = {
    serial: puzzle.serial,
    wiresSolved: puzzle.modules.wires.solved,
    glyphsSolved: puzzle.modules.glyphs.solved,
    coolantSolved: puzzle.modules.coolant.solved,
    glyphProgress: puzzle.modules.glyphs.pressed.length,
    moduleOrder: [...puzzle.moduleOrder],
    activeModule
  };

  if (role === "operator") {
    const view = {
      role,
      progress,
      wires: puzzle.modules.wires.items.map(wire => ({ slot: wire.slot, cut: wire.cut })),
      glyphs: puzzle.modules.glyphs.items.map(glyph => ({ slot: glyph.slot })),
      coolant: puzzle.modules.coolant.tanks.map(tank => ({ label: tank.label, value: tank.value }))
    };
    if (tutorial) {
      view.training = {
        wireColor: puzzle.modules.wires.targetColor,
        wireSlot: puzzle.modules.wires.solutionSlot,
        wires: puzzle.modules.wires.items.map(wire => ({
          slot: wire.slot,
          color: wire.color,
          colorHex: wire.colorHex
        })),
        glyphs: [...puzzle.modules.glyphs.solution],
        glyphSlots: puzzle.modules.glyphs.solution.map(symbol => puzzle.modules.glyphs.items.find(item => item.symbol === symbol).slot),
        glyphItems: puzzle.modules.glyphs.items.map(glyph => ({ slot: glyph.slot, symbol: glyph.symbol })),
        coolant: puzzle.modules.coolant.tanks.map(tank => ({
          label: tank.label,
          temp: tank.temp,
          target: puzzle.modules.coolant.target[tank.label]
        }))
      };
    }
    return view;
  }

  if (role === "lookout") {
    return {
      role,
      progress,
      scanner: {
        wires: puzzle.modules.wires.items.map(wire => ({
          slot: wire.slot,
          color: wire.color,
          colorName: wire.colorName,
          colorHex: wire.colorHex,
          cut: wire.cut
        })),
        glyphs: puzzle.modules.glyphs.items.map(glyph => ({
          slot: glyph.slot,
          symbol: glyph.symbol,
          symbolName: glyph.symbolName
        })),
        coolant: puzzle.modules.coolant.tanks.map(tank => ({
          label: tank.label,
          temp: tank.temp,
          value: tank.value
        }))
      }
    };
  }

  if (role === "scribe") {
    return {
      role,
      progress,
      manual: {
        wire: puzzle.rules.wire,
        glyph: puzzle.rules.glyph,
        coolant: puzzle.rules.coolant
      }
    };
  }

  return {
    role,
    progress,
    observer: true
  };
}

function addLog(room, text, tone = "system") {
  room.logs.push({ text, tone, time: Date.now() });
  room.logs = room.logs.slice(-30);
}

function broadcast(room) {
  for (const player of room.players.values()) {
    player.peer.send(buildState(room, player));
  }
}

function leaveRoom(peer) {
  if (!peer.roomCode) return;
  const room = rooms.get(peer.roomCode);
  if (room) {
    const player = room.players.get(peer.id);
    if (player) addLog(room, `${player.nick} left.`, "system");
    room.players.delete(peer.id);
    if (room.hostId === peer.id) {
      const nextHost = [...room.players.values()].sort((a, b) => a.connectedAt - b.connectedAt)[0];
      room.hostId = nextHost?.id || null;
      if (nextHost) addLog(room, `${nextHost.nick} теперь командир комнаты.`, "system");
    }
    if (room.players.size > 0) broadcast(room);
  }
  peer.roomCode = null;
}

function disconnectPeer(peer) {
  if (!peer.alive) return;
  peer.alive = false;
  leaveRoom(peer);
  peers.delete(peer.id);
  try {
    peer.socket.destroy();
  } catch {
    // Already closed.
  }
}

function cleanEmptyRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.players.size === 0 && now - room.lastTick > 60_000) {
      rooms.delete(code);
    }
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function spawnFor(role, fallbackIndex) {
  if (role === "operator") return { x: 126, y: 158 };
  if (role === "lookout") return { x: 236, y: 76 };
  if (role === "scribe") return { x: 348, y: 158 };
  return { x: 80 + fallbackIndex * 28, y: 210 };
}

function roleName(roleId) {
  return ({ operator: "оператор", lookout: "наблюдатель", scribe: "архивариус" })[roleId] || "наблюдатель";
}

function symbolName(symbolId) {
  return SYMBOL_BOOK.find(symbol => symbol.id === symbolId)?.name || symbolId;
}

function pick(chars, rng) {
  return chars[Math.floor(rng() * chars.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(source, rng) {
  const output = [...source];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
