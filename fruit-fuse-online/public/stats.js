export const CORE_BELOW_STATS_KEY = "coreBelowStats:v1";

const SCENARIO_IDS = ["reactor", "cryo", "signal"];
const ROLE_IDS = ["operator", "lookout", "scribe"];
const SHIFT_ID_LIMIT = 60;
const HISTORY_LIMIT = 18;

export function createDefaultStats(now = Date.now()) {
  return {
    version: 1,
    createdAt: now,
    lastSeenAt: now,
    sessions: 0,
    activeSeconds: 0,
    shiftsStarted: 0,
    shiftsCompleted: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    perfectWins: 0,
    modulesStabilized: 0,
    mistakes: 0,
    signalsSent: 0,
    messagesSent: 0,
    distanceTravelled: 0,
    bestWinSeconds: null,
    roleRuns: counterMap(ROLE_IDS),
    scenarioRuns: counterMap(SCENARIO_IDS),
    scenarioWins: counterMap(SCENARIO_IDS),
    startedShiftIds: [],
    completedShiftIds: [],
    history: []
  };
}

export function normalizeStats(value, now = Date.now()) {
  const stats = createDefaultStats(now);
  if (!value || typeof value !== "object") return stats;

  const numberKeys = [
    "sessions", "activeSeconds", "shiftsStarted", "shiftsCompleted", "wins", "losses",
    "currentStreak", "bestStreak", "perfectWins", "modulesStabilized", "mistakes",
    "signalsSent", "messagesSent", "distanceTravelled"
  ];
  for (const key of numberKeys) stats[key] = nonNegativeInteger(value[key]);

  stats.createdAt = validTimestamp(value.createdAt, now);
  stats.lastSeenAt = validTimestamp(value.lastSeenAt, now);
  stats.bestWinSeconds = nullablePositiveInteger(value.bestWinSeconds);
  stats.roleRuns = normalizeCounterMap(value.roleRuns, ROLE_IDS);
  stats.scenarioRuns = normalizeCounterMap(value.scenarioRuns, SCENARIO_IDS);
  stats.scenarioWins = normalizeCounterMap(value.scenarioWins, SCENARIO_IDS);
  stats.startedShiftIds = normalizeIds(value.startedShiftIds);
  stats.completedShiftIds = normalizeIds(value.completedShiftIds);
  stats.history = normalizeHistory(value.history);
  stats.shiftsStarted = Math.max(stats.shiftsStarted, stats.shiftsCompleted);
  stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
  return stats;
}

export class CoreBelowStats {
  constructor({ storage = globalThis.localStorage ?? null, key = CORE_BELOW_STATS_KEY, now = () => Date.now() } = {}) {
    this.storage = storage;
    this.key = key;
    this.now = now;
    this.data = this.load();
  }

  load() {
    try {
      const raw = this.storage?.getItem(this.key);
      return normalizeStats(raw ? JSON.parse(raw) : null, this.now());
    } catch {
      return createDefaultStats(this.now());
    }
  }

  persist() {
    this.data.lastSeenAt = this.now();
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.data));
    } catch {
      // Statistics must never interrupt an online shift.
    }
  }

  startSession() {
    this.data.sessions += 1;
    this.persist();
  }

  addActivity({ seconds = 0, distance = 0 } = {}) {
    const safeSeconds = nonNegativeInteger(seconds);
    const safeDistance = nonNegativeInteger(distance);
    if (!safeSeconds && !safeDistance) return false;
    this.data.activeSeconds += safeSeconds;
    this.data.distanceTravelled += safeDistance;
    this.persist();
    return true;
  }

  recordShiftStart({ shiftId, scenarioId, role } = {}) {
    if (!validId(shiftId) || this.data.startedShiftIds.includes(shiftId)) return false;
    const safeScenario = SCENARIO_IDS.includes(scenarioId) ? scenarioId : "reactor";
    const safeRole = ROLE_IDS.includes(role) ? role : "operator";
    this.data.shiftsStarted += 1;
    this.data.scenarioRuns[safeScenario] += 1;
    this.data.roleRuns[safeRole] += 1;
    this.data.startedShiftIds = rememberId(this.data.startedShiftIds, shiftId);
    this.persist();
    return true;
  }

  recordShiftResult({ shiftId, scenarioId, role, outcome, elapsedSeconds, mistakes, modulesSolved } = {}) {
    if (!validId(shiftId) || this.data.completedShiftIds.includes(shiftId)) return false;
    const safeScenario = SCENARIO_IDS.includes(scenarioId) ? scenarioId : "reactor";
    const safeRole = ROLE_IDS.includes(role) ? role : "operator";
    if (!this.data.startedShiftIds.includes(shiftId)) {
      this.recordShiftStart({ shiftId, scenarioId: safeScenario, role: safeRole });
    }

    const won = outcome === "won";
    const duration = nonNegativeInteger(elapsedSeconds);
    const errorCount = nonNegativeInteger(mistakes);
    const moduleCount = Math.min(3, nonNegativeInteger(modulesSolved));
    this.data.shiftsCompleted += 1;
    this.data[won ? "wins" : "losses"] += 1;
    this.data.mistakes += errorCount;
    this.data.modulesStabilized += moduleCount;
    this.data.completedShiftIds = rememberId(this.data.completedShiftIds, shiftId);

    if (won) {
      this.data.currentStreak += 1;
      this.data.bestStreak = Math.max(this.data.bestStreak, this.data.currentStreak);
      this.data.scenarioWins[safeScenario] += 1;
      if (errorCount === 0) this.data.perfectWins += 1;
      if (duration > 0) {
        this.data.bestWinSeconds = this.data.bestWinSeconds === null
          ? duration
          : Math.min(this.data.bestWinSeconds, duration);
      }
    } else {
      this.data.currentStreak = 0;
    }

    this.data.history = [{
      shiftId,
      scenarioId: safeScenario,
      role: safeRole,
      won,
      elapsedSeconds: duration,
      mistakes: errorCount,
      modulesSolved: moduleCount,
      completedAt: this.now()
    }, ...this.data.history.filter(entry => entry.shiftId !== shiftId)].slice(0, HISTORY_LIMIT);
    this.persist();
    return true;
  }

  recordSignal() {
    this.data.signalsSent += 1;
    this.persist();
  }

  recordMessage() {
    this.data.messagesSent += 1;
    this.persist();
  }

  snapshot() {
    return normalizeStats(this.data, this.now());
  }
}

function counterMap(keys) {
  return Object.fromEntries(keys.map(key => [key, 0]));
}

function normalizeCounterMap(value, keys) {
  return Object.fromEntries(keys.map(key => [key, nonNegativeInteger(value?.[key])]));
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(validId).slice(0, SHIFT_ID_LIMIT);
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(entry => entry && validId(entry.shiftId)).slice(0, HISTORY_LIMIT).map(entry => ({
    shiftId: entry.shiftId,
    scenarioId: SCENARIO_IDS.includes(entry.scenarioId) ? entry.scenarioId : "reactor",
    role: ROLE_IDS.includes(entry.role) ? entry.role : "operator",
    won: Boolean(entry.won),
    elapsedSeconds: nonNegativeInteger(entry.elapsedSeconds),
    mistakes: nonNegativeInteger(entry.mistakes),
    modulesSolved: Math.min(3, nonNegativeInteger(entry.modulesSolved)),
    completedAt: validTimestamp(entry.completedAt, Date.now())
  }));
}

function rememberId(ids, id) {
  return [id, ...ids.filter(value => value !== id)].slice(0, SHIFT_ID_LIMIT);
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 80;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function nullablePositiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

function validTimestamp(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
