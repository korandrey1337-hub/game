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
const quickPingButtons = [...document.querySelectorAll("[data-ping]")];
const endOverlay = document.querySelector("#endOverlay");
const endKicker = document.querySelector("#endKicker");
const endTitle = document.querySelector("#endTitle");
const endReason = document.querySelector("#endReason");
const endStats = document.querySelector("#endStats");

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
  lookout: { short: "НЕ СЛЫШИТ", detail: "АУДИОКАНАЛ ОТКЛЮЧЕН · СКАНИРУЕТ" },
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

const audio = createAudioEngine();

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
  const muted = audio.toggleMute();
  audioButton.textContent = "♫";
  audioButton.classList.toggle("is-muted", muted);
  audioButton.title = muted ? "Включить звук" : "Выключить звук";
  audioButton.setAttribute("aria-label", audioButton.title);
});
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
  send({ type: "chat", text });
  chatInput.value = "";
  canvas.focus();
});

quickPingButtons.forEach(button => {
  button.addEventListener("click", () => {
    audio.play("ping");
    send({ type: "ping", text: button.dataset.ping });
    canvas.focus();
  });
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
  if (document.hidden) releaseAllInput();
});
window.addEventListener("blur", releaseAllInput);

setInterval(sendInput, 80);
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
  connectionStatus.textContent = "";
  bootScreen.classList.remove("is-hidden");
  gameShell.classList.add("is-hidden");
  joinButton.disabled = false;
  tutorialButton.disabled = false;
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
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

  roomCode.textContent = state.tutorial ? "УЧЕБА" : state.code;
  roleName.textContent = `${ROLE_LABELS[self?.role] || "ЗРИТЕЛЬ"} · ${ROLE_TRAITS[self?.role]?.short || "НАБЛЮДАЕТ"}`;
  scenarioName.textContent = scenario?.name || "ОЖИДАНИЕ СМЕНЫ";
  canvasStage.style.setProperty("--scenario-bg", `url("${scenario?.background || "./assets/reactor-room-v2.png"}")`);
  canvasStage.dataset.scenario = scenario?.id || "reactor";
  timer.textContent = formatTime(state.timer);
  strikes.textContent = `${state.mistakes}/${state.maxMistakes}`;
  crewCount.textContent = `${state.players.length} В СЕТИ`;

  lobbyPanel.hidden = !inLobby;
  relayPanel.hidden = inLobby || state.tutorial || state.phase !== "playing";
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
    endButton.textContent = state.tutorial ? "В ОНЛАЙН-МЕНЮ" : "НОВАЯ СМЕНА";
  }

  startButton.textContent = state.phase === "lobby" ? "НАЧАТЬ СМЕНУ" : "НОВАЯ СМЕНА";
  startButton.disabled = !["lobby", "won", "lost"].includes(state.phase);

  players.innerHTML = state.players.map(player => `
    <div class="player">
      <span class="role-avatar role-${player.role}" aria-hidden="true"><img src="./assets/crew-atlas-v1.png" alt=""></span>
      <span class="player-copy"><strong>${escapeHtml(player.nick)}</strong><small>${ROLE_LABELS[player.role] || "ЗРИТЕЛЬ"} · ${ROLE_TRAITS[player.role]?.short || "НАБЛЮДАЕТ"}</small></span>
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
  chatInput.disabled = mutedRole;
  chatForm.querySelector("button").disabled = mutedRole;
  chatInput.placeholder = mutedRole ? "ГОЛОСОВОЙ МОДУЛЬ ОТКЛЮЧЕН — ИСПОЛЬЗУЙТЕ СИГНАЛЫ" : "СООБЩЕНИЕ КОМАНДЕ";
  renderRoleSignals(self?.role);

  renderObjective(self, nearby);
  renderConsole(self, nearby);
  renderLog();
  renderStory(self, nearby);
  renderProximity(self, nearby);
}

function renderRoleSignals(role) {
  const signals = role === "scribe"
    ? ["ПРАВИЛО ГОТОВО", "ПОВТОРИТЕ СКАН", "СТОП"]
    : role === "lookout"
      ? ["СКАН ГОТОВ", "НУЖНО ПРАВИЛО", "ПОВТОРЯЮ"]
      : ["НУЖЕН СКАНЕР", "НУЖНО ПРАВИЛО", "Я У МОДУЛЯ"];
  quickPingButtons.forEach((button, index) => {
    button.textContent = signals[index];
    button.dataset.ping = signals[index];
  });
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
    if (!view.progress.wiresSolved) {
      kicker = "ОБУЧЕНИЕ · ШАГ 1 ИЗ 3";
      text = nearby?.id === "wires"
        ? `Вы у терминала. ЭХО видит ${colorLabel(view.training.wireColor)} провод в гнезде ${view.training.wireSlot}. Нажмите клавишу ${view.training.wireSlot}.`
        : "Зажмите W или стрелку вверх и подойдите к красному терминалу ПРОВОДА слева.";
    } else if (!view.progress.glyphsSolved) {
      kicker = "ОБУЧЕНИЕ · ШАГ 2 ИЗ 3";
      text = nearby?.id === "glyphs"
        ? `Порядок пластин: ${view.training.glyphSlots.join(" → ")}. Нажмите эти клавиши по очереди.`
        : "Провода готовы. Подойдите к голубому терминалу ЗНАКИ справа.";
    } else if (!view.progress.coolantSolved) {
      kicker = "ОБУЧЕНИЕ · ШАГ 3 ИЗ 3";
      text = nearby?.id === "coolant"
        ? `Выставьте ${view.training.coolant.map(tank => `${tank.label}=${tank.target}`).join(", ")}, затем нажмите Enter или ПОДТВЕРДИТЬ.`
        : "Остался желтый терминал ОХЛАЖДЕНИЕ внизу.";
    }
  } else if (self?.role === "operator") {
    text = nearby
      ? nearby.id === activeModule
        ? `Оптика отключена. Получите решение для модуля ${nearby.name} от команды и используйте клавиши 1–4.`
        : `Этот терминал заблокирован. Следующая цель: ${activeName}.`
      : `Следующая цель: ${activeName}. Вы не видите данные, но только вы управляете терминалами.`;
  } else if (self?.role === "lookout") {
    text = `Аудиоканал заглушён. Сканируйте данные для цели ${activeName} и передавайте их текстом.`;
  } else if (self?.role === "scribe") {
    text = `Голосовой модуль отключен. Сопоставьте правило для ${activeName} и передайте решение короткими сигналами.`;
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
  } else {
    consoleKicker.textContent = "РОЛЕВАЯ КОНСОЛЬ";
    consoleTitle.textContent = ROLE_LABELS[self.role];
    keyHelp.textContent = "ПЕРЕДАЙТЕ ДАННЫЕ";
  }

  renderIntel(self, nearby);
  renderActions(self, nearby);
}

function renderIntel(self, nearby) {
  const view = state.puzzleView;

  if (state.tutorial && nearby) {
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
    intelPanel.innerHTML = `
      <div class="data-list">
        ${view.scanner.wires.map(wire => `<div class="data-row"><span>ПРОВОД ${wire.slot}</span><strong>${colorLabel(wire.color)}</strong></div>`).join("")}
        ${view.scanner.glyphs.map(glyph => `<div class="data-row"><span>ПЛАСТИНА ${glyph.slot}</span><strong>${SYMBOL_LABELS[glyph.symbol] || glyph.symbol}</strong></div>`).join("")}
        ${view.scanner.coolant.map(tank => `<div class="data-row"><span>БАК ${tank.label}</span><strong>T=${tank.temp} · ${tank.value}</strong></div>`).join("")}
      </div>`;
    return;
  }

  if (view.role === "scribe") {
    intelPanel.innerHTML = `
      <div class="data-list">
        <div class="data-row"><span>ПРОВОДА</span><strong>${escapeHtml(view.manual.wire)}</strong></div>
        <div class="data-row"><span>ЗНАКИ</span><strong>${escapeHtml(view.manual.glyph)}</strong></div>
        <div class="data-row"><span>ОХЛАЖДЕНИЕ</span><strong>${escapeHtml(view.manual.coolant)}</strong></div>
      </div>`;
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
    proximityHint.textContent = self.role === "scribe" ? "СОПОСТАВЬТЕ ПРАВИЛО · ОТПРАВЬТЕ СИГНАЛ" : "СКАНИРУЙТЕ · ПЕРЕДАВАЙТЕ ДАННЫЕ ТЕКСТОМ";
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
    const view = state.puzzleView;
    speaker = nearby ? (nearby.id === "wires" ? "ЭХО" : "ЯРА") : "КУРАТОР";
    if (!view.progress.wiresSolved) text = nearby?.id === "wires" ? "Терминал активен. Решение уже показано крупно справа." : "Зажмите клавишу движения. Персонаж идет, пока клавиша удерживается.";
    else if (!view.progress.glyphsSolved) text = nearby?.id === "glyphs" ? "Нажимайте цифры в указанном порядке. Ошибка сбросит последовательность." : "Теперь идите к голубому терминалу справа.";
    else text = nearby?.id === "coolant" ? "Цифры 1–3 меняют клапаны. Enter подтверждает готовый набор." : "Последний терминал находится в нижней части комнаты.";
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
  const left = Math.max(0, self.x - 88);
  const right = Math.min(480, self.x + 88);
  const top = Math.max(0, self.y - 68);
  const bottom = Math.min(270, self.y + 68);
  ctx.fillStyle = "rgba(2, 4, 6, 0.22)";
  ctx.fillRect(0, 0, 480, top);
  ctx.fillRect(0, bottom, 480, 270 - bottom);
  ctx.fillRect(0, top, left, bottom - top);
  ctx.fillRect(right, top, 480 - right, bottom - top);
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
  for (const player of state.players) {
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
  }
  const self = state.players.find(player => player.id === selfId);
  if (state.phase === "playing" && (self?.moving || Object.values(input).some(Boolean)) && now - lastFootstepAt > 280) {
    lastFootstepAt = now;
    audio.play("step");
  }
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
  const lookoutCycle = now % 2600;
  const scribeCycle = (now + 1300) % 2600;
  drawCrew(204, 66, "lookout", now, false, "down", false, lookoutCycle < 900 ? "scan" : null, lookoutCycle);
  drawCrew(276, 66, "scribe", now, false, "down", false, scribeCycle < 900 ? "record" : null, scribeCycle);
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
    filter.frequency.setTargetAtTime(role === "lookout" ? 620 : 12000, now, 0.08);
    master.gain.setTargetAtTime(muted ? 0 : role === "lookout" ? 0.2 : 0.42, now, 0.04);
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
