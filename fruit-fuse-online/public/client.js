import { CoreBelowStats } from "./stats.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const canvasStage = document.querySelector(".canvas-stage");
const bootScreen = document.querySelector("#bootScreen");
const gameShell = document.querySelector("#gameShell");
const joinButton = document.querySelector("#joinButton");
const tutorialButton = document.querySelector("#tutorialButton");
const connectionStatus = document.querySelector("#connectionStatus");
const menuButton = document.querySelector("#menuButton");
const audioButton = document.querySelector("#audioButton");
const startButton = document.querySelector("#startButton");
const endButton = document.querySelector("#endButton");
const lobbyHint = document.querySelector("#lobbyHint");
const nameInput = document.querySelector("#nameInput");
const roomInput = document.querySelector("#roomInput");
const roomCode = document.querySelector("#roomCode");
const roleName = document.querySelector("#roleName");
const scenarioName = document.querySelector("#scenarioName");
const timer = document.querySelector("#timer");
const strikes = document.querySelector("#strikes");
const moduleDots = document.querySelector("#moduleDots");
const storyLine = document.querySelector("#storyLine");
const consoleKicker = document.querySelector("#consoleKicker");
const consoleTitle = document.querySelector("#consoleTitle");
const keyHelp = document.querySelector(".key-help");
const lobbyPanel = document.querySelector("#lobbyPanel");
const tutorialRoleBar = document.querySelector("#tutorialRoleBar");
const workPanel = document.querySelector("#workPanel");
const relayPanel = document.querySelector("#relayPanel");
const players = document.querySelector("#players");
const roleButtons = document.querySelector("#roleButtons");
const objectiveCard = document.querySelector("#tutorialCard");
const intelPanel = document.querySelector("#intelPanel");
const actionPanel = document.querySelector("#actionPanel");
const proximityHint = document.querySelector("#proximityHint");
const crewCount = document.querySelector("#crewCount");
const log = document.querySelector("#log");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const quickPings = document.querySelector("#quickPings");
const routeControls = document.querySelector("#routeControls");
const touchControls = document.querySelector(".touch");
const quickPingButtons = [...document.querySelectorAll("#quickPings [data-ping]")];
const pingButtons = [...document.querySelectorAll("[data-ping]")];
const symbolRelay = document.querySelector("#symbolRelay");
const symbolDraftView = document.querySelector("#symbolDraft");
const symbolPalette = document.querySelector("#symbolPalette");
const symbolClear = document.querySelector("#symbolClear");
const symbolSend = document.querySelector("#symbolSend");
const endOverlay = document.querySelector("#endOverlay");
const endKicker = document.querySelector("#endKicker");
const endTitle = document.querySelector("#endTitle");
const endReason = document.querySelector("#endReason");
const endStats = document.querySelector("#endStats");
const statsPanel = document.querySelector("#statsPanel");
const statsBackdrop = document.querySelector("#statsBackdrop");
const statsSummary = document.querySelector("#statsSummary");
const statsDetails = document.querySelector("#statsDetails");
const statsScenarios = document.querySelector("#statsScenarios");
const statsRoles = document.querySelector("#statsRoles");
const statsHistory = document.querySelector("#statsHistory");
const statsOpenButtons = ["#statsOpenMenu", "#statsOpenGame", "#statsOpenEnd"].map(selector => document.querySelector(selector));
const statsCloseButtons = [document.querySelector("#statsClose"), document.querySelector("#statsCloseIcon")];

const MODULES = {
  wires: { id: "wires", name: "ПРОВОДА", x: 106, y: 86, radius: 48 },
  glyphs: { id: "glyphs", name: "ЗНАКИ", x: 363, y: 88, radius: 48 },
  coolant: { id: "coolant", name: "ОХЛАЖДЕНИЕ", x: 238, y: 198, radius: 52 }
};

const ROLE_COLORS = {
  operator: "#ff3b35",
  lookout: "#55e6ec",
  scribe: "#ffd85a",
  observer: "#c3cbc6"
};

const ROLE_LABELS = {
  operator: "ОПЕРАТОР",
  lookout: "НАБЛЮДАТЕЛЬ",
  scribe: "АРХИВАРИУС",
  observer: "ЗРИТЕЛЬ"
};

const ROLE_TRAITS = {
  operator: { short: "НЕ ВИДИТ", detail: "ОПТИКА ОТКЛЮЧЕНА · УПРАВЛЯЕТ" },
  lookout: { short: "У ПУЛЬТА", detail: "НЕ СЛЫШИТ · НЕ ДВИГАЕТСЯ · СКАНИРУЕТ" },
  scribe: { short: "НЕ ГОВОРИТ", detail: "ГОЛОСОВОЙ МОДУЛЬ ОТКЛЮЧЕН · ЗНАЕТ ПРАВИЛА" },
  observer: { short: "НАБЛЮДАЕТ", detail: "РЕЗЕРВНЫЙ КАНАЛ" }
};

const ROLE_SPRITE_INDEX = {
  operator: 0,
  lookout: 1,
  scribe: 2,
  observer: 1
};

const crewAtlas = new Image();
crewAtlas.src = "./assets/crew-atlas-v1.png";

const crewSheets = Object.fromEntries(["operator", "lookout", "scribe"].map(role => {
  const image = new Image();
  image.src = `./assets/${role}-anim-v1.png`;
  return [role, image];
}));

const explosionSheet = new Image();
explosionSheet.src = "./assets/reactor-explosion-v1.png";

const SYMBOL_LABELS = {
  spark: "ИСКРА",
  crown: "КОРОНА",
  coil: "СПИРАЛЬ",
  drop: "КАПЛЯ",
  eye: "ГЛАЗ",
  arrow: "СТРЕЛА"
};

const input = { up: false, down: false, left: false, right: false };
const releaseTimers = { up: null, down: null, left: null, right: null };
let socket = null;
let state = null;
let selfId = null;
let lastInput = {};
let returningToMenu = false;
let focusedAfterJoin = false;
let stateReceivedAt = performance.now();
let lastFootstepAt = 0;
let pendingStatsDistance = 0;
let statsActivityStartedAt = document.visibilityState === "visible" ? performance.now() : null;
let symbolDraft = [];
let audioManuallyMuted = false;

const audio = createAudioEngine();
const playerStats = new CoreBelowStats();
playerStats.startSession();

joinButton.addEventListener("click", () => {
  audio.start();
  audio.play("ui");
  connect(false);
});
tutorialButton.addEventListener("click", () => {
  audio.start();
  audio.play("ui");
  connect(true);
});
menuButton.addEventListener("click", showMenu);
startButton.addEventListener("click", () => {
  audio.play("ui");
  send({ type: "start" });
});
audioButton.addEventListener("click", () => {
  audioManuallyMuted = audio.toggleMute();
  audioButton.textContent = "♫";
  updateAudioButton();
});
statsOpenButtons.forEach(button => button.addEventListener("click", openStatsPanel));
statsCloseButtons.forEach(button => button.addEventListener("click", closeStatsPanel));
statsBackdrop.addEventListener("click", closeStatsPanel);
endButton.addEventListener("click", () => {
  audio.play("ui");
  if (state?.tutorial) showMenu();
  else send({ type: "start" });
});
canvas.addEventListener("pointerdown", () => canvas.focus());

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  if (send({ type: "chat", text })) playerStats.recordMessage();
  chatInput.value = "";
  canvas.focus();
});

pingButtons.forEach(button => {
  button.addEventListener("click", () => {
    audio.play("ping");
    if (send({ type: "ping", text: button.dataset.ping })) playerStats.recordSignal();
    canvas.focus();
  });
});

tutorialRoleBar.addEventListener("click", event => {
  const button = event.target.closest("[data-tutorial-role]");
  if (!button || !tutorialRoleBar.contains(button)) return;
  audio.play("ui");
  releaseAllInput();
  symbolDraft = [];
  renderSymbolDraft();
  send({ type: "tutorialRole", role: button.dataset.tutorialRole });
});

symbolPalette.addEventListener("click", event => {
  const button = event.target.closest("[data-symbol]");
  if (!button || !symbolPalette.contains(button) || symbolDraft.length >= 7) return;
  symbolDraft.push(button.dataset.symbol);
  audio.play("ui");
  renderSymbolDraft();
});

symbolClear.addEventListener("click", () => {
  symbolDraft = [];
  audio.play("ui");
  renderSymbolDraft();
});

symbolSend.addEventListener("click", () => {
  if (symbolDraft.length === 0) return;
  if (send({ type: "symbol", tokens: symbolDraft })) playerStats.recordSignal();
  symbolDraft = [];
  audio.play("ping");
  renderSymbolDraft();
  canvas.focus();
});

actionPanel.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button || !actionPanel.contains(button)) return;
  const action = button.dataset.action;
  if (action === "wire") send({ type: "interact", module: "wires", slot: Number(button.dataset.slot) });
  if (action === "glyph") send({ type: "interact", module: "glyphs", slot: Number(button.dataset.slot) });
  if (action === "coolant") send({ type: "interact", module: "coolant", action: "cycle", label: button.dataset.label });
  if (action === "commit") send({ type: "interact", module: "coolant", action: "commit" });
  audio.play("tool");
  canvas.focus();
});

roleButtons.addEventListener("click", event => {
  const button = event.target.closest("[data-role]");
  if (!button || button.disabled || !roleButtons.contains(button)) return;
  audio.play("ui");
  send({ type: "setRole", role: button.dataset.role });
});

document.querySelectorAll("[data-move]").forEach(button => {
  const key = button.dataset.move;
  const release = () => {
    clearTimeout(releaseTimers[key]);
    releaseTimers[key] = setTimeout(() => {
      input[key] = false;
      releaseTimers[key] = null;
      sendInput();
    }, 110);
  };
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    clearTimeout(releaseTimers[key]);
    releaseTimers[key] = null;
    input[key] = true;
    sendInput();
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

window.addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Escape" && !statsPanel.hidden) {
    closeStatsPanel();
    return;
  }
  if (event.code === "Escape" && !gameShell.classList.contains("is-hidden")) {
    showMenu();
    return;
  }

  if (!event.repeat && /^Digit[1-4]$/.test(event.code)) {
    const index = Number(event.code.at(-1)) - 1;
    const button = actionPanel.querySelectorAll("button:not(:disabled)")[index];
    if (button) {
      event.preventDefault();
      button.click();
      return;
    }
  }

  if (!event.repeat && event.code === "Enter") {
    const commit = actionPanel.querySelector('[data-action="commit"]');
    if (commit) {
      event.preventDefault();
      commit.click();
      return;
    }
  }

  if (setKey(event.code, true)) {
    event.preventDefault();
    sendInput();
  }
});

window.addEventListener("keyup", event => {
  if (setKey(event.code, false)) {
    event.preventDefault();
    sendInput();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseAllInput();
    flushStatsActivity();
    statsActivityStartedAt = null;
  } else {
    statsActivityStartedAt = performance.now();
  }
});
window.addEventListener("blur", releaseAllInput);
window.addEventListener("pagehide", flushStatsActivity);

setInterval(sendInput, 80);
setInterval(flushStatsActivity, 15_000);
requestAnimationFrame(draw);

function connect(tutorial) {
  if (socket && socket.readyState <= WebSocket.OPEN) socket.close();

  returningToMenu = false;
  focusedAfterJoin = false;
  socket = new WebSocket(socketEndpoint());
  joinButton.disabled = true;
  tutorialButton.disabled = true;
  connectionStatus.textContent = "ПОДКЛЮЧЕНИЕ К СЕРВЕРУ...";
  const activeButton = tutorial ? tutorialButton : joinButton;
  const oldText = activeButton.textContent;
  activeButton.textContent = "СОЕДИНЕНИЕ...";

  socket.addEventListener("open", () => {
    connectionStatus.textContent = "";
    send({
      type: "join",
      name: nameInput.value || "СТАЖЕР",
      roomCode: tutorial ? "" : roomInput.value,
      tutorial
    });
    activeButton.textContent = oldText;
  });

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "hello") {
      selfId = message.peerId;
      return;
    }
    if (message.type === "state") {
      const previousState = state;
      selfId = message.selfId;
      state = message.room;
      stateReceivedAt = performance.now();
      trackPlayerStats(previousState, state, selfId);
      audio.sync(previousState, state, selfId);
      bootScreen.classList.add("is-hidden");
      gameShell.classList.remove("is-hidden");
      renderUi();
      if (!focusedAfterJoin) {
        focusedAfterJoin = true;
        requestAnimationFrame(() => canvas.focus());
      }
      return;
    }
    if (message.type === "error") addClientLine(message.message, "danger");
  });

  socket.addEventListener("close", () => {
    joinButton.disabled = false;
    tutorialButton.disabled = false;
    activeButton.textContent = oldText;
    if (!returningToMenu) {
      connectionStatus.textContent = "СЕРВЕР ИГРЫ НЕДОСТУПЕН. ПРОВЕРЬТЕ АДРЕС BACKEND.";
      addClientLine("Связь с сервером потеряна.", "danger");
    }
  });
}

function socketEndpoint() {
  const configured = String(window.CORE_BELOW_SOCKET_URL || "").trim();
  if (configured) return configured;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}/socket`;
}

function showMenu() {
  audio.play("ui");
  returningToMenu = true;
  releaseAllInput();
  if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
  socket = null;
  state = null;
  selfId = null;
  lastInput = {};
  audio.setScene("menu", null);
  closeStatsPanel();
  connectionStatus.textContent = "";
  bootScreen.classList.remove("is-hidden");
  gameShell.classList.add("is-hidden");
  joinButton.disabled = false;
  tutorialButton.disabled = false;
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}

function trackPlayerStats(previous, next, ownId) {
  if (next.tutorial) return;
  const self = next.players.find(player => player.id === ownId);
  if (!self || !["operator", "lookout", "scribe"].includes(self.role)) return;

  if (next.shiftId && next.phase === "playing") {
    playerStats.recordShiftStart({
      shiftId: next.shiftId,
      scenarioId: next.scenario?.id,
      role: self.role
    });
  }

  if (previous?.shiftId === next.shiftId && previous.phase === "playing") {
    const previousSelf = previous.players.find(player => player.id === ownId);
    if (previousSelf) {
      const step = Math.hypot(self.x - previousSelf.x, self.y - previousSelf.y);
      if (step <= 50) pendingStatsDistance += step;
    }
  }

  if (next.shiftId && ["won", "lost"].includes(next.phase)) {
    const progress = next.puzzleView?.progress;
    const modulesSolved = [progress?.wiresSolved, progress?.glyphsSolved, progress?.coolantSolved].filter(Boolean).length;
    playerStats.recordShiftResult({
      shiftId: next.shiftId,
      scenarioId: next.scenario?.id,
      role: self.role,
      outcome: next.phase,
      elapsedSeconds: next.elapsedSeconds,
      mistakes: next.mistakes,
      modulesSolved
    });
    if (!statsPanel.hidden) renderStatsPanel();
  }
}

function flushStatsActivity() {
  const now = performance.now();
  const seconds = statsActivityStartedAt === null ? 0 : Math.floor((now - statsActivityStartedAt) / 1000);
  playerStats.addActivity({ seconds, distance: Math.round(pendingStatsDistance) });
  pendingStatsDistance = 0;
  statsActivityStartedAt = document.visibilityState === "visible" ? now : null;
}

function openStatsPanel() {
  audio.start();
  audio.play("ui");
  flushStatsActivity();
  renderStatsPanel();
  statsPanel.hidden = false;
  document.querySelector("#statsCloseIcon").focus();
}

function closeStatsPanel() {
  statsPanel.hidden = true;
}

function renderStatsPanel() {
  const stats = playerStats.snapshot();
  const successRate = stats.shiftsCompleted ? Math.round((stats.wins / stats.shiftsCompleted) * 100) : 0;
  const roleLabels = { operator: "ОПЕРАТОР", lookout: "НАБЛЮДАТЕЛЬ", scribe: "АРХИВАРИУС" };
  const scenarioLabels = { reactor: "БИОРЕАКТОР", cryo: "КРИОХРАНИЛИЩЕ", signal: "УЗЕЛ СВЯЗИ" };
  const favoriteRole = stats.shiftsStarted
    ? Object.entries(stats.roleRuns).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  statsSummary.innerHTML = [
    ["СМЕНЫ", stats.shiftsCompleted],
    ["ПОБЕДЫ", stats.wins],
    ["УСПЕХ", `${successRate}%`],
    ["ЛУЧШАЯ СЕРИЯ", `×${stats.bestStreak}`]
  ].map(([label, value]) => `<div class="stats-cell"><span>${label}</span><strong>${value}</strong></div>`).join("");

  statsDetails.innerHTML = [
    ["ИДЕАЛЬНЫЕ СМЕНЫ", stats.perfectWins],
    ["МОДУЛИ СТАБИЛИЗИРОВАНЫ", stats.modulesStabilized],
    ["ОШИБКИ ЭКИПАЖА", stats.mistakes],
    ["ЛУЧШЕЕ ВРЕМЯ", stats.bestWinSeconds ? formatStatsDuration(stats.bestWinSeconds) : "—"],
    ["АКТИВНОЕ ВРЕМЯ", formatStatsDuration(stats.activeSeconds)],
    ["ПРОЙДЕННАЯ ДИСТАНЦИЯ", `${stats.distanceTravelled} м`],
    ["СВЯЗЬ", `${stats.signalsSent} сигналов · ${stats.messagesSent} сообщений`],
    ["ОСНОВНАЯ РОЛЬ", favoriteRole ? roleLabels[favoriteRole] : "—"]
  ].map(([label, value]) => `<div class="stats-row"><span>${label}</span><strong>${value}</strong></div>`).join("");

  statsScenarios.innerHTML = Object.keys(scenarioLabels).map(id => `
    <div class="stats-row">
      <span>${scenarioLabels[id]}</span>
      <strong>${stats.scenarioWins[id]} / ${stats.scenarioRuns[id]}</strong>
    </div>
  `).join("");

  statsRoles.innerHTML = Object.keys(roleLabels).map(id => `
    <div class="stats-row">
      <span>${roleLabels[id]}</span>
      <strong>${stats.roleRuns[id]} СМЕН</strong>
    </div>
  `).join("");

  statsHistory.innerHTML = stats.history.length ? stats.history.slice(0, 8).map(entry => `
    <div class="stats-history-row ${entry.won ? "is-win" : "is-loss"}">
      <span>${scenarioLabels[entry.scenarioId]} · ${roleLabels[entry.role]} · ${formatStatsDuration(entry.elapsedSeconds)}</span>
      <strong>${entry.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"} · ${entry.mistakes} ОШ.</strong>
    </div>
  `).join("") : `<div class="stats-empty">ЗАВЕРШЕННЫХ ОНЛАЙН-СМЕН ПОКА НЕТ.</div>`;
}

function formatStatsDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, "0");
  return hours ? `${hours} Ч ${String(minutes).padStart(2, "0")} М` : `${minutes}:${seconds}`;
}

function setKey(code, value) {
  const map = {
    KeyW: "up", ArrowUp: "up",
    KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right"
  };
  const key = map[code];
  if (!key) return false;
  const self = state?.players.find(player => player.id === selfId);
  if (self?.role === "lookout") return false;
  if (value) {
    clearTimeout(releaseTimers[key]);
    releaseTimers[key] = null;
    if (input[key]) return false;
    input[key] = true;
    return true;
  }
  if (!input[key]) return false;
  clearTimeout(releaseTimers[key]);
  releaseTimers[key] = setTimeout(() => {
    input[key] = false;
    releaseTimers[key] = null;
    sendInput();
  }, 110);
  return true;
}

function releaseAllInput() {
  let changed = false;
  for (const key of Object.keys(input)) {
    clearTimeout(releaseTimers[key]);
    releaseTimers[key] = null;
    if (input[key]) changed = true;
    input[key] = false;
  }
  if (changed) sendInput();
}

function sendInput() {
  if (JSON.stringify(input) === JSON.stringify(lastInput)) return;
  lastInput = { ...input };
  send({ type: "input", input });
}

function renderUi() {
  if (!state) return;
  const self = state.players.find(player => player.id === selfId);
  const view = state.puzzleView;
  const inLobby = state.phase === "lobby";
  const nearby = self ? nearestModule(self) : null;
  const scenario = state.scenario;
  const modules = currentModules();

  gameShell.dataset.role = self?.role || "observer";
  gameShell.classList.toggle("is-tutorial", Boolean(state.tutorial));
  gameShell.dataset.phase = state.phase;

  roomCode.textContent = state.tutorial ? "УЧЕБА" : state.code;
  roleName.textContent = `${ROLE_LABELS[self?.role] || "ЗРИТЕЛЬ"} · ${ROLE_TRAITS[self?.role]?.short || "НАБЛЮДАЕТ"}`;
  scenarioName.textContent = scenario?.name || "ОЖИДАНИЕ СМЕНЫ";
  canvasStage.style.setProperty("--scenario-bg", `url("${scenario?.background || "./assets/reactor-room-v2.png"}")`);
  canvasStage.dataset.scenario = scenario?.id || "reactor";
  canvasStage.classList.toggle("is-blind", state.phase === "playing" && self?.role === "operator");
  timer.textContent = formatTime(state.timer);
  strikes.textContent = `${state.mistakes}/${state.maxMistakes}`;
  crewCount.textContent = `${state.players.length} В СЕТИ`;

  lobbyPanel.hidden = !inLobby;
  tutorialRoleBar.hidden = !state.tutorial || state.phase !== "playing";
  tutorialRoleBar.querySelectorAll("[data-tutorial-role]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.tutorialRole === self?.role));
  });
  relayPanel.hidden = inLobby || state.phase !== "playing";
  const finished = ["won", "lost"].includes(state.phase);
  const won = state.phase === "won";
  endOverlay.hidden = !finished;
  canvasStage.classList.toggle("outcome-won", finished && won);
  canvasStage.classList.toggle("outcome-lost", finished && !won);
  endOverlay.classList.toggle("is-won", finished && won);
  endOverlay.classList.toggle("is-lost", finished && !won);
  if (!endOverlay.hidden) {
    const completed = [view?.progress?.wiresSolved, view?.progress?.glyphsSolved, view?.progress?.coolantSolved].filter(Boolean).length;
    endKicker.textContent = won ? "СМЕНА ЗАВЕРШЕНА" : "АВАРИЙНЫЙ ПРОТОКОЛ";
    endTitle.textContent = won ? "РЕАКТОР СТАБИЛЕН" : "РЕАКТОР УНИЧТОЖЕН";
    endReason.textContent = won
      ? "Защитный контур удержан. Экипаж пережил смену."
      : state.outcomeReason === "timeout"
        ? "Время вышло: активная зона перегрелась и пробила оболочку."
        : "Третья ошибка перегрузила аварийный контур.";
    endStats.textContent = won
      ? `3/3 МОДУЛЯ · ${state.mistakes} ОШИБОК · ${formatTime(state.timer)} В ЗАПАСЕ`
      : `${completed}/3 МОДУЛЯ · ${state.mistakes}/${state.maxMistakes} ОШИБОК`;
    endButton.textContent = state.tutorial
      ? "В ОНЛАЙН-МЕНЮ"
      : state.isHost ? "НОВАЯ СМЕНА" : "ОЖИДАНИЕ КОМАНДИРА";
    endButton.disabled = !state.tutorial && (!state.isHost || !state.crewReady);
  }

  startButton.textContent = !state.isHost
    ? "ОЖИДАНИЕ КОМАНДИРА"
    : state.crewReady ? "НАЧАТЬ СМЕНУ" : "НУЖНЫ 3 СПЕЦИАЛИСТА";
  startButton.disabled = !inLobby || !state.isHost || !state.crewReady;
  lobbyHint.textContent = !state.isHost
    ? "Выберите свободную роль. Смену запускает командир комнаты."
    : state.crewReady
      ? "Экипаж укомплектован. Можно начинать смену."
      : "Для старта нужны оператор, наблюдатель и архивариус.";

  players.innerHTML = state.players.map(player => `
    <div class="player">
      <span class="role-avatar role-${player.role}" aria-hidden="true"><img src="./assets/crew-atlas-v1.png" alt=""></span>
      <span class="player-copy"><strong>${escapeHtml(player.nick)}</strong>${player.isHost ? "<em>КОМАНДИР</em>" : ""}<small>${ROLE_LABELS[player.role] || "ЗРИТЕЛЬ"} · ${ROLE_TRAITS[player.role]?.short || "НАБЛЮДАЕТ"}</small></span>
    </div>
  `).join("");

  const taken = new Set(state.players.filter(player => player.id !== selfId).map(player => player.role));
  const roleMarkup = state.roles.map(role => `
    <button ${taken.has(role.id) || !inLobby ? "disabled" : ""} data-role="${role.id}">
      <strong>${ROLE_LABELS[role.id]}</strong>
      <small>${ROLE_TRAITS[role.id]?.detail || "РЕЗЕРВ"}</small>
    </button>
  `).join("");
  if (roleButtons.innerHTML !== roleMarkup) roleButtons.innerHTML = roleMarkup;

  const progress = view?.progress;
  const moduleOrder = progress?.moduleOrder || ["wires", "glyphs", "coolant"];
  moduleDots.innerHTML = moduleOrder.map(id => `<i class="module-dot ${progress?.[`${id}Solved`] ? "done" : ""} ${progress?.activeModule === id ? "active" : ""}"></i>`).join("");
  document.querySelector(".station-wires span").textContent = modules.wires.name;
  document.querySelector(".station-glyphs span").textContent = modules.glyphs.name;
  document.querySelector(".station-coolant span").textContent = modules.coolant.name;
  document.querySelector(".station-wires").classList.toggle("is-done", Boolean(progress?.wiresSolved));
  document.querySelector(".station-glyphs").classList.toggle("is-done", Boolean(progress?.glyphsSolved));
  document.querySelector(".station-coolant").classList.toggle("is-done", Boolean(progress?.coolantSolved));

  const mutedRole = self?.role === "scribe";
  chatForm.hidden = mutedRole;
  quickPings.hidden = mutedRole || self?.role === "lookout";
  routeControls.hidden = self?.role !== "lookout";
  symbolRelay.hidden = !mutedRole;
  touchControls.hidden = self?.role === "lookout";
  chatInput.disabled = mutedRole;
  chatForm.querySelector("button").disabled = mutedRole;
  chatInput.placeholder = "СООБЩЕНИЕ КОМАНДЕ";
  renderSymbolDraft();
  renderRoleSignals(self?.role);
  updateAudioButton(self?.role);

  renderObjective(self, nearby);
  renderConsole(self, nearby);
  renderLog();
  renderStory(self, nearby);
  renderProximity(self, nearby);
}

function renderRoleSignals(role) {
  const signals = role === "lookout"
    ? [
        { text: "←", label: "Левее" },
        { text: "↑", label: "Вверх" },
        { text: "↓", label: "Вниз" },
        { text: "→", label: "Правее" }
      ]
    : [
        { text: "? СКАН", label: "Нужен сканер" },
        { text: "? ПРАВИЛО", label: "Нужно правило" },
        { text: "◎ У ЦЕЛИ", label: "Я у модуля" },
        { text: "✓", label: "Понял" }
      ];
  quickPingButtons.forEach((button, index) => {
    const signal = signals[index] || signals.at(-1);
    button.textContent = signal.text;
    button.dataset.ping = signal.label;
    button.title = signal.label;
    button.setAttribute("aria-label", signal.label);
  });
}

function renderSymbolDraft() {
  symbolDraftView.textContent = symbolDraft.length ? symbolDraft.join(" ") : "…";
  symbolSend.disabled = symbolDraft.length === 0;
  symbolClear.disabled = symbolDraft.length === 0;
}

function updateAudioButton(role = state?.players.find(player => player.id === selfId)?.role) {
  const roleDeaf = role === "lookout";
  audioButton.classList.toggle("is-muted", audioManuallyMuted || roleDeaf);
  audioButton.disabled = roleDeaf;
  audioButton.title = roleDeaf
    ? "Аудиоканал наблюдателя отключён"
    : audioManuallyMuted ? "Включить звук" : "Выключить звук";
  audioButton.setAttribute("aria-label", audioButton.title);
}

function renderObjective(self, nearby) {
  if (state.phase === "lobby" || ["won", "lost"].includes(state.phase)) {
    objectiveCard.hidden = true;
    return;
  }

  const view = state.puzzleView;
  const activeModule = view?.progress?.activeModule;
  const activeName = activeModule ? currentModules()[activeModule].name : "ВСЕ МОДУЛИ";
  let kicker = state.scenario?.name || "ВАША ЗАДАЧА";
  let text = "Стабилизируйте три модуля до конца таймера.";

  if (state.tutorial && view) {
    const solvedCount = [view.progress.wiresSolved, view.progress.glyphsSolved, view.progress.coolantSolved].filter(Boolean).length;
    kicker = `ОБУЧЕНИЕ · ${ROLE_LABELS[self?.role]} · ${Math.min(3, solvedCount + 1)}/3`;
    if (self?.role === "lookout") {
      text = activeModule === "wires"
        ? "Вы не можете ходить. Сканируйте цвета гнёзд и ведите красного оператора стрелками в консоли."
        : activeModule === "glyphs"
          ? "Вы не можете ходить. Сканируйте знаки пластин и направьте оператора к цели."
          : "Вы не можете ходить. Сканируйте температу баков A, B и C и следите за оператором на карте.";
    } else if (self?.role === "scribe") {
      text = activeModule === "wires"
        ? "Справа уже открыт ваш СПРАВОЧНИК. Прочитайте цвет и внизу соберите: квадрат + номер гнезда."
        : activeModule === "glyphs"
          ? "Справа открыт СПРАВОЧНИК с порядком знаков. Передайте его только символами."
          : "Справа открыт СПРАВОЧНИК температур. Передайте A, B, C и нужные числа символами.";
    } else {
      const training = view.training;
      const answer = activeModule === "wires"
        ? `В учебной смене нужно гнездо ${training.wireSlot}.`
        : activeModule === "glyphs"
          ? `Порядок клавиш: ${training.glyphSlots.join(" → ")}.`
          : `Выставьте ${training.coolant.map(tank => `${tank.label}=${tank.target}`).join(", ")}.`;
      text = nearby?.id === activeModule
        ? `Вы у цели. ${answer}`
        : `Карта специально затемнена. Идите к модулю ${activeName} по сигналам команды.`;
    }
  } else if (self?.role === "operator") {
    text = nearby
      ? nearby.id === activeModule
        ? `Оптика отключена. Получите решение для модуля ${nearby.name} от команды и используйте клавиши 1–4.`
        : `Этот терминал заблокирован. Следующая цель: ${activeName}.`
      : `Виден только круг фонаря. Попросите команду направить вас к модулю ${activeName}.`;
  } else if (self?.role === "lookout") {
    text = `Вы закреплены у пульта и не можете ходить. Сканируйте ${activeName}, следите за красным оператором и ведите его стрелками.`;
  } else if (self?.role === "scribe") {
    text = `Справа открыт личный СПРАВОЧНИК для модуля ${activeName}. Передайте ответ цветами, знаками и цифрами.`;
  } else {
    text = "Следите за прогрессом экипажа.";
  }

  objectiveCard.hidden = false;
  objectiveCard.innerHTML = `<strong>${kicker}</strong><p>${escapeHtml(text)}</p>`;
}

function renderConsole(self, nearby) {
  const view = state.puzzleView;
  if (!view || state.phase !== "playing" || !self) {
    workPanel.hidden = true;
    return;
  }

  const operatorAtModule = self.role === "operator" && nearby;
  const informationRole = ["lookout", "scribe"].includes(self.role);
  workPanel.hidden = !(operatorAtModule || informationRole);
  if (workPanel.hidden) return;

  if (operatorAtModule) {
    consoleKicker.textContent = "АКТИВНЫЙ ТЕРМИНАЛ";
    consoleTitle.textContent = nearby.name;
    keyHelp.textContent = nearby.id === "coolant" ? "1–3 ВЫБОР · ENTER ПУСК" : "КЛАВИШИ 1–4";
  } else if (self.role === "scribe") {
    const activeName = currentModules()[view.progress.activeModule]?.name || "ТЕКУЩИЙ МОДУЛЬ";
    consoleKicker.textContent = "ЛИЧНЫЙ СПРАВОЧНИК";
    consoleTitle.textContent = activeName;
    keyHelp.textContent = "ТОЛЬКО ВЫ ЭТО ВИДИТЕ";
  } else {
    consoleKicker.textContent = "РОЛЕВАЯ КОНСОЛЬ";
    consoleTitle.textContent = ROLE_LABELS[self.role];
    keyHelp.textContent = "СТРЕЛКИ = МАРШРУТ";
  }

  renderIntel(self, nearby);
  renderActions(self, nearby);
}

function renderIntel(self, nearby) {
  const view = state.puzzleView;

  if (state.tutorial && self?.role === "operator" && nearby && view.training) {
    if (nearby.id === "wires") {
      intelPanel.innerHTML = `<p>ЭХО: нужен <strong>${colorLabel(view.training.wireColor)}</strong> провод. Он находится в гнезде <strong>${view.training.wireSlot}</strong>.</p>`;
      return;
    }
    if (nearby.id === "glyphs") {
      intelPanel.innerHTML = `<p>ЯРА: порядок знаков <strong>${view.training.glyphs.map(symbol => SYMBOL_LABELS[symbol]).join(" → ")}</strong>.<br>ЭХО: это пластины <strong>${view.training.glyphSlots.join(" → ")}</strong>.</p>`;
      return;
    }
    if (nearby.id === "coolant") {
      intelPanel.innerHTML = `<div class="data-list">${view.training.coolant.map(tank => `<div class="data-row"><span>БАК ${tank.label} · T=${tank.temp}</span><strong>НУЖНО ${tank.target}</strong></div>`).join("")}</div>`;
      return;
    }
  }

  if (view.role === "lookout") {
    const activeModule = view.progress.activeModule;
    const rows = activeModule === "wires"
      ? view.scanner.wires.map(wire => `<div class="data-row"><span>ПРОВОД ${wire.slot}</span><strong>${colorLabel(wire.color)}</strong></div>`).join("")
      : activeModule === "glyphs"
        ? view.scanner.glyphs.map(glyph => `<div class="data-row"><span>ПЛАСТИНА ${glyph.slot}</span><strong>${SYMBOL_LABELS[glyph.symbol] || glyph.symbol}</strong></div>`).join("")
        : view.scanner.coolant.map(tank => `<div class="data-row"><span>БАК ${tank.label}</span><strong>T=${tank.temp} · ${tank.value}</strong></div>`).join("");
    intelPanel.innerHTML = `
      <div class="data-list">
        ${rows}
      </div>`;
    return;
  }

  if (view.role === "scribe") {
    const activeModule = view.progress.activeModule;
    const rule = activeModule === "wires" ? view.manual.wire : activeModule === "glyphs" ? view.manual.glyph : view.manual.coolant;
    const label = currentModules()[activeModule]?.name || "ПРАВИЛО";
    intelPanel.innerHTML = `
      <article class="manual-page">
        <header><span>ОТКРЫТА НУЖНАЯ СТРАНИЦА</span><strong>${escapeHtml(label)}</strong></header>
        <p class="manual-rule">${escapeHtml(rule)}</p>
        <footer>СОБЕРИТЕ ОТВЕТ СИМВОЛАМИ ВНИЗУ ↓</footer>
      </article>`;
    return;
  }

  intelPanel.innerHTML = "<p>Используйте решение, которое передала команда.</p>";
}

function renderActions(self, nearby) {
  if (!state?.puzzleView || state.phase !== "playing" || self?.role !== "operator" || !nearby) {
    setActionMarkup("");
    return;
  }
  const view = state.puzzleView;
  let markup = "";
  if (nearby.id !== view.progress.activeModule) {
    const target = currentModules()[view.progress.activeModule]?.name || "СЛЕДУЮЩИЙ МОДУЛЬ";
    setActionMarkup(`<p class="locked-action">ЗАБЛОКИРОВАНО · СНАЧАЛА ${escapeHtml(target)}</p>`);
    return;
  }

  if (nearby.id === "wires") {
    if (view.progress.wiresSolved) return showActionDone("МОДУЛЬ УЖЕ СТАБИЛЕН");
    markup = view.wires.map((wire, index) => `
      <button ${wire.cut ? "disabled" : ""} data-action="wire" data-slot="${wire.slot}"><kbd>${index + 1}</kbd>ПРОВОД ${wire.slot}</button>
    `).join("");
  }

  if (nearby.id === "glyphs") {
    if (view.progress.glyphsSolved) return showActionDone("ЗАМОК УЖЕ ОТКРЫТ");
    markup = view.glyphs.map((glyph, index) => `
      <button data-action="glyph" data-slot="${glyph.slot}"><kbd>${index + 1}</kbd>ПЛАСТИНА ${glyph.slot}</button>
    `).join("");
  }

  if (nearby.id === "coolant") {
    if (view.progress.coolantSolved) return showActionDone("КОНТУР УЖЕ СТАБИЛЕН");
    markup = [
      ...view.coolant.map((tank, index) => `<button data-action="coolant" data-label="${tank.label}"><kbd>${index + 1}</kbd>${tank.label} = ${tank.value}</button>`),
      '<button class="primary" data-action="commit"><kbd>↵</kbd>ПОДТВЕРДИТЬ</button>'
    ].join("");
  }

  setActionMarkup(markup);
}

function showActionDone(text) {
  setActionMarkup(`<p>${text}</p>`);
}

function setActionMarkup(markup) {
  if (actionPanel.innerHTML !== markup) actionPanel.innerHTML = markup;
}

function renderProximity(self, nearby) {
  if (state.phase !== "playing" || !self) {
    proximityHint.hidden = true;
    return;
  }
  proximityHint.hidden = false;
  if (self.role !== "operator") {
    proximityHint.textContent = self.role === "scribe"
      ? "СОПОСТАВЬТЕ ПРАВИЛО · ОТПРАВЬТЕ СИМВОЛЫ"
      : "ВЫ У ПУЛЬТА · СЛЕДИТЕ ЗА ОПЕРАТОРОМ · ВЕДИТЕ СТРЕЛКАМИ";
  } else if (nearby) {
    proximityHint.textContent = nearby.id === state.puzzleView?.progress?.activeModule
      ? `${nearby.name} · ВЫБОР: 1–4${nearby.id === "coolant" ? " · ПУСК: ENTER" : ""}`
      : `${nearby.name} · ЗАБЛОКИРОВАНО`;
  } else {
    proximityHint.textContent = "WASD / СТРЕЛКИ — ДВИЖЕНИЕ К ЦВЕТНОМУ ТЕРМИНАЛУ";
  }
}

function renderLog() {
  if (!state) return;
  const entries = state.logs.slice(-5);
  log.innerHTML = entries.map(entry => `<div class="log-line ${entry.tone}">${escapeHtml(entry.text)}</div>`).join("");
  log.scrollTop = log.scrollHeight;
}

function renderStory(self, nearby) {
  let speaker = "СИСТЕМА";
  let text = "Соберите экипаж и выберите роли.";

  if (state.phase === "won") {
    text = "Все три модуля стабилизированы. Реактор работает штатно.";
  } else if (state.phase === "lost") {
    speaker = "ТРЕВОГА";
    text = "Смена провалена. Запустите новую попытку.";
  } else if (state.tutorial && state.puzzleView) {
    speaker = "КУРАТОР";
    text = self?.role === "lookout"
      ? "Вы — стационарный диспетчер. Следите за оператором и ведите его стрелками; движение вам недоступно."
      : self?.role === "scribe"
        ? "Ваш справочник открыт справа. Прочитайте правило и соберите ответ из знаков внизу."
        : nearby
          ? "Фонарь нашёл терминал. Введите решение команды."
          : "Виден только круг фонаря и маяки напарников. Двигайтесь по их сигналам.";
  } else if (state.logs.length) {
    const entry = state.logs.at(-1);
    speaker = entry.tone === "danger" ? "ТРЕВОГА" : entry.tone === "chat" ? "ЭКИПАЖ" : "СИСТЕМА";
    text = entry.text;
  }

  storyLine.innerHTML = `<strong>${speaker}</strong><span>${escapeHtml(text)}</span>`;
}

function addClientLine(text, tone) {
  const div = document.createElement("div");
  div.className = `log-line ${tone}`;
  div.textContent = text;
  log.append(div);
}

function currentModules() {
  return state?.modules || MODULES;
}

function nearestModule(player) {
  let best = null;
  for (const module of Object.values(currentModules())) {
    const dist = Math.hypot(player.x - module.x, player.y - module.y);
    if (dist <= module.radius && (!best || dist < best.dist)) best = { ...module, dist };
  }
  return best;
}

function draw(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.imageSmoothingEnabled = false;

  if (state) {
    drawScenarioAtmosphere(now);
    drawCorePulse(now);
    drawModuleStates(now);
    drawSensoryLayer();
    if (state.tutorial && state.phase === "playing") drawTutorialCrew(now);
    drawPlayers(now);
    drawOutcomeEffects(now);
  }
  requestAnimationFrame(draw);
}

function drawCorePulse(now) {
  if (state.phase !== "playing") return;
  const bright = Math.floor(now / 420) % 2 === 0;
  const tones = state.scenario?.id === "cryo"
    ? ["rgba(140, 236, 255, 0.38)", "rgba(140, 236, 255, 0.14)"]
    : state.scenario?.id === "signal"
      ? ["rgba(112, 236, 140, 0.38)", "rgba(192, 104, 255, 0.14)"]
      : ["rgba(255, 216, 90, 0.3)", "rgba(255, 216, 90, 0.12)"];
  ctx.fillStyle = bright ? tones[0] : tones[1];
  ctx.fillRect(231, 125, 18, 18);
  ctx.fillRect(235, 121, 10, 26);
}

function drawScenarioAtmosphere(now) {
  if (state.phase !== "playing") return;
  const scenario = state.scenario?.id || "reactor";
  ctx.save();
  if (scenario === "cryo") {
    ctx.fillStyle = "rgba(220, 250, 255, 0.68)";
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 83 + now / 24) % 480;
      const y = (index * 47 + now / 45) % 270;
      ctx.fillRect(Math.round(x), Math.round(y), index % 3 === 0 ? 2 : 1, 2);
    }
  } else if (scenario === "signal") {
    ctx.globalAlpha = 0.55;
    for (let index = 0; index < 10; index += 1) {
      const x = 35 + ((index * 61 + now / 18) % 410);
      const y = 36 + ((index * 37) % 185);
      ctx.fillStyle = index % 2 ? "#70ec8c" : "#c068ff";
      ctx.fillRect(Math.round(x), y, 5, 1);
      ctx.fillRect(Math.round(x + 2), y - 2, 1, 5);
    }
  } else {
    ctx.fillStyle = "rgba(255, 122, 56, 0.52)";
    for (let index = 0; index < 9; index += 1) {
      const x = 90 + ((index * 97 + now / 30) % 300);
      const y = 230 - ((index * 29 + now / 22) % 120);
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }
  ctx.restore();
}

function drawSensoryLayer() {
  if (state.phase !== "playing") return;
  const self = state.players.find(player => player.id === selfId);
  if (!self || self.role !== "operator") return;

  ctx.save();
  ctx.fillStyle = "rgba(1, 3, 4, 0.94)";
  ctx.fillRect(0, 0, 480, 270);
  ctx.globalCompositeOperation = "destination-out";
  const light = ctx.createRadialGradient(self.x, self.y - 9, 8, self.x, self.y - 9, 58);
  light.addColorStop(0, "rgba(0, 0, 0, 1)");
  light.addColorStop(0.55, "rgba(0, 0, 0, 0.82)");
  light.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(self.x - 60, self.y - 69, 120, 120);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 248, 220, 0.52)";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(self.x - 24), Math.round(self.y - 45), 48, 48);
  ctx.restore();
}

function drawModuleStates(now) {
  const progress = state.puzzleView?.progress;
  const self = state.players.find(player => player.id === selfId);
  const nearby = self ? nearestModule(self) : null;
  const solved = {
    wires: progress?.wiresSolved,
    glyphs: progress?.glyphsSolved,
    coolant: progress?.coolantSolved
  };
  const colors = { wires: "#ff3b35", glyphs: "#55e6ec", coolant: "#ffd85a" };

  for (const module of Object.values(currentModules())) {
    const active = progress?.activeModule === module.id;
    ctx.globalAlpha = solved[module.id] || active ? 1 : 0.38;
    ctx.strokeStyle = solved[module.id] ? "#70ec8c" : colors[module.id];
    ctx.lineWidth = nearby?.id === module.id ? 3 : 2;
    const size = nearby?.id === module.id && Math.floor(now / 240) % 2 === 0 ? 42 : 38;
    ctx.strokeRect(module.x - size / 2, module.y - size / 2, size, size);
    ctx.fillStyle = solved[module.id] ? "#70ec8c" : colors[module.id];
    ctx.fillRect(module.x - 4, module.y - 4, 8, 8);
    if (solved[module.id]) {
      ctx.fillStyle = "#080a0c";
      ctx.fillRect(module.x - 1, module.y - 3, 2, 6);
      ctx.fillRect(module.x - 3, module.y - 1, 6, 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlayers(now) {
  const viewer = state.players.find(player => player.id === selfId);
  for (const player of state.players) {
    if (viewer?.role === "operator" && player.id !== selfId) {
      drawGuideBeacon(player.x, player.y, player.role, now);
      continue;
    }
    drawCrew(
      player.x,
      player.y,
      player.role,
      now,
      player.id === selfId,
      player.facing,
      player.moving,
      player.action,
      player.actionAgeMs
    );
    if (viewer?.role === "lookout" && player.role === "operator") drawTrackingReticle(player.x, player.y, now);
  }
  if (state.phase === "playing" && (viewer?.moving || Object.values(input).some(Boolean)) && now - lastFootstepAt > 280) {
    lastFootstepAt = now;
    audio.play("step");
  }
}

function drawGuideBeacon(x, y, role, now) {
  const accent = ROLE_COLORS[role] || ROLE_COLORS.observer;
  const pulse = 8 + Math.floor(now / 180) % 4 * 3;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.round(x - pulse), Math.round(y - pulse), pulse * 2, pulse * 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
  ctx.fillRect(Math.round(x - 10), Math.round(y), 6, 2);
  ctx.fillRect(Math.round(x + 4), Math.round(y), 6, 2);
  ctx.fillRect(Math.round(x), Math.round(y - 10), 2, 6);
  ctx.fillRect(Math.round(x), Math.round(y + 4), 2, 6);
  ctx.restore();
}

function drawTrackingReticle(x, y, now) {
  const pulse = Math.floor(now / 220) % 2;
  const size = 22 + pulse * 4;
  ctx.save();
  ctx.strokeStyle = ROLE_COLORS.operator;
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.round(x - size), Math.round(y - size - 14), size * 2, size * 2);
  ctx.fillStyle = ROLE_COLORS.operator;
  ctx.fillRect(Math.round(x - 3), Math.round(y - size - 19), 6, 3);
  ctx.restore();
}

function drawCrew(x, y, role, now, self, facing = "down", moving = false, action = null, actionAgeMs = 0) {
  const accent = ROLE_COLORS[role] || ROLE_COLORS.observer;
  const walking = !action && (moving || (self && Object.values(input).some(Boolean)));
  const frame = action
    ? Math.min(3, Math.floor(Math.max(0, actionAgeMs) / 225))
    : walking ? Math.floor(now / 115) % 4 : 0;
  const row = action || !walking ? 1 : 0;
  const py = Math.round(y);

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x - 13, py + 10, 26, 5);

  const sheet = crewSheets[role];
  if (sheet?.complete && sheet.naturalWidth > 0) {
    const sourceWidth = sheet.naturalWidth / 4;
    const sourceHeight = sheet.naturalHeight / 2;
    const drawHeight = role === "operator" ? 61 : 58;
    const drawWidth = drawHeight * (sourceWidth / sourceHeight);

    ctx.save();
    ctx.translate(Math.round(x), Math.round(py + 13));
    if (facing === "left") ctx.scale(-1, 1);
    ctx.drawImage(
      sheet,
      frame * sourceWidth,
      row * sourceHeight,
      sourceWidth,
      sourceHeight,
      -drawWidth / 2,
      -drawHeight,
      drawWidth,
      drawHeight
    );
    ctx.restore();
  } else if (crewAtlas.complete && crewAtlas.naturalWidth > 0) {
    drawStaticCrew(x, py, role, facing);
  } else {
    drawCrewFallback(x, py, accent);
  }

  drawRoleDamage(x, py, role);
  drawRoleEquipment(x, py, role, now);
  if (action) drawActionEffect(x, py, role, frame, accent);

  if (self) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 5, py - 56, 10, 6);
    ctx.fillStyle = accent;
    ctx.fillRect(x - 2, py - 54, 4, 2);
  }
}

function drawRoleEquipment(x, py, role, now) {
  const phase = Math.floor(now / 180) % 4;
  ctx.save();
  if (role === "operator") {
    ctx.strokeStyle = `rgba(255, 59, 53, ${0.2 + phase * 0.18})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 13 - phase, py - 42 - phase, 26 + phase * 2, 16 + phase * 2);
  } else if (role === "lookout") {
    ctx.fillStyle = phase < 2 ? "#fff8dc" : ROLE_COLORS.lookout;
    ctx.fillRect(x + 10, py - 50, 3, 3);
    ctx.fillStyle = "rgba(85, 230, 236, 0.45)";
    ctx.fillRect(x + 13, py - 49, 4 + phase * 2, 1);
  } else if (role === "scribe") {
    ctx.fillStyle = phase % 2 ? ROLE_COLORS.scribe : "#fff8dc";
    ctx.fillRect(x - 7, py - 16, 14, 2);
    ctx.fillRect(x - 5 + phase * 2, py - 13, 3, 2);
  }
  ctx.restore();
}

function drawRoleDamage(x, py, role) {
  ctx.save();
  ctx.lineWidth = 2;
  if (role === "operator") {
    ctx.fillStyle = "#050607";
    ctx.fillRect(x - 10, py - 38, 20, 7);
    ctx.fillStyle = ROLE_COLORS.operator;
    ctx.fillRect(x - 9, py - 36, 18, 2);
  } else if (role === "lookout") {
    ctx.strokeStyle = ROLE_COLORS.lookout;
    for (const side of [-1, 1]) {
      const earX = x + side * 12;
      ctx.fillStyle = "#050607";
      ctx.fillRect(earX - 3, py - 37, 6, 9);
      ctx.beginPath();
      ctx.moveTo(earX - 3, py - 37);
      ctx.lineTo(earX + 3, py - 28);
      ctx.moveTo(earX + 3, py - 37);
      ctx.lineTo(earX - 3, py - 28);
      ctx.stroke();
    }
  } else if (role === "scribe") {
    ctx.fillStyle = "#050607";
    ctx.fillRect(x - 8, py - 27, 16, 6);
    ctx.strokeStyle = ROLE_COLORS.scribe;
    ctx.beginPath();
    ctx.moveTo(x - 6, py - 27);
    ctx.lineTo(x + 6, py - 21);
    ctx.moveTo(x + 6, py - 27);
    ctx.lineTo(x - 6, py - 21);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOutcomeEffects(now) {
  if (!state || !["won", "lost"].includes(state.phase)) return;
  const age = state.outcomeAgeMs + Math.max(0, now - stateReceivedAt);
  const cx = 240;
  const cy = 134;

  if (state.phase === "won") {
    const pulse = Math.floor(age / 120) % 5;
    ctx.save();
    ctx.globalAlpha = Math.max(0.25, 1 - age / 2600);
    ctx.strokeStyle = pulse % 2 ? ROLE_COLORS.lookout : "#70ec8c";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 18 - pulse * 5, cy - 18 - pulse * 5, 36 + pulse * 10, 36 + pulse * 10);
    ctx.fillStyle = "rgba(112, 236, 140, 0.22)";
    ctx.fillRect(cx - 34, cy - 34, 68, 68);
    for (let index = 0; index < 18; index += 1) {
      const angle = index * 2.399;
      const distance = 34 + ((age / 18 + index * 11) % 70);
      ctx.fillStyle = index % 3 === 0 ? "#fff8dc" : index % 2 ? "#70ec8c" : "#55e6ec";
      ctx.fillRect(Math.round(cx + Math.cos(angle) * distance), Math.round(cy + Math.sin(angle) * distance), 3, 3);
    }
    ctx.restore();
    return;
  }

  const blast = Math.min(1, age / 1250);
  ctx.save();
  if (age < 180) {
    ctx.globalAlpha = 1 - age / 180;
    ctx.fillStyle = "#fff8dc";
    ctx.fillRect(0, 0, 480, 270);
  }
  if (explosionSheet.complete && explosionSheet.naturalWidth > 0) {
    const sourceWidth = explosionSheet.naturalWidth / 4;
    const sourceHeight = explosionSheet.naturalHeight / 2;
    const frame = Math.min(7, Math.floor(age / 170));
    const drawSize = 92 + Math.min(frame, 4) * 18;
    ctx.globalAlpha = frame === 7 ? 0.82 : 1;
    ctx.drawImage(
      explosionSheet,
      (frame % 4) * sourceWidth,
      Math.floor(frame / 4) * sourceHeight,
      sourceWidth,
      sourceHeight,
      cx - drawSize / 2,
      cy - drawSize / 2,
      drawSize,
      drawSize
    );
  }
  for (let index = 0; index < 32; index += 1) {
    const angle = index * 2.21;
    const speed = 45 + (index % 7) * 14;
    const distance = blast * speed;
    const particleX = cx + Math.cos(angle) * distance;
    const particleY = cy + Math.sin(angle) * distance + blast * blast * (index % 4) * 18;
    ctx.fillStyle = index % 4 === 0 ? "#fff8dc" : index % 2 ? "#ff3b35" : "#ff9f35";
    ctx.fillRect(Math.round(particleX), Math.round(particleY), 3 + index % 3, 3 + index % 3);
  }
  ctx.restore();
}

function drawStaticCrew(x, py, role, facing) {
  const spriteIndex = ROLE_SPRITE_INDEX[role] ?? ROLE_SPRITE_INDEX.observer;
  const sourceWidth = crewAtlas.naturalWidth / 3;
  const sourceHeight = crewAtlas.naturalHeight;
  const drawHeight = role === "operator" ? 50 : 47;
  const drawWidth = drawHeight * (sourceWidth / sourceHeight);

  ctx.save();
  ctx.translate(Math.round(x), Math.round(py + 13));
  if (facing === "left") ctx.scale(-1, 1);
  ctx.drawImage(
    crewAtlas,
    spriteIndex * sourceWidth,
    0,
    sourceWidth,
    sourceHeight,
    -drawWidth / 2,
    -drawHeight,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

function drawActionEffect(x, py, role, frame, accent) {
  if (frame < 1 || frame > 2) return;
  const side = role === "scribe" ? -1 : 1;
  const pulse = frame === 2 ? 5 : 3;
  ctx.save();
  ctx.globalAlpha = frame === 2 ? 0.95 : 0.55;
  ctx.fillStyle = accent;
  ctx.fillRect(x + side * 15, py - 22, pulse, 2);
  ctx.fillRect(x + side * 18, py - 25, 2, pulse);
  ctx.restore();
}

function drawCrewFallback(x, py, accent) {
  ctx.fillStyle = "#f4f0da";
  ctx.fillRect(x - 7, py - 12, 14, 5);
  ctx.fillRect(x - 9, py - 7, 18, 13);
  ctx.fillStyle = "#172024";
  ctx.fillRect(x - 5, py - 9, 10, 6);
  ctx.fillRect(x - 6, py + 1, 12, 7);
  ctx.fillStyle = accent;
  ctx.fillRect(x - 9, py - 1, 18, 4);
  ctx.fillRect(x - 7, py + 8, 5, 5);
  ctx.fillRect(x + 2, py + 8, 5, 5);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 3, py - 7, 2, 2);
  ctx.fillRect(x + 2, py - 7, 2, 2);
}

function drawTutorialCrew(now) {
  const self = state.players.find(player => player.id === selfId);
  const demonstrations = [
    { role: "operator", x: 126, y: 158, action: "communicate", offset: 0 },
    { role: "lookout", x: 204, y: 66, action: "scan", offset: 850 },
    { role: "scribe", x: 276, y: 66, action: "record", offset: 1700 }
  ];
  for (const demo of demonstrations) {
    if (demo.role === self?.role) continue;
    const cycle = (now + demo.offset) % 2800;
    if (self?.role === "operator") {
      drawGuideBeacon(demo.x, demo.y, demo.role, now);
    } else {
      drawCrew(demo.x, demo.y, demo.role, now, false, "down", false, cycle < 850 ? demo.action : null, cycle);
      if (self?.role === "lookout" && demo.role === "operator") drawTrackingReticle(demo.x, demo.y, now);
    }
  }
}

function createAudioEngine() {
  const profiles = {
    menu: { notes: [55, 73.42, 82.41, 65.41], interval: 720, type: "triangle", volume: 0.025 },
    reactor: { notes: [82.41, 110, 123.47, 146.83, 110, 164.81], interval: 360, type: "square", volume: 0.032 },
    cryo: { notes: [65.41, 98, 130.81, 103.83, 82.41, 146.83], interval: 470, type: "sine", volume: 0.036 },
    signal: { notes: [98, 146.83, 196, 293.66, 220, 174.61], interval: 300, type: "triangle", volume: 0.034 }
  };
  let context = null;
  let filter = null;
  let master = null;
  let musicTimer = null;
  let scene = "menu";
  let role = null;
  let muted = false;
  let musicStep = 0;

  function ensureContext() {
    if (context) return true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
    filter = context.createBiquadFilter();
    filter.type = "lowpass";
    master = context.createGain();
    filter.connect(master);
    master.connect(context.destination);
    updateMix();
    restartMusic();
    return true;
  }

  function start() {
    if (!ensureContext()) return;
    if (context.state === "suspended") context.resume();
  }

  function updateMix() {
    if (!context) return;
    const now = context.currentTime;
    filter.frequency.setTargetAtTime(role === "lookout" ? 420 : 12000, now, 0.08);
    master.gain.setTargetAtTime(muted || role === "lookout" ? 0 : 0.42, now, 0.04);
  }

  function tone(frequency, duration, volume, type = "square", delay = 0) {
    if (!context || muted) return;
    const startAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  }

  function noise(duration, volume, cutoff = 1200) {
    if (!context || muted) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    const localFilter = context.createBiquadFilter();
    const gain = context.createGain();
    localFilter.type = "lowpass";
    localFilter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.buffer = buffer;
    source.connect(localFilter);
    localFilter.connect(gain);
    gain.connect(filter);
    source.start();
  }

  function playBeat() {
    if (!context || context.state !== "running" || muted) return;
    const profile = profiles[scene] || profiles.reactor;
    const note = profile.notes[musicStep % profile.notes.length];
    tone(note, Math.min(0.32, profile.interval / 1000 * 0.72), profile.volume, profile.type);
    if (musicStep % 4 === 0) tone(note / 2, 0.46, profile.volume * 0.55, "sine");
    musicStep += 1;
  }

  function restartMusic() {
    clearInterval(musicTimer);
    musicStep = 0;
    if (!context) return;
    const profile = profiles[scene] || profiles.reactor;
    playBeat();
    musicTimer = setInterval(playBeat, profile.interval);
  }

  function setScene(nextScene = "menu", nextRole = null) {
    const sceneChanged = scene !== nextScene;
    scene = nextScene;
    role = nextRole;
    updateMix();
    if (sceneChanged) restartMusic();
  }

  function play(name) {
    if (!ensureContext()) return;
    if (context.state === "suspended") context.resume();
    if (name === "ui") tone(240, 0.07, 0.06, "square");
    if (name === "step") {
      tone(82, 0.045, 0.035, "square");
      noise(0.035, 0.018, 420);
    }
    if (name === "tool") {
      tone(330, 0.08, 0.07, "square");
      tone(495, 0.06, 0.045, "square", 0.06);
    }
    if (name === "ping") {
      tone(660, 0.1, 0.07, "sine");
      tone(880, 0.12, 0.05, "sine", 0.1);
    }
    if (name === "error") {
      tone(118, 0.34, 0.12, "sawtooth");
      tone(92, 0.42, 0.09, "square", 0.12);
    }
    if (name === "solve") [392, 523.25, 659.25].forEach((note, index) => tone(note, 0.18, 0.075, "square", index * 0.08));
    if (name === "win") [392, 493.88, 587.33, 783.99].forEach((note, index) => tone(note, 0.32, 0.095, "triangle", index * 0.13));
    if (name === "lose") {
      noise(1.25, 0.32, 1800);
      tone(76, 1.1, 0.18, "sawtooth");
      tone(48, 1.4, 0.14, "square", 0.16);
    }
  }

  function sync(previous, next, ownId) {
    const ownRole = next.players.find(player => player.id === ownId)?.role || null;
    setScene(next.scenario?.music || "menu", ownRole);
    if (!previous) return;
    if (next.mistakes > previous.mistakes) play("error");
    const solvedCount = room => {
      const progress = room?.puzzleView?.progress;
      return [progress?.wiresSolved, progress?.glyphsSolved, progress?.coolantSolved].filter(Boolean).length;
    };
    if (solvedCount(next) > solvedCount(previous)) play("solve");
    if (previous.phase !== next.phase && next.phase === "won") play("win");
    if (previous.phase !== next.phase && next.phase === "lost") play("lose");
  }

  function toggleMute() {
    muted = !muted;
    updateMix();
    return muted;
  }

  return { start, play, sync, setScene, toggleMute };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function colorLabel(color) {
  return ({ red: "КРАСНЫЙ", blue: "ГОЛУБОЙ", lime: "ЗЕЛЕНЫЙ", gold: "ЖЕЛТЫЙ", pink: "РОЗОВЫЙ", white: "БЕЛЫЙ" })[color] || String(color).toUpperCase();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);
}
