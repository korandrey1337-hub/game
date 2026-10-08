import assert from "node:assert/strict";
import { test } from "node:test";
import { makeCooperativeIncident, stabilizationPressure } from "../party-rules.mjs";

const blueprint = { id: "test", station: "wires", choices: [{ id: "a" }, { id: "b" }, { id: "c" }] };

test("every generated incident has one fault and an answer requiring both clues", () => {
  const variants = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    let state = seed;
    const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const incident = makeCooperativeIncident(blueprint, 0, rng);
    const faults = incident.readings.filter(row => row.value < incident.normalMin || row.value > incident.normalMax);
    assert.equal(faults.length, 1);
    assert.equal(faults[0].station, incident.station);
    const row = incident.rules.find(rule => rule.id === incident.clueId);
    assert.equal(incident.solutionId, row[incident.mode ? "inverted" : "normal"]);
    assert.notEqual(row.normal, row.inverted);
    assert.equal(new Set(incident.rules.map(rule => rule.normal)).size, 3);
    assert.equal(new Set(incident.rules.map(rule => rule.inverted)).size, 3);
    variants.add(JSON.stringify([incident.station, incident.pattern, incident.mode, incident.rules]));
  }
  assert.ok(variants.size > 25);
});

test("pressure cycles through safe and unsafe regions and training gives a stable first cue", () => {
  const puzzle = { incidents: [{ timingOffset: 0 }], currentIndex: 0, incidentStartedAt: 1000 };
  assert.equal(stabilizationPressure(puzzle, 1000), 0);
  assert.equal(stabilizationPressure(puzzle, 2250), 50);
  assert.equal(stabilizationPressure(puzzle, 3500), 100);
  assert.equal(stabilizationPressure(puzzle, 6000), 0);
  assert.equal(stabilizationPressure(puzzle, 1000, true), 50);
});
