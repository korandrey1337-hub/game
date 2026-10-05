const TOKEN_STORAGE_KEY = "rouletteClubOnlineTokens:v1";
const NAME_STORAGE_KEY = "rouletteClubOnlineName:v1";

export class OnlineClient extends EventTarget {
  constructor({ endpoint = socketEndpoint(), storage = globalThis.localStorage ?? null } = {}) {
    super();
    this.endpoint = endpoint;
    this.storage = storage;
    this.socket = null;
    this.joinRequest = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.closedByUser = false;
    this.room = null;
    this.playerId = null;
  }

  join({ name, roomCode = "", create = false, playerCount = 2, weaponSkin = "revolver" }) {
    const code = normalizeCode(roomCode);
    const playerName = sanitizeName(name);
    const savedSession = code ? normalizeSavedSession(this.loadTokens()[code]) : null;
    this.closedByUser = false;
    this.joinRequest = {
      type: "join",
      name: playerName,
      roomCode: code,
      create,
      playerCount: Number(playerCount) === 4 ? 4 : 2,
      weaponSkin: weaponSkin === "shotgun" ? "shotgun" : "revolver",
      resumeToken: savedSession?.name === playerName ? savedSession.token : "",
    };
    this.saveName(this.joinRequest.name);
    this.open();
  }

  open() {
    clearTimeout(this.reconnectTimer);
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close();

    this.emit("status", { status: "connecting" });
    const socket = new WebSocket(this.endpoint);
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (socket !== this.socket) return;
      this.reconnectAttempts = 0;
      this.emit("status", { status: "connected" });
      if (this.joinRequest) socket.send(JSON.stringify(this.joinRequest));
    });

    socket.addEventListener("message", (event) => {
      if (socket !== this.socket) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handleMessage(message);
    });

    socket.addEventListener("close", () => {
      if (socket !== this.socket) return;
      this.emit("status", { status: this.closedByUser ? "offline" : "reconnecting" });
      if (!this.closedByUser && this.joinRequest) this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      if (socket !== this.socket) return;
      this.emit("status", { status: "error" });
    });
  }

  handleMessage(message) {
    if (message.type === "welcome") {
      this.playerId = message.playerId;
      if (message.roomCode && message.resumeToken) {
        const tokens = this.loadTokens();
        tokens[message.roomCode] = {
          token: message.resumeToken,
          name: this.joinRequest?.name || "Игрок",
        };
        this.saveTokens(tokens);
        if (this.joinRequest) {
          this.joinRequest.roomCode = message.roomCode;
          this.joinRequest.resumeToken = message.resumeToken;
          this.joinRequest.create = false;
        }
      }
      this.emit("welcome", message);
      return;
    }

    if (message.type === "state") {
      this.room = message.room;
      this.playerId = message.room?.selfId ?? this.playerId;
      this.emit("state", message.room);
      return;
    }

    if (message.type === "error") {
      this.emit("error", { message: message.message || "Ошибка онлайн-комнаты" });
    }
  }

  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.emit("error", { message: "Нет соединения с игровым столом" });
      return false;
    }
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  leave() {
    this.closedByUser = true;
    clearTimeout(this.reconnectTimer);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "leave" }));
    }
    this.socket?.close();
    this.socket = null;
    this.joinRequest = null;
    this.room = null;
    this.playerId = null;
    this.emit("status", { status: "offline" });
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(8000, 700 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  savedName() {
    try {
      return sanitizeName(this.storage?.getItem(NAME_STORAGE_KEY) || "");
    } catch {
      return "";
    }
  }

  saveName(name) {
    try {
      this.storage?.setItem(NAME_STORAGE_KEY, name);
    } catch {
      // A blocked storage write should not prevent online play.
    }
  }

  loadTokens() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(TOKEN_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  saveTokens(tokens) {
    try {
      this.storage?.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    } catch {
      // Reconnect tokens are optional when storage is unavailable.
    }
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export function socketEndpoint(location = globalThis.location) {
  const configured = globalThis.ROULETTE_SOCKET_URL;
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  const protocol = location?.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location?.host || "127.0.0.1:5174"}/socket`;
}

function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function sanitizeName(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 18) || "Игрок";
}

function normalizeSavedSession(value) {
  if (typeof value === "string") return { token: value, name: "" };
  if (!value || typeof value !== "object") return null;
  return {
    token: typeof value.token === "string" ? value.token : "",
    name: sanitizeName(value.name),
  };
}
