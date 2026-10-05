export const ROULETTE_STATS_KEY = "rouletteClubStats:v1";

const ITEM_IDS = ["hammer", "claw", "vape", "tarot"];
const WEAPON_IDS = ["revolver", "shotgun"];
const MATCH_HISTORY_LIMIT = 40;
const EVENT_HISTORY_LIMIT = 120;

export function createDefaultStats(now = Date.now()) {
  return {
    version: 1,
    createdAt: now,
    lastSeenAt: now,
    sessions: 0,
    telegramSessions: 0,
    activeSeconds: 0,
    matchesStarted: 0,
    matchesCompleted: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalScore: 0,
    bestMatchScore: 0,
    roundsPlayed: 0,
    shotsFired: 0,
    selfShots: 0,
    opponentShots: 0,
    liveShots: 0,
    blankShots: 0,
    damageDealt: 0,
    damageTaken: 0,
    eliminations: 0,
    itemsUsed: 0,
    itemUses: Object.fromEntries(ITEM_IDS.map((id) => [id, 0])),
    weaponMatches: Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])),
    weaponWins: Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])),
    startedMatchIds: [],
    completedMatchIds: [],
    recordedEventIds: [],
  };
}

export function normalizeStats(value, now = Date.now()) {
  const base = createDefaultStats(now);
  if (!value || typeof value !== "object") return base;

  for (const key of Object.keys(base)) {
    if (typeof base[key] === "number" && !["version", "createdAt", "lastSeenAt"].includes(key)) {
      base[key] = nonNegativeInteger(value[key]);
    }
  }

  base.createdAt = validTimestamp(value.createdAt, now);
  base.lastSeenAt = validTimestamp(value.lastSeenAt, now);
  base.itemUses = normalizeCounterMap(value.itemUses, ITEM_IDS);
  base.weaponMatches = normalizeCounterMap(value.weaponMatches, WEAPON_IDS);
  base.weaponWins = normalizeCounterMap(value.weaponWins, WEAPON_IDS);
  base.startedMatchIds = normalizeMatchIds(value.startedMatchIds);
  base.completedMatchIds = normalizeMatchIds(value.completedMatchIds);
  base.recordedEventIds = normalizeEventIds(value.recordedEventIds);
  base.bestStreak = Math.max(base.bestStreak, base.currentStreak);
  base.matchesStarted = Math.max(base.matchesStarted, base.matchesCompleted);
  return base;
}

export class RouletteStats {
  constructor({ storage = globalThis.localStorage ?? null, key = ROULETTE_STATS_KEY, now = () => Date.now() } = {}) {
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
      // Statistics should never interrupt a match when storage is unavailable.
    }
  }

  startSession({ telegram = false } = {}) {
    this.data.sessions += 1;
    if (telegram) this.data.telegramSessions += 1;
    this.persist();
  }

  addActiveSeconds(seconds) {
    const amount = nonNegativeInteger(seconds);
    if (!amount) return;
    this.data.activeSeconds += amount;
    this.persist();
  }

  recordMatchStart({ matchId, weaponSkin } = {}) {
    if (!matchId || this.data.startedMatchIds.includes(matchId)) return false;
    const weapon = WEAPON_IDS.includes(weaponSkin) ? weaponSkin : "revolver";
    this.data.matchesStarted += 1;
    this.data.weaponMatches[weapon] += 1;
    this.data.startedMatchIds = rememberMatch(this.data.startedMatchIds, matchId);
    this.persist();
    return true;
  }

  recordEvent(event, { playerId = "p0", eventId = null } = {}) {
    if (!event || typeof event !== "object") return false;
    const safeEventId = typeof eventId === "string" && eventId ? eventId : null;
    if (safeEventId && this.data.recordedEventIds.includes(safeEventId)) return false;

    let recorded = false;

    if (event.type === "round-start") {
      this.data.roundsPlayed += 1;
      recorded = true;
    } else if (event.type === "item" && event.actorId === playerId && ITEM_IDS.includes(event.itemId)) {
      this.data.itemsUsed += 1;
      this.data.itemUses[event.itemId] += 1;
      recorded = true;
    } else if (event.type === "shot") {
      const humanActed = event.actorId === playerId;
      const humanTargeted = event.targetId === playerId;
      const damage = nonNegativeInteger(event.damage);

      if (humanActed) {
        this.data.shotsFired += 1;
        this.data[event.selfShot ? "selfShots" : "opponentShots"] += 1;
        this.data[event.shell === "live" ? "liveShots" : "blankShots"] += 1;
        if (!event.selfShot) {
          this.data.damageDealt += damage;
          if (event.eliminated) this.data.eliminations += 1;
        }
      }

      if (humanTargeted) this.data.damageTaken += damage;
      recorded = humanActed || humanTargeted;
    }

    if (!recorded) return false;
    if (safeEventId) {
      this.data.recordedEventIds = rememberEvent(this.data.recordedEventIds, safeEventId);
    }
    this.persist();
    return true;
  }

  recordMatchResult({ matchId, winnerId, playerId = "p0", weaponSkin, score = 0 } = {}) {
    if (!matchId || !winnerId || this.data.completedMatchIds.includes(matchId)) return false;
    const won = winnerId === playerId;
    const weapon = WEAPON_IDS.includes(weaponSkin) ? weaponSkin : "revolver";
    const safeScore = nonNegativeInteger(score);

    this.data.matchesCompleted += 1;
    this.data.completedMatchIds = rememberMatch(this.data.completedMatchIds, matchId);
    if (won) {
      this.data.wins += 1;
      this.data.currentStreak += 1;
      this.data.bestStreak = Math.max(this.data.bestStreak, this.data.currentStreak);
      this.data.totalScore += safeScore;
      this.data.bestMatchScore = Math.max(this.data.bestMatchScore, safeScore);
      this.data.weaponWins[weapon] += 1;
    } else {
      this.data.losses += 1;
      this.data.currentStreak = 0;
    }
    this.persist();
    return true;
  }

  snapshot() {
    return normalizeStats(this.data, this.now());
  }
}

function normalizeCounterMap(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, nonNegativeInteger(value?.[key])]));
}

function normalizeMatchIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.length > 0).slice(0, MATCH_HISTORY_LIMIT);
}

function normalizeEventIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.length > 0).slice(0, EVENT_HISTORY_LIMIT);
}

function rememberMatch(ids, matchId) {
  return [matchId, ...ids.filter((id) => id !== matchId)].slice(0, MATCH_HISTORY_LIMIT);
}

function rememberEvent(ids, eventId) {
  return [eventId, ...ids.filter((id) => id !== eventId)].slice(0, EVENT_HISTORY_LIMIT);
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function validTimestamp(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}
