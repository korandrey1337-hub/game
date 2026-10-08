import { CoreBelowStats } from "./stats.js";
import { createActionRenderer } from "./action-panel.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const canvasStage = document.querySelector(".canvas-stage");
const bootScreen = document.querySelector("#bootScreen");
const cinematic = document.querySelector("#cinematic");
const introVideo = document.querySelector("#introVideo");
const introPlay = document.querySelector("#introPlay");
const introSound = document.querySelector("#introSound");
const introRestart = document.querySelector("#introRestart");
const introSkip = document.querySelector("#introSkip");
const keyboardDone = document.querySelector("#keyboardDone");
const chatToggle = document.querySelector("#chatToggle");
const gameShell = document.querySelector("#gameShell");
const joinButton = document.querySelector("#joinButton");
const tutorialButton = document.querySelector("#tutorialButton");
const connectionStatus = document.querySelector("#connectionStatus");
const tutorialGate = document.querySelector("#tutorialGate");
const tutorialIntro = document.querySelector("#tutorialIntro");
const tutorialIntroStart = document.querySelector("#tutorialIntroStart");
const tutorialIntroBack = document.querySelector("#tutorialIntroBack");
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
const tutorialModuleLabel = document.querySelector("#tutorialModuleLabel");
const tutorialNextButton = document.querySelector("#tutorialNextButton");
const tutorialStepElements = [...document.querySelectorAll("[data-tutorial-step]")];
const workPanel = document.querySelector("#workPanel");
const relayPanel = document.querySelector("#relayPanel");
const players = document.querySelector("#players");
const roleButtons = document.querySelector("#roleButtons");
const objectiveCard = document.querySelector("#tutorialCard");
const intelPanel = document.querySelector("#intelPanel");
const actionPanel = document.querySelector("#actionPanel");
const setActionMarkup = createActionRenderer(actionPanel);
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

const TUTORIAL_COMPLETE_KEY = "core-below:tutorial-complete:v2";
const TUTORIAL_ROLE_ORDER = ["lookout", "scribe", "operator"];
const COOP_PHASES = ["scan", "route", "report", "terminal", "signal", "prepare", "sync", "action"];

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
let tutorialComplete = readTutorialComplete();

const audio = createAudioEngine();
const playerStats = new CoreBelowStats();
playerStats.startSession();
updateTutorialGate();

function dismissKeyboard() {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.isContentEditable) active.blur();
  keyboardDone.hidden = true;
}

function finishCinematic() {
  if (cinematic.hidden) return;
  introVideo.pause();
  cinematic.hidden = true;
  bootScreen.inert = false;
  dismissKeyboard();
}

bootScreen.inert = true;
introVideo.muted = true;
function updateIntroSound() {
  introSound.classList.toggle("is-muted", introVideo.muted);
  introSound.setAttribute("aria-label", introVideo.muted ? "Включить звук заставки" : "Выключить звук заставки");
  introSound.title = introSound.getAttribute("aria-label");
}
function playCinematic(withSound = false) {
  if (cinematic.hidden || introVideo.ended) return;
  if (withSound) introVideo.muted = false;
  updateIntroSound();
  introPlay.hidden = true;
  introVideo.play().catch(() => { if (!cinematic.hidden) introPlay.hidden = false; });
}
function autoStartCinematic() {
  if (!document.hidden) playCinematic();
}
introVideo.addEventListener("ended", () => {
  introPlay.textContent = "ПРОДОЛЖИТЬ →";
  introPlay.hidden = false;
  introRestart.hidden = false;
  introSkip.hidden = true;
});
introVideo.addEventListener("error", finishCinematic);
introSkip.addEventListener("click", finishCinematic);
introPlay.addEventListener("click", () => {
  if (introVideo.ended) finishCinematic();
  else playCinematic(true);
});
function restartCinematic() {
  dismissKeyboard();
  introVideo.currentTime = 0;
  cinematic.hidden = false;
  bootScreen.inert = true;
  introPlay.textContent = "▶ СМОТРЕТЬ ЗАСТАВКУ";
  introPlay.hidden = false;
  introRestart.hidden = true;
  introSkip.hidden = false;
  playCinematic(true);
}
document.querySelector("#introReplay").addEventListener("click", restartCinematic);
introRestart.addEventListener("click", restartCinematic);
introSound.addEventListener("click", () => {
  introVideo.muted = !introVideo.muted;
  updateIntroSound();
  if (introVideo.paused && !introVideo.ended) playCinematic();
});
updateIntroSound();
window.addEventListener("focus", autoStartCinematic);
window.addEventListener("blur", () => { if (!cinematic.hidden) introVideo.pause(); });
autoStartCinematic();
keyboardDone.addEventListener("click", dismissKeyboard);
document.querySelector("#rotateMenu").addEventListener("click", showMenu);
document.addEventListener("focusin", event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) keyboardDone.hidden = false;
});
document.addEventListener("focusout", () => {
  setTimeout(() => {
    keyboardDone.hidden = !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement);
  }, 0);
});
document.addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement && event.target !== chatInput && event.key === "Enter") {
    event.preventDefault();
    dismissKeyboard();
  }
});
document.addEventListener("pointerdown", event => {
  if (!(event.target instanceof Element) || event.target.closest("input, textarea, [contenteditable]")) return;
  dismissKeyboard();
});
document.addEventListener("contextmenu", event => {
  if (event.target instanceof Element && event.target.closest("button")) event.preventDefault();
});
function handleOrientationChange() {
  dismissKeyboard();
  releaseAllInput();
}
window.addEventListener("orientationchange", handleOrientationChange);
screen.orientation?.addEventListener("change", handleOrientationChange);
function updateVisibleViewport() {
  const viewport = window.visualViewport;
  const visibleHeight = viewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--visible-height", `${Math.round(visibleHeight)}px`);
  const keyboardInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(keyboardInset)}px`);
  gameShell.classList.toggle("is-compact", window.innerWidth > window.innerHeight && window.innerHeight <= 600);
}
updateVisibleViewport();
window.visualViewport?.addEventListener("resize", updateVisibleViewport);
window.visualViewport?.addEventListener("scroll", updateVisibleViewport);
window.addEventListener("resize", updateVisibleViewport);
const objectiveResize = new ResizeObserver(entries => {
  gameShell.style.setProperty("--compact-hint-height", `${Math.ceil(entries[0].target.getBoundingClientRect().height) + 6}px`);
});
objectiveResize.observe(objectiveCard);
chatToggle.addEventListener("click", () => {
  const open = gameShell.classList.toggle("is-chat-open");
  chatToggle.setAttribute("aria-expanded", String(open));
  if (!open) dismissKeyboard();
});

let menuTouchY = null;
bootScreen.addEventListener("touchstart", event => {
  menuTouchY = event.touches.length === 1 ? event.touches[0].clientY : null;
}, { passive: true });
bootScreen.addEventListener("touchmove", event => {
  if (menuTouchY === null || event.touches.length !== 1) return;
  const y = event.touches[0].clientY;
  const delta = y - menuTouchY;
  menuTouchY = y;
  const bottom = bootScreen.scrollHeight - bootScreen.clientHeight;
  // Keep overscroll gestures inside the embedded menu without blocking its scroll.
  if ((delta > 0 && bootScreen.scrollTop <= 0) || (delta < 0 && bootScreen.scrollTop >= bottom - 1)) {
    if (event.cancelable) event.preventDefault();
  }
}, { passive: false });
const endMenuTouch = () => { menuTouchY = null; };
bootScreen.addEventListener("touchend", endMenuTouch, { passive: true });
bootScreen.addEventListener("touchcancel", endMenuTouch, { passive: true });

joinButton.addEventListener("click", () => {
  if (!tutorialComplete) return;
  audio.start();
  audio.play("ui");
  connect(false);
});
tutorialButton.addEventListener("click", () => {
  dismissKeyboard();
  audio.start();
  audio.play("ui");
  tutorialIntro.hidden = false;
  tutorialIntroStart.focus();
});
tutorialIntroBack.addEventListener("click", closeTutorialIntro);
tutorialIntro.querySelector(".tutorial-intro-backdrop").addEventListener("click", closeTutorialIntro);
tutorialIntroStart.addEventListener("click", () => {
  closeTutorialIntro();
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
  if (state?.tutorial && state.phase === "lost") connect(true);
  else if (state?.tutorial) showMenu();
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

tutorialNextButton.addEventListener("click", () => {
  const self = state?.players.find(player => player.id === selfId);
  const currentIndex = TUTORIAL_ROLE_ORDER.indexOf(self?.role);
  const nextRole = TUTORIAL_ROLE_ORDER[currentIndex + 1];
  if (!state?.tutorial || !nextRole) return;
  audio.play("ui");
  releaseAllInput();
  symbolDraft = [];
  renderSymbolDraft();
  send({ type: "tutorialRole", role: nextRole });
  canvas.focus();
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
  const sent = send({ type: "interact", action, choice: button.dataset.choice,
    station: button.dataset.station, code: button.dataset.code,
    mode: button.dataset.mode === undefined ? undefined : Number(button.dataset.mode) });
  if (sent && ["report", "terminal", "signal", "cue"].includes(action)) playerStats.recordSignal();
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
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  if (event.code === "Escape" && !tutorialIntro.hidden) {
    closeTutorialIntro();
    return;
  }
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
    dismissKeyboard();
    introVideo.pause();
    releaseAllInput();
    flushStatsActivity();
    statsActivityStartedAt = null;
  } else {
    autoStartCinematic();
    statsActivityStartedAt = performance.now();
  }
});
window.addEventListener("blur", releaseAllInput);
window.addEventListener("blur", dismissKeyboard);
window.addEventListener("pagehide", flushStatsActivity);
window.addEventListener("pagehide", dismissKeyboard);

setInterval(sendInput, 80);
setInterval(flushStatsActivity, 15_000);
requestAnimationFrame(draw);

function readTutorialComplete() {
  try {
    return localStorage.getItem(TUTORIAL_COMPLETE_KEY) === "yes";
  } catch {
    return false;
  }
}

function markTutorialComplete() {
  if (tutorialComplete) return;
  tutorialComplete = true;
  try {
    localStorage.setItem(TUTORIAL_COMPLETE_KEY, "yes");
  } catch {
    // The current session still unlocks online play when storage is unavailable.
  }
  updateTutorialGate();
}

function updateTutorialGate() {
  joinButton.disabled = !tutorialComplete;
  roomInput.disabled = !tutorialComplete;
  joinButton.classList.toggle("primary", tutorialComplete);
  tutorialButton.classList.toggle("primary", !tutorialComplete);
  joinButton.textContent = tutorialComplete ? "ВОЙТИ В СМЕНУ" : "ОНЛАЙН ЗАКРЫТ";
  tutorialButton.textContent = tutorialComplete ? "ПОВТОРИТЬ ОБУЧЕНИЕ" : "НАЧАТЬ ОБУЧЕНИЕ";
  tutorialGate.classList.toggle("is-complete", tutorialComplete);
  tutorialGate.textContent = tutorialComplete
    ? "ОБУЧЕНИЕ ПРОЙДЕНО · ОНЛАЙН ДОСТУПЕН"
    : "СНАЧАЛА ПРОЙДИТЕ КОРОТКОЕ ОБУЧЕНИЕ · ОНЛАЙН ОТКРОЕТСЯ АВТОМАТИЧЕСКИ";
}

function closeTutorialIntro() {
  tutorialIntro.hidden = true;
  tutorialButton.focus();
}

function connect(tutorial) {
  dismissKeyboard();
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
      document.body.classList.remove("is-menu");
      document.body.classList.add("is-game");
      stateReceivedAt = performance.now();
      if (state.tutorial && state.phase === "won") markTutorialComplete();
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
    tutorialButton.disabled = false;
    activeButton.textContent = oldText;
    updateTutorialGate();
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
  dismissKeyboard();
  document.body.classList.remove("is-game");
  document.body.classList.add("is-menu");
  gameShell.classList.remove("is-chat-open");
  chatToggle.setAttribute("aria-expanded", "false");
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
  tutorialIntro.hidden = true;
  connectionStatus.textContent = "";
  bootScreen.classList.remove("is-hidden");
  gameShell.classList.add("is-hidden");
  tutorialButton.disabled = false;
  updateTutorialGate();
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
    const modulesSolved = progress?.resolvedCount || 0;
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
  document.querySelector("#compactTutorialStep").textContent = state.tutorial
    ? `${Math.max(0, COOP_PHASES.indexOf(view?.phase)) + 1}/${COOP_PHASES.length}`
    : `${Math.min((view?.progress?.incidentIndex || 0) + 1, view?.progress?.totalIncidents || 4)}/${view?.progress?.totalIncidents || 4}`;

  roomCode.textContent = state.tutorial ? "УЧЕБА" : state.code;
  roleName.textContent = `${ROLE_LABELS[self?.role] || "ЗРИТЕЛЬ"} · ${ROLE_TRAITS[self?.role]?.short || "НАБЛЮДАЕТ"}`;
  scenarioName.textContent = scenario?.name || "ОЖИДАНИЕ СМЕНЫ";
  canvasStage.style.setProperty("--scenario-bg", `url("${scenario?.background || "./assets/reactor-room-v2.png"}")`);
  canvasStage.dataset.scenario = scenario?.id || "reactor";
  canvasStage.classList.toggle("is-blind", state.phase === "playing" && self?.role === "operator");
  timer.textContent = state.tutorial ? "∞" : formatTime(state.timer);
  strikes.textContent = state.tutorial ? "УЧЕБА" : `${state.mistakes}/${state.maxMistakes}`;
  crewCount.textContent = `${state.players.length} В СЕТИ`;

  lobbyPanel.hidden = !inLobby;
  tutorialRoleBar.hidden = !state.tutorial || state.phase !== "playing";
  if (!tutorialRoleBar.hidden) renderTutorialProgress(self, view);
  relayPanel.hidden = inLobby || state.phase !== "playing";
  const finished = ["won", "lost"].includes(state.phase);
  const won = state.phase === "won";
  endOverlay.hidden = !finished;
  canvasStage.classList.toggle("outcome-won", finished && won);
  canvasStage.classList.toggle("outcome-lost", finished && !won);
  endOverlay.classList.toggle("is-won", finished && won);
  endOverlay.classList.toggle("is-lost", finished && !won);
  if (!endOverlay.hidden) {
    const completed = view?.progress?.resolvedCount || 0;
    const total = view?.progress?.totalIncidents || (state.tutorial ? 1 : 4);
    if (state.tutorial && won) {
      endKicker.textContent = "ОБУЧЕНИЕ ЗАВЕРШЕНО";
      endTitle.textContent = "ВЫ ГОТОВЫ К СМЕНЕ";
      endReason.textContent = "Вы поставили диагноз, объединили две подсказки и синхронно запустили ремонт. Онлайн-режим разблокирован.";
      endStats.textContent = "3 РОЛИ · ДИАГНОЗ · ПРАВИЛО · СИНХРОНИЗАЦИЯ";
    } else {
      endKicker.textContent = won ? "СМЕНА ЗАВЕРШЕНА" : "АВАРИЙНЫЙ ПРОТОКОЛ";
      endTitle.textContent = won ? "КОМАНДА СПАСЛА СМЕНУ" : "РЕАКТОР УНИЧТОЖЕН";
      endReason.textContent = won
        ? "Четыре аварии устранены совместными действиями экипажа."
        : state.outcomeReason === "timeout"
          ? "Время смены закончилось раньше, чем удалось справиться со всеми авариями."
          : "Шесть сбоев перегрузили аварийный контур.";
      endStats.textContent = won
        ? `${total}/${total} АВАРИИ · ${state.mistakes} СБОЕВ · ${formatTime(state.timer)} В ЗАПАСЕ`
        : `${completed}/${total} АВАРИИ · ${state.mistakes}/${state.maxMistakes} СБОЕВ`;
    }
    endButton.textContent = state.tutorial
      ? won ? "ПЕРЕЙТИ В ОНЛАЙН" : "ПОВТОРИТЬ ОБУЧЕНИЕ"
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
  const incidentTotal = progress?.totalIncidents || (state.tutorial ? 1 : 4);
  moduleDots.innerHTML = Array.from({ length: incidentTotal }, (_, index) => `<i class="module-dot ${index < (progress?.resolvedCount || 0) ? "done" : ""} ${index === progress?.incidentIndex && state.phase === "playing" ? "active" : ""}"></i>`).join("");
  document.querySelector(".station-wires span").textContent = modules.wires.name;
  document.querySelector(".station-glyphs span").textContent = modules.glyphs.name;
  document.querySelector(".station-coolant span").textContent = modules.coolant.name;
  for (const id of ["wires", "glyphs", "coolant"]) {
    document.querySelector(`.station-${id}`).classList.toggle("is-active", progress?.activeModule === id);
  }

  const mutedRole = self?.role === "scribe";
  chatForm.hidden = mutedRole;
  quickPings.hidden = true;
  routeControls.hidden = self?.role !== "lookout" || !view?.team?.routeReady || view.team.clueReported === null || view.team.operatorArmed;
  symbolRelay.hidden = true;
  touchControls.hidden = self?.role === "lookout";
  chatInput.disabled = mutedRole;
  chatForm.querySelector("button").disabled = mutedRole;
  chatInput.placeholder = "СООБЩЕНИЕ КОМАНДЕ";
  renderSymbolDraft();
  renderRoleSignals(self?.role);
  updateAudioButton(self?.role);

  renderObjective(self, nearby);
  renderConsole(self, nearby);
  gameShell.dataset.consoleOpen = String(!workPanel.hidden);
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

function renderTutorialProgress(self, view) {
  const currentIndex = Math.max(0, TUTORIAL_ROLE_ORDER.indexOf(self?.role));

  tutorialModuleLabel.textContent = "УЧЕБНАЯ АВАРИЯ · ОДНО ДЕЙСТВИЕ ЗА РАЗ";
  tutorialStepElements.forEach((element, index) => {
    const done = [view.team.clueReported !== null, view.team.signalReady, view.team.operatorArmed][index];
    element.classList.toggle("is-complete", done);
    element.classList.toggle("is-current", index === currentIndex);
    element.classList.toggle("is-locked", index > currentIndex);
  });
  tutorialNextButton.hidden = true;
}

function renderObjective(self, nearby) {
  if (state.phase === "lobby" || ["won", "lost"].includes(state.phase)) {
    objectiveCard.hidden = true;
    return;
  }

  const view = state.puzzleView;
  const activeModule = view?.progress?.activeModule;
  const activeName = activeModule ? currentModules()[activeModule].name : "ЦЕЛЬ";
  const incidentNumber = (view?.progress?.incidentIndex || 0) + 1;
  const total = view?.progress?.totalIncidents || 4;
  let kicker = `АВАРИЯ ${incidentNumber}/${total} · ${view?.incident?.title || "ТРЕВОГА"}`;
  let text = view?.incident?.alert || "Дождитесь новой задачи.";

  if (view?.chaos) {
    kicker = `СБОЙ · ${view.chaos.label}`;
    text = "Ничего страшного: помеха исчезнет через несколько секунд. Продолжайте действовать вместе.";
  } else if (self?.role === "lookout") {
    text = !view.team.scanned
      ? "Сканируйте узлы: сравните их показания с нормальным диапазоном."
      : !view.team.routeReady
        ? "Выберите узел с показанием вне нормы. Исправные узлы не отмечайте."
        : view.team.clueReported === null
          ? "Найдите рисунок сигнала в легенде и передайте соответствующий код."
          : !view.team.operatorArmed
            ? `Ведите оператора к станции ${activeName} стрелками. Затем понадобится ваша команда на запуск.`
            : view.team.cueRemainingMs > 0
              ? "Команда дана! У оператора короткое окно для запуска ремонта."
              : "Дождитесь, когда стрелка попадёт в зелёную зону, и дайте команду «Сейчас».";
  } else if (self?.role === "scribe") {
    text = !view.team.routeReady
      ? "Ждите диагноза наблюдателя. Затем появятся правила ремонта."
      : view.team.clueReported === null || view.team.modeReported === null
        ? "Для решения нужны код наблюдателя и режим терминала от оператора. Изучите три правила."
      : !view.team.signalReady
        ? "Код: строка. Режим: столбец. Выберите инструмент."
        : "Решение передано. Наблюдатель и оператор должны синхронно закончить ремонт.";
  } else if (self?.role === "operator") {
    text = !view.team.routeReady
      ? "Ждите диагноза. Наблюдатель найдёт цель и направит вас стрелками."
      : view.team.modeReported === null
        ? nearby?.id === activeModule
          ? "Прочитайте режим терминала и передайте + или − архивариусу."
          : `Найдите станцию ${activeName} по командам наблюдателя и прочитайте её терминал.`
      : !view.team.signalReady
        ? "Режим передан. Архивариус объединяет две подсказки и выбирает инструмент."
        : !view.team.operatorArmed
          ? "Подключите инструмент, который выбрал архивариус. Затем дождитесь команды наблюдателя."
          : view.team.cueRemainingMs > 0 ? "СЕЙЧАС! Нажмите «Запустить ремонт», пока окно не закрылось."
            : "Инструмент готов. Не запускайте ремонт, пока наблюдатель не даст команду «Сейчас».";
  } else {
    text = "Следите за тремя этапами командной работы.";
  }

  if (state.tutorial) {
    const phaseLabel = ({ scan: "СКАН", route: "ДИАГНОЗ", report: "КОД", terminal: "РЕЖИМ", signal: "ПРАВИЛО", prepare: "ИНСТРУМЕНТ", sync: "БЕЗОПАСНЫЙ МОМЕНТ", action: "ЗАПУСК" })[view.phase] || "ШАГ";
    kicker = `ОБУЧЕНИЕ · ${ROLE_LABELS[self?.role]} · ${phaseLabel}`;
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
    consoleKicker.textContent = "СТАНЦИЯ РЕМОНТА";
    consoleTitle.textContent = nearby.name;
    keyHelp.textContent = "ВЫБОР 1–3";
  } else if (self.role === "scribe") {
    consoleKicker.textContent = "ДВЕ ПОДСКАЗКИ";
    consoleTitle.textContent = "ПРАВИЛА РЕМОНТА";
    keyHelp.textContent = "КОД + РЕЖИМ";
  } else {
    consoleKicker.textContent = "ДИАГНОСТИКА И СИНХРОНИЗАЦИЯ";
    consoleTitle.textContent = view.team.operatorArmed ? "КОНТРОЛЬ ДАВЛЕНИЯ" : "СКАНЕР УЗЛОВ";
    keyHelp.textContent = "СРАВНИТЕ ПОКАЗАНИЯ";
  }

  renderIntel(self, nearby);
  renderActions(self, nearby);
}

function renderIntel(self, nearby) {
  const view = state.puzzleView;

  if (view.role === "lookout") {
    if (view.team.operatorArmed) {
      const pressure = view.pressure ?? 0;
      intelPanel.innerHTML = `<div class="pressure-readout"><span>БЕЗОПАСНАЯ ЗОНА: 25–75</span>
        <strong>${pressure}</strong><div class="pressure-track"><span class="pressure-safe"></span><i style="left:${pressure}%"></i></div>
        <small>${view.team.cueRemainingMs > 0 ? "КОМАНДА ДАНА · ЖДЁМ ОПЕРАТОРА" : "СЛЕДИТЕ ЗА СТРЕЛКОЙ"}</small></div>`;
    } else if (!view.scanner) {
      intelPanel.innerHTML = '<div class="big-readout waiting"><span>ПОКАЗАНИЯ НЕ ПОЛУЧЕНЫ</span><strong>?</strong><small>Запустите сканер</small></div>';
    } else if (!view.team.routeReady) {
      intelPanel.innerHTML = `<p class="diagnostic-normal">НОРМА: ${view.scanner.normalMin}–${view.scanner.normalMax}</p>`;
    } else if (view.team.clueReported === null) {
      intelPanel.innerHTML = `<div class="diagnostic-pattern"><span>СИГНАЛ УЗЛА</span><strong>${escapeHtml(view.scanner.pattern)}</strong></div>
        <div class="diagnostic-legend">${view.scanner.legend.map(code => `<span>${escapeHtml(code.pattern)} → <b>${escapeHtml(code.symbol)}</b></span>`).join("")}</div>`;
    } else {
      intelPanel.innerHTML = `<p class="route-target">ЦЕЛЬ: ${escapeHtml(currentModules()[view.progress.activeModule]?.name || "УЗЕЛ")}</p>`;
    }
    return;
  }

  if (view.role === "scribe") {
    const code = view.manual?.rules.find(rule => rule.id === view.team.clueReported);
    const choice = id => view.manual.choices.find(item => item.id === id);
    intelPanel.innerHTML = view.manual
      ? `<div class="received-clues"><span>КОД: <b>${escapeHtml(code?.symbol || "?")}</b></span><span>РЕЖИМ: <b>${view.team.modeReported === null ? "?" : view.team.modeReported ? "−" : "+"}</b></span></div>
        <table class="repair-rules"><thead><tr><th>КОД</th><th>+</th><th>−</th></tr></thead><tbody>${view.manual.rules.map(rule => `<tr><th>${escapeHtml(rule.symbol)}</th>${[rule.normal, rule.inverted].map(id => `<td title="${escapeHtml(choice(id).label)}">${escapeHtml(choice(id).symbol)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : '<div class="big-readout waiting"><span>ЖДЁМ ДИАГНОЗ</span><strong>…</strong><small>Наблюдатель сравнивает показания</small></div>';
    return;
  }

  if (view.team.modeReported === null && view.terminal) {
    intelPanel.innerHTML = `<div class="big-readout"><span>РЕЖИМ ТЕРМИНАЛА</span><strong>${view.terminal.mode ? "−" : "+"}</strong><small>Передайте режим архивариусу</small></div>`;
    return;
  }
  if (view.team.operatorArmed) {
    intelPanel.innerHTML = `<div class="big-readout ${view.team.cueRemainingMs > 0 ? "sync-live" : "waiting"}"><span>КОМАНДА НАБЛЮДАТЕЛЯ</span><strong>${view.team.cueRemainingMs > 0 ? "СЕЙЧАС!" : "ЖДИТЕ"}</strong><small>${view.team.cueRemainingMs > 0 ? `${(view.team.cueRemainingMs / 1000).toFixed(1)} с` : "Давление видит только наблюдатель"}</small></div>`;
    return;
  }
  const signal = view.choices?.find(choice => choice.id === view.team.signalId);
  intelPanel.innerHTML = signal
    ? `<div class="big-readout symbol-readout"><span>ИНСТРУМЕНТ АРХИВАРИУСА</span><strong>${escapeHtml(signal.symbol)}</strong><small>Подключите инструмент для ремонта</small></div>`
    : '<div class="big-readout waiting"><span>ЖДЁМ СИМВОЛ</span><strong>…</strong><small>Не выбирайте наугад</small></div>';
}

function renderActions(self, nearby) {
  if (!state?.puzzleView || state.phase !== "playing" || !self) {
    setActionMarkup("");
    return;
  }
  const view = state.puzzleView;

  if (self.role === "lookout") {
    if (view.team.operatorArmed) {
      setActionMarkup(`<button class="primary wide-action" data-action="cue" ${view.team.cueRemainingMs > 0 ? "disabled" : ""}><b>!</b><span>СЕЙЧАС · ДАТЬ КОМАНДУ</span></button>`);
    } else if (!view.team.scanned) {
      setActionMarkup('<button class="primary wide-action" data-action="scan"><b>◉</b><span>СКАНИРОВАТЬ УЗЛЫ</span></button>');
    } else if (!view.team.routeReady) {
      setActionMarkup(view.scanner.readings.map(reading => `<button class="diagnostic-node" data-action="route" data-station="${reading.station}"><strong>${reading.value}</strong><span>${escapeHtml(currentModules()[reading.station].name)}</span></button>`).join(""));
    } else if (view.team.clueReported === null) {
      setActionMarkup(view.scanner.legend.map(code => `<button class="symbol-choice" data-action="report" data-code="${code.id}"><b>${escapeHtml(code.symbol)}</b><span>КОД</span></button>`).join(""));
    } else {
      showActionDone("МАРШРУТ ПЕРЕДАН · ВЕДИТЕ ОПЕРАТОРА СТРЕЛКАМИ");
    }
    return;
  }

  if (self.role === "scribe") {
    if (!view.manual) {
      showActionDone("ЖДЁМ, ПОКА НАБЛЮДАТЕЛЬ ПЕРЕДАСТ МАРШРУТ");
      return;
    }
    if (view.team.signalReady) {
      showActionDone("СИМВОЛ ПЕРЕДАН ОПЕРАТОРУ");
      return;
    }
    if (view.team.clueReported === null || view.team.modeReported === null) {
      showActionDone("ЖДЁМ КОД И РЕЖИМ ОТ КОМАНДЫ");
      return;
    }
    setActionMarkup(view.manual.choices.map((choice, index) => `
      <button class="symbol-choice" data-action="signal" data-choice="${escapeHtml(choice.id)}"><kbd>${index + 1}</kbd><b>${escapeHtml(choice.symbol)}</b><span>${escapeHtml(choice.label)}</span></button>
    `).join(""));
    return;
  }

  if (self.role !== "operator" || !nearby) {
    setActionMarkup("");
    return;
  }

  if (nearby.id !== view.progress.activeModule) {
    const target = currentModules()[view.progress.activeModule]?.name || "НУЖНАЯ СТАНЦИЯ";
    setActionMarkup(`<p class="locked-action">НЕ ТА СТАНЦИЯ · ИЩИТЕ ${escapeHtml(target)}</p>`);
    return;
  }

  if (view.team.modeReported === null && view.terminal) {
    setActionMarkup(`<div class="terminal-modes">${[0, 1].map(mode => `<button class="mode-choice" data-action="terminal" data-mode="${mode}"><b>${mode ? "−" : "+"}</b><span>ПЕРЕДАТЬ РЕЖИМ</span></button>`).join("")}</div>`);
    return;
  }
  if (!view.team.signalReady) {
    showActionDone("ЖДЁМ РЕШЕНИЕ АРХИВАРИУСА");
    return;
  }

  if (view.team.operatorArmed) {
    setActionMarkup(`<button class="primary wide-action" data-action="resolve" ${view.team.cueRemainingMs > 0 ? "" : "disabled"}><b>◎</b><span>ЗАПУСТИТЬ РЕМОНТ</span></button>`);
    return;
  }

  setActionMarkup(view.choices.map((choice, index) => `
    <button class="symbol-choice" data-action="prepare" data-choice="${escapeHtml(choice.id)}"><kbd>${index + 1}</kbd><b>${escapeHtml(choice.symbol)}</b><span>${escapeHtml(choice.label)}</span></button>
  `).join(""));
}

function showActionDone(text) {
  setActionMarkup(`<p>${text}</p>`);
}

function renderProximity(self, nearby) {
  if (state.phase !== "playing" || !self) {
    proximityHint.hidden = true;
    return;
  }
  proximityHint.hidden = false;
  if (self.role !== "operator") {
    proximityHint.textContent = self.role === "scribe"
      ? "ОБЪЕДИНИТЕ КОД И РЕЖИМ · ПЕРЕДАЙТЕ ИНСТРУМЕНТ"
      : "ДИАГНОЗ · КОД · НАПРАВЛЕНИЕ · БЕЗОПАСНЫЙ МОМЕНТ";
  } else if (nearby) {
    proximityHint.textContent = nearby.id === state.puzzleView?.progress?.activeModule
      ? `${nearby.name} · ТЕРМИНАЛ · ИНСТРУМЕНТ · ЗАПУСК`
      : `${nearby.name} · НЕ ТА СТАНЦИЯ`;
  } else {
    proximityHint.textContent = "WASD / СТРЕЛКИ · СЛЕДУЙТЕ К МАЯКУ КОМАНДЫ";
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
    text = "Все аварии устранены. Реактор работает штатно.";
  } else if (state.phase === "lost") {
    speaker = "ТРЕВОГА";
    text = "Смена провалена. Запустите новую попытку.";
  } else if (state.tutorial && state.puzzleView) {
    speaker = "КУРАТОР";
    text = objectiveCard.querySelector("p")?.textContent || "Сравните показания, объедините подсказки и согласуйте запуск ремонта.";
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
    drawTutorialRoute(now);
    if (state.tutorial && state.phase === "playing") drawTutorialCrew(now);
    drawPlayers(now);
    drawChaosEffects(now);
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
  const lightRadius = state.tutorial ? 92 : 76;
  const light = ctx.createRadialGradient(self.x, self.y - 9, 8, self.x, self.y - 9, lightRadius);
  light.addColorStop(0, "rgba(0, 0, 0, 1)");
  light.addColorStop(0.55, "rgba(0, 0, 0, 0.82)");
  light.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(self.x - lightRadius - 2, self.y - lightRadius - 11, (lightRadius + 2) * 2, (lightRadius + 2) * 2);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 248, 220, 0.52)";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(self.x - 24), Math.round(self.y - 45), 48, 48);
  ctx.restore();
}

function drawTutorialRoute(now) {
  if (state.phase !== "playing") return;
  const self = state.players.find(player => player.id === selfId);
  if (!self || self.role !== "operator") return;
  if (!state.tutorial && !state.puzzleView?.team?.routeReady) return;
  const activeId = state.puzzleView?.progress?.activeModule;
  const target = currentModules()[activeId];
  if (!target) return;
  if (!state.tutorial && Math.hypot(self.x - target.x, self.y - target.y) > 90) return;

  const pulse = Math.floor(now / 240) % 2;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = pulse ? "#ffd85a" : "#fff8dc";
  ctx.lineWidth = 2;
  if (state.tutorial) {
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(Math.round(self.x), Math.round(self.y - 8));
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeRect(target.x - 23 - pulse * 3, target.y - 23 - pulse * 3, 46 + pulse * 6, 46 + pulse * 6);
  ctx.fillStyle = "#ffd85a";
  ctx.fillRect(target.x - 3, target.y - 3, 6, 6);
  ctx.restore();
}

function drawModuleStates(now) {
  const progress = state.puzzleView?.progress;
  const self = state.players.find(player => player.id === selfId);
  const nearby = self ? nearestModule(self) : null;
  const colors = { wires: "#ff3b35", glyphs: "#55e6ec", coolant: "#ffd85a" };

  for (const module of Object.values(currentModules())) {
    const active = progress?.activeModule === module.id;
    const revealed = state.puzzleView?.team?.scanned || self?.role !== "lookout";
    ctx.globalAlpha = active && revealed ? 1 : 0.28;
    ctx.strokeStyle = active ? "#fff8dc" : colors[module.id];
    ctx.lineWidth = nearby?.id === module.id ? 3 : 2;
    const pulse = active && Math.floor(now / 240) % 2 === 0;
    const size = nearby?.id === module.id || pulse ? 44 : 36;
    ctx.strokeRect(module.x - size / 2, module.y - size / 2, size, size);
    ctx.fillStyle = active ? "#fff8dc" : colors[module.id];
    ctx.fillRect(module.x - 4, module.y - 4, 8, 8);
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

function drawChaosEffects(now) {
  const chaos = state.puzzleView?.chaos;
  const resolved = state.puzzleView?.lastResolved;
  if (!chaos && !resolved) return;

  ctx.save();
  if (resolved) {
    const pulse = Math.floor(now / 100) % 5;
    ctx.strokeStyle = pulse % 2 ? "#70ec8c" : "#fff8dc";
    ctx.lineWidth = 3;
    ctx.strokeRect(210 - pulse * 5, 104 - pulse * 5, 60 + pulse * 10, 60 + pulse * 10);
  }
  if (chaos?.id === "blackout") {
    ctx.fillStyle = Math.floor(now / 180) % 2 ? "rgba(0, 0, 0, 0.58)" : "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, 480, 270);
  }
  if (chaos?.id === "steam") {
    ctx.fillStyle = "rgba(235, 244, 238, 0.2)";
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 67 + now / 12) % 520 - 20;
      const y = 35 + (index * 41) % 210;
      ctx.fillRect(Math.round(x), y, 24, 8);
    }
  }
  if (chaos?.id === "slip") {
    ctx.fillStyle = "rgba(85, 230, 236, 0.38)";
    for (let index = 0; index < 12; index += 1) {
      const x = 28 + index * 39;
      const y = 220 + (index % 3) * 8;
      ctx.fillRect(x, y, 25, 2);
    }
  }
  if (chaos?.id === "alarm") {
    ctx.fillStyle = Math.floor(now / 220) % 2 ? "rgba(255, 59, 53, 0.22)" : "rgba(255, 59, 53, 0.04)";
    ctx.fillRect(0, 0, 480, 270);
  }
  ctx.restore();
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
      return progress?.resolvedCount || 0;
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
