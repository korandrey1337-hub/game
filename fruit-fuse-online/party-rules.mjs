export const DIAGNOSTIC_CODES = [
  { id: "one", symbol: "A" },
  { id: "two", symbol: "B" },
  { id: "three", symbol: "C" }
];

const PATTERNS = [
  ["|", "||", "|||"],
  ["↑", "→", "↓"],
  ["○", "△", "□"]
];

export function makeCooperativeIncident(blueprint, index, rng, tutorial = false) {
  const stations = ["wires", "glyphs", "coolant"];
  const station = tutorial ? blueprint.station : stations[Math.floor(rng() * stations.length)];
  const clueIndex = tutorial ? 0 : Math.floor(rng() * 3);
  const mode = tutorial ? 0 : Math.floor(rng() * 2);
  const offset = tutorial ? 0 : Math.floor(rng() * 3);
  const patterns = PATTERNS[tutorial ? 0 : Math.floor(rng() * PATTERNS.length)];
  const normalMin = tutorial ? 40 : 25 + Math.floor(rng() * 30);
  const normalMax = normalMin + 20;
  const rules = DIAGNOSTIC_CODES.map((code, row) => ({
    ...code,
    normal: blueprint.choices[(row + offset) % 3].id,
    inverted: blueprint.choices[(row + offset + 1) % 3].id
  }));
  return {
    ...blueprint,
    id: `${blueprint.id}-${index + 1}`,
    station,
    choices: blueprint.choices.map(choice => ({ ...choice })),
    rules,
    clueId: DIAGNOSTIC_CODES[clueIndex].id,
    mode,
    solutionId: rules[clueIndex][mode ? "inverted" : "normal"],
    pattern: patterns[clueIndex],
    legend: DIAGNOSTIC_CODES.map((code, row) => ({ ...code, pattern: patterns[row] })),
    normalMin,
    normalMax,
    readings: stations.map(id => ({
      station: id,
      value: id === station
        ? (tutorial || rng() > 0.5 ? normalMax + 15 : normalMin - 15)
        : normalMin + 3 + Math.floor(rng() * 15)
    })),
    timingOffset: tutorial ? 0 : Math.floor(rng() * 5000)
  };
}

export function stabilizationPressure(puzzle, now, tutorial = false) {
  if (tutorial) return 50;
  const incident = puzzle.incidents[puzzle.currentIndex];
  const phase = ((now - puzzle.incidentStartedAt + incident.timingOffset) % 5000) / 5000;
  return Math.round(phase < 0.5 ? phase * 200 : (1 - phase) * 200);
}
