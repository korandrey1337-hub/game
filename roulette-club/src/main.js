import { ITEM_DEFS, RouletteGame, WEAPON_SKINS } from "./game.js?v=20261006-1";
import { OnlineClient } from "./online.js?v=20261006-1";
import { ROULETTE_STATS_KEY, RouletteStats } from "./stats.js?v=20261006-1";

const canvas = document.querySelector("#club-scene");
const ctx = canvas.getContext("2d", { alpha: false });
const backdropCanvas = document.createElement("canvas");
const backdropCtx = backdropCanvas.getContext("2d");

const playerCountSelect = document.querySelector("#player-count");
const weaponSkinSelect = document.querySelector("#weapon-skin");
const newGameButton = document.querySelector("#new-game");
const playersEl = document.querySelector("#players");
const roundCardEl = document.querySelector("#round-card");
const turnTitleEl = document.querySelector("#turn-title");
const itemsEl = document.querySelector("#items");
const targetsEl = document.querySelector("#targets");
const targetLabelEl = document.querySelector("#target-label");
const battleLogEl = document.querySelector("#battle-log");
const leaderboardEl = document.querySelector("#leaderboard");
const scoreAwardEl = document.querySelector("#score-award");
const turnHintEl = document.querySelector("#turn-hint");
const eventToastEl = document.querySelector("#event-toast");
const peekCardEl = document.querySelector("#peek-card");
const tutorialOpenButton = document.querySelector("#tutorial-open");
const tutorialEl = document.querySelector("#tutorial");
const tutorialTitleEl = document.querySelector("#tutorial-title");
const tutorialCopyEl = document.querySelector("#tutorial-copy");
const tutorialProgressEl = document.querySelector("#tutorial-progress");
const tutorialSkipButton = document.querySelector("#tutorial-skip");
const tutorialNextButton = document.querySelector("#tutorial-next");
const statsOpenButton = document.querySelector("#stats-open");
const musicToggleButton = document.querySelector("#music-toggle");
const backgroundMusic = document.querySelector("#background-music");
const onlineOpenButton = document.querySelector("#online-open");
const onlinePanelEl = document.querySelector("#online-panel");
const onlineBackdropEl = document.querySelector("#online-backdrop");
const onlineCloseButton = document.querySelector("#online-close");
const onlineEntryEl = document.querySelector("#online-entry");
const onlineRoomEl = document.querySelector("#online-room");
const onlineNameInput = document.querySelector("#online-name");
const onlineCodeInput = document.querySelector("#online-code-input");
const onlineCreateButton = document.querySelector("#online-create");
const onlineJoinButton = document.querySelector("#online-join");
const onlineCopyCodeButton = document.querySelector("#online-copy-code");
const onlineStatusEl = document.querySelector("#online-status");
const onlinePlayersEl = document.querySelector("#online-players");
const onlinePlayerCountSelect = document.querySelector("#online-player-count");
const onlineWeaponSelect = document.querySelector("#online-weapon");
const onlineHintEl = document.querySelector("#online-hint");
const onlineReadyButton = document.querySelector("#online-ready");
const onlineStartButton = document.querySelector("#online-start");
const onlineLeaveButton = document.querySelector("#online-leave");
const onlineErrorEl = document.querySelector("#online-error");
const statsPanelEl = document.querySelector("#stats-panel");
const statsBackdropEl = document.querySelector("#stats-backdrop");
const statsSummaryEl = document.querySelector("#stats-summary");
const statsDetailsEl = document.querySelector("#stats-details");
const statsCloseButton = document.querySelector("#stats-close");
const statsCloseIconButton = document.querySelector("#stats-close-icon");
const resultPanelEl = document.querySelector("#result-panel");
const resultCardEl = document.querySelector("#result-card");
const resultCharacterEl = document.querySelector("#result-character");
const resultKickerEl = document.querySelector("#result-kicker");
const resultTitleEl = document.querySelector("#result-title");
const resultSubtitleEl = document.querySelector("#result-subtitle");
const resultMetricsEl = document.querySelector("#result-metrics");
const resultStatsButton = document.querySelector("#result-stats");
const resultReplayButton = document.querySelector("#result-replay");
const topbarEl = document.querySelector(".topbar");
const scoreboardEl = document.querySelector(".scoreboard");
const commandDeckEl = document.querySelector(".command-deck");
const appShellEl = document.querySelector(".app-shell");

const game = new RouletteGame({ playerCount: 2, weaponSkin: "revolver" });
const onlineClient = new OnlineClient();
const qaMode = new URLSearchParams(window.location.search).has("qa");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rouletteStats = new RouletteStats({ key: qaMode ? `${ROULETTE_STATS_KEY}:qa` : ROULETTE_STATS_KEY });
rouletteStats.startSession({ telegram: Boolean(window.Telegram?.WebApp) });
rouletteStats.recordMatchStart(game.state);

const ART = {
  background: "./assets/art/club-background-board.webp",
  p0: "./assets/art/player-teal.webp",
  p0Victory: "./assets/art/player-teal-victory.webp",
  p1: "./assets/art/player-red.webp",
  p2: "./assets/art/player-yellow.webp",
  p3: "./assets/art/player-green.webp",
  hammer: "./assets/art/item-hammer.webp",
  claw: "./assets/art/item-claw.webp",
  vape: "./assets/art/item-vape.webp",
  tarot: "./assets/art/item-tarot.webp",
  live: "./assets/art/charge-live.webp",
  blank: "./assets/art/charge-blank.webp",
  revolver: "./assets/art/weapon-revolver.webp",
  shotgun: "./assets/art/weapon-shotgun.webp",
};

const BG_SIZE = { width: 1672, height: 941 };
const SHOT_AIM_MS = 420;
const SHOT_FLIGHT_MS = 380;
const SHOT_RECOVERY_MS = 360;
const ROUND_REVEAL_MS = 1250;
const ROUND_LOAD_MS = 1250;
const ROUND_SETTLE_MS = 200;
const ROUND_INTRO_MS = ROUND_REVEAL_MS + ROUND_LOAD_MS + ROUND_SETTLE_MS;
const MATCH_CINEMATIC_MS = 5000;
const RESULT_REVEAL_MS = SHOT_AIM_MS + SHOT_FLIGHT_MS + 900;
const LEADERBOARD_KEY = "rouletteClubLeaderboard:v1";
const MUSIC_MUTED_KEY = "rouletteClubMusicMuted:v1";
const MUSIC_VOLUME = 0.16;
const LEADERBOARD_PLAYERS = [
  { id: "p0", name: "Ты" },
  { id: "p1", name: "Шумный Прораб" },
  { id: "p2", name: "Бетонный Джим" },
  { id: "p3", name: "Смузи-Бригадир" },
];
const CHARACTER_KEYS = ["p0", "p1", "p2", "p3"];
const images = {};
const particles = [];
const visualBursts = [];
const playerAnims = new Map();

let pendingItem = null;
let botTimer = null;
let lastAnimatedRevision = -1;
let audioCtx = null;
let masterBus = null;
let dpr = 1;
let viewport = { width: 1, height: 1 };
let bgFrame = { x: 0, y: 0, width: 1, height: 1, scale: 1 };
let bgBackdropFrame = { x: 0, y: 0, width: 1, height: 1, scale: 1 };
let pointerDown = null;
let leaderboard = loadLeaderboard();
let lastAward = null;
let telegramWebApp = null;
let telegramFullscreenTried = false;
let backdropCacheKey = "";
let eventToastTimer = null;
let actionLockedUntil = 0;
let actionUnlockTimer = null;
let activeStatsSince = document.visibilityState === "visible" ? performance.now() : null;
let resultRevealTimer = null;
let resultSoundMatchId = null;
let musicUnlocked = false;
let musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === "1";
let onlineRoom = null;
let onlineMode = false;
let onlineStatus = "offline";
let onlineActionPending = false;
let lastOnlineAward = null;
let drawFrameId = null;
let lastDrawAt = 0;
let resizeFrameId = null;
let hudSceneBoundsCache = null;
let animationGeneration = 0;
let toastGeneration = 0;

const impact = {
  startedAt: 0,
  event: null,
};

const roundIntro = {
  active: false,
  pending: false,
  startedAt: 0,
  roundNumber: 0,
  live: 0,
  blank: 0,
  weaponSkin: "revolver",
  event: null,
  message: "",
  sequence: 0,
};

const matchCinematic = {
  active: false,
  pending: false,
  startedAt: 0,
  sequence: 0,
};

const TUTORIAL_STEPS = [
  {
    title: "Цель партии",
    copy: "За столом остается один победитель. Каждый раунд реквизит заряжается боевыми и пустыми зарядами в случайном порядке, а точная очередь скрыта.",
  },
  {
    title: "Очки и серия",
    copy: "Победа дает очки. Чем больше HP осталось и чем длиннее серия побед подряд, тем жирнее награда в таблице лидеров.",
  },
  {
    title: "Твой ход",
    copy: "Выбери: хлопнуть в себя или в другого игрока. Пустой щелчок в себя дает еще один ход, а выстрел в соперника всегда передает ход дальше.",
  },
  {
    title: "Выбери оружие",
    copy: "Револьвер снимает 1 HP и стреляет точнее. Дробовик снимает 2 HP, звучит тяжелее и выпускает заметную россыпь дроби.",
  },
  {
    title: "Предметы",
    copy: "Молоток заставляет цель пропустить ход, клешня ворует предмет, вейп лечит 1 HP, таро показывает текущий заряд.",
  },
  {
    title: "Читай стол",
    copy: "Слева HP и предметы, снизу действия, на столе реквизит раунда. Обучение можно открыть заново в верхней панели.",
  },
];

let tutorialIndex = 0;

const seats = {
  2: {
    p0: { x: 858, y: 744, scale: 0.295, layer: 4, face: 0, nameY: -305 },
    p1: { x: 858, y: 244, scale: 0.215, layer: 1, face: 0, nameY: -134 },
  },
  4: {
    p0: { x: 858, y: 744, scale: 0.295, layer: 4, face: 0, nameY: -305 },
    p1: { x: 1382, y: 512, scale: 0.225, layer: 3, face: -0.035, nameY: -165 },
    p2: { x: 858, y: 244, scale: 0.212, layer: 1, face: 0, nameY: -134 },
    p3: { x: 330, y: 512, scale: 0.212, layer: 3, face: 0.035, nameY: -165 },
  },
};

const tableSlots = {
  weapon: { x: 836, y: 532 },
  charges: { x: 620, y: 528 },
};

Promise.allSettled(
  Object.entries(ART).filter(([key]) => key !== "p0Victory").map(([key, src]) =>
    loadImage(src).then((image) => {
      images[key] = image;
    }),
  ),
).then(() => {
  resizeCanvas();
  if (!hasSeenTutorial() && !qaMode) {
    openTutorial(0);
  }
  prepareMatchCinematic();
  syncAll();
  startDrawLoop();
});

newGameButton.addEventListener("click", () => {
  startNewMatch();
});

tutorialOpenButton.addEventListener("click", () => {
  openTutorial(0);
});

statsOpenButton.addEventListener("click", openStatsPanel);
musicToggleButton.addEventListener("click", toggleBackgroundMusic);
onlineOpenButton.addEventListener("click", openOnlinePanel);
onlineCloseButton.addEventListener("click", closeOnlinePanel);
onlineBackdropEl.addEventListener("click", closeOnlinePanel);
onlineCreateButton.addEventListener("click", () => joinOnlineRoom(true));
onlineJoinButton.addEventListener("click", () => joinOnlineRoom(false));
onlineCopyCodeButton.addEventListener("click", copyOnlineRoomCode);
onlineReadyButton.addEventListener("click", toggleOnlineReady);
onlineStartButton.addEventListener("click", () => {
  onlineClient.send({ type: onlineRoom?.phase === "finished" ? "rematch" : "start" });
});
onlineLeaveButton.addEventListener("click", leaveOnlineRoom);
onlinePlayerCountSelect.addEventListener("change", configureOnlineRoom);
onlineWeaponSelect.addEventListener("change", configureOnlineRoom);
onlineCodeInput.addEventListener("input", () => {
  onlineCodeInput.value = onlineCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
});
onlineClient.addEventListener("state", (event) => applyOnlineRoom(event.detail));
onlineClient.addEventListener("status", (event) => {
  onlineStatus = event.detail.status;
  renderOnlinePanel();
});
onlineClient.addEventListener("error", (event) => {
  onlineActionPending = false;
  showOnlineError(event.detail.message);
  if (onlineMode) showEventToast(event.detail.message, "warning");
  renderOnlinePanel();
});
statsCloseButton.addEventListener("click", closeStatsPanel);
statsCloseIconButton.addEventListener("click", closeStatsPanel);
statsBackdropEl.addEventListener("click", closeStatsPanel);
resultReplayButton.addEventListener("click", startNewMatch);
resultStatsButton.addEventListener("click", openStatsPanel);

tutorialSkipButton.addEventListener("click", () => {
  closeTutorial();
});

tutorialNextButton.addEventListener("click", () => {
  if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
    closeTutorial();
    return;
  }
  openTutorial(tutorialIndex + 1);
});

playerCountSelect.addEventListener("change", () => {
  startNewMatch();
});

weaponSkinSelect.addEventListener("change", () => {
  startNewMatch();
});

window.addEventListener("resize", scheduleResizeCanvas);
window.visualViewport?.addEventListener("resize", scheduleResizeCanvas);
screen.orientation?.addEventListener?.("change", () => window.setTimeout(applyTelegramViewport, 80));
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);
window.addEventListener("pointerdown", requestTelegramFullscreen, { passive: true });
window.addEventListener("keydown", requestTelegramFullscreen);
window.addEventListener("keydown", (event) => {
  const modal = activeModalPanel();
  if (event.key === "Tab" && modal) {
    trapModalFocus(event, modal);
    return;
  }
  if (event.key !== "Escape") return;
  if (!onlinePanelEl.hidden) closeOnlinePanel();
  else if (!statsPanelEl.hidden) closeStatsPanel();
  else if (!tutorialEl.hidden) closeTutorial();
});
window.addEventListener("pagehide", flushActiveStats);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    stopDrawLoop();
    flushActiveStats();
    activeStatsSince = null;
    backgroundMusic.pause();
  } else {
    startDrawLoop();
    activeStatsSince = performance.now();
    if (musicUnlocked && !musicMuted) startBackgroundMusic();
  }
});
window.setInterval(flushActiveStats, 15000);

backgroundMusic.volume = MUSIC_VOLUME;
backgroundMusic.muted = musicMuted;
syncMusicToggle();

canvas.addEventListener("pointerdown", (event) => {
  unlockAudio();
  pointerDown = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerDown) return;
  const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (distance < 14) {
    if (matchCinematic.active) {
      finishMatchCinematic();
      return;
    }
    handleSceneClick(event.clientX, event.clientY);
  }
});

initTelegramWebApp();
onlineNameInput.value = defaultOnlineName();
const invitedRoomCode = new URLSearchParams(window.location.search).get("room");
if (invitedRoomCode) {
  onlineCodeInput.value = invitedRoomCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  openOnlinePanel();
}

function initTelegramWebApp() {
  const candidate = window.Telegram?.WebApp ?? null;
  const hasTelegramLaunchData = Boolean(candidate?.initData || candidate?.initDataUnsafe?.user);
  telegramWebApp = hasTelegramLaunchData ? candidate : null;
  if (!telegramWebApp) {
    setAppHeight(window.innerHeight);
    return;
  }

  document.documentElement.classList.add("is-telegram");
  try {
    telegramWebApp.ready?.();
    telegramWebApp.expand?.();
    if (telegramSupports("7.7")) telegramWebApp.disableVerticalSwipes?.();
    if (telegramSupports("6.1")) {
      telegramWebApp.setHeaderColor?.("#080506");
      telegramWebApp.setBackgroundColor?.("#080506");
    }
    if (telegramSupports("7.10")) telegramWebApp.setBottomBarColor?.("#080506");
  } catch {
    // Telegram desktop and older clients expose slightly different API subsets.
  }

  applyTelegramViewport();
  telegramWebApp.onEvent?.("viewportChanged", applyTelegramViewport);
  telegramWebApp.onEvent?.("fullscreenChanged", applyTelegramViewport);
  telegramWebApp.onEvent?.("safeAreaChanged", applyTelegramViewport);
  telegramWebApp.onEvent?.("contentSafeAreaChanged", applyTelegramViewport);
  window.setTimeout(requestTelegramFullscreen, 120);
}

function defaultOnlineName() {
  const telegramUser = telegramWebApp?.initDataUnsafe?.user;
  const telegramName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ");
  return onlineClient.savedName() || telegramName || telegramUser?.username || "Игрок";
}

function applyTelegramViewport() {
  const height = telegramWebApp?.viewportHeight || telegramWebApp?.viewportStableHeight || window.innerHeight;
  setAppHeight(height);
  setTelegramInsets();
  resizeCanvas();
}

function setTelegramInsets() {
  const safe = telegramWebApp?.safeAreaInset ?? {};
  const content = telegramWebApp?.contentSafeAreaInset ?? {};
  const readInset = (name) => Math.max(0, Number(safe[name] ?? 0), Number(content[name] ?? 0));
  const safeTop = readInset("top");
  const isFullscreen = Boolean(telegramWebApp?.isFullscreen);
  document.documentElement.classList.toggle("tg-fullscreen", isFullscreen);
  document.documentElement.style.setProperty("--tg-safe-top", `${safeTop}px`);
  document.documentElement.style.setProperty("--tg-safe-right", `${readInset("right")}px`);
  document.documentElement.style.setProperty("--tg-safe-bottom", `${readInset("bottom")}px`);
  document.documentElement.style.setProperty("--tg-safe-left", `${readInset("left")}px`);
  document.documentElement.style.setProperty("--tg-hud-top", `${isFullscreen ? safeTop : Math.max(92, safeTop)}px`);
}

function setAppHeight(height) {
  const safeHeight = Math.max(320, Math.round(height || window.innerHeight || 320));
  document.documentElement.style.setProperty("--app-height", `${safeHeight}px`);
}

function requestTelegramFullscreen() {
  if (!telegramWebApp) return;
  try {
    telegramWebApp.expand?.();
    if (
      !telegramFullscreenTried &&
      telegramSupports("8.0") &&
      typeof telegramWebApp.requestFullscreen === "function"
    ) {
      telegramFullscreenTried = true;
      const fullscreenResult = telegramWebApp.requestFullscreen();
      fullscreenResult?.catch?.(() => {});
    } else if (!telegramSupports("8.0")) {
      telegramFullscreenTried = true;
    }
  } catch {
    telegramFullscreenTried = true;
  }
  applyTelegramViewport();
}

function telegramSupports(version) {
  return typeof telegramWebApp?.isVersionAtLeast !== "function" || telegramWebApp.isVersionAtLeast(version);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function openOnlinePanel() {
  clearOnlineError();
  renderOnlinePanel();
  onlinePanelEl.hidden = false;
  if (onlineRoom) onlineReadyButton.focus({ preventScroll: true });
  else onlineNameInput.focus({ preventScroll: true });
}

function closeOnlinePanel() {
  onlinePanelEl.hidden = true;
  onlineOpenButton.focus({ preventScroll: true });
}

function joinOnlineRoom(create) {
  clearOnlineError();
  const roomCode = onlineCodeInput.value.trim().toUpperCase();
  if (!create && roomCode.length !== 5) {
    showOnlineError("Введи пятизначный код комнаты");
    return;
  }
  onlineStatus = "connecting";
  onlineClient.join({
    name: onlineNameInput.value,
    roomCode: create ? "" : roomCode,
    create,
    playerCount: Number(playerCountSelect.value),
    weaponSkin: weaponSkinSelect.value,
  });
  renderOnlinePanel();
}

function applyOnlineRoom(room) {
  const previousMatchId = onlineRoom?.game?.matchId;
  onlineRoom = room;
  onlineStatus = "connected";
  onlineActionPending = false;
  clearOnlineError();
  updateOnlineInviteUrl(room.code);

  playerCountSelect.value = String(room.playerCount);
  weaponSkinSelect.value = room.weaponSkin;
  playerCountSelect.disabled = true;
  weaponSkinSelect.disabled = true;

  if (room.game) {
    const newMatch = previousMatchId !== room.game.matchId;
    const startCinematic = newMatch && room.phase === "playing";
    onlineMode = true;
    clearTimeout(botTimer);
    game.state = room.game;
    if (newMatch) {
      animationGeneration += 1;
      pendingItem = null;
      lastAnimatedRevision = -1;
      lastOnlineAward = null;
      resultPanelEl.hidden = true;
      resultReplayButton.disabled = false;
      resultReplayButton.textContent = "Реванш";
      appShellEl.dataset.resultOpen = "false";
      rouletteStats.recordMatchStart(game.state);
      if (startCinematic) prepareMatchCinematic({ defer: true });
    }
    syncAll({ scheduleBots: false });
    if (room.phase === "playing") {
      closeOnlinePanel();
      if (startCinematic) startMatchCinematicPlayback();
    }
  } else {
    onlineMode = false;
    pendingItem = null;
    resultPanelEl.hidden = true;
    appShellEl.dataset.resultOpen = "false";
    openOnlinePanel();
  }
  renderOnlinePanel();
}

function renderOnlinePanel() {
  const room = onlineRoom;
  appShellEl.dataset.online = room ? "true" : "false";
  onlineEntryEl.hidden = Boolean(room);
  onlineRoomEl.hidden = !room;
  onlineOpenButton.classList.toggle("is-connected", Boolean(room));
  onlineOpenButton.textContent = room?.code || "Онлайн";
  newGameButton.textContent = room ? "Комната" : "Новая игра";
  newGameButton.setAttribute("aria-label", room ? "Открыть онлайн-комнату" : "Начать новую игру");
  newGameButton.title = room ? "Онлайн-комната" : "Новая игра";

  if (!room) {
    onlineStatusEl.textContent = onlineStatusLabel();
    return;
  }

  onlineCopyCodeButton.textContent = room.code;
  onlineStatusEl.textContent = room.phase === "playing"
    ? "Матч идёт"
    : room.phase === "finished"
      ? "Финал"
      : `${room.players.length}/${room.playerCount} игроков`;

  onlinePlayersEl.replaceChildren(...room.players.map((player) => {
    const row = document.createElement("div");
    row.className = "online-player";
    if (player.isSelf) row.classList.add("is-self");
    if (player.ready) row.classList.add("is-ready");
    if (!player.connected) row.classList.add("is-offline");

    const dot = document.createElement("span");
    dot.className = "online-player-dot";
    dot.style.color = player.color;
    dot.style.background = player.color;
    const name = document.createElement("span");
    name.className = "online-player-name";
    name.textContent = `${player.name}${player.isSelf ? " · ты" : ""}${player.isHost ? " · хост" : ""}`;
    const state = document.createElement("span");
    state.className = "online-player-state";
    state.textContent = !player.connected ? "связь" : player.ready ? "готов" : "ждёт";
    row.append(dot, name, state);
    return row;
  }));

  onlinePlayerCountSelect.value = String(room.playerCount);
  onlineWeaponSelect.value = room.weaponSkin;
  const configuring = room.phase === "lobby" && room.isHost;
  onlinePlayerCountSelect.disabled = !configuring;
  onlineWeaponSelect.disabled = !configuring;

  const self = room.players.find((player) => player.isSelf);
  onlineReadyButton.hidden = room.phase !== "lobby";
  onlineReadyButton.textContent = self?.ready ? "Готов" : "Я готов";
  onlineReadyButton.classList.toggle("is-ready", Boolean(self?.ready));
  onlineStartButton.hidden = !room.isHost || !["lobby", "finished"].includes(room.phase);
  onlineStartButton.textContent = room.phase === "finished" ? "Собрать реванш" : "Начать матч";
  onlineStartButton.disabled = room.phase === "lobby" && !room.canStart;

  if (onlineStatus === "reconnecting") {
    onlineHintEl.textContent = "Связь потеряна. Возвращаем тебя в кресло...";
  } else if (room.phase === "playing") {
    onlineHintEl.textContent = "Матч уже идёт. Закрой окно и продолжай ход.";
  } else if (room.phase === "finished") {
    onlineHintEl.textContent = room.isHost ? "Хозяин стола может собрать реванш." : "Ждём, когда хозяин откроет реванш.";
  } else if (room.players.length < room.playerCount) {
    onlineHintEl.textContent = `Пригласи ещё ${room.playerCount - room.players.length}: отправь код комнаты.`;
  } else if (!room.players.every((player) => player.ready)) {
    onlineHintEl.textContent = "Все заняли места. Осталось подтвердить готовность.";
  } else {
    onlineHintEl.textContent = room.isHost ? "Стол собран. Можно начинать." : "Все готовы. Хозяин запускает матч.";
  }
}

function configureOnlineRoom() {
  if (!onlineRoom?.isHost || onlineRoom.phase !== "lobby") return;
  onlineClient.send({
    type: "configure",
    playerCount: Number(onlinePlayerCountSelect.value),
    weaponSkin: onlineWeaponSelect.value,
  });
}

function toggleOnlineReady() {
  const self = onlineRoom?.players.find((player) => player.isSelf);
  if (!self || onlineRoom.phase !== "lobby") return;
  onlineClient.send({ type: "ready", ready: !self.ready });
}

async function copyOnlineRoomCode() {
  if (!onlineRoom?.code) return;
  try {
    await navigator.clipboard.writeText(onlineRoom.code);
    onlineHintEl.textContent = "Код скопирован. Отправь его друзьям.";
  } catch {
    onlineHintEl.textContent = `Код комнаты: ${onlineRoom.code}`;
  }
}

function leaveOnlineRoom() {
  onlineClient.leave();
  onlineRoom = null;
  onlineMode = false;
  onlineActionPending = false;
  playerCountSelect.disabled = false;
  weaponSkinSelect.disabled = false;
  updateOnlineInviteUrl(null);
  closeOnlinePanel();
  startNewMatch();
  renderOnlinePanel();
}

function updateOnlineInviteUrl(code) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  history.replaceState(null, "", url);
}

function showOnlineError(message) {
  onlineErrorEl.hidden = false;
  onlineErrorEl.textContent = message;
}

function clearOnlineError() {
  onlineErrorEl.hidden = true;
  onlineErrorEl.textContent = "";
}

function onlineStatusLabel() {
  return {
    connecting: "Подключение",
    reconnecting: "Возвращаем связь",
    connected: "На связи",
    error: "Ошибка связи",
  }[onlineStatus] || "Новый стол";
}

function getLocalPlayerId() {
  return onlineMode ? onlineRoom?.selfId ?? onlineClient.playerId ?? "p0" : "p0";
}

function isLocalPlayer(player) {
  return Boolean(player && player.id === getLocalPlayerId());
}

function startNewMatch() {
  if (onlineRoom) {
    if (onlineRoom.phase === "finished" && onlineRoom.isHost) {
      onlineClient.send({ type: "rematch" });
    } else {
      openOnlinePanel();
    }
    return;
  }
  pendingItem = null;
  animationGeneration += 1;
  toastGeneration += 1;
  actionLockedUntil = 0;
  clearTimeout(actionUnlockTimer);
  clearTimeout(resultRevealTimer);
  resultRevealTimer = null;
  resultPanelEl.hidden = true;
  resultReplayButton.disabled = false;
  resultReplayButton.textContent = "Реванш";
  appShellEl.dataset.resultOpen = "false";
  roundIntro.active = false;
  roundIntro.pending = false;
  roundIntro.sequence += 1;
  particles.length = 0;
  visualBursts.length = 0;
  playerAnims.clear();
  impact.event = null;
  game.newGame({
    playerCount: Number(playerCountSelect.value),
    weaponSkin: weaponSkinSelect.value,
  });
  rouletteStats.recordMatchStart(game.state);
  prepareMatchCinematic();
  syncAll();
}

function syncAll({ scheduleBots = true } = {}) {
  maybeAwardMatch();
  maybeRecordStatsMatch();
  renderHud();
  resizeCanvas();
  queueAnimationForLastEvent();
  if (scheduleBots && !onlineMode) {
    scheduleBotTurn();
  }
}

function resizeCanvas() {
  hudSceneBoundsCache = null;
  if (!telegramWebApp) setAppHeight(window.innerHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewport = {
    width: window.innerWidth,
    height: getViewportHeight(),
  };
  const pixelWidth = Math.max(1, Math.floor(viewport.width * dpr));
  const pixelHeight = Math.max(1, Math.floor(viewport.height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const mode = getLayoutMode();
  if (mode !== "desktop") {
    const bounds = getHudSceneBounds(mode);
    const stageWidth = Math.max(220, bounds.right - bounds.left);
    const stageHeight = Math.max(150, bounds.bottom - bounds.top);
    const landscape = mode === "landscape";
    const scale = landscape
      ? Math.max(stageWidth / (BG_SIZE.width * 0.78), stageHeight / (BG_SIZE.height * 0.8))
      : Math.max(stageWidth / (BG_SIZE.width * 0.66), stageHeight / (BG_SIZE.height * 0.98));
    const coverScale = Math.max(viewport.width / BG_SIZE.width, viewport.height / BG_SIZE.height);
    const focus = landscape ? { x: 890, y: 545 } : { x: 858, y: 500 };
    bgFrame = {
      width: BG_SIZE.width * scale,
      height: BG_SIZE.height * scale,
      x: (bounds.left + bounds.right) * 0.5 - focus.x * scale,
      y: (bounds.top + bounds.bottom) * 0.5 - focus.y * scale,
      scale,
    };
    bgBackdropFrame = {
      width: BG_SIZE.width * coverScale,
      height: BG_SIZE.height * coverScale,
      x: (viewport.width - BG_SIZE.width * coverScale) / 2,
      y: (viewport.height - BG_SIZE.height * coverScale) / 2,
      scale: coverScale,
    };
    refreshBackdropCache();
    return;
  }

  const fitScale = Math.min(viewport.width / BG_SIZE.width, viewport.height / BG_SIZE.height);
  const coverScale = Math.max(viewport.width / BG_SIZE.width, viewport.height / BG_SIZE.height);
  const tallStage = viewport.width >= 980 && viewport.height / viewport.width > 0.6;
  const scale = fitScale * (tallStage ? 0.94 : 1);
  const verticalNudge = viewport.width >= 980 ? viewport.height * 0.025 : 0;
  bgFrame = {
    width: BG_SIZE.width * scale,
    height: BG_SIZE.height * scale,
    x: (viewport.width - BG_SIZE.width * scale) / 2,
    y: (viewport.height - BG_SIZE.height * scale) / 2 + verticalNudge,
    scale,
  };
  bgBackdropFrame = {
    width: BG_SIZE.width * coverScale,
    height: BG_SIZE.height * coverScale,
    x: (viewport.width - BG_SIZE.width * coverScale) / 2,
    y: (viewport.height - BG_SIZE.height * coverScale) / 2,
    scale: coverScale,
  };
  refreshBackdropCache();
}

function scheduleResizeCanvas() {
  if (resizeFrameId !== null) return;
  resizeFrameId = requestAnimationFrame(() => {
    resizeFrameId = null;
    resizeCanvas();
  });
}

function refreshBackdropCache() {
  const image = images.background;
  if (!image || !backdropCtx) return;

  const cacheDpr = Math.min(dpr, 1.25);
  const pixelWidth = Math.max(1, Math.floor(viewport.width * cacheDpr));
  const pixelHeight = Math.max(1, Math.floor(viewport.height * cacheDpr));
  const key = [
    pixelWidth,
    pixelHeight,
    bgBackdropFrame.x.toFixed(2),
    bgBackdropFrame.y.toFixed(2),
    bgBackdropFrame.width.toFixed(2),
    bgBackdropFrame.height.toFixed(2),
  ].join(":");
  if (key === backdropCacheKey) return;

  backdropCacheKey = key;
  backdropCanvas.width = pixelWidth;
  backdropCanvas.height = pixelHeight;
  backdropCtx.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);
  backdropCtx.clearRect(0, 0, viewport.width, viewport.height);
  backdropCtx.filter = "blur(18px) brightness(0.58) saturate(1.08)";
  backdropCtx.drawImage(
    image,
    bgBackdropFrame.x - 30,
    bgBackdropFrame.y - 30,
    bgBackdropFrame.width + 60,
    bgBackdropFrame.height + 60,
  );
  backdropCtx.filter = "none";
}

function getLayoutMode() {
  if (viewport.width < 760 && viewport.height >= viewport.width) return "portrait";
  if (viewport.height < 680 && viewport.width > viewport.height) return "landscape";
  return "desktop";
}

function getHudSceneBounds(mode = getLayoutMode()) {
  if (hudSceneBoundsCache?.mode === mode) return hudSceneBoundsCache.bounds;
  const topbar = topbarEl?.getBoundingClientRect();
  const scoreboard = scoreboardEl?.getBoundingClientRect();
  const deck = commandDeckEl?.getBoundingClientRect();
  const inset = 8;

  if (mode === "portrait") {
    const bounds = {
      left: inset,
      right: viewport.width - inset,
      top: Math.min(viewport.height - 190, (scoreboard?.bottom ?? viewport.height * 0.24) + inset),
      bottom: Math.max(190, (deck?.top ?? viewport.height * 0.8) - inset),
    };
    hudSceneBoundsCache = { mode, bounds };
    return bounds;
  }

  if (mode === "landscape") {
    const bounds = {
      left: Math.min(viewport.width * 0.38, (scoreboard?.right ?? 0) + inset),
      right: viewport.width - inset,
      top: (topbar?.bottom ?? 54) + 5,
      bottom: Math.max(180, (deck?.top ?? viewport.height - 82) - 6),
    };
    hudSceneBoundsCache = { mode, bounds };
    return bounds;
  }

  const bounds = {
    left: inset,
    right: viewport.width - inset,
    top: (topbar?.bottom ?? 84) + inset,
    bottom: (deck?.top ?? viewport.height) - inset,
  };
  hudSceneBoundsCache = { mode, bounds };
  return bounds;
}

function getViewportHeight() {
  return Math.max(
    320,
    Math.round(telegramWebApp?.viewportHeight || telegramWebApp?.viewportStableHeight || window.innerHeight || 320),
  );
}

function renderHud() {
  const state = game.state;
  const active = game.activePlayer;
  appShellEl.dataset.playerCount = String(state.playerCount);
  appShellEl.dataset.gameOver = state.winnerId ? "true" : "false";

  roundCardEl.innerHTML = `
    <strong>Раунд ${state.roundNumber}</strong>
    <div class="shell-counts">
      <div class="shell-chip shell-chip-live"><span>Бой</span><b>${state.shellCounts.live}</b></div>
      <div class="shell-chip shell-chip-blank"><span>Пусто</span><b>${state.shellCounts.blank}</b></div>
    </div>
  `;

  playersEl.replaceChildren(
    ...state.players.map((player) => {
      const card = document.createElement("article");
      card.className = "player-card";
      if (player.id === state.currentPlayerId && !state.winnerId) card.classList.add("is-active");
      if (player.out) card.classList.add("is-out");

      const hpPercent = (player.hp / player.maxHp) * 100;
      card.innerHTML = `
        <div class="player-head">
          <div class="player-name"><span class="player-dot" style="background:${player.color}"></span>${player.name}${onlineMode && isLocalPlayer(player) ? " · ты" : ""}</div>
          <div class="player-meta">${player.out ? "вылетел" : `${player.hp}/${player.maxHp} HP`}</div>
        </div>
        <div class="hp-bar" aria-label="HP ${player.name}">
          <div class="hp-fill" style="width:${hpPercent}%"></div>
        </div>
        ${player.skipTurns ? `<span class="skip-badge">пропуск x${player.skipTurns}</span>` : ""}
      `;
      return card;
    }),
  );

  if (state.winnerId) {
    const winner = state.players.find((player) => player.id === state.winnerId);
    turnTitleEl.textContent = winner ? `${winner.name} забрал стол` : "Матч закончен";
  } else if (active) {
    turnTitleEl.textContent = active.isHuman ? "Твой ход" : `Ходит ${active.name}`;
  } else {
    turnTitleEl.textContent = "Ожидание";
  }

  renderPeek(active);
  renderItems(active);
  renderTargets(active);
  renderTurnHint(active);
  renderLog();
  renderScoreAward();
  renderLeaderboard();
}

function renderPeek(active) {
  const state = game.state;
  const canShow = active && state.peekedShell && state.peekedBy === active.id;
  if (!canShow) {
    peekCardEl.hidden = true;
    return;
  }

  const label = state.peekedShell === "live" ? "боевой" : "пустой";
  peekCardEl.hidden = false;
  peekCardEl.textContent = `Таро шепчет: ${label}`;
}

function renderItems(active) {
  itemsEl.replaceChildren();
  const locked = !active?.isHuman || game.state.winnerId || isShotInputLocked() || isOnlineActionLocked();

  if (!active || active.items.length === 0) {
    itemsEl.append(emptyNote(locked ? "ожидание" : "предметов нет"));
    return;
  }

  for (const itemId of active.items) {
    const item = ITEM_DEFS[itemId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item-button";
    if (pendingItem === itemId) button.classList.add("is-selected");
    button.dataset.item = itemId;
    const blockedAtFullHp = itemId === "vape" && active.hp >= active.maxHp;
    button.disabled = locked || blockedAtFullHp;
    button.innerHTML = `<span class="item-icon" aria-hidden="true"></span><span>${item.shortName}</span>`;
    button.setAttribute(
      "aria-label",
      blockedAtFullHp ? `${item.name}: HP уже полный` : `${item.name}: ${item.description}`,
    );
    button.title = blockedAtFullHp ? "HP уже полный" : item.description;
    if (item.needsTarget) button.setAttribute("aria-pressed", String(pendingItem === itemId));
    button.addEventListener("click", () => {
      if (item.needsTarget) {
        pendingItem = pendingItem === itemId ? null : itemId;
        renderItems(game.activePlayer);
        renderTargets(game.activePlayer);
        renderTurnHint(game.activePlayer);
        return;
      }
      const result = usePlayerItem(itemId);
      if (!result.ok) {
        showEventToast(result.error, "warning");
        return;
      }
      syncAll();
    });
    itemsEl.append(button);
  }
}

function renderTargets(active) {
  targetsEl.replaceChildren();

  if (game.state.winnerId) {
    targetLabelEl.textContent = "Финал";
    targetsEl.append(emptyNote("подводим итог"));
    return;
  }

  if (!active?.isHuman) {
    targetLabelEl.textContent = "Выбор";
    targetsEl.append(emptyNote(onlineMode ? "ждём ход" : "бот думает"));
    return;
  }

  if (pendingItem) {
    const item = ITEM_DEFS[pendingItem];
    targetLabelEl.textContent = item.shortName;
    const validTargets = game.alivePlayers().filter((player) => {
      if (player.id === active.id) return false;
      if (item.targetMode === "hasItem") return player.items.length > 0;
      return true;
    });

    for (const player of validTargets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "target-button primary";
      decorateTargetButton(button, player, shortTargetName(player));
      button.setAttribute(
        "aria-label",
        item.id === "hammer" ? `Ударить ${player.name}` : `Украсть у ${player.name}`,
      );
      button.addEventListener("click", () => {
        usePlayerItem(pendingItem, player.id);
        pendingItem = null;
        if (!onlineMode) syncAll();
      });
      targetsEl.append(button);
    }

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "target-button";
    cancel.textContent = "Отмена";
    cancel.addEventListener("click", () => {
      pendingItem = null;
      renderItems(game.activePlayer);
      renderTargets(game.activePlayer);
      renderTurnHint(game.activePlayer);
    });
    targetsEl.append(cancel);

    if (validTargets.length === 0) {
      targetsEl.prepend(emptyNote("нет цели"));
    }
    return;
  }

  targetLabelEl.textContent = "Выстрел";
  const selfButton = document.createElement("button");
  selfButton.type = "button";
  selfButton.className = "target-button danger";
  selfButton.disabled = isShotInputLocked() || isOnlineActionLocked();
  decorateTargetButton(selfButton, active, "В себя");
  selfButton.addEventListener("click", () => {
    performHumanShot(active.id);
  });
  targetsEl.append(selfButton);

  for (const player of game.alivePlayers().filter((player) => player.id !== active.id)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "target-button primary";
    button.disabled = isShotInputLocked() || isOnlineActionLocked();
    decorateTargetButton(button, player, shortTargetName(player));
    button.setAttribute("aria-label", `Выстрелить в ${player.name}`);
    button.addEventListener("click", () => {
      performHumanShot(player.id);
    });
    targetsEl.append(button);
  }
}

function decorateTargetButton(button, player, label) {
  const dot = document.createElement("span");
  dot.className = "target-dot";
  dot.style.background = player.color;
  dot.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = label;
  button.append(dot, text);
}

function renderRiskMeter(state) {
  const total = state.shellCounts.live + state.shellCounts.blank;
  const risk = total ? Math.round((state.shellCounts.live / total) * 100) : 0;
  const level = risk >= 60 ? "high" : risk <= 35 ? "low" : "medium";
  return `
    <div class="shell-risk is-${level}" aria-label="Вероятность боевого заряда ${risk}%">
      <span class="risk-track"><i style="width:${risk}%"></i></span>
      <em><b>${risk}%</b> боевой</em>
    </div>
  `;
}

function renderTurnHint(active) {
  const state = game.state;
  if (state.winnerId) {
    turnHintEl.textContent = "Результат сохранён в таблице";
    return;
  }
  if (!active) {
    turnHintEl.textContent = "Подготовка следующего раунда";
    return;
  }
  if (!active.isHuman) {
    turnHintEl.textContent = onlineMode ? `${active.name} принимает решение...` : `${active.name} выбирает ход...`;
    return;
  }
  if (pendingItem) {
    turnHintEl.textContent = `Выбери цель: ${ITEM_DEFS[pendingItem].description}`;
    return;
  }
  if (state.peekedBy === active.id && state.peekedShell) {
    turnHintEl.textContent =
      state.peekedShell === "blank"
        ? "Таро: пустой. Выстрел в себя сохранит ход"
        : "Таро: боевой. Целься в соперника";
    return;
  }

  const total = state.shellCounts.live + state.shellCounts.blank;
  const risk = total ? state.shellCounts.live / total : 0;
  if (risk <= 0.35) {
    turnHintEl.textContent = "Пустых больше: риск в себя может сохранить ход";
  } else if (risk >= 0.6) {
    turnHintEl.textContent = "Боевых больше: выгоднее выбрать соперника";
  } else {
    turnHintEl.textContent = "Шансы близки: предмет может решить ход";
  }
}

function showEventToast(message, tone = "neutral") {
  if (!eventToastEl || !message) return;
  toastGeneration += 1;
  const generation = toastGeneration;
  clearTimeout(eventToastTimer);
  eventToastEl.hidden = false;
  eventToastEl.textContent = message;
  eventToastEl.dataset.tone = tone;
  eventToastEl.classList.remove("is-visible");
  requestAnimationFrame(() => eventToastEl.classList.add("is-visible"));
  eventToastTimer = setTimeout(() => {
    eventToastEl.classList.remove("is-visible");
    window.setTimeout(() => {
      if (generation !== toastGeneration) return;
      eventToastEl.hidden = true;
    }, 180);
  }, 2800);
}

function shortTargetName(player) {
  if (onlineMode) {
    const firstName = player.name.trim().split(/\s+/)[0];
    return firstName.length > 10 ? `${firstName.slice(0, 9)}…` : firstName;
  }
  return {
    p1: "Прораб",
    p2: "Джим",
    p3: "Смузи",
  }[player.id] ?? player.name;
}

function renderLog() {
  battleLogEl.replaceChildren(
    ...game.state.log.map((entry) => {
      const li = document.createElement("li");
      li.textContent = entry;
      return li;
    }),
  );
}

function createDefaultLeaderboard() {
  return {
    records: Object.fromEntries(
      LEADERBOARD_PLAYERS.map((player) => [
        player.id,
        {
          id: player.id,
          name: player.name,
          totalScore: 0,
          wins: 0,
          currentStreak: 0,
          bestStreak: 0,
          lastWinAt: null,
        },
      ]),
    ),
    lastWinnerId: null,
    awardedMatches: [],
    history: [],
  };
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return normalizeLeaderboard(raw ? JSON.parse(raw) : null);
  } catch {
    return createDefaultLeaderboard();
  }
}

function saveLeaderboard() {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  } catch {
    // A blocked storage write should not break the match.
  }
}

function normalizeLeaderboard(value) {
  const base = createDefaultLeaderboard();
  if (!value || typeof value !== "object") return base;

  for (const player of LEADERBOARD_PLAYERS) {
    const record = value.records?.[player.id];
    if (!record || typeof record !== "object") continue;
    base.records[player.id] = {
      id: player.id,
      name: player.name,
      totalScore: numberOrZero(record.totalScore),
      wins: numberOrZero(record.wins),
      currentStreak: numberOrZero(record.currentStreak),
      bestStreak: numberOrZero(record.bestStreak),
      lastWinAt: typeof record.lastWinAt === "number" ? record.lastWinAt : null,
    };
  }

  base.lastWinnerId = typeof value.lastWinnerId === "string" ? value.lastWinnerId : null;
  base.awardedMatches = Array.isArray(value.awardedMatches)
    ? value.awardedMatches.filter((id) => typeof id === "string").slice(0, 30)
    : [];
  base.history = Array.isArray(value.history)
    ? value.history
        .filter((entry) => entry && typeof entry === "object" && typeof entry.matchId === "string")
        .slice(0, 20)
        .map((entry) => ({
          matchId: entry.matchId,
          winnerId: typeof entry.winnerId === "string" ? entry.winnerId : null,
          name: typeof entry.name === "string" ? entry.name : "Победитель",
          score: numberOrZero(entry.score),
          streak: Math.max(1, numberOrZero(entry.streak)),
          wonAt: typeof entry.wonAt === "number" ? entry.wonAt : null,
        }))
    : [];
  return base;
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function maybeAwardMatch() {
  if (onlineMode) return;
  const { winnerId, matchId, completedAt, playerCount } = game.state;
  if (!winnerId || !matchId || !completedAt) return;

  const existingAward = leaderboard.history.find((entry) => entry.matchId === matchId);
  if (existingAward) {
    lastAward = existingAward;
    return;
  }
  if (leaderboard.awardedMatches.includes(matchId)) return;

  const winner = game.state.players.find((player) => player.id === winnerId);
  if (!winner) return;

  const records = leaderboard.records;
  for (const player of LEADERBOARD_PLAYERS) {
    if (!records[player.id]) {
      records[player.id] = createDefaultLeaderboard().records[player.id];
    }
    if (player.id !== winnerId) {
      records[player.id].currentStreak = 0;
    }
  }

  const record = records[winnerId];
  const newStreak = record.currentStreak + 1;
  const base = playerCount === 4 ? 220 : 120;
  const hpBonus = winner.hp * 15;
  const streakBonus = (newStreak - 1) * (playerCount === 4 ? 90 : 50);
  const score = base + hpBonus + streakBonus;

  record.totalScore += score;
  record.wins += 1;
  record.currentStreak = newStreak;
  record.bestStreak = Math.max(record.bestStreak, newStreak);
  record.lastWinAt = completedAt;

  lastAward = {
    matchId,
    winnerId,
    name: winner.name,
    score,
    streak: newStreak,
    wonAt: completedAt,
  };
  leaderboard.lastWinnerId = winnerId;
  leaderboard.awardedMatches = [matchId, ...leaderboard.awardedMatches].slice(0, 30);
  leaderboard.history = [lastAward, ...leaderboard.history.filter((entry) => entry.matchId !== matchId)].slice(0, 20);
  game.pushLog(`${winner.name}: +${score} очков, серия x${newStreak}.`);
  saveLeaderboard();
}

function maybeRecordStatsMatch() {
  const { winnerId, matchId, weaponSkin } = game.state;
  if (!winnerId || !matchId) return;
  if (onlineMode) {
    const localPlayerId = getLocalPlayerId();
    const winner = game.state.players.find((player) => player.id === winnerId);
    const won = winnerId === localPlayerId;
    const base = game.state.playerCount === 4 ? 220 : 120;
    const currentStreak = rouletteStats.snapshot().currentStreak;
    const nextStreak = won ? currentStreak + 1 : 0;
    const streakBonus = won ? (nextStreak - 1) * (game.state.playerCount === 4 ? 90 : 50) : 0;
    const score = won ? base + (winner?.hp ?? 0) * 15 + streakBonus : 0;
    const recorded = rouletteStats.recordMatchResult({
      matchId,
      winnerId,
      playerId: localPlayerId,
      weaponSkin,
      score,
    });
    if (recorded && won) {
      const stats = rouletteStats.snapshot();
      lastOnlineAward = { matchId, score, streak: stats.currentStreak };
    }
    return;
  }
  const award = leaderboard.history.find((entry) => entry.matchId === matchId);
  rouletteStats.recordMatchResult({
    matchId,
    winnerId,
    weaponSkin,
    score: winnerId === "p0" ? award?.score ?? 0 : 0,
  });
}

function sortedLeaderboardRecords() {
  return Object.values(leaderboard.records).sort(
    (a, b) => b.totalScore - a.totalScore || b.wins - a.wins || b.bestStreak - a.bestStreak,
  );
}

function renderScoreAward() {
  if (!scoreAwardEl) return;
  if (game.state.winnerId && lastAward?.matchId === game.state.matchId) {
    scoreAwardEl.hidden = false;
    scoreAwardEl.textContent = `+${lastAward.score} очков • серия x${lastAward.streak}`;
    return;
  }
  scoreAwardEl.hidden = true;
  scoreAwardEl.textContent = "";
}

function renderLeaderboard() {
  if (!leaderboardEl) return;
  const title = document.createElement("div");
  title.className = "leaderboard-title";
  title.textContent = "Лидеры";

  const list = document.createElement("ol");
  list.className = "leaderboard-list";

  for (const record of sortedLeaderboardRecords()) {
    const row = document.createElement("li");
    row.className = "leaderboard-row";
    if (record.id === "p0") row.classList.add("is-you");
    if (record.id === leaderboard.lastWinnerId) row.classList.add("is-last-winner");

    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = record.name;

    const score = document.createElement("strong");
    score.className = "leaderboard-score";
    score.textContent = String(record.totalScore);

    const meta = document.createElement("span");
    meta.className = "leaderboard-meta";
    meta.textContent = `${record.wins} побед • серия x${record.bestStreak}`;

    row.append(name, score, meta);
    list.append(row);
  }

  leaderboardEl.replaceChildren(title, list);
}

function emptyNote(text) {
  const note = document.createElement("span");
  note.className = "player-meta";
  note.textContent = text;
  return note;
}

function openTutorial(index) {
  tutorialIndex = index;
  const step = TUTORIAL_STEPS[tutorialIndex];
  tutorialTitleEl.textContent = step.title;
  tutorialCopyEl.textContent = step.copy;
  tutorialNextButton.textContent = tutorialIndex === TUTORIAL_STEPS.length - 1 ? "Играть" : "Дальше";
  tutorialProgressEl.replaceChildren(
    ...TUTORIAL_STEPS.map((_, stepIndex) => {
      const dot = document.createElement("span");
      dot.className = "tutorial-dot";
      if (stepIndex === tutorialIndex) {
        dot.classList.add("is-active");
      }
      return dot;
    }),
  );
  tutorialEl.hidden = false;
  tutorialNextButton.focus({ preventScroll: true });
}

function closeTutorial() {
  tutorialEl.hidden = true;
  try {
    localStorage.setItem("rouletteClubTutorialSeen", "true");
  } catch {
    // The tutorial can still close when embedded storage is unavailable.
  }
  if (matchCinematic.pending) {
    startMatchCinematicPlayback();
  } else if (roundIntro.pending) {
    startRoundIntroPlayback();
  }
  if (tutorialOpenButton.offsetParent !== null) tutorialOpenButton.focus({ preventScroll: true });
}

function activeModalPanel() {
  return [statsPanelEl, onlinePanelEl, tutorialEl, resultPanelEl].find((panel) => panel && !panel.hidden) ?? null;
}

function trapModalFocus(event, panel) {
  const focusable = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])")]
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!panel.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function hasSeenTutorial() {
  try {
    return localStorage.getItem("rouletteClubTutorialSeen") === "true";
  } catch {
    return false;
  }
}

function openStatsPanel() {
  flushActiveStats();
  renderStatsPanel();
  statsPanelEl.hidden = false;
  statsCloseIconButton.focus({ preventScroll: true });
}

function closeStatsPanel() {
  statsPanelEl.hidden = true;
  statsOpenButton.focus({ preventScroll: true });
}

function scheduleMatchResult(event) {
  if (!event?.gameOver || !game.state.winnerId) return;
  const matchId = game.state.matchId;
  clearTimeout(resultRevealTimer);
  resultRevealTimer = window.setTimeout(() => {
    if (game.state.matchId !== matchId || !game.state.winnerId) return;
    showMatchResult();
  }, RESULT_REVEAL_MS);
}

function showMatchResult() {
  const state = game.state;
  const winner = state.players.find((player) => player.id === state.winnerId);
  if (!winner) return;

  const humanWon = winner.id === getLocalPlayerId();
  const winnerIndex = Math.max(0, Number(winner.id.slice(1)) || 0);
  const award = onlineMode ? lastOnlineAward : leaderboard.history.find((entry) => entry.matchId === state.matchId);
  const localStats = rouletteStats.snapshot();
  const humanRecord = onlineMode
    ? { totalScore: localStats.totalScore, currentStreak: localStats.currentStreak }
    : leaderboard.records.p0;
  resultCardEl.classList.toggle("is-victory", humanWon);
  resultCardEl.classList.toggle("is-defeat", !humanWon);
  resultCharacterEl.src = humanWon && winnerIndex === 0 ? ART.p0Victory : ART[CHARACTER_KEYS[winnerIndex]];
  resultCharacterEl.alt = winner.name;
  resultKickerEl.textContent = humanWon ? "Победа" : "Поражение";
  resultTitleEl.textContent = humanWon ? "Стол твой" : `${winner.name} выстоял`;
  resultSubtitleEl.textContent = humanWon
    ? onlineMode ? "Ты пережил живой стол. Победа записана в твою статистику." : "Последний соперник выбит. Награда уже в твоем рейтинге."
    : "Твоя серия прервана. Следующий матч начинается с чистого барабана.";

  resultMetricsEl.replaceChildren(
    makeResultMetric(humanWon ? "Награда" : "Итог", humanWon ? `+${award?.score ?? 0}` : `Раунд ${state.roundNumber}`),
    makeResultMetric(humanWon ? "Серия" : "Победитель", humanWon ? `x${award?.streak ?? humanRecord.currentStreak}` : `${winner.hp} HP`),
    makeResultMetric("Всего очков", formatStatNumber(humanRecord.totalScore)),
  );

  resultPanelEl.hidden = false;
  appShellEl.dataset.resultOpen = "true";
  resultReplayButton.textContent = onlineMode ? (onlineRoom?.isHost ? "Собрать реванш" : "Ждать реванш") : "Реванш";
  resultReplayButton.disabled = onlineMode && !onlineRoom?.isHost;
  resultReplayButton.focus({ preventScroll: true });

  const origin = playerEffectPoint(winner.id, "head") ?? { x: viewport.width / 2, y: viewport.height / 2 };
  emitParticleBurst(
    origin,
    humanWon ? 84 : 42,
    humanWon ? ["#ffd57a", "#fff5df", "#62d7c5", "#ff5d66"] : ["#ff5d66", "#f3b84d", "#fff5df"],
    humanWon ? 520 : 300,
    humanWon ? 430 : 250,
    performance.now(),
    "confetti",
  );

  if (resultSoundMatchId !== state.matchId) {
    resultSoundMatchId = state.matchId;
    playOutcomeSfx(humanWon);
  }
}

function makeResultMetric(label, value) {
  const metric = document.createElement("div");
  const caption = document.createElement("span");
  const strong = document.createElement("strong");
  caption.textContent = label;
  strong.textContent = value;
  metric.append(caption, strong);
  return metric;
}

function renderStatsPanel() {
  const stats = rouletteStats.snapshot();
  const winRate = stats.matchesCompleted ? Math.round((stats.wins / stats.matchesCompleted) * 100) : 0;
  const telegramSuffix = stats.telegramSessions ? ` · Telegram ${stats.telegramSessions}` : "";

  statsSummaryEl.replaceChildren(
    makeStatCell("Победы", formatStatNumber(stats.wins)),
    makeStatCell("Winrate", `${winRate}%`),
    makeStatCell("Лучшая серия", `x${stats.bestStreak}`),
    makeStatCell("Очки", formatStatNumber(stats.totalScore)),
  );

  statsDetailsEl.replaceChildren(
    makeStatRow("Матчи", `${stats.matchesCompleted} завершено · ${stats.wins} побед · ${stats.losses} поражений`),
    makeStatRow("Время за столом", formatStatDuration(stats.activeSeconds)),
    makeStatRow("Выстрелы", `${stats.shotsFired} всего · ${stats.selfShots} в себя · ${stats.opponentShots} в соперников`),
    makeStatRow("Заряды", `${stats.liveShots} боевых · ${stats.blankShots} пустых`),
    makeStatRow("Урон", `${stats.damageDealt} нанесено · ${stats.damageTaken} получено`),
    makeStatRow("Выбивания", formatStatNumber(stats.eliminations)),
    makeStatRow(
      "Предметы",
      `${stats.itemsUsed} всего · молоток ${stats.itemUses.hammer} · клешня ${stats.itemUses.claw} · вейп ${stats.itemUses.vape} · таро ${stats.itemUses.tarot}`,
    ),
    makeStatRow(
      "Оружие",
      `револьвер ${stats.weaponWins.revolver}/${stats.weaponMatches.revolver} · дробовик ${stats.weaponWins.shotgun}/${stats.weaponMatches.shotgun}`,
    ),
    makeStatRow("Раунды", formatStatNumber(stats.roundsPlayed)),
    makeStatRow("Сессии", `${stats.sessions}${telegramSuffix}`),
  );
}

function makeStatCell(label, value) {
  const cell = document.createElement("div");
  cell.className = "stats-cell";
  const caption = document.createElement("span");
  caption.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  cell.append(caption, strong);
  return cell;
}

function makeStatRow(label, value) {
  const row = document.createElement("div");
  row.className = "stats-row";
  const caption = document.createElement("span");
  caption.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  row.append(caption, strong);
  return row;
}

function formatStatNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("ru-RU");
}

function formatStatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return `${hours} ч ${minutes} мин`;
  if (minutes) return `${minutes} мин`;
  return `${total} сек`;
}

function flushActiveStats() {
  if (activeStatsSince === null) return;
  const now = performance.now();
  const elapsedSeconds = Math.floor((now - activeStatsSince) / 1000);
  if (!elapsedSeconds) return;
  rouletteStats.addActiveSeconds(elapsedSeconds);
  activeStatsSince += elapsedSeconds * 1000;
  if (!statsPanelEl.hidden) renderStatsPanel();
}

function startDrawLoop() {
  if (drawFrameId !== null || document.visibilityState === "hidden") return;
  drawFrameId = requestAnimationFrame(draw);
}

function stopDrawLoop() {
  if (drawFrameId !== null) cancelAnimationFrame(drawFrameId);
  drawFrameId = null;
}

function draw(now = 0) {
  drawFrameId = null;
  if (document.visibilityState === "hidden") return;
  const frameInterval = getLayoutMode() === "desktop" ? 1000 / 60 : 1000 / 30;
  if (now - lastDrawAt < frameInterval) {
    drawFrameId = requestAnimationFrame(draw);
    return;
  }
  lastDrawAt = now;
  if (!images.background || !images.p0 || !images.revolver) {
    drawFrameId = requestAnimationFrame(draw);
    return;
  }

  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.save();
  const shake = getScreenShake(now);
  ctx.translate(shake.x, shake.y);
  drawBackground(now);
  drawTableVignette(now);
  drawFarPlayers(now);
  if (!matchCinematic.active) drawTableProps(now);
  drawNearPlayers(now);
  drawParticles(now);
  drawImpact(now);
  if (!matchCinematic.active) {
    drawSceneLabels(now);
    drawRoundIntro(now);
  }
  drawMatchCinematic(now);
  ctx.restore();
  drawFrameId = requestAnimationFrame(draw);
}

function drawBackground(now) {
  const image = images.background;
  const mode = getLayoutMode();
  const base = ctx.createLinearGradient(0, 0, 0, viewport.height);
  base.addColorStop(0, "#1a0909");
  base.addColorStop(0.42, "#0b1718");
  base.addColorStop(1, "#040303");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  if (mode !== "portrait" && backdropCanvas.width > 1 && backdropCanvas.height > 1) {
    ctx.drawImage(backdropCanvas, 0, 0, backdropCanvas.width, backdropCanvas.height, 0, 0, viewport.width, viewport.height);
  }

  ctx.save();
  if (mode === "portrait") {
    const bounds = getHudSceneBounds(mode);
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.clip();
  }
  ctx.filter = "saturate(1.08) contrast(1.03)";
  ctx.drawImage(image, bgFrame.x, bgFrame.y, bgFrame.width, bgFrame.height);
  ctx.restore();

  if (mode !== "portrait") {
    const hudShade = ctx.createLinearGradient(0, 0, viewport.width * 0.32, 0);
    hudShade.addColorStop(0, "rgba(2, 3, 5, 0.72)");
    hudShade.addColorStop(0.68, "rgba(2, 3, 5, 0.22)");
    hudShade.addColorStop(1, "rgba(2, 3, 5, 0)");
    ctx.fillStyle = hudShade;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  const gradient = ctx.createRadialGradient(
    viewport.width * 0.5,
    viewport.height * 0.5,
    viewport.width * 0.05,
    viewport.width * 0.5,
    viewport.height * 0.56,
    viewport.width * 0.78,
  );
  gradient.addColorStop(0, "rgba(255, 215, 126, 0.08)");
  gradient.addColorStop(0.55, "rgba(10, 8, 10, 0)");
  gradient.addColorStop(1, "rgba(4, 2, 4, 0.62)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

function drawGameRoom(now) {
  drawBackWall(now);
  drawCurtains(now);
  drawClubStage(now);
  drawFloor(now);
  drawSideProps(now);
  drawHangingLights(now);
}

function drawBackWall(now) {
  const wall = ctx.createLinearGradient(0, 0, 0, 560);
  wall.addColorStop(0, "#2a1112");
  wall.addColorStop(0.52, "#19131a");
  wall.addColorStop(1, "#111012");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, BG_SIZE.width, 560);

  ctx.save();
  ctx.globalAlpha = 0.34;
  for (let x = 0; x < BG_SIZE.width; x += 96) {
    ctx.fillStyle = x < 360 ? "rgba(68, 215, 220, 0.055)" : "rgba(255, 180, 74, 0.045)";
    roundedRect(x + 12, 62 + (x % 3) * 12, 62, 230, 18);
    ctx.fill();
  }
  ctx.restore();

  const leftSafe = ctx.createLinearGradient(0, 0, 420, 0);
  leftSafe.addColorStop(0, "rgba(3, 4, 6, 0.9)");
  leftSafe.addColorStop(0.7, "rgba(3, 4, 6, 0.52)");
  leftSafe.addColorStop(1, "rgba(3, 4, 6, 0)");
  ctx.fillStyle = leftSafe;
  ctx.fillRect(0, 0, 430, BG_SIZE.height);
}

function drawCurtains(now) {
  const pulse = 0.5 + Math.sin(now * 0.002) * 0.5;
  ctx.save();
  for (const curtain of [
    { x: 530, w: 210, lean: -42 },
    { x: 1250, w: 230, lean: 38 },
    { x: 760, w: 190, lean: -24 },
    { x: 1060, w: 190, lean: 24 },
  ]) {
    const fold = ctx.createLinearGradient(curtain.x, 0, curtain.x + curtain.w, 0);
    fold.addColorStop(0, "#421316");
    fold.addColorStop(0.28, "#9c2423");
    fold.addColorStop(0.55, "#57161a");
    fold.addColorStop(0.82, "#b63a2d");
    fold.addColorStop(1, "#2a0c10");
    ctx.fillStyle = fold;
    ctx.beginPath();
    ctx.moveTo(curtain.x, 0);
    ctx.bezierCurveTo(curtain.x + curtain.lean, 120, curtain.x + curtain.w * 0.2, 240, curtain.x + curtain.w * 0.15, 356);
    ctx.lineTo(curtain.x + curtain.w * 0.86, 356);
    ctx.bezierCurveTo(curtain.x + curtain.w * 0.72, 226, curtain.x + curtain.w + curtain.lean, 112, curtain.x + curtain.w, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 0.42 + pulse * 0.08;
  ctx.strokeStyle = "rgba(255, 199, 78, 0.48)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(560, 86);
  ctx.bezierCurveTo(730, 150, 1060, 150, 1265, 84);
  ctx.stroke();
  ctx.restore();
}

function drawClubStage(now) {
  const glow = ctx.createRadialGradient(1010, 188, 20, 1010, 245, 380);
  glow.addColorStop(0, "rgba(255, 181, 75, 0.34)");
  glow.addColorStop(0.55, "rgba(164, 47, 37, 0.18)");
  glow.addColorStop(1, "rgba(20, 7, 8, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(560, 40, 860, 360);

  ctx.save();
  ctx.fillStyle = "rgba(15, 8, 9, 0.84)";
  roundedRect(650, 235, 720, 120, 28);
  ctx.fill();

  const stage = ctx.createLinearGradient(0, 230, 0, 382);
  stage.addColorStop(0, "#5c2b1b");
  stage.addColorStop(0.52, "#24100e");
  stage.addColorStop(1, "#0d0808");
  ctx.fillStyle = stage;
  roundedRect(610, 275, 800, 112, 36);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 213, 122, 0.32)";
  ctx.lineWidth = 3;
  ctx.stroke();

  drawMicrophone(1010, 224, now);
  for (let i = 0; i < 10; i += 1) {
    drawBulb(690 + i * 70, 294 + Math.sin(i) * 8, 7, 0.55);
  }
  ctx.restore();
}

function drawMicrophone(x, y, now) {
  const shimmer = 0.5 + Math.sin(now * 0.006) * 0.5;
  ctx.save();
  ctx.strokeStyle = "rgba(235, 197, 127, 0.72)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + 24);
  ctx.lineTo(x, y + 122);
  ctx.stroke();

  ctx.fillStyle = "#161012";
  ctx.beginPath();
  ctx.ellipse(x, y, 16, 25, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 221, 151, ${0.5 + shimmer * 0.28})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "rgba(255, 245, 223, 0.8)";
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x - 10, y + i * 7);
    ctx.lineTo(x + 10, y + i * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFloor(now) {
  const floor = ctx.createLinearGradient(0, 420, 0, BG_SIZE.height);
  floor.addColorStop(0, "#1d1715");
  floor.addColorStop(0.7, "#111111");
  floor.addColorStop(1, "#080706");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 390, BG_SIZE.width, BG_SIZE.height - 390);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "rgba(255, 245, 223, 0.12)";
  ctx.lineWidth = 1;
  for (let y = 438; y < BG_SIZE.height; y += 56) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BG_SIZE.width, y + (y - 438) * 0.12);
    ctx.stroke();
  }
  for (let x = 120; x < BG_SIZE.width; x += 115) {
    ctx.beginPath();
    ctx.moveTo(x, 395);
    ctx.lineTo(x - 190, BG_SIZE.height);
    ctx.stroke();
  }
  ctx.restore();

  drawRug(1000, 740);
}

function drawRug(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.34);
  const rug = ctx.createRadialGradient(0, 0, 50, 0, 0, 690);
  rug.addColorStop(0, "rgba(130, 38, 32, 0.46)");
  rug.addColorStop(0.72, "rgba(81, 19, 23, 0.36)");
  rug.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = rug;
  ctx.beginPath();
  ctx.arc(0, 0, 705, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 213, 122, 0.2)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(0, 0, 560, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSideProps(now) {
  ctx.save();
  drawCrate(255, 285, 98, 72, -0.04);
  drawCrate(1475, 292, 112, 78, 0.05);
  drawCautionStripe(170, 250, 190, 38, -0.12);
  drawCautionStripe(1400, 235, 160, 34, 0.08);
  drawCone(360, 374, 38, 92);
  drawCone(1510, 384, 34, 80);
  drawPipeArc(255, 104, 185, 210, "#38c9d4");
  drawPipeArc(1510, 118, 180, 205, "#f0aa3c");
  ctx.restore();
}

function drawCrate(x, y, width, height, rotate) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.fillStyle = "rgba(93, 56, 33, 0.68)";
  roundedRect(-width / 2, -height / 2, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 213, 122, 0.2)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-width * 0.42, -height * 0.32);
  ctx.lineTo(width * 0.42, height * 0.32);
  ctx.moveTo(width * 0.42, -height * 0.32);
  ctx.lineTo(-width * 0.42, height * 0.32);
  ctx.stroke();
  ctx.restore();
}

function drawCautionStripe(x, y, width, height, rotate) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  roundedRect(-width / 2, -height / 2, width, height, 6);
  ctx.clip();
  ctx.fillStyle = "#f3b84d";
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.fillStyle = "#181014";
  for (let i = -width; i < width; i += 34) {
    ctx.beginPath();
    ctx.moveTo(i, -height / 2);
    ctx.lineTo(i + 18, -height / 2);
    ctx.lineTo(i + 54, height / 2);
    ctx.lineTo(i + 36, height / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCone(x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.beginPath();
  ctx.ellipse(0, height * 0.42, width * 0.7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d85a25";
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.5);
  ctx.lineTo(width * 0.5, height * 0.5);
  ctx.lineTo(-width * 0.5, height * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 245, 223, 0.72)";
  ctx.fillRect(-width * 0.28, height * 0.02, width * 0.56, height * 0.1);
  ctx.fillRect(-width * 0.18, -height * 0.2, width * 0.36, height * 0.08);
  ctx.restore();
}

function drawPipeArc(x, y, width, height, color) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(x, y, width, height, 0, Math.PI * 0.68, Math.PI * 1.34);
  ctx.stroke();
  ctx.restore();
}

function drawHangingLights(now) {
  const lights = [
    { x: 245, y: 96, r: 34, c: "#62d7c5", a: 0.18 },
    { x: 618, y: 110, r: 38, c: "#ffd57a", a: 0.3 },
    { x: 1008, y: 58, r: 44, c: "#ffb64d", a: 0.32 },
    { x: 1396, y: 118, r: 36, c: "#ffd57a", a: 0.28 },
  ];

  for (const light of lights) {
    const pulse = 0.5 + Math.sin(now * 0.004 + light.x) * 0.5;
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(light.x, -20);
    ctx.lineTo(light.x, light.y - light.r * 0.7);
    ctx.stroke();
    drawBulb(light.x, light.y, light.r, light.a + pulse * 0.06, light.c);
    ctx.restore();
  }
}

function drawBulb(x, y, radius, alpha = 0.32, color = "#ffd57a") {
  ctx.save();
  const glowColor =
    color === "#62d7c5"
      ? `rgba(98, 215, 197, ${alpha})`
      : color === "#ffb64d"
        ? `rgba(255, 182, 77, ${alpha})`
        : `rgba(255, 213, 122, ${alpha})`;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
  glow.addColorStop(0, glowColor);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);

  ctx.fillStyle = "rgba(255, 226, 151, 0.9)";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(19, 10, 9, 0.68)";
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.beginPath();
  ctx.ellipse(x, y - radius * 0.22, radius * 0.72, radius * 0.34, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGameTable(now) {
  const center = { x: 1000, y: 585 };
  drawTableShadow(center.x, center.y);
  drawTableLegs(center.x, center.y);
  drawTableRim(center.x, center.y, now);
  drawFelt(center.x, center.y, now);
  drawCupHolders(center.x, center.y);
}

function drawTableShadow(x, y) {
  ctx.save();
  ctx.translate(x, y + 110);
  ctx.scale(1, 0.32);
  const shadow = ctx.createRadialGradient(0, 0, 20, 0, 0, 760);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.58)");
  shadow.addColorStop(0.72, "rgba(0, 0, 0, 0.34)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, 770, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTableLegs(x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(33, 17, 11, 0.82)";
  for (const leg of [
    { x: x - 360, y: y + 160, w: 92, h: 170 },
    { x: x + 360, y: y + 160, w: 92, h: 170 },
    { x, y: y + 176, w: 130, h: 190 },
  ]) {
    ctx.beginPath();
    ctx.ellipse(leg.x, leg.y, leg.w, leg.h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTableRim(x, y, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.43);

  const rim = ctx.createRadialGradient(-170, -110, 100, 0, 0, 720);
  rim.addColorStop(0, "#ffd57a");
  rim.addColorStop(0.18, "#9b5729");
  rim.addColorStop(0.54, "#4a2215");
  rim.addColorStop(0.88, "#1a0b09");
  rim.addColorStop(1, "#090504");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(0, 0, 720, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 222, 139, 0.72)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 705, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(14, 8, 8, 0.65)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(0, 0, 610, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y + 170);
  ctx.scale(1, 0.24);
  const front = ctx.createRadialGradient(0, -40, 30, 0, 0, 720);
  front.addColorStop(0, "rgba(255, 190, 79, 0.32)");
  front.addColorStop(0.52, "rgba(90, 38, 17, 0.72)");
  front.addColorStop(1, "rgba(5, 3, 3, 0)");
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.arc(0, 0, 720, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const sparkle = 0.5 + Math.sin(now * 0.004) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.2 + sparkle * 0.08;
  ctx.strokeStyle = "#ffd57a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 648, 268, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();
  ctx.restore();
}

function drawFelt(x, y, now) {
  ctx.save();
  ctx.translate(x, y - 22);
  ctx.scale(1, 0.42);
  const felt = ctx.createRadialGradient(-80, -80, 40, 0, 0, 610);
  felt.addColorStop(0, "#3fa171");
  felt.addColorStop(0.44, "#146143");
  felt.addColorStop(0.86, "#073623");
  felt.addColorStop(1, "#041b14");
  ctx.fillStyle = felt;
  ctx.beginPath();
  ctx.arc(0, 0, 606, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(255, 245, 223, 0.22)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 80; i += 1) {
    const angle = (i * 2.399 + now * 0.00002) % (Math.PI * 2);
    const radius = 70 + ((i * 47) % 500);
    const x0 = Math.cos(angle) * radius;
    const y0 = Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(angle + 1.2) * 12, y0 + Math.sin(angle + 1.2) * 5);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255, 213, 122, 0.52)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 500, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 245, 223, 0.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 145, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCupHolders(x, y) {
  for (const holder of [
    { x: x - 500, y: y - 145, r: 32 },
    { x: x + 500, y: y - 145, r: 32 },
    { x: x - 560, y: y + 80, r: 36 },
    { x: x + 560, y: y + 80, r: 36 },
  ]) {
    ctx.save();
    ctx.translate(holder.x, holder.y);
    ctx.scale(1, 0.48);
    const outer = ctx.createRadialGradient(-8, -8, 2, 0, 0, holder.r);
    outer.addColorStop(0, "#ffe29a");
    outer.addColorStop(0.38, "#b06d2e");
    outer.addColorStop(0.7, "#27100b");
    outer.addColorStop(1, "#050303");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, holder.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#090606";
    ctx.beginPath();
    ctx.arc(0, 0, holder.r * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 222, 139, 0.7)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }
}

function drawTableSeatOcclusion(now) {
  ctx.save();
  ctx.translate(bgFrame.x, bgFrame.y);
  ctx.scale(bgFrame.scale, bgFrame.scale);
  const x = 1000;
  const y = 585;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.43);
  const rim = ctx.createLinearGradient(0, -690, 0, 690);
  rim.addColorStop(0, "rgba(255, 224, 156, 0.82)");
  rim.addColorStop(0.26, "rgba(128, 70, 31, 0.88)");
  rim.addColorStop(0.55, "rgba(45, 20, 13, 0.92)");
  rim.addColorStop(1, "rgba(9, 5, 4, 0.86)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.arc(0, 0, 626, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 222, 139, 0.5)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 642, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const shade = ctx.createLinearGradient(0, y - 190, 0, y + 190);
  shade.addColorStop(0, "rgba(0, 0, 0, 0.0)");
  shade.addColorStop(0.46, "rgba(0, 0, 0, 0.12)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(x, y, 640, 270, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawTableVignette(now) {
  const lampPulse = 0.5 + Math.sin(now * 0.003) * 0.5;
  const center = project({ x: 836, y: 532 });
  const radius = Math.min(viewport.width, viewport.height) * 0.58;
  const glow = ctx.createRadialGradient(center.x, center.y, 20, center.x, center.y, radius);
  glow.addColorStop(0, `rgba(255, 217, 135, ${0.18 + lampPulse * 0.05})`);
  glow.addColorStop(0.45, "rgba(255, 184, 77, 0.06)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 10; i += 1) {
    const smokeX = viewport.width * ((i * 0.113 + now * 0.000012) % 1);
    const smokeY = viewport.height * (0.14 + ((i * 0.071 + now * 0.000018) % 0.32));
    ctx.beginPath();
    ctx.ellipse(smokeX, smokeY, 70 + i * 3, 12 + (i % 3) * 4, Math.sin(now * 0.0004 + i), 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? "rgba(98, 215, 197, 0.18)" : "rgba(255, 245, 223, 0.12)";
    ctx.fill();
  }
  ctx.restore();
}

function drawFarPlayers(now) {
  const ordered = [...game.state.players].filter((player) => getSeat(player)?.layer < 4);
  ordered.sort((a, b) => getSeat(a).layer - getSeat(b).layer);
  for (const player of ordered) {
    drawPlayer(player, now);
  }
}

function drawNearPlayers(now) {
  for (const player of game.state.players.filter((player) => getSeat(player)?.layer >= 4)) {
    drawPlayer(player, now);
  }
}

function drawPlayer(player, now) {
  const seat = getSeat(player);
  const image = images[CHARACTER_KEYS[Number(player.id.slice(1))]];
  if (!seat || !image) return;

  const pos = projectSeat(player, seat);
  const responsive = getPlayerResponsiveScale(player);
  const scale = seat.scale * bgFrame.scale * responsive;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const active = game.state.currentPlayerId === player.id && !game.state.winnerId;
  const idNumber = Number(player.id.slice(1));
  const breath = Math.sin(now * 0.0026 + idNumber * 1.7);
  const anim = getPlayerAnim(player.id, now);
  const deathQueued = playerAnims.get(player.id)?.some((entry) => entry.type === "death") ?? false;
  let offsetX = 0;
  let offsetY = 0;
  let rotate = seat.face;
  let scaleX = active ? 1.012 : 1;
  let scaleY = 1 + breath * (active ? 0.007 : 0.004);
  let alpha = player.out && !deathQueued ? 0.18 : 1;

  if (anim) {
    const direction = player.id === "p1" || player.id === "p2" ? -1 : 1;
    if (anim.type === "recoil") {
      offsetX += direction * anim.power * 18;
      offsetY -= anim.power * 8;
      rotate += direction * anim.power * 0.05;
    } else if (anim.type === "tinyRecoil") {
      offsetY -= anim.power * 4;
      rotate += direction * anim.power * 0.018;
    } else if (anim.type === "hit") {
      offsetX += Math.sin(anim.t * Math.PI * 14) * anim.power * 13;
      offsetY -= anim.power * 15;
      rotate += direction * anim.power * 0.11;
      scaleX += anim.power * 0.045;
      scaleY -= anim.power * 0.065;
    } else if (anim.type === "bonk") {
      offsetY += anim.power * 7;
      scaleX += anim.power * 0.035;
      scaleY -= anim.power * 0.045;
    } else if (anim.type === "heal" || anim.type === "reveal") {
      offsetY -= anim.power * 5;
      scaleX += anim.power * 0.012;
      scaleY += anim.power * 0.012;
    } else if (anim.type === "cheer") {
      const hop = Math.abs(Math.sin(anim.t * Math.PI * 2.5)) * (1 - anim.t * 0.45);
      offsetY -= hop * height * 0.1;
      rotate += Math.sin(anim.t * Math.PI * 5) * 0.075;
      scaleX += hop * 0.055;
      scaleY += hop * 0.035;
    } else if (anim.type === "celebrate") {
      const hop = Math.abs(Math.sin(anim.t * Math.PI * 5)) * (1 - anim.t * 0.2);
      offsetY -= hop * height * 0.13;
      rotate += Math.sin(anim.t * Math.PI * 7) * 0.105;
      scaleX += hop * 0.075;
      scaleY += hop * 0.045;
    } else if (anim.type === "relief") {
      offsetY -= Math.sin(anim.t * Math.PI * 2) * anim.power * 8;
      rotate += direction * Math.sin(anim.t * Math.PI * 2) * 0.035;
      scaleY += anim.power * 0.025;
    } else if (anim.type === "frustrated") {
      offsetY += Math.sin(anim.t * Math.PI) * height * 0.055;
      rotate -= direction * anim.power * 0.055;
      scaleY -= anim.power * 0.045;
    } else if (anim.type === "death") {
      const fall = easeInOut(clamp(anim.t / 0.78, 0, 1));
      offsetX += direction * width * 0.36 * fall;
      offsetY += height * 0.28 * fall;
      rotate += direction * 0.78 * fall;
      scaleX *= 1 - fall * 0.1;
      scaleY *= 1 - fall * 0.24;
      alpha = 1 - clamp((anim.t - 0.68) / 0.28, 0, 1);
    }
  }

  ctx.save();
  ctx.translate(pos.x + offsetX, pos.y + offsetY);
  ctx.rotate(rotate);
  ctx.scale(scaleX, scaleY);
  drawPlayerShadow(width, height, active, player.out && !deathQueued);

  if (active) {
    drawTurnHalo(width, height, now);
  }

  ctx.globalAlpha = alpha;
  if (anim?.type === "death") {
    ctx.filter = `grayscale(${clamp(anim.t * 0.9, 0, 0.9)}) brightness(${1 - anim.t * 0.28}) drop-shadow(0 9px 12px rgba(0, 0, 0, 0.4))`;
  } else if (player.out && !deathQueued) {
    ctx.filter = "grayscale(0.75) brightness(0.72)";
  } else {
    ctx.filter = active
      ? "drop-shadow(0 10px 14px rgba(0, 0, 0, 0.38)) drop-shadow(0 0 10px rgba(98, 215, 197, 0.28)) saturate(1.08) contrast(1.04)"
      : "drop-shadow(0 8px 12px rgba(0, 0, 0, 0.34)) saturate(1.04) contrast(1.02)";
  }
  ctx.save();
  applyPlayerSeatClip(player, width, height);
  ctx.drawImage(image, -width / 2, -height, width, height);
  ctx.restore();
  ctx.filter = "none";

  if (!player.out || deathQueued) {
    drawSeatPocketShadow(player, width, height, active);
    drawSeatOccluderLip(player, width, height, active);
  }

  if (anim && (anim.type === "hit" || anim.type === "bonk") && anim.power > 0.04) {
    drawImpactLines(width, height, anim.power);
  }
  if (anim) drawPlayerReaction(width, height, anim, now);
  ctx.restore();
}

function drawPlayerReaction(width, height, anim, now) {
  if (!["cheer", "celebrate", "relief", "frustrated", "death"].includes(anim.type)) return;
  ctx.save();
  ctx.globalAlpha = anim.type === "death" ? Math.max(0, 1 - anim.t) : 0.35 + anim.power * 0.65;

  if (anim.type === "cheer" || anim.type === "celebrate") {
    const count = anim.type === "celebrate" ? 9 : 5;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + now * 0.002;
      const radius = width * (0.42 + anim.power * 0.16);
      ctx.save();
      ctx.translate(Math.cos(angle) * radius, -height * 0.7 + Math.sin(angle) * radius * 0.46);
      ctx.rotate(angle + now * 0.004);
      ctx.fillStyle = index % 2 ? "#ffd57a" : "#62d7c5";
      drawStar(0, 0, width * 0.018, width * 0.04, 5);
      ctx.fill();
      ctx.restore();
    }
  } else if (anim.type === "relief") {
    ctx.strokeStyle = "rgba(155, 200, 255, 0.9)";
    ctx.lineWidth = Math.max(1, width * 0.008);
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath();
      ctx.arc(width * (0.24 + index * 0.08), -height * (0.72 + index * 0.05), width * (0.035 + index * 0.012), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (anim.type === "frustrated") {
    ctx.strokeStyle = "#ff5d66";
    ctx.lineWidth = Math.max(2, width * 0.012);
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * width * 0.22, -height * 0.82);
      ctx.lineTo(side * width * 0.34, -height * 0.9);
      ctx.lineTo(side * width * 0.27, -height * 0.99);
      ctx.stroke();
    }
  } else if (anim.type === "death") {
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2 + anim.t * Math.PI * 3;
      ctx.save();
      ctx.translate(Math.cos(angle) * width * 0.34, -height * 0.78 + Math.sin(angle) * height * 0.08);
      ctx.rotate(angle);
      ctx.fillStyle = index % 2 ? "#fff5df" : "#ffd57a";
      drawStar(0, 0, width * 0.02, width * 0.045, 5);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function applyPlayerSeatClip(player, width, height) {
  const cut = {
    p0: -height * 0.14,
    p1: -height * 0.18,
    p2: -height * 0.19,
    p3: -height * 0.18,
  }[player.id] ?? 0;

  ctx.beginPath();
  ctx.rect(-width * 0.64, -height * 1.04, width * 1.28, height * 1.08 + cut);
  ctx.clip();
}

function drawPlayerShadow(width, height, active, out) {
  ctx.save();
  ctx.translate(0, -height * 0.08);
  ctx.scale(1, 0.24);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.5);
  gradient.addColorStop(0, active ? "rgba(255, 185, 67, 0.42)" : "rgba(0, 0, 0, 0.42)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = out ? "rgba(0,0,0,0.2)" : gradient;
  ctx.beginPath();
  ctx.arc(0, 0, width * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function seatLevelProfile(playerId) {
  return {
    p0: { backY: 0.48, backW: 1.12, backH: 0.62, frontY: 0.18, frontW: 0.9, frontH: 0.13 },
    p1: { backY: 0.5, backW: 1.08, backH: 0.66, frontY: 0.24, frontW: 0.88, frontH: 0.13 },
    p2: { backY: 0.5, backW: 1.02, backH: 0.58, frontY: 0.18, frontW: 0.78, frontH: 0.12 },
    p3: { backY: 0.5, backW: 1.08, backH: 0.66, frontY: 0.24, frontW: 0.88, frontH: 0.13 },
  }[playerId] ?? { backY: 0.48, backW: 1.08, backH: 0.6, frontY: 0.22, frontW: 0.9, frontH: 0.13 };
}

function drawLevelSeatBack(player, pos, width, height, active, now, face) {
  const profile = seatLevelProfile(player.id);
  const backW = width * profile.backW;
  const backH = height * profile.backH;
  const backY = -height * profile.backY;
  const radius = Math.min(backW * 0.18, 26 * bgFrame.scale);
  const pulse = active ? 0.5 + Math.sin(now * 0.006) * 0.5 : 0;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(face);
  ctx.globalAlpha = player.out ? 0.35 : 1;

  const outer = ctx.createLinearGradient(0, backY - backH * 0.5, 0, backY + backH * 0.5);
  outer.addColorStop(0, active ? "rgba(105, 43, 36, 0.92)" : "rgba(72, 30, 30, 0.9)");
  outer.addColorStop(0.58, "rgba(35, 14, 17, 0.96)");
  outer.addColorStop(1, "rgba(12, 7, 9, 0.98)");
  ctx.fillStyle = outer;
  roundedRect(-backW / 2, backY - backH / 2, backW, backH, radius);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.22 + pulse * 0.08;
  ctx.strokeStyle = "#ffd57a";
  ctx.lineWidth = Math.max(1.2, 2.2 * bgFrame.scale);
  roundedRect(-backW / 2 + 5 * bgFrame.scale, backY - backH / 2 + 5 * bgFrame.scale, backW - 10 * bgFrame.scale, backH - 10 * bgFrame.scale, radius * 0.82);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = "rgba(255, 213, 122, 0.38)";
  ctx.lineWidth = Math.max(0.8, 1.2 * bgFrame.scale);
  for (let row = 0; row < 3; row += 1) {
    const y = backY - backH * 0.26 + row * backH * 0.23;
    ctx.beginPath();
    ctx.moveTo(-backW * 0.34, y);
    ctx.quadraticCurveTo(0, y - backH * 0.08, backW * 0.34, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.62;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = (col - 1) * backW * 0.23;
      const y = backY - backH * 0.18 + row * backH * 0.24;
      const r = Math.max(2.4, 3.6 * bgFrame.scale);
      const button = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r * 1.7);
      button.addColorStop(0, "rgba(255, 224, 156, 0.76)");
      button.addColorStop(0.42, "rgba(141, 70, 45, 0.82)");
      button.addColorStop(1, "rgba(16, 7, 8, 0.74)");
      ctx.fillStyle = button;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.restore();
}

function drawLevelSeatFront(player, pos, width, height, active, now, face) {
  const profile = seatLevelProfile(player.id);
  const railW = width * profile.frontW;
  const railH = Math.max(13 * bgFrame.scale, height * profile.frontH);
  const y = -height * profile.frontY;
  const pulse = active ? 0.5 + Math.sin(now * 0.006) * 0.5 : 0;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(face);
  ctx.globalAlpha = player.out ? 0.36 : 0.92;

  ctx.save();
  ctx.translate(0, y + railH * 0.12);
  ctx.scale(1, 0.26);
  const seatShadow = ctx.createRadialGradient(0, 0, 0, 0, 0, railW * 0.56);
  seatShadow.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  seatShadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = seatShadow;
  ctx.beginPath();
  ctx.arc(0, 0, railW * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const brass = ctx.createLinearGradient(0, y - railH * 0.62, 0, y + railH * 0.62);
  brass.addColorStop(0, "rgba(255, 218, 132, 0.78)");
  brass.addColorStop(0.28, "rgba(122, 64, 31, 0.86)");
  brass.addColorStop(0.72, "rgba(43, 18, 14, 0.9)");
  brass.addColorStop(1, "rgba(12, 7, 8, 0.92)");
  ctx.fillStyle = brass;
  roundedRect(-railW / 2, y - railH / 2, railW, railH, railH * 0.5);
  ctx.fill();

  const insetW = railW * 0.76;
  const insetH = railH * 0.38;
  const leather = ctx.createLinearGradient(0, y - insetH, 0, y + insetH);
  leather.addColorStop(0, active ? "rgba(112, 42, 37, 0.92)" : "rgba(68, 25, 28, 0.92)");
  leather.addColorStop(1, "rgba(18, 8, 10, 0.94)");
  ctx.fillStyle = leather;
  roundedRect(-insetW / 2, y - insetH * 0.5, insetW, insetH, insetH * 0.55);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 213, 122, ${active ? 0.56 + pulse * 0.22 : 0.28})`;
  ctx.lineWidth = Math.max(1.2, 2 * bgFrame.scale);
  roundedRect(-railW / 2, y - railH / 2, railW, railH, railH * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawSeatPocketShadow(player, width, height, active) {
  const bottomFactor = {
    p0: 0.2,
    p1: 0.23,
    p2: 0.2,
    p3: 0.23,
  }[player.id] ?? 0.22;
  const y = -height * bottomFactor;
  const glow = active ? 0.07 : 0.035;

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const shadow = ctx.createRadialGradient(0, y, width * 0.08, 0, y, width * 0.62);
  shadow.addColorStop(0, "rgba(14, 6, 8, 0.34)");
  shadow.addColorStop(0.55, "rgba(14, 6, 8, 0.22)");
  shadow.addColorStop(1, "rgba(14, 6, 8, 0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(0, y, width * 0.58, height * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = glow;
    ctx.strokeStyle = "#ffd57a";
    ctx.lineWidth = Math.max(1, width * 0.01);
    ctx.beginPath();
    ctx.ellipse(0, y - height * 0.02, width * 0.44, height * 0.08, 0, Math.PI * 0.06, Math.PI * 0.94);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSeatOccluderLip(player, width, height, active) {
  const profile = {
    p0: { y: -0.095, width: 0.64, height: 0.062, alpha: 0.92 },
    p1: { y: -0.15, width: 0.58, height: 0.058, alpha: 0.82 },
    p2: { y: -0.15, width: 0.58, height: 0.058, alpha: 0.82 },
    p3: { y: -0.15, width: 0.58, height: 0.058, alpha: 0.82 },
  }[player.id];
  if (!profile) return;

  const lipWidth = width * profile.width;
  const lipHeight = Math.max(8 * bgFrame.scale, height * profile.height);
  const y = height * profile.y;
  const radius = lipHeight * 0.5;

  ctx.save();
  ctx.globalAlpha = player.out ? 0.3 : profile.alpha;
  ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
  ctx.shadowBlur = 8 * bgFrame.scale;
  ctx.shadowOffsetY = 4 * bgFrame.scale;

  const brass = ctx.createLinearGradient(0, y - lipHeight, 0, y + lipHeight);
  brass.addColorStop(0, active ? "#ffdf8f" : "#e1a456");
  brass.addColorStop(0.42, "#8d552c");
  brass.addColorStop(1, "#24100c");
  ctx.fillStyle = brass;
  roundedRect(-lipWidth / 2, y - lipHeight / 2, lipWidth, lipHeight, radius);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = active ? "rgba(255, 245, 223, 0.52)" : "rgba(255, 222, 139, 0.28)";
  ctx.lineWidth = Math.max(1, 1.4 * bgFrame.scale);
  ctx.stroke();
  ctx.restore();
}

function drawTurnHalo(width, height, now) {
  const pulse = 0.7 + Math.sin(now * 0.006) * 0.3;
  ctx.save();
  ctx.translate(0, -height * 0.08);
  ctx.scale(1, 0.27);
  ctx.lineWidth = Math.max(3, width * 0.012);
  ctx.strokeStyle = `rgba(255, 199, 78, ${0.75 + pulse * 0.2})`;
  ctx.beginPath();
  ctx.arc(0, 0, width * (0.38 + pulse * 0.025), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawImpactLines(width, height, power) {
  ctx.save();
  ctx.globalAlpha = power * 0.75;
  ctx.strokeStyle = "#fff5df";
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i += 1) {
    const angle = -Math.PI * 0.85 + (i / 6) * Math.PI * 0.7;
    const r0 = width * 0.43;
    const r1 = width * (0.55 + power * 0.16);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r0, -height * 0.55 + Math.sin(angle) * r0);
    ctx.lineTo(Math.cos(angle) * r1, -height * 0.55 + Math.sin(angle) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTableProps(now) {
  drawWeapon(now);
  drawCharges(now);
  drawPlayerItems(now);
}

function drawWeapon(now) {
  const skin = game.state.weaponSkin;
  const image = images[skin];
  const slot = project(tableSlots.weapon);
  if (!image) return;

  const scale = (skin === "shotgun" ? 0.25 : 0.34) * bgFrame.scale * getWorldObjectScale();
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const baseAngle = skin === "shotgun" ? -0.08 : -0.16;
  let rotation = baseAngle;
  let recoil = 0;

  if (impact.event?.type === "shot") {
    const shotAge = now - impact.startedAt;
    const geometry = getWeaponShotGeometry(impact.event);
    if (geometry) {
      if (shotAge < SHOT_AIM_MS) {
        rotation = lerpAngle(baseAngle, geometry.angle, easeInOut(clamp(shotAge / SHOT_AIM_MS, 0, 1)));
      } else {
        const travelTime = impact.event.shell === "live" ? SHOT_FLIGHT_MS : 0;
        const recovery = clamp((shotAge - SHOT_AIM_MS - travelTime) / SHOT_RECOVERY_MS, 0, 1);
        rotation = lerpAngle(geometry.angle, baseAngle, easeInOut(recovery));
        const recoilAge = shotAge - SHOT_AIM_MS;
        if (recoilAge >= 0 && recoilAge < 140) {
          const liveRecoil = impact.event.weaponSkin === "shotgun" ? 18 : 11;
          recoil = Math.sin((recoilAge / 140) * Math.PI) * (impact.event.shell === "live" ? liveRecoil : 3) * bgFrame.scale;
        }
      }
    }
  }

  drawWeaponPlate(slot, width, height, now);
  ctx.save();
  ctx.translate(slot.x - Math.cos(rotation) * recoil, slot.y - Math.sin(rotation) * recoil);
  ctx.rotate(rotation);
  drawDropShadow(width, height, 0.52);
  ctx.shadowColor = "rgba(255, 202, 96, 0.2)";
  ctx.shadowBlur = 14;
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function getWeaponShotGeometry(event) {
  if (!event || event.type !== "shot") return null;
  const skin = game.state.weaponSkin;
  const image = images[skin];
  const target = playerEffectPoint(event.targetId, "chest");
  if (!image || !target) return null;
  const slot = project(tableSlots.weapon);
  const scale = (skin === "shotgun" ? 0.25 : 0.34) * bgFrame.scale * getWorldObjectScale();
  const width = image.naturalWidth * scale;
  const angle = Math.atan2(target.y - slot.y, target.x - slot.x);
  const muzzleDistance = width * (skin === "shotgun" ? 0.44 : 0.42);
  return {
    slot,
    target,
    angle,
    muzzle: {
      x: slot.x + Math.cos(angle) * muzzleDistance,
      y: slot.y + Math.sin(angle) * muzzleDistance,
    },
  };
}

function lerpAngle(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function drawWeaponPlate(slot, width, height, now) {
  const pulse = 0.5 + Math.sin(now * 0.004) * 0.5;
  const radiusX = Math.max(width * 0.72, 176 * bgFrame.scale);
  const radiusY = Math.max(height * 0.72, 66 * bgFrame.scale);

  ctx.save();
  ctx.translate(slot.x, slot.y + 10 * bgFrame.scale);
  ctx.rotate(-0.08);

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  glow.addColorStop(0, `rgba(255, 220, 138, ${0.18 + pulse * 0.05})`);
  glow.addColorStop(0.62, "rgba(37, 75, 49, 0.22)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(1.5, 2 * bgFrame.scale);
  ctx.strokeStyle = "rgba(255, 224, 156, 0.42)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX * 0.74, radiusY * 0.58, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCharges(now) {
  if (!isRoundIntroActive(now)) return;
  const loadingAge = now - roundIntro.startedAt - ROUND_REVEAL_MS;
  if (loadingAge < 0 || loadingAge >= ROUND_LOAD_MS) return;

  const progress = clamp(loadingAge / ROUND_LOAD_MS, 0, 1);
  const charges = getRoundIntroCharges();
  const bounds = getHudSceneBounds();
  const mode = getLayoutMode();
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const spread = Math.min(330, (bounds.right - bounds.left) * 0.56);
  const target = project(tableSlots.weapon);
  const targetHeight = mode === "desktop"
    ? 92
    : mode === "portrait"
      ? clamp((bounds.right - bounds.left) / (Math.max(4, charges.length) * 1.55), 30, 46)
      : 52;
  const sourceWave = mode === "portrait" ? 18 : 28;
  const arcHeight = mode === "portrait" ? 66 : 90;

  charges.forEach((kind, index) => {
    const image = images[kind];
    if (!image) return;
    const stagger = charges.length <= 1 ? 0 : (index / (charges.length - 1)) * 0.25;
    const local = clamp((progress - stagger) / 0.75, 0, 1);
    const shuffledIndex = (index * 3 + 1) % charges.length;
    const source = {
      x: centerX - spread / 2 + (spread * shuffledIndex) / Math.max(1, charges.length - 1),
      y: centerY + Math.sin(index * 1.9) * sourceWave,
    };
    const control = {
      x: centerX + Math.cos(index * 2.1) * spread * 0.22,
      y: centerY - arcHeight - (index % 3) * (mode === "portrait" ? 12 : 18),
    };
    const point = quadraticPoint(source, control, target, easeInOut(local));
    const alpha = local < 0.62 ? 1 : 1 - (local - 0.62) / 0.38;
    const height = targetHeight * (1 - local * 0.34);
    const width = image.naturalWidth * (height / image.naturalHeight);

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(-0.46 + index * 0.37 + local * Math.PI * 2.4);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.filter = `drop-shadow(0 6px 8px rgba(0,0,0,.56)) blur(${local > 0.74 ? 0.6 : 0}px)`;
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  });

  const pulse = Math.sin(progress * Math.PI * Math.max(2, charges.length));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const glowRadius = (34 + Math.max(0, pulse) * 28) * Math.max(0.72, bgFrame.scale);
  const glow = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, glowRadius);
  glow.addColorStop(0, "rgba(255, 232, 170, 0.52)");
  glow.addColorStop(1, "rgba(243, 184, 77, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(target.x - glowRadius, target.y - glowRadius, glowRadius * 2, glowRadius * 2);
  ctx.restore();
}

function drawRoundIntro(now) {
  if (!isRoundIntroActive(now)) return;
  const age = now - roundIntro.startedAt;
  const bounds = getHudSceneBounds();
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const mode = getLayoutMode();

  if (age < ROUND_REVEAL_MS) {
    const progress = clamp(age / 260, 0, 1);
    const exit = clamp((ROUND_REVEAL_MS - age) / 180, 0, 1);
    const alpha = easeInOut(progress) * exit;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(4, 3, 4, 0.68)";
    ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f3b84d";
    ctx.font = `800 ${mode === "desktop" ? 15 : 12}px Inter, system-ui, sans-serif`;
    const roundOffset = mode === "portrait" ? 116 : mode === "landscape" ? 108 : 154;
    const titleOffset = mode === "portrait" ? 86 : mode === "landscape" ? 78 : 120;
    ctx.fillText(`РАУНД ${roundIntro.roundNumber}`, centerX, centerY - roundOffset);
    ctx.fillStyle = "#fff5df";
    ctx.font = `900 ${mode === "desktop" ? 30 : 22}px Inter, system-ui, sans-serif`;
    ctx.fillText("СОСТАВ ЗАРЯДОВ", centerX, centerY - titleOffset);

    const targetHeight = mode === "desktop" ? 150 : mode === "landscape" ? 94 : 108;
    const gap = mode === "desktop" ? 144 : mode === "landscape" ? 92 : 78;
    const pop = 0.78 + (1 - Math.pow(1 - progress, 3)) * 0.22;
    drawChargeCloseup("live", centerX - gap, centerY + 4, targetHeight, roundIntro.live, "БОЕВЫЕ", pop);
    drawChargeCloseup("blank", centerX + gap, centerY + 4, targetHeight, roundIntro.blank, "ПУСТЫЕ", pop);
    ctx.restore();
    return;
  }

  const loadProgress = clamp((age - ROUND_REVEAL_MS) / ROUND_LOAD_MS, 0, 1);
  const fade = age > ROUND_REVEAL_MS + ROUND_LOAD_MS
    ? clamp((ROUND_INTRO_MS - age) / ROUND_SETTLE_MS, 0, 1)
    : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = `rgba(4, 3, 4, ${0.22 * (1 - loadProgress)})`;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff5df";
  ctx.font = `900 ${mode === "desktop" ? 24 : 17}px Inter, system-ui, sans-serif`;
  ctx.fillText("ЗАРЯЖАЕМ ВСЛЕПУЮ", centerX, bounds.top + (mode === "portrait" ? 34 : 46));
  ctx.fillStyle = "rgba(243, 184, 77, 0.9)";
  ctx.font = `700 ${mode === "desktop" ? 13 : 11}px Inter, system-ui, sans-serif`;
  const weapon = WEAPON_SKINS[roundIntro.weaponSkin];
  ctx.fillText(`${weapon.name.toUpperCase()} • ${weapon.damage} УРОН`, centerX, bounds.top + (mode === "portrait" ? 57 : 72));
  ctx.restore();
}

function drawMatchCinematic(now) {
  if (!matchCinematic.active) return;
  const age = now - matchCinematic.startedAt;
  if (age >= MATCH_CINEMATIC_MS) {
    finishMatchCinematic();
    return;
  }

  const bounds = getHudSceneBounds();
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const finalFade = clamp((MATCH_CINEMATIC_MS - age) / 720, 0, 1);
  const openingFade = easeInOut(clamp(age / 520, 0, 1));
  const darkness = (0.94 - openingFade * 0.27) * finalFade;

  ctx.save();
  ctx.fillStyle = `rgba(2, 2, 3, ${darkness})`;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const sweepProgress = easeInOut(clamp((age - 280) / 1900, 0, 1));
  const sweepX = bounds.left + width * (0.08 + sweepProgress * 0.84);
  const sweepY = bounds.top + height * (0.34 + Math.sin(age * 0.0014) * 0.08);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = finalFade * (0.42 + openingFade * 0.22);
  const sweepRadius = Math.max(width, height) * 0.48;
  const sweep = ctx.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, sweepRadius);
  sweep.addColorStop(0, "rgba(255, 226, 156, 0.54)");
  sweep.addColorStop(0.18, "rgba(243, 184, 77, 0.19)");
  sweep.addColorStop(0.58, "rgba(112, 64, 42, 0.04)");
  sweep.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(bounds.left, bounds.top, width, height);

  game.state.players.forEach((player, index) => {
    const point = playerEffectPoint(player.id, "chest");
    if (!point) return;
    const reveal = easeInOut(clamp((age - 720 - index * 180) / 480, 0, 1));
    if (reveal <= 0) return;
    const radius = clamp(Math.min(width, height) * 0.25, 78, 240);
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    glow.addColorStop(0, `rgba(255, 234, 184, ${0.42 * reveal})`);
    glow.addColorStop(0.26, `rgba(243, 184, 77, ${0.16 * reveal})`);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  });
  ctx.restore();

  drawCinematicWeapon(age, centerX, centerY, width, height, finalFade);
  drawCinematicSparks(age, centerX, centerY, width, height);

  const barsProgress = finalFade * easeInOut(clamp(age / 360, 0, 1));
  const barHeight = Math.min(54, viewport.height * 0.075) * barsProgress;
  ctx.fillStyle = "rgba(2, 2, 3, 0.98)";
  ctx.fillRect(0, 0, viewport.width, barHeight);
  ctx.fillRect(0, viewport.height - barHeight, viewport.width, barHeight);

  const flashT = clamp((age - 4080) / 520, 0, 1);
  if (flashT > 0 && flashT < 1) {
    const power = Math.sin(flashT * Math.PI);
    ctx.globalCompositeOperation = "screen";
    const flashRadius = Math.max(width, height) * (0.18 + flashT * 0.48);
    const flash = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, flashRadius);
    flash.addColorStop(0, `rgba(255, 248, 219, ${0.72 * power})`);
    flash.addColorStop(0.22, `rgba(243, 184, 77, ${0.38 * power})`);
    flash.addColorStop(1, "rgba(243, 184, 77, 0)");
    ctx.fillStyle = flash;
    ctx.fillRect(bounds.left, bounds.top, width, height);
  }
  ctx.restore();
}

function drawCinematicWeapon(age, centerX, centerY, sceneWidth, sceneHeight, finalFade) {
  const image = images[game.state.weaponSkin];
  if (!image || age < 1780) return;
  const reveal = easeInOut(clamp((age - 1780) / 760, 0, 1));
  const settle = easeInOut(clamp((age - 3660) / 560, 0, 1));
  const fade = clamp((4720 - age) / 360, 0, 1) * finalFade;
  const maxWidth = game.state.weaponSkin === "shotgun" ? 620 : 430;
  const targetWidth = Math.min(sceneWidth * 0.58, sceneHeight * 0.72, maxWidth);
  const weaponWidth = targetWidth * (0.58 + reveal * 0.42) * (1 - settle * 0.08);
  const weaponHeight = image.naturalHeight * (weaponWidth / image.naturalWidth);
  const float = prefersReducedMotion ? 0 : Math.sin(age * 0.0042) * 9 * (1 - settle);
  const drop = settle * Math.min(46, sceneHeight * 0.08);
  const startRotation = prefersReducedMotion ? -0.12 : -1.26;
  const rotation = startRotation
    + reveal * (-startRotation - 0.12)
    + (prefersReducedMotion ? 0 : Math.sin(age * 0.0028) * 0.035 * (1 - settle));
  const weaponY = centerY - sceneHeight * 0.03 + float + drop;

  ctx.save();
  ctx.globalAlpha = reveal * fade;
  ctx.globalCompositeOperation = "screen";
  const haloRadius = weaponWidth * 0.86;
  const halo = ctx.createRadialGradient(centerX, weaponY, 0, centerX, weaponY, haloRadius);
  halo.addColorStop(0, "rgba(255, 226, 156, 0.34)");
  halo.addColorStop(0.42, "rgba(243, 184, 77, 0.12)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(centerX - haloRadius, weaponY - haloRadius, haloRadius * 2, haloRadius * 2);
  ctx.restore();

  if (age > 2320 && age < 4080) {
    drawCinematicCharges(age, centerX, weaponY, weaponWidth, weaponHeight, fade);
  }

  ctx.save();
  ctx.globalAlpha = reveal * fade;
  ctx.translate(centerX, weaponY);
  ctx.rotate(rotation);
  ctx.shadowColor = "rgba(255, 209, 112, 0.74)";
  ctx.shadowBlur = Math.max(18, weaponWidth * 0.08);
  ctx.filter = "saturate(1.12) contrast(1.06) drop-shadow(0 22px 20px rgba(0, 0, 0, 0.62))";
  ctx.drawImage(image, -weaponWidth / 2, -weaponHeight / 2, weaponWidth, weaponHeight);
  ctx.restore();
}

function drawCinematicCharges(age, centerX, centerY, weaponWidth, weaponHeight, fade) {
  const orbitT = clamp((age - 2320) / 1680, 0, 1);
  const orbitRadiusX = weaponWidth * 0.66;
  const orbitRadiusY = Math.max(weaponHeight * 0.74, weaponWidth * 0.19);
  const chargeKinds = ["live", "blank", "live"];
  chargeKinds.forEach((kind, index) => {
    const image = images[kind];
    if (!image) return;
    const baseAngle = -Math.PI * 0.72 + index * Math.PI * 0.72;
    const angle = baseAngle + (prefersReducedMotion ? 0 : orbitT * Math.PI * 1.45);
    const x = centerX + Math.cos(angle) * orbitRadiusX;
    const y = centerY + Math.sin(angle) * orbitRadiusY;
    const chargeHeight = clamp(weaponHeight * 0.56, 46, 112);
    const chargeWidth = image.naturalWidth * (chargeHeight / image.naturalHeight);
    ctx.save();
    ctx.globalAlpha = Math.sin(orbitT * Math.PI) * fade * 0.96;
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2 + (prefersReducedMotion ? 0 : orbitT * Math.PI * 2));
    ctx.filter = "drop-shadow(0 9px 8px rgba(0, 0, 0, 0.58)) saturate(1.1)";
    ctx.drawImage(image, -chargeWidth / 2, -chargeHeight / 2, chargeWidth, chargeHeight);
    ctx.restore();
  });
}

function drawCinematicSparks(age, centerX, centerY, sceneWidth, sceneHeight) {
  const t = clamp((age - 4070) / 720, 0, 1);
  if (t <= 0 || t >= 1) return;
  const power = 1 - t;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 18; index += 1) {
    const angle = -Math.PI * 0.88 + (index / 17) * Math.PI * 1.76;
    const distance = (36 + index % 4 * 13) + t * Math.min(sceneWidth, sceneHeight) * (0.24 + (index % 5) * 0.025);
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance * 0.68;
    const length = 9 + (index % 4) * 4;
    ctx.strokeStyle = index % 3 === 0
      ? `rgba(255, 245, 223, ${power})`
      : `rgba(243, 184, 77, ${power * 0.92})`;
    ctx.lineWidth = 2 + (index % 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChargeCloseup(kind, x, y, targetHeight, count, label, scaleIn) {
  const image = images[kind];
  if (!image) return;
  const height = targetHeight * scaleIn;
  const width = image.naturalWidth * (height / image.naturalHeight);
  const color = kind === "live" ? "255, 93, 102" : "155, 200, 255";

  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, height * 0.78);
  glow.addColorStop(0, `rgba(${color}, 0.26)`);
  glow.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(x - height, y - height, height * 2, height * 2);
  ctx.translate(x, y);
  ctx.rotate(kind === "live" ? -0.16 : 0.16);
  drawDropShadow(width, height, 0.62);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();

  const badgeX = x + width * 0.38;
  const badgeY = y - height * 0.36;
  ctx.fillStyle = `rgba(${color}, 0.94)`;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#12090b";
  ctx.font = "900 17px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count), badgeX, badgeY + 1);
  ctx.fillStyle = "#fff5df";
  ctx.font = "800 13px Inter, system-ui, sans-serif";
  ctx.fillText(label, x, y + height * 0.62);
}

function getRoundIntroCharges() {
  const result = [];
  let live = roundIntro.live;
  let blank = roundIntro.blank;
  while (live > 0 || blank > 0) {
    if (blank > 0) {
      result.push("blank");
      blank -= 1;
    }
    if (live > 0) {
      result.push("live");
      live -= 1;
    }
  }
  return result;
}

function isRoundIntroActive(now = performance.now()) {
  if (!roundIntro.active) return false;
  if (now - roundIntro.startedAt >= ROUND_INTRO_MS) {
    roundIntro.active = false;
    return false;
  }
  return true;
}

function drawPlayerItems(now) {
  for (const player of game.state.players) {
    if (player.out) continue;
    if (!player.items.length) continue;
    const pos = getItemAnchor(player);
    const active = game.state.currentPlayerId === player.id && !game.state.winnerId;
    drawWorldItemDock(pos, player, active, now);
    player.items.forEach((itemId, index) => {
      const image = images[itemId];
      if (!image) return;
      const scale = itemScale(itemId) * bgFrame.scale * getWorldObjectScale();
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const spread = (index - (player.items.length - 1) / 2) * Math.max(width * 0.38, 34 * bgFrame.scale);
      const lift = itemId === "tarot" ? -12 * bgFrame.scale : 0;
      ctx.save();
      ctx.translate(pos.x + spread, pos.y + lift + Math.sin(now * 0.004 + index) * (active ? 3 : 1));
      ctx.rotate((index - 0.5) * 0.12 + (itemId === "tarot" ? -0.08 : 0));
      ctx.globalAlpha = active ? 0.98 : 0.88;
      drawDropShadow(width, height, active ? 0.42 : 0.28);
      ctx.shadowColor = active ? "rgba(98, 215, 197, 0.28)" : "rgba(0, 0, 0, 0)";
      ctx.shadowBlur = active ? 12 : 0;
      if (active) {
        drawSoftItemGlow(width, height);
      }
      ctx.filter = active
        ? "drop-shadow(0 5px 6px rgba(0, 0, 0, 0.42)) saturate(0.98) contrast(0.98)"
        : "drop-shadow(0 4px 5px rgba(0, 0, 0, 0.36)) saturate(0.82) brightness(0.9) contrast(0.94)";
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    });
  }
}

function drawWorldItemDock(pos, player, active, now) {
  const pulse = active ? 0.5 + Math.sin(now * 0.006) * 0.5 : 0;
  const width = (player.items.length > 1 ? 98 : 72) * bgFrame.scale;
  const height = 36 * bgFrame.scale;
  const turn = {
    p0: -0.04,
    p1: -0.16,
    p2: 0.06,
    p3: 0.16,
  }[player.id] ?? 0;

  ctx.save();
  ctx.translate(pos.x, pos.y + 4 * bgFrame.scale);
  ctx.rotate(turn);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.filter = "blur(8px)";
  ctx.beginPath();
  ctx.ellipse(0, height * 0.18, width * 0.58, height * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `rgba(255, 213, 122, ${active ? 0.42 + pulse * 0.18 : 0.18})`;
  ctx.lineWidth = Math.max(1, 1.3 * bgFrame.scale);
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.56, height * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSoftItemGlow(width, height) {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "rgba(98, 215, 197, 0.22)";
  ctx.beginPath();
  ctx.ellipse(0, height * 0.12, width * 0.35, height * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function itemScale(itemId) {
  if (itemId === "hammer") return 0.145;
  if (itemId === "claw") return 0.15;
  if (itemId === "vape") return 0.165;
  if (itemId === "tarot") return 0.046;
  return 0.155;
}

function drawDropShadow(width, height, alpha) {
  ctx.save();
  ctx.translate(width * 0.04, height * 0.09);
  ctx.filter = "blur(10px)";
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.42, height * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(now) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    const age = now - particle.startedAt;
    if (age < 0) continue;
    const t = age / particle.life;
    if (t >= 1) {
      particles.splice(i, 1);
      continue;
    }
    const ease = 1 - (1 - t) * (1 - t);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(particle.x + particle.vx * ease, particle.y + particle.vy * ease);
    ctx.rotate(particle.rotation + t * particle.spin);
    ctx.fillStyle = particle.color;
    if (particle.shape === "smoke") {
      ctx.globalAlpha = (1 - t) * 0.62;
      ctx.filter = "blur(5px)";
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * (1 + t * 1.1), particle.size * 0.58 * (1 + t), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.shape === "star") {
      drawStar(0, 0, particle.size * 0.62, particle.size * 1.12, 5);
      ctx.fill();
    } else if (particle.shape === "confetti") {
      ctx.scale(1, Math.max(0.16, Math.abs(Math.cos(t * Math.PI * 5 + particle.rotation))));
      ctx.fillRect(-particle.size * 0.45, -particle.size * 0.7, particle.size * 0.9, particle.size * 1.4);
    } else {
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.55);
    }
    ctx.restore();
  }
}

function drawStar(x, y, innerRadius, outerRadius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawImpact(now) {
  drawVisualBursts(now);
  if (!impact.event) return;

  const delay = impact.event.type === "shot" ? SHOT_AIM_MS : 0;
  const life = impact.event.type === "shot" ? (impact.event.shell === "live" ? 520 : 260) : 420;
  const t = (now - impact.startedAt - delay) / life;
  if (t < 0) {
    if (impact.event.type === "shot") {
      drawAimTelegraph(impact.event, clamp((now - impact.startedAt) / SHOT_AIM_MS, 0, 1));
    }
    return;
  }
  if (t >= 1) {
    impact.event = null;
    return;
  }
  const power = Math.sin(t * Math.PI);

  if (impact.event.type === "shot") {
    const center = project(tableSlots.weapon);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const live = impact.event.shell === "live";
    const weaponScale = impact.event.weaponSkin === "shotgun" ? 1.3 : 1;
    const radius = (live ? 260 * weaponScale : 135) * bgFrame.scale;
    const flash = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    flash.addColorStop(0, `rgba(255, 245, 223, ${live ? 0.55 * power : 0.24 * power})`);
    flash.addColorStop(0.18, live ? `rgba(255, 93, 102, ${0.35 * power})` : `rgba(155, 200, 255, ${0.16 * power})`);
    flash.addColorStop(1, "rgba(255, 93, 102, 0)");
    ctx.fillStyle = flash;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.restore();
  }
}

function drawAimTelegraph(event, progress) {
  const geometry = getWeaponShotGeometry(event);
  if (!geometry) return;

  const eased = easeInOut(progress);
  const radius = (40 - eased * 18) * bgFrame.scale;
  const alpha = 0.14 + eased * 0.56;
  const lineStart = quadraticPoint(geometry.muzzle, geometry.muzzle, geometry.target, 0.08);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = `rgba(255, 213, 122, ${alpha * 0.42})`;
  ctx.lineWidth = Math.max(1, 1.6 * bgFrame.scale);
  ctx.setLineDash([7 * bgFrame.scale, 10 * bgFrame.scale]);
  ctx.beginPath();
  ctx.moveTo(lineStart.x, lineStart.y);
  ctx.lineTo(geometry.target.x, geometry.target.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.translate(geometry.target.x, geometry.target.y);
  ctx.rotate(progress * 0.22);
  ctx.strokeStyle = `rgba(255, 236, 176, ${alpha})`;
  ctx.lineWidth = Math.max(1.5, 2.5 * bgFrame.scale);
  ctx.beginPath();
  ctx.arc(0, 0, radius, -0.68, 0.68);
  ctx.arc(0, 0, radius, Math.PI - 0.68, Math.PI + 0.68);
  ctx.stroke();

  ctx.fillStyle = `rgba(255, 93, 102, ${alpha * eased})`;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, 3.6 * bgFrame.scale), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVisualBursts(now) {
  for (let i = visualBursts.length - 1; i >= 0; i -= 1) {
    const burst = visualBursts[i];
    const t = (now - burst.startedAt) / burst.life;
    if (t < 0) continue;
    if (t >= 1) {
      visualBursts.splice(i, 1);
      continue;
    }
    const power = Math.sin(t * Math.PI);

    if (burst.type === "muzzle-live" || burst.type === "muzzle-blank") {
      drawMuzzleBurst(burst, t, power);
    } else if (burst.type === "bullet") {
      drawBulletBurst(burst, t, power);
    } else if (burst.type === "hammer") {
      drawHammerBurst(burst, t, power);
    } else if (burst.type === "hit-stars") {
      drawHitStarsBurst(burst, t, power);
    } else if (burst.type === "claw") {
      drawClawBurst(burst, t, power);
    } else if (burst.type === "vape") {
      drawVapeBurst(burst, t, power);
    } else if (burst.type === "tarot") {
      drawTarotBurst(burst, t, power);
    }
  }
}

function drawMuzzleBurst(burst, t, power) {
  const origin = burst.origin;
  if (!origin) return;
  const live = burst.type === "muzzle-live";
  const shotgun = burst.weaponSkin === "shotgun";
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(origin.x, origin.y);
  ctx.rotate(burst.angle ?? -0.22);
  const radius = (live ? (shotgun ? 86 : 62) : 34) * bgFrame.scale * (0.8 + power);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, live ? "rgba(255, 245, 223, 0.95)" : "rgba(220, 232, 242, 0.7)");
  gradient.addColorStop(0.28, live ? "rgba(255, 93, 102, 0.58)" : "rgba(155, 200, 255, 0.28)");
  gradient.addColorStop(1, "rgba(255, 93, 102, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.28, radius * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

}

function drawBulletBurst(burst, t, power) {
  if (!burst.origin || !burst.target) return;
  const distance = Math.hypot(burst.target.x - burst.origin.x, burst.target.y - burst.origin.y);
  const control = {
    x: (burst.origin.x + burst.target.x) * 0.5,
    y: (burst.origin.y + burst.target.y) * 0.5 - Math.min(34 * bgFrame.scale, distance * 0.08),
  };
  const eased = easeInOut(t);
  const tailT = Math.max(0, eased - 0.16);
  const head = quadraticPoint(burst.origin, control, burst.target, eased);
  const tail = quadraticPoint(burst.origin, control, burst.target, tailT);
  const ahead = quadraticPoint(burst.origin, control, burst.target, Math.min(1, eased + 0.015));
  const angle = Math.atan2(ahead.y - head.y, ahead.x - head.x);
  const shotgun = burst.weaponSkin === "shotgun";
  const offsets = shotgun ? [-13, -6, 0, 6, 13] : [0];
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);

  offsets.forEach((offset, index) => {
    const spread = offset * eased * Math.max(0.75, bgFrame.scale);
    const headX = head.x + perpX * spread;
    const headY = head.y + perpY * spread;
    const tailX = tail.x + perpX * spread * 0.72;
    const tailY = tail.y + perpY * spread * 0.72;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const trail = ctx.createLinearGradient(tailX, tailY, headX, headY);
    trail.addColorStop(0, "rgba(255, 93, 102, 0)");
    trail.addColorStop(0.52, "rgba(243, 184, 77, 0.42)");
    trail.addColorStop(1, "rgba(255, 250, 221, 0.96)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = shotgun ? Math.max(1.4, 2.3 * bgFrame.scale) : Math.max(2, 4 * bgFrame.scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.translate(headX, headY);
    ctx.rotate(angle + (shotgun ? (index - 2) * 0.018 : 0));
    ctx.shadowColor = "rgba(255, 210, 90, 0.9)";
    ctx.shadowBlur = (shotgun ? 9 : 14) * bgFrame.scale;
    ctx.fillStyle = "#fff4b8";
    ctx.strokeStyle = "rgba(255, 115, 62, 0.92)";
    ctx.lineWidth = Math.max(1, 1.7 * bgFrame.scale);
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      shotgun ? Math.max(3.5, 5 * bgFrame.scale) : Math.max(7, 10 * bgFrame.scale),
      shotgun ? Math.max(2, 2.8 * bgFrame.scale) : Math.max(3.5, 4.5 * bgFrame.scale),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawHammerBurst(burst, t, power) {
  const target = burst.target;
  if (!target) return;
  ctx.save();
  ctx.translate(target.x, target.y - 14 * bgFrame.scale);
  ctx.rotate(Math.sin(t * Math.PI * 6) * 0.18);
  ctx.globalAlpha = power;
  ctx.fillStyle = "#ffd57a";
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + t * 2;
    const r = (28 + 34 * t) * bgFrame.scale;
    drawStar(Math.cos(angle) * r, Math.sin(angle) * r * 0.64, 4 * bgFrame.scale, 9 * bgFrame.scale, 5);
    ctx.fill();
  }
  ctx.restore();
}

function drawHitStarsBurst(burst, t, power) {
  const target = burst.target;
  if (!target) return;

  ctx.save();
  ctx.translate(target.x, target.y - 8 * bgFrame.scale);
  ctx.globalAlpha = Math.min(1, (1 - t) * 1.3);
  ctx.lineWidth = Math.max(1.5, 2.5 * bgFrame.scale);

  const ring = (34 + 54 * t) * bgFrame.scale;
  ctx.strokeStyle = `rgba(255, 213, 122, ${0.46 * power})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, ring * 1.08, ring * 0.54, -0.1, 0, Math.PI * 2);
  ctx.stroke();

  for (const star of burst.stars) {
    const angle = star.angle + t * star.spin;
    const radius = (star.radius + t * 34) * bgFrame.scale;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.62;
    const size = star.size * bgFrame.scale * (0.78 + power * 0.42);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * 0.65 + t * Math.PI * 3);
    ctx.fillStyle = star.color;
    drawStar(0, 0, size * 0.48, size, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(38, 17, 14, 0.55)";
    ctx.stroke();
    ctx.restore();
  }

  if (t < 0.55) {
    ctx.globalAlpha = (1 - t / 0.55) * 0.88;
    ctx.font = `900 ${Math.max(12, 20 * bgFrame.scale)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff5df";
    ctx.strokeStyle = "rgba(61, 21, 17, 0.84)";
    ctx.lineWidth = Math.max(3, 4 * bgFrame.scale);
    const damageLabel = burst.eliminated ? "ВЫБЫЛ!" : `-${burst.damage ?? 1} HP`;
    ctx.strokeText(damageLabel, 0, -52 * bgFrame.scale);
    ctx.fillText(damageLabel, 0, -52 * bgFrame.scale);
  }

  ctx.restore();
}

function drawClawBurst(burst, t, power) {
  const origin = burst.origin;
  const target = burst.target;
  if (!origin || !target) return;
  const control = {
    x: (origin.x + target.x) / 2,
    y: Math.min(origin.y, target.y) - 95 * bgFrame.scale,
  };
  const flyT = easeInOut(clamp(t * 1.25, 0, 1));
  const point = quadraticPoint(origin, control, target, flyT < 0.52 ? flyT / 0.52 : 1 - (flyT - 0.52) / 0.48);

  ctx.save();
  ctx.globalAlpha = 0.28 + power * 0.5;
  ctx.strokeStyle = "rgba(98, 215, 197, 0.9)";
  ctx.lineWidth = Math.max(2, 3 * bgFrame.scale);
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.quadraticCurveTo(control.x, control.y, target.x, target.y);
  ctx.stroke();
  ctx.restore();

  const image = images[burst.stolen] ?? images.claw;
  if (image) {
    const size = 34 * bgFrame.scale * (1 + power * 0.18);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(t * Math.PI * 4);
    drawDropShadow(size, size, 0.25);
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

function drawVapeBurst(burst, t, power) {
  const origin = burst.origin;
  if (!origin) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const radius = (40 + 42 * t) * bgFrame.scale;
  const glow = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, radius);
  glow.addColorStop(0, `rgba(152, 255, 238, ${0.32 * power})`);
  glow.addColorStop(0.5, `rgba(155, 200, 255, ${0.18 * power})`);
  glow.addColorStop(1, "rgba(152, 255, 238, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(origin.x - radius, origin.y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawTarotBurst(burst, t, power) {
  const origin = burst.origin;
  if (!origin) return;
  const label = burst.peekedShell === "live" ? "БОЙ" : "ПУСТО";
  ctx.save();
  ctx.translate(origin.x, origin.y - 26 * bgFrame.scale);
  ctx.rotate((t - 0.5) * 0.42);
  ctx.globalAlpha = 0.45 + power * 0.55;
  const width = 58 * bgFrame.scale;
  const height = 78 * bgFrame.scale;
  const flip = Math.max(0.18, Math.abs(Math.cos(t * Math.PI)));
  ctx.scale(flip, 1);
  ctx.fillStyle = "rgba(38, 17, 45, 0.92)";
  roundedRect(-width / 2, -height / 2, width, height, 8 * bgFrame.scale);
  ctx.fill();
  ctx.strokeStyle = "rgba(243, 184, 77, 0.88)";
  ctx.lineWidth = Math.max(1, 2 * bgFrame.scale);
  ctx.stroke();
  ctx.fillStyle = "#ffd57a";
  ctx.font = `800 ${Math.max(9, 12 * bgFrame.scale)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function getScreenShake(now) {
  if (!impact.event || impact.event.type !== "shot") return { x: 0, y: 0 };
  const age = now - impact.startedAt - SHOT_AIM_MS;
  const life = impact.event.shell === "live" ? 420 : 180;
  if (age < 0 || age > life) return { x: 0, y: 0 };
  const t = age / life;
  const liveAmp = impact.event.weaponSkin === "shotgun" ? 11 : 7;
  const amp = (impact.event.shell === "live" ? liveAmp : 2) * (1 - t) * bgFrame.scale;
  return {
    x: Math.sin(age * 0.09) * amp,
    y: Math.cos(age * 0.13) * amp * 0.65,
  };
}

function quadraticPoint(a, b, c, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * a.x + 2 * inv * t * b.x + t * t * c.x,
    y: inv * inv * a.y + 2 * inv * t * b.y + t * t * c.y,
  };
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function ensureAudio() {
  if (audioCtx) return audioCtx;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioCtx = new AudioContextCtor();
  masterBus = audioCtx.createDynamicsCompressor();
  masterBus.threshold.setValueAtTime(-18, audioCtx.currentTime);
  masterBus.knee.setValueAtTime(24, audioCtx.currentTime);
  masterBus.ratio.setValueAtTime(5, audioCtx.currentTime);
  masterBus.attack.setValueAtTime(0.004, audioCtx.currentTime);
  masterBus.release.setValueAtTime(0.18, audioCtx.currentTime);
  masterBus.connect(audioCtx.destination);
  return audioCtx;
}

function unlockAudio() {
  const ctxAudio = ensureAudio();
  if (ctxAudio?.state === "suspended") {
    ctxAudio.resume().catch(() => {});
  }
  musicUnlocked = true;
  if (!musicMuted) startBackgroundMusic();
}

function startBackgroundMusic() {
  if (document.visibilityState === "hidden" || musicMuted) return;
  backgroundMusic.play().catch(() => {});
}

function toggleBackgroundMusic() {
  musicMuted = !musicMuted;
  backgroundMusic.muted = musicMuted;
  localStorage.setItem(MUSIC_MUTED_KEY, musicMuted ? "1" : "0");
  if (!musicMuted) {
    musicUnlocked = true;
    startBackgroundMusic();
  }
  syncMusicToggle();
}

function syncMusicToggle() {
  const enabled = !musicMuted;
  musicToggleButton.classList.toggle("is-muted", !enabled);
  musicToggleButton.setAttribute("aria-pressed", String(enabled));
  musicToggleButton.setAttribute("aria-label", enabled ? "Выключить музыку" : "Включить музыку");
  musicToggleButton.title = enabled ? "Выключить музыку" : "Включить музыку";
}

function playSfx(event) {
  const ctxAudio = ensureAudio();
  if (!ctxAudio || ctxAudio.state !== "running") return;

  if (event.type === "shot") {
    if (event.shell === "live") {
      playGunshot(event.weaponSkin ?? game.state.weaponSkin);
    } else {
      playTone(1480, 0.028, "square", 0.036, 0, 820);
      playTone(420, 0.075, "triangle", 0.024, 0.026, 260);
      noiseBurst(0.024, 0.028, 3600, 0, "highpass", 0.8);
      playDryClick(0.012);
      if ((event.weaponSkin ?? game.state.weaponSkin) === "shotgun") {
        playShotgunAction(0.09, 0.72);
      }
    }
    return;
  }

  if (event.type === "round-start") {
    playWeaponLoading(event);
    return;
  }

  if (event.type !== "item") return;

  if (event.itemId === "hammer") {
    playTone(255, 0.18, "triangle", 0.075, 0, 88);
    playTone(620, 0.06, "sine", 0.035, 0.035, 920);
    playTone(740, 0.08, "sine", 0.026, 0.11, 520);
    noiseBurst(0.052, 0.07, 880, 0.012, "bandpass", 1.5);
    playRubberBonk(0.025);
  } else if (event.itemId === "claw") {
    playTone(1220, 0.032, "square", 0.028, 0, 720);
    playTone(760, 0.038, "square", 0.026, 0.06, 980);
    playTone(520, 0.034, "square", 0.023, 0.12, 360);
    sweptNoise(0.18, 0.034, 900, 2600, 0.02, "bandpass");
    playRatchet(0);
  } else if (event.itemId === "vape") {
    sweptNoise(0.48, 0.048, 360, 1450, 0.01, "lowpass");
    noiseBurst(0.18, 0.018, 1800, 0.22, "bandpass", 0.75);
    playTone(164, 0.24, "sine", 0.018, 0.08, 220);
    playSparkleRun([330, 392, 494, 659], 0.035, 0.012, 0.07);
  } else if (event.itemId === "tarot") {
    playTone(520, 0.12, "sine", 0.032, 0, 780);
    playTone(780, 0.15, "sine", 0.028, 0.07, 1040);
    playTone(1040, 0.18, "sine", 0.022, 0.14, 1380);
    noiseBurst(0.24, 0.018, 2400, 0.03, "bandpass", 2.2);
    playSparkleRun([880, 1175, 1568, 2093], 0.026, 0.016, 0.06);
  }
}

function playGunshot(weaponSkin) {
  if (weaponSkin === "shotgun") {
    noiseBurst(0.038, 0.52, 2600, 0, "highpass", 0.42);
    noiseBurst(0.2, 0.36, 520, 0.006, "bandpass", 0.58);
    noiseBurst(0.62, 0.16, 190, 0.012, "lowpass", 0.7);
    noiseBurst(0.48, 0.07, 880, 0.07, "bandpass", 0.52);
    playTone(58, 0.34, "sawtooth", 0.16, 0, 28);
    playTone(118, 0.2, "sine", 0.09, 0.012, 44);
    playTableThump(0.018, 0.15);
    playRoomEcho(0.075, 0.12);
    playShotgunAction(0.31, 1);
    return;
  }

  noiseBurst(0.024, 0.44, 4200, 0, "highpass", 0.38);
  noiseBurst(0.11, 0.25, 1180, 0.004, "bandpass", 0.72);
  noiseBurst(0.34, 0.1, 260, 0.012, "lowpass", 0.78);
  noiseBurst(0.42, 0.046, 1450, 0.045, "bandpass", 0.48);
  playTone(92, 0.21, "sawtooth", 0.12, 0, 40);
  playTone(168, 0.11, "triangle", 0.058, 0.008, 72);
  playTableThump(0.025, 0.085);
  playRoomEcho(0.065, 0.075);
}

function playHitImpact(event) {
  if (!audioCtx || audioCtx.state !== "running") return;
  const shotgun = event.weaponSkin === "shotgun";
  noiseBurst(shotgun ? 0.16 : 0.1, shotgun ? 0.13 : 0.085, shotgun ? 340 : 520, 0, "bandpass", 0.72);
  playTone(shotgun ? 74 : 112, shotgun ? 0.24 : 0.16, "sine", shotgun ? 0.09 : 0.055, 0, 42);
  playTableThump(0.008, shotgun ? 0.105 : 0.064);
  if (event.eliminated) {
    playTone(310, 0.22, "triangle", 0.036, 0.04, 92);
    playTone(146, 0.34, "sawtooth", 0.032, 0.09, 48);
    noiseBurst(0.28, 0.038, 760, 0.06, "lowpass", 0.58);
  } else if (!event.selfShot) {
    playTone(680, 0.08, "triangle", 0.018, 0.045, 920);
  }
}

function playOutcomeSfx(humanWon) {
  if (!audioCtx || audioCtx.state !== "running") return;
  if (humanWon) {
    const chord = [262, 330, 392];
    chord.forEach((frequency, index) => {
      playTone(frequency, 0.42, "triangle", 0.035, index * 0.055, frequency * 1.5);
    });
    playSparkleRun([523, 659, 784, 1047], 0.12, 0.026, 0.105);
    sweptNoise(0.72, 0.026, 420, 2600, 0.08, "bandpass");
    noiseBurst(0.48, 0.022, 980, 0.28, "bandpass", 0.6);
    return;
  }

  playTone(294, 0.28, "triangle", 0.034, 0, 196);
  playTone(196, 0.34, "triangle", 0.032, 0.13, 123);
  playTone(110, 0.5, "sine", 0.04, 0.26, 55);
  noiseBurst(0.55, 0.022, 420, 0.18, "lowpass", 0.6);
}

function playRoomEcho(delay, gain) {
  noiseBurst(0.17, gain, 760, delay, "bandpass", 0.46);
  noiseBurst(0.24, gain * 0.55, 520, delay + 0.09, "bandpass", 0.42);
  noiseBurst(0.32, gain * 0.28, 390, delay + 0.19, "lowpass", 0.6);
}

function playWeaponLoading(event) {
  const count = Math.max(2, (event.live ?? 0) + (event.blank ?? 0));
  const weaponSkin = event.weaponSkin ?? game.state.weaponSkin;

  if (weaponSkin === "shotgun") {
    playMetalClack(0, 190, 0.07);
    noiseBurst(0.12, 0.055, 920, 0.018, "bandpass", 1.1);
    for (let i = 0; i < count; i += 1) {
      const delay = 0.11 + i * 0.085;
      playTone(124 + (i % 2) * 18, 0.07, "triangle", 0.032, delay, 74);
      noiseBurst(0.026, 0.032, 1750, delay + 0.008, "bandpass", 1.6);
    }
    playShotgunAction(Math.min(0.76, 0.16 + count * 0.085), 0.9);
    return;
  }

  playMetalClack(0, 250, 0.055);
  playTone(168, 0.09, "triangle", 0.026, 0.04, 92);
  for (let i = 0; i < count; i += 1) {
    const delay = 0.1 + i * 0.078;
    playMetalClack(delay, 520 + (i % 3) * 70, 0.026);
  }
  const closeAt = Math.min(0.78, 0.16 + count * 0.078);
  playRatchet(closeAt - 0.15);
  playMetalClack(closeAt, 220, 0.075);
  playTone(96, 0.1, "sine", 0.042, closeAt + 0.012, 62);
}

function playMetalClack(delay, pitch = 360, gain = 0.04) {
  playTone(pitch, 0.034, "square", gain, delay, Math.max(90, pitch * 0.46));
  playTone(pitch * 1.9, 0.018, "triangle", gain * 0.55, delay + 0.004, pitch * 0.9);
  noiseBurst(0.022, gain * 0.8, 2600, delay, "highpass", 1.1);
}

function playShotgunAction(delay = 0, strength = 1) {
  sweptNoise(0.16, 0.042 * strength, 460, 1700, delay, "bandpass");
  playMetalClack(delay + 0.02, 178, 0.055 * strength);
  playMetalClack(delay + 0.13, 240, 0.068 * strength);
  playTone(82, 0.09, "triangle", 0.038 * strength, delay + 0.14, 54);
}

function playTableThump(delay = 0, gain = 0.075) {
  playTone(96, 0.14, "sine", gain, delay, 48);
  noiseBurst(0.07, gain * 0.42, 180, delay + 0.006, "lowpass", 0.8);
}

function playDryClick(delay = 0) {
  playTone(1840, 0.018, "square", 0.022, delay, 920);
  playTone(330, 0.05, "triangle", 0.018, delay + 0.018, 260);
  noiseBurst(0.018, 0.024, 5200, delay + 0.004, "highpass", 1.1);
}

function playRatchet(delay = 0) {
  for (let i = 0; i < 4; i += 1) {
    playTone(560 + i * 90, 0.024, "square", 0.014, delay + i * 0.036, 420 + i * 70);
    noiseBurst(0.018, 0.012, 2800 + i * 300, delay + i * 0.036, "bandpass", 3.2);
  }
}

function playRubberBonk(delay = 0) {
  playTone(180, 0.11, "sine", 0.052, delay, 118);
  playTone(390, 0.09, "triangle", 0.034, delay + 0.048, 620);
  playTone(720, 0.07, "sine", 0.022, delay + 0.105, 510);
}

function playSparkleRun(frequencies, duration, gainValue, stepDelay) {
  frequencies.forEach((frequency, index) => {
    playTone(frequency, duration, "sine", gainValue, index * stepDelay, frequency * 1.35);
  });
}

function playTone(frequency, duration, type, gainValue, delay = 0, endFrequency = frequency) {
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delay;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(masterBus ?? audioCtx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noiseBurst(duration, gainValue, filterFrequency, delay = 0, filterType = "bandpass", q = 0.9) {
  if (!audioCtx) return;
  const sampleCount = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    const decay = 1 - i / sampleCount;
    data[i] = (Math.random() * 2 - 1) * decay;
  }

  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  const start = audioCtx.currentTime + delay;
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency, start);
  filter.Q.setValueAtTime(q, start);
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterBus ?? audioCtx.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function sweptNoise(duration, gainValue, startFrequency, endFrequency, delay = 0, filterType = "lowpass") {
  if (!audioCtx) return;
  const sampleCount = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    const envelope = Math.sin(t * Math.PI);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  const start = audioCtx.currentTime + delay;
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(24, startFrequency), start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), start + duration);
  filter.Q.setValueAtTime(filterType === "bandpass" ? 1.4 : 0.72, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterBus ?? audioCtx.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function drawSceneLabels(now) {
  if (isRoundIntroActive(now)) return;
  const active = game.activePlayer;
  if (!active || game.state.winnerId) return;
  const seat = getSeat(active);
  if (!seat) return;

  const pos = projectSeat(active, seat);
  const responsive = getPlayerResponsiveScale(active);
  const bounds = getHudSceneBounds();
  let y = pos.y + seat.nameY * bgFrame.scale * responsive;
  if (active.id === "p0") {
    const labelSlot = project({ x: 836, y: 392 });
    y = clamp(labelSlot.y, bounds.top + 22, Math.min(bounds.bottom - 24, viewport.height * 0.62));
  }
  const label = active.isHuman ? "ТВОЙ ХОД" : active.name.toUpperCase();

  ctx.save();
  const compact = getLayoutMode() !== "desktop";
  ctx.font = `800 ${compact ? 14 : 18}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = ctx.measureText(label).width + (compact ? 26 : 34);
  const height = compact ? 29 : 34;
  const pulse = 0.85 + Math.sin(now * 0.006) * 0.15;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(22, 14, 18, 0.82)";
  roundedRect(pos.x - width / 2, y - height / 2, width, height, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(243, 184, 77, 0.86)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff5df";
  ctx.fillText(label, pos.x, y + 1);
  ctx.restore();
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function project(point) {
  return {
    x: bgFrame.x + point.x * bgFrame.scale,
    y: bgFrame.y + point.y * bgFrame.scale,
  };
}

function projectSeat(player, seat) {
  const projected = project(seat);
  const mode = getLayoutMode();
  const bounds = getHudSceneBounds(mode);
  const scoreboardRight = scoreboardEl?.getBoundingClientRect().right ?? 0;
  const compact = mode !== "desktop";
  const xPad = mode === "portrait" ? 24 : 30;
  let leftGuard = mode === "landscape" ? Math.max(scoreboardRight + 24, bounds.left) : Math.max(bounds.left, xPad);
  let rightGuard = Math.min(bounds.right, viewport.width - xPad);
  let topGuard = bounds.top + (compact ? 18 : 34);
  const bottomGuard = bounds.bottom - (compact ? 14 : 26);
  let x = projected.x;
  let y = projected.y;

  const image = images[CHARACTER_KEYS[Number(player.id.slice(1))]];
  if (image) {
    const scale = seat.scale * bgFrame.scale * getPlayerResponsiveScale(player);
    if (seat.layer < 4) {
      topGuard = Math.max(topGuard, bounds.top + image.naturalHeight * scale * 0.92);
    }
    if (mode === "portrait") {
      const halfWidth = Math.min(image.naturalWidth * scale * 0.46, (bounds.right - bounds.left) * 0.22);
      leftGuard = Math.max(leftGuard, bounds.left + halfWidth);
      rightGuard = Math.min(rightGuard, bounds.right - halfWidth);
    }
  }

  if (mode === "desktop" && player.id === "p3") {
    x = Math.max(x, scoreboardRight + 66);
  }

  return {
    x: clamp(x, leftGuard, rightGuard),
    y: clamp(y, topGuard, bottomGuard),
  };
}

function getItemAnchor(player) {
  if (!player) return project(tableSlots.weapon);

  const count = game.state.playerCount;
  const mode = getLayoutMode();
  const bounds = getHudSceneBounds(mode);
  const scoreRight = scoreboardEl?.getBoundingClientRect().right ?? 0;
  const topLimit = bounds.top + 20;
  const bottomLimit = bounds.bottom - 24;
  const leftLimit = mode === "landscape" ? Math.max(bounds.left + 18, scoreRight + 24) : bounds.left + 22;
  const rightLimit = bounds.right - 22;
  const slots = {
    2: {
      p0: { x: 956, y: 652 },
      p1: { x: 946, y: 300 },
    },
    4: {
      p0: { x: 956, y: 652 },
      p1: { x: 1208, y: 498 },
      p2: { x: 946, y: 300 },
      p3: { x: 560, y: 498 },
    },
  };
  const projected = project(slots[count]?.[player.id] ?? tableSlots.weapon);

  return {
    x: clamp(projected.x, leftLimit, rightLimit),
    y: clamp(projected.y, topLimit, bottomLimit),
  };
}

function getWorldObjectScale() {
  const mode = getLayoutMode();
  if (mode === "portrait") return 0.9;
  if (mode === "landscape") return 0.84;
  return 1;
}

function getPlayerResponsiveScale(player) {
  const base = getWorldObjectScale();
  if (
    getLayoutMode() === "portrait"
    && game.state.playerCount === 4
    && (player?.id === "p1" || player?.id === "p3")
  ) {
    return base * 0.78;
  }
  return base;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function unproject(clientX, clientY) {
  return {
    x: (clientX - bgFrame.x) / bgFrame.scale,
    y: (clientY - bgFrame.y) / bgFrame.scale,
  };
}

function getSeat(player) {
  return seats[game.state.playerCount]?.[player.id] ?? null;
}

function playerEffectPoint(playerId, part = "chest") {
  const player = game.state.players.find((candidate) => candidate.id === playerId);
  const seat = player ? getSeat(player) : null;
  const image = player ? images[CHARACTER_KEYS[Number(player.id.slice(1))]] : null;
  if (!player || !seat || !image) return null;

  const pos = projectSeat(player, seat);
  const responsive = getPlayerResponsiveScale(player);
  const scale = seat.scale * bgFrame.scale * responsive;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const sideOffset = player.id === "p1" ? -width * 0.12 : player.id === "p3" ? width * 0.12 : 0;
  const partY = {
    head: -height * 0.72,
    chest: -height * 0.46,
    hands: -height * 0.34,
  }[part] ?? -height * 0.46;

  return {
    x: pos.x + sideOffset,
    y: pos.y + partY,
  };
}

function eventAffectsPlayer(playerId, now) {
  if (!impact.event) return false;
  const age = now - impact.startedAt;
  if (age < 0 || age > 520) return false;
  return impact.event.actorId === playerId || impact.event.targetId === playerId;
}

function queueAnimationForLastEvent() {
  const event = game.state.lastEvent;
  if (!event || game.state.revision === lastAnimatedRevision) {
    return;
  }
  lastAnimatedRevision = game.state.revision;
  const playerId = getLocalPlayerId();
  const eventId = `${game.state.matchId}:${event.revision ?? game.state.revision}`;
  rouletteStats.recordEvent(event, { playerId, eventId });
  if (event.nextRound) {
    rouletteStats.recordEvent(event.nextRound, {
      playerId,
      eventId: `${game.state.matchId}:${event.nextRound.revision ?? game.state.revision}:round`,
    });
  }
  if (!statsPanelEl.hidden) renderStatsPanel();
  if (event.type === "shot" || event.type === "item" || event.type === "round-start") {
    const startedAt = performance.now();
    impact.startedAt = startedAt;
    impact.event = event;
    if (event.type === "round-start") {
      beginRoundIntro(event, startedAt, game.state.log[0]);
      return;
    }
    assignPlayerAnimations(event);
    spawnParticles(event);
    spawnVisualBursts(event);
    if (event.type === "shot") {
      const eventMessage = event.message ?? game.state.log[0];
      const generation = animationGeneration;
      window.setTimeout(() => {
        if (generation !== animationGeneration) return;
        playSfx(event);
        triggerHaptic(event);
      }, SHOT_AIM_MS);
      if (event.shell === "live") {
        window.setTimeout(() => {
          if (generation !== animationGeneration) return;
          playHitImpact(event);
        }, SHOT_AIM_MS + SHOT_FLIGHT_MS);
      }
      window.setTimeout(
        () => {
          if (generation !== animationGeneration) return;
          showEventToast(eventMessage, event.gameOver ? "success" : event.shell === "live" ? "danger" : "neutral");
        },
        SHOT_AIM_MS + (event.shell === "live" ? SHOT_FLIGHT_MS : 0),
      );
      scheduleMatchResult(event);
      if (event.nextRound && !event.gameOver) {
        const nextRoundDelay = SHOT_AIM_MS
          + (event.shell === "live" ? SHOT_FLIGHT_MS : 0)
          + SHOT_RECOVERY_MS;
        const matchId = game.state.matchId;
        window.setTimeout(() => {
          if (generation !== animationGeneration || game.state.matchId !== matchId || game.state.winnerId) return;
          beginRoundIntro(event.nextRound, performance.now(), event.nextRound.message);
        }, nextRoundDelay);
      }
    } else {
      playSfx(event);
      announceEvent(event);
    }
  }
}

function beginRoundIntro(event, startedAt, message) {
  roundIntro.sequence += 1;
  roundIntro.active = false;
  roundIntro.pending = !tutorialEl.hidden || matchCinematic.active || matchCinematic.pending;
  roundIntro.roundNumber = game.state.roundNumber;
  roundIntro.live = event.live ?? game.state.shellCounts.live;
  roundIntro.blank = event.blank ?? game.state.shellCounts.blank;
  roundIntro.weaponSkin = event.weaponSkin ?? game.state.weaponSkin;
  roundIntro.event = event;
  roundIntro.message = message;
  if (!roundIntro.pending) {
    startRoundIntroPlayback(startedAt);
  }
}

function prepareMatchCinematic({ defer = false } = {}) {
  matchCinematic.sequence += 1;
  matchCinematic.active = false;
  matchCinematic.pending = true;
  matchCinematic.startedAt = 0;
  particles.length = 0;
  visualBursts.length = 0;
  playerAnims.clear();
  impact.event = null;
  appShellEl.dataset.cinematic = "false";
  if (!defer && tutorialEl.hidden) {
    startMatchCinematicPlayback();
  }
}

function startMatchCinematicPlayback(startedAt = performance.now()) {
  if (!matchCinematic.pending || !tutorialEl.hidden) return;
  const sequence = matchCinematic.sequence;
  matchCinematic.active = true;
  matchCinematic.pending = false;
  matchCinematic.startedAt = startedAt;
  roundIntro.active = false;
  appShellEl.dataset.cinematic = "true";
  lockInputFor(MATCH_CINEMATIC_MS);
  playCinematicCue("open");
  scheduleCinematicCue(sequence, 900, "seats");
  scheduleCinematicCue(sequence, 2280, "weapon");
  scheduleCinematicCue(sequence, 4120, "slam");
}

function scheduleCinematicCue(sequence, delay, cue) {
  window.setTimeout(() => {
    if (!matchCinematic.active || matchCinematic.sequence !== sequence) return;
    playCinematicCue(cue);
  }, delay);
}

function playCinematicCue(cue) {
  if (!audioCtx || audioCtx.state !== "running") return;
  if (cue === "open") {
    playTone(54, 0.72, "sine", 0.052, 0, 34);
    sweptNoise(0.86, 0.018, 180, 920, 0.05, "bandpass");
  } else if (cue === "seats") {
    playTone(92, 0.42, "triangle", 0.036, 0, 148);
    playTone(184, 0.18, "sine", 0.018, 0.16, 236);
  } else if (cue === "weapon") {
    playRatchet(0);
    playTone(132, 0.34, "triangle", 0.036, 0.12, 78);
    sweptNoise(0.62, 0.022, 480, 2100, 0.04, "bandpass");
  } else if (cue === "slam") {
    playTableThump(0, 0.13);
    noiseBurst(0.18, 0.11, 540, 0.006, "bandpass", 0.72);
    playSparkleRun([523, 784, 1047], 0.055, 0.018, 0.06);
    triggerHaptic({ type: "item" });
  }
}

function finishMatchCinematic() {
  if (!matchCinematic.active && !matchCinematic.pending) return;
  matchCinematic.sequence += 1;
  matchCinematic.active = false;
  matchCinematic.pending = false;
  appShellEl.dataset.cinematic = "false";
  if (roundIntro.pending) {
    startRoundIntroPlayback();
    return;
  }
  releaseInputLock();
}

function releaseInputLock() {
  actionLockedUntil = 0;
  clearTimeout(actionUnlockTimer);
  const active = game.activePlayer;
  if (active?.isHuman && !game.state.winnerId) {
    renderItems(active);
    renderTargets(active);
  }
}

function startRoundIntroPlayback(startedAt = performance.now()) {
  const sequence = roundIntro.sequence;
  roundIntro.active = true;
  roundIntro.pending = false;
  roundIntro.startedAt = startedAt;
  lockInputFor(ROUND_INTRO_MS);
  spawnParticles(roundIntro.event);
  window.setTimeout(() => {
    if (roundIntro.sequence === sequence) playSfx(roundIntro.event);
  }, ROUND_REVEAL_MS);
  window.setTimeout(() => {
    if (roundIntro.sequence === sequence) showEventToast(roundIntro.message, "neutral");
  }, ROUND_REVEAL_MS + ROUND_LOAD_MS);
}

function announceEvent(event) {
  const tone = event.gameOver ? "success" : event.type === "shot" && event.shell === "live" ? "danger" : "neutral";
  showEventToast(game.state.log[0], tone);

  triggerHaptic(event);
}

function triggerHaptic(event) {
  if (!telegramSupports("6.1")) return;
  const haptics = telegramWebApp?.HapticFeedback;
  if (!haptics) return;
  try {
    if (event.gameOver) {
      haptics.notificationOccurred?.("success");
    } else if (event.type === "shot") {
      haptics.impactOccurred?.(event.shell === "live" ? "heavy" : "soft");
    } else if (event.type === "item") {
      haptics.selectionChanged?.();
    }
  } catch {
    // Haptics are optional and vary between Telegram clients.
  }
}

function spawnParticles(event) {
  const now = performance.now();

  if (event.type === "shot") {
    const geometry = getWeaponShotGeometry(event);
    const origin = geometry?.muzzle ?? project(tableSlots.weapon);
    const target = geometry?.target ?? playerEffectPoint(event.targetId, "chest");
    const live = event.shell === "live";
    const shotgun = event.weaponSkin === "shotgun";
    const palette = live ? ["#ff5d66", "#fff5df", "#f3b84d"] : ["#c8d7e6", "#fff5df", "#7b8794"];
    const fireAt = now + SHOT_AIM_MS;
    emitParticleBurst(
      origin,
      live ? (shotgun ? 46 : 30) : 14,
      palette,
      live ? (shotgun ? 340 : 260) : 120,
      live ? (shotgun ? 270 : 210) : 90,
      fireAt,
      live ? "spark" : "smoke",
    );
    if (live && target) {
      emitParticleBurst(
        target,
        shotgun ? 28 : 18,
        ["#ff5d66", "#ffd57a", "#fff5df"],
        190,
        160,
        fireAt + SHOT_FLIGHT_MS,
        "spark",
      );
    }
    return;
  }

  if (event.type === "item") {
    const actor = playerEffectPoint(event.actorId, "hands") ?? getItemAnchor(game.state.players.find((player) => player.id === event.actorId));
    const target = playerEffectPoint(event.targetId, "head") ?? actor;
    if (event.itemId === "hammer") {
      emitParticleBurst(target, 22, ["#ffd57a", "#fff5df", "#ff5d66"], 180, 170, now, "star");
    } else if (event.itemId === "claw") {
      emitParticleBurst(actor, 12, ["#62d7c5", "#fff5df", "#9bc8ff"], 160, 100, now, "spark");
      emitParticleBurst(target, 8, ["#f3b84d", "#fff5df"], 90, 80, now, "spark");
    } else if (event.itemId === "vape") {
      emitParticleBurst(actor, 24, ["rgba(210, 248, 255, 0.82)", "rgba(152, 255, 238, 0.64)", "rgba(255, 213, 246, 0.56)"], 78, 150, now, "smoke");
    } else if (event.itemId === "tarot") {
      emitParticleBurst(actor, 20, ["#9bc8ff", "#f3b84d", "#fff5df"], 130, 130, now, "spark");
    }
    return;
  }

  if (event.type === "round-start") {
    emitParticleBurst(
      project(tableSlots.weapon),
      18,
      ["#f3b84d", "#fff5df", "#9bc8ff"],
      120,
      90,
      now + ROUND_REVEAL_MS + ROUND_LOAD_MS - 120,
      "spark",
    );
  }
}

function emitParticleBurst(origin, count, palette, spreadX, spreadY, startedAt, shape = "spark") {
  if (!origin) return;
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: origin.x,
      y: origin.y,
      vx: (Math.random() - 0.5) * spreadX,
      vy: (Math.random() - 0.68) * spreadY,
      size: (shape === "smoke" ? 8 : 3) + Math.random() * (shape === "smoke" ? 16 : 8),
      spin: (Math.random() - 0.5) * 7,
      rotation: Math.random() * Math.PI,
      color: palette[i % palette.length],
      shape,
      life: (shape === "smoke" ? 780 : 430) + Math.random() * 420,
      startedAt,
    });
  }
}

function assignPlayerAnimations(event) {
  if (event.type === "shot") {
    setPlayerAnim(
      event.actorId,
      event.shell === "live" ? "recoil" : "tinyRecoil",
      event.shell === "live" ? 560 : 360,
      SHOT_AIM_MS,
    );
    if (event.shell === "live") {
      const impactDelay = SHOT_AIM_MS + SHOT_FLIGHT_MS;
      setPlayerAnim(event.targetId, event.eliminated ? "death" : "hit", event.eliminated ? 1500 : 760, impactDelay, event.eliminated);
      if (!event.selfShot) {
        setPlayerAnim(event.actorId, event.gameOver ? "celebrate" : "cheer", event.gameOver ? 2600 : 980, impactDelay + 180);
      }
      if (event.gameOver) {
        const winnerId = game.state.winnerId;
        if (winnerId && winnerId !== event.actorId) {
          setPlayerAnim(winnerId, "celebrate", 2600, impactDelay + 420);
        }
      }
    } else {
      setPlayerAnim(event.actorId, event.selfShot ? "relief" : "frustrated", 760, SHOT_AIM_MS + 80);
    }
    return;
  }

  if (event.type !== "item") return;

  if (event.itemId === "hammer") {
    setPlayerAnim(event.actorId, "recoil", 380);
    setPlayerAnim(event.targetId, "bonk", 620);
  } else if (event.itemId === "claw") {
    setPlayerAnim(event.actorId, "tinyRecoil", 420);
    setPlayerAnim(event.targetId, "hit", 420);
  } else if (event.itemId === "vape") {
    setPlayerAnim(event.actorId, "heal", 760);
  } else if (event.itemId === "tarot") {
    setPlayerAnim(event.actorId, "reveal", 760);
  }
}

function setPlayerAnim(playerId, type, duration, delay = 0, hold = false) {
  if (!playerId) return;
  const queue = playerAnims.get(playerId) ?? [];
  queue.push({
    type,
    startedAt: performance.now() + delay,
    duration,
    hold,
  });
  playerAnims.set(playerId, queue);
}

function getPlayerAnim(playerId, now) {
  const queue = playerAnims.get(playerId);
  if (!queue?.length) return null;

  let active = null;
  const remaining = [];
  for (const anim of queue) {
    const rawT = (now - anim.startedAt) / anim.duration;
    if (rawT < 0) {
      remaining.push(anim);
      continue;
    }
    if (rawT < 1 || anim.hold) {
      remaining.push(anim);
      active = {
        ...anim,
        t: Math.min(1, rawT),
        power: rawT >= 1 ? 0 : Math.sin(rawT * Math.PI),
      };
    }
  }
  if (remaining.length) playerAnims.set(playerId, remaining);
  else playerAnims.delete(playerId);
  return active;
}

function spawnVisualBursts(event) {
  const now = performance.now();
  if (event.type === "shot") {
    const geometry = getWeaponShotGeometry(event);
    const fireAt = now + SHOT_AIM_MS;
    const target = playerEffectPoint(event.targetId, "head");
    visualBursts.push({
      type: event.shell === "live" ? "muzzle-live" : "muzzle-blank",
      startedAt: fireAt,
      life: event.shell === "live" ? 380 : 300,
      origin: geometry?.muzzle ?? project(tableSlots.weapon),
      target: geometry?.target ?? playerEffectPoint(event.targetId, "chest"),
      angle: geometry?.angle,
      shell: event.shell,
      weaponSkin: event.weaponSkin,
    });
    if (event.shell === "live" && geometry) {
      visualBursts.push({
        type: "bullet",
        startedAt: fireAt,
        life: SHOT_FLIGHT_MS,
        origin: geometry.muzzle,
        target: geometry.target,
        weaponSkin: event.weaponSkin,
      });
    }
    if (event.shell === "live" && target) {
      const starCount = event.weaponSkin === "shotgun" ? 13 : 9;
      visualBursts.push({
        type: "hit-stars",
        startedAt: fireAt + SHOT_FLIGHT_MS,
        life: 720,
        target,
        damage: event.damage,
        eliminated: event.eliminated,
        stars: Array.from({ length: starCount }, (_, index) => ({
          angle: (index / starCount) * Math.PI * 2 + Math.random() * 0.35,
          radius: (event.weaponSkin === "shotgun" ? 42 : 34) + Math.random() * 38,
          spin: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.8),
          size: 8 + Math.random() * 9,
          color: ["#ffd57a", "#fff5df", "#62d7c5", "#ff5d66"][index % 4],
        })),
      });
    }
    return;
  }

  if (event.type !== "item") return;

  visualBursts.push({
    type: event.itemId,
    startedAt: now,
    life: event.itemId === "claw" ? 720 : 640,
    origin: playerEffectPoint(event.actorId, "hands") ?? getItemAnchor(game.state.players.find((player) => player.id === event.actorId)),
    target: playerEffectPoint(event.targetId, event.itemId === "hammer" ? "head" : "hands"),
    itemId: event.itemId,
    stolen: event.stolen,
    peekedShell: event.peekedShell,
  });
}

function scheduleBotTurn() {
  clearTimeout(botTimer);
  if (onlineMode) return;
  const active = game.activePlayer;
  if (!active || active.isHuman || game.state.winnerId) {
    return;
  }
  const lockedFor = Math.max(0, actionLockedUntil - performance.now());
  botTimer = setTimeout(runBotTurn, Math.max(1250, lockedFor + 120));
}

function runBotTurn() {
  if (onlineMode) return;
  const active = game.activePlayer;
  if (!active || active.isHuman || game.state.winnerId) {
    return;
  }
  if (isShotInputLocked()) {
    scheduleBotTurn();
    return;
  }

  const plan = buildBotPlan(active);
  executeBotPlan(plan, 0);
}

function buildBotPlan(active) {
  const actions = [];
  const enemies = game.alivePlayers().filter((player) => player.id !== active.id);
  const weakestEnemy = [...enemies].sort((a, b) => a.hp - b.hp)[0];
  const richestEnemy = [...enemies].sort((a, b) => b.items.length - a.items.length)[0];
  const has = (itemId) => active.items.includes(itemId);

  if (has("tarot") && !game.state.peekedShell && Math.random() < 0.65) {
    actions.push({ type: "item", itemId: "tarot" });
  }
  if (has("vape") && active.hp < active.maxHp && (active.hp <= 2 || Math.random() < 0.45)) {
    actions.push({ type: "item", itemId: "vape" });
  }
  if (has("claw") && richestEnemy?.items.length > 0 && Math.random() < 0.42) {
    actions.push({ type: "item", itemId: "claw", targetId: richestEnemy.id });
  }
  if (has("hammer") && weakestEnemy && Math.random() < 0.38) {
    actions.push({ type: "item", itemId: "hammer", targetId: weakestEnemy.id });
  }

  const known = game.state.peekedBy === active.id ? game.state.peekedShell : null;
  let targetId = weakestEnemy?.id ?? active.id;
  if (known === "blank") {
    targetId = active.id;
  } else if (!known && active.hp > 1 && Math.random() < 0.28) {
    targetId = active.id;
  }
  actions.push({ type: "shot", targetId });
  return actions;
}

function executeBotPlan(plan, index) {
  const action = plan[index];
  const active = game.activePlayer;
  if (!action || !active || active.isHuman || game.state.winnerId) {
    syncAll();
    return;
  }

  if (action.type === "item") {
    game.useItem(action.itemId, action.targetId);
    syncAll({ scheduleBots: false });
    botTimer = setTimeout(() => executeBotPlan(plan, index + 1), 560);
    return;
  }

  game.shoot(resolveBotShotTarget(active, action.targetId));
  lockShotInput(game.state.lastEvent);
  syncAll();
}

function resolveBotShotTarget(active, plannedTargetId) {
  const enemies = game.alivePlayers().filter((player) => player.id !== active.id);
  const weakestEnemy = [...enemies].sort((a, b) => a.hp - b.hp)[0];
  const known = game.state.peekedBy === active.id ? game.state.peekedShell : null;
  if (known === "blank") return active.id;
  if (known === "live") return weakestEnemy?.id ?? plannedTargetId ?? active.id;
  return plannedTargetId ?? weakestEnemy?.id ?? active.id;
}

function handleSceneClick(clientX, clientY) {
  const active = game.activePlayer;
  if (!active?.isHuman || game.state.winnerId || isShotInputLocked()) {
    return;
  }

  const clicked = game
    .alivePlayers()
    .map((player) => ({ player, seat: getSeat(player) }))
    .filter(({ seat }) => seat)
    .map(({ player, seat }) => {
      const pos = projectSeat(player, seat);
      const responsive = getPlayerResponsiveScale(player);
      const image = images[CHARACTER_KEYS[Number(player.id.slice(1))]];
      const scale = seat.scale * bgFrame.scale * responsive;
      const compact = getLayoutMode() !== "desktop";
      const rx = Math.max(compact ? 36 : 72, (image?.naturalWidth ?? 460) * scale * 0.42);
      const ry = Math.max(compact ? 52 : 104, (image?.naturalHeight ?? 620) * scale * 0.44);
      return {
        player,
        distance: Math.hypot((clientX - pos.x) / rx, (clientY - (pos.y - ry * 0.8)) / ry),
      };
    })
    .filter(({ distance }) => distance < 1)
    .sort((a, b) => a.distance - b.distance)[0]?.player;

  if (!clicked) {
    return;
  }

  if (pendingItem) {
    const result = usePlayerItem(pendingItem, clicked.id);
    if (result.ok) {
      pendingItem = null;
      if (!onlineMode) syncAll();
    } else {
      showEventToast(result.error, "warning");
    }
    return;
  }

  const result = performHumanShot(clicked.id);
  if (!result.ok) {
    showEventToast(result.error, "warning");
  }
}

function isShotInputLocked() {
  return performance.now() < actionLockedUntil;
}

function isOnlineActionLocked() {
  return onlineMode && (onlineActionPending || onlineStatus !== "connected");
}

function usePlayerItem(itemId, targetId = null) {
  if (!onlineMode) return game.useItem(itemId, targetId);
  if (isOnlineActionLocked()) return { ok: false, error: "Ждём ответ игрового стола" };
  const sent = onlineClient.send({ type: "action", action: "item", itemId, targetId });
  if (!sent) return { ok: false, error: "Нет соединения с игровым столом" };
  onlineActionPending = true;
  renderItems(game.activePlayer);
  renderTargets(game.activePlayer);
  return { ok: true };
}

function performHumanShot(targetId) {
  if (isShotInputLocked() || isOnlineActionLocked()) {
    return { ok: false, error: "Дай выстрелу закончиться" };
  }

  if (onlineMode) {
    const sent = onlineClient.send({ type: "action", action: "shoot", targetId });
    if (!sent) return { ok: false, error: "Нет соединения с игровым столом" };
    onlineActionPending = true;
    lockInputFor(SHOT_AIM_MS + SHOT_FLIGHT_MS + SHOT_RECOVERY_MS);
    renderItems(game.activePlayer);
    renderTargets(game.activePlayer);
    return { ok: true };
  }

  const result = game.shoot(targetId);
  if (!result.ok) return result;

  const event = game.state.lastEvent;
  lockShotInput(event);
  syncAll();
  return result;
}

function lockShotInput(event) {
  if (event?.type !== "shot") return;
  const lockDuration = SHOT_AIM_MS + (event.shell === "live" ? SHOT_FLIGHT_MS : 0) + SHOT_RECOVERY_MS;
  lockInputFor(lockDuration);
}

function lockInputFor(duration) {
  actionLockedUntil = performance.now() + duration;
  clearTimeout(actionUnlockTimer);
  const active = game.activePlayer;
  if (active?.isHuman && !game.state.winnerId) {
    renderItems(active);
    renderTargets(active);
  }
  actionUnlockTimer = window.setTimeout(() => {
    actionLockedUntil = 0;
    const current = game.activePlayer;
    if (current?.isHuman && !game.state.winnerId) {
      renderItems(current);
      renderTargets(current);
    }
  }, duration);
}
