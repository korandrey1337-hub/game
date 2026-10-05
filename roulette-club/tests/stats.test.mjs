import assert from "node:assert/strict";
import test from "node:test";

import { ROULETTE_STATS_KEY, RouletteStats } from "../src/stats.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function tracker() {
  return new RouletteStats({ storage: new MemoryStorage(), now: () => 1_750_000_000_000 });
}

test("roulette statistics use a dedicated storage key", () => {
  const storage = new MemoryStorage();
  const stats = new RouletteStats({ storage, now: () => 1000 });
  stats.startSession({ telegram: true });

  assert.ok(storage.getItem(ROULETTE_STATS_KEY));
  assert.equal(stats.snapshot().sessions, 1);
  assert.equal(stats.snapshot().telegramSessions, 1);
});

test("match starts and results are counted once", () => {
  const stats = tracker();
  assert.equal(stats.recordMatchStart({ matchId: "m1", weaponSkin: "shotgun" }), true);
  assert.equal(stats.recordMatchStart({ matchId: "m1", weaponSkin: "shotgun" }), false);
  assert.equal(stats.recordMatchResult({ matchId: "m1", winnerId: "p0", weaponSkin: "shotgun", score: 250 }), true);
  assert.equal(stats.recordMatchResult({ matchId: "m1", winnerId: "p0", weaponSkin: "shotgun", score: 250 }), false);

  const value = stats.snapshot();
  assert.equal(value.matchesStarted, 1);
  assert.equal(value.matchesCompleted, 1);
  assert.equal(value.wins, 1);
  assert.equal(value.currentStreak, 1);
  assert.equal(value.totalScore, 250);
  assert.equal(value.weaponMatches.shotgun, 1);
  assert.equal(value.weaponWins.shotgun, 1);
});

test("human shots, damage and eliminations are tracked separately", () => {
  const stats = tracker();
  stats.recordEvent({
    type: "shot",
    actorId: "p0",
    targetId: "p1",
    shell: "live",
    damage: 2,
    selfShot: false,
    eliminated: true,
  });
  stats.recordEvent({
    type: "shot",
    actorId: "p1",
    targetId: "p0",
    shell: "live",
    damage: 1,
    selfShot: false,
  });
  stats.recordEvent({
    type: "shot",
    actorId: "p0",
    targetId: "p0",
    shell: "blank",
    damage: 0,
    selfShot: true,
  });

  const value = stats.snapshot();
  assert.equal(value.shotsFired, 2);
  assert.equal(value.opponentShots, 1);
  assert.equal(value.selfShots, 1);
  assert.equal(value.liveShots, 1);
  assert.equal(value.blankShots, 1);
  assert.equal(value.damageDealt, 2);
  assert.equal(value.damageTaken, 1);
  assert.equal(value.eliminations, 1);
});

test("rounds, items, losses and active time are persisted", () => {
  const stats = tracker();
  stats.recordMatchStart({ matchId: "m2", weaponSkin: "revolver" });
  stats.recordEvent({ type: "round-start" });
  stats.recordEvent({ type: "item", actorId: "p0", itemId: "tarot" });
  stats.recordEvent({ type: "item", actorId: "p1", itemId: "hammer" });
  stats.addActiveSeconds(95);
  stats.recordMatchResult({ matchId: "m2", winnerId: "p1", weaponSkin: "revolver" });

  const value = stats.snapshot();
  assert.equal(value.roundsPlayed, 1);
  assert.equal(value.itemsUsed, 1);
  assert.equal(value.itemUses.tarot, 1);
  assert.equal(value.activeSeconds, 95);
  assert.equal(value.losses, 1);
  assert.equal(value.currentStreak, 0);
});

test("online player events use the local seat and ignore duplicate revisions", () => {
  const stats = tracker();
  const event = { type: "item", actorId: "p1", itemId: "hammer" };

  assert.equal(stats.recordEvent(event, { playerId: "p1", eventId: "match-1:7" }), true);
  assert.equal(stats.recordEvent(event, { playerId: "p1", eventId: "match-1:7" }), false);
  assert.equal(stats.snapshot().itemsUsed, 1);
  assert.equal(stats.snapshot().itemUses.hammer, 1);
});
