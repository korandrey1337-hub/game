import assert from "node:assert/strict";
import test from "node:test";

import { CORE_BELOW_STATS_KEY, CoreBelowStats } from "../public/stats.js";

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
  return new CoreBelowStats({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 });
}

test("statistics use a separate project storage key", () => {
  const storage = new MemoryStorage();
  const stats = new CoreBelowStats({ storage, now: () => 1000 });
  stats.startSession();
  assert.ok(storage.getItem(CORE_BELOW_STATS_KEY));
  assert.equal(stats.snapshot().sessions, 1);
});

test("a shift start and result are counted only once", () => {
  const stats = tracker();
  assert.equal(stats.recordShiftStart({ shiftId: "s1", scenarioId: "cryo", role: "lookout" }), true);
  assert.equal(stats.recordShiftStart({ shiftId: "s1", scenarioId: "cryo", role: "lookout" }), false);
  assert.equal(stats.recordShiftResult({
    shiftId: "s1",
    scenarioId: "cryo",
    role: "lookout",
    outcome: "won",
    elapsedSeconds: 94,
    mistakes: 0,
    modulesSolved: 3
  }), true);
  assert.equal(stats.recordShiftResult({ shiftId: "s1", outcome: "won" }), false);

  const value = stats.snapshot();
  assert.equal(value.shiftsStarted, 1);
  assert.equal(value.shiftsCompleted, 1);
  assert.equal(value.wins, 1);
  assert.equal(value.perfectWins, 1);
  assert.equal(value.bestWinSeconds, 94);
  assert.equal(value.roleRuns.lookout, 1);
  assert.equal(value.scenarioRuns.cryo, 1);
  assert.equal(value.scenarioWins.cryo, 1);
});

test("losses, activity and communication are accumulated", () => {
  const stats = tracker();
  stats.recordShiftResult({
    shiftId: "s2",
    scenarioId: "signal",
    role: "scribe",
    outcome: "lost",
    elapsedSeconds: 130,
    mistakes: 2,
    modulesSolved: 1
  });
  stats.addActivity({ seconds: 37, distance: 248 });
  stats.recordSignal();
  stats.recordSignal();
  stats.recordMessage();

  const value = stats.snapshot();
  assert.equal(value.losses, 1);
  assert.equal(value.currentStreak, 0);
  assert.equal(value.mistakes, 2);
  assert.equal(value.modulesStabilized, 1);
  assert.equal(value.activeSeconds, 37);
  assert.equal(value.distanceTravelled, 248);
  assert.equal(value.signalsSent, 2);
  assert.equal(value.messagesSent, 1);
  assert.equal(value.history.length, 1);
});
