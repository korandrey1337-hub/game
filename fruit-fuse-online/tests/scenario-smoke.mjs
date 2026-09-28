import assert from "node:assert/strict";

const MODULE_TARGETS = {
  wires: { x: 106, y: 86 },
  glyphs: { x: 363, y: 88 },
  coolant: { x: 238, y: 198 }
};

const EXPECTED_SCENARIOS = {
  reactor: { durationSec: 210, maxMistakes: 3, order: ["wires", "glyphs", "coolant"], glyphLength: 3 },
  cryo: { durationSec: 195, maxMistakes: 3, order: ["coolant", "wires", "glyphs"], glyphLength: 4 },
  signal: { durationSec: 180, maxMistakes: 2, order: ["glyphs", "coolant", "wires"], glyphLength: 3 }
};

const operator = await connect();
operator.send({ type: "join", name: "SCENARIO-OPERATOR" });
const lobby = await operator.waitFor(room => room.phase === "lobby");

const lookout = await connect();
lookout.send({ type: "join", name: "SCENARIO-LOOKOUT", roomCode: lobby.code });
const scribe = await connect();
scribe.send({ type: "join", name: "SCENARIO-SCRIBE", roomCode: lobby.code });
await Promise.all([
  operator.waitFor(room => room.players.length === 3 && room.crewReady),
  lookout.waitFor(room => room.players.length === 3 && room.crewReady),
  scribe.waitFor(room => room.players.length === 3 && room.crewReady)
]);

assert.equal(operator.latest().isHost, true);
assert.equal(lookout.latest().isHost, false);
assert.equal(scribe.latest().isHost, false);

const seenScenarios = [];
const seenShiftIds = new Set();

for (let round = 0; round < 3; round += 1) {
  operator.send({ type: "start" });
  const [operatorState, lookoutState, scribeState] = await Promise.all([
    operator.waitFor(room => room.phase === "playing" && !seenShiftIds.has(room.shiftId)),
    lookout.waitFor(room => room.phase === "playing" && !seenShiftIds.has(room.shiftId)),
    scribe.waitFor(room => room.phase === "playing" && !seenShiftIds.has(room.shiftId))
  ]);

  assert.equal(operatorState.shiftId, lookoutState.shiftId);
  assert.equal(operatorState.shiftId, scribeState.shiftId);
  seenShiftIds.add(operatorState.shiftId);

  const expected = EXPECTED_SCENARIOS[operatorState.scenario.id];
  assert.ok(expected);
  assert.equal(operatorState.scenario.durationSec, expected.durationSec);
  assert.equal(operatorState.maxMistakes, expected.maxMistakes);
  assert.deepEqual(operatorState.puzzleView.progress.moduleOrder, expected.order);
  assert.equal(glyphSequence(scribeState.puzzleView.manual.glyph).length, expected.glyphLength);
  assert.match(operatorState.scenario.background, /^\.\/assets\/.+\.png$/);
  assert.notEqual(operatorState.scenario.id, seenScenarios.at(-1));

  while (operator.latest().phase === "playing") {
    const activeModule = operator.latest().puzzleView.progress.activeModule;
    await moveToModule(operator, activeModule);
    await solveModule(activeModule, operator, lookout, scribe);
    await operator.waitFor(room => room.phase !== "playing" || room.puzzleView.progress[`${activeModule}Solved`], 5000);
  }

  const result = await operator.waitFor(room => room.shiftId === operatorState.shiftId && room.phase === "won");
  assert.equal(result.mistakes, 0);
  assert.equal(result.puzzleView.progress.activeModule, null);
  assert.ok(result.elapsedSeconds > 0);
  seenScenarios.push(result.scenario.id);
}

assert.equal(new Set(seenScenarios).size, 3, `Expected all scenarios, saw ${seenScenarios.join(", ")}`);
console.log(`Scenario smoke test passed with three online roles: ${seenScenarios.join(" -> ")}.`);
operator.close();
lookout.close();
scribe.close();

async function solveModule(moduleId, operatorClient, lookoutClient, scribeClient) {
  const scanner = lookoutClient.latest().puzzleView.scanner;
  const manual = scribeClient.latest().puzzleView.manual;

  if (moduleId === "wires") {
    const wire = scanner.wires.find(item => manual.wire.includes(item.colorName));
    assert.ok(wire, `Wire rule did not match scanner data: ${manual.wire}`);
    operatorClient.send({ type: "interact", module: "wires", slot: wire.slot });
    return;
  }

  if (moduleId === "glyphs") {
    const sequence = glyphSequence(manual.glyph);
    for (let index = 0; index < sequence.length; index += 1) {
      const glyph = scanner.glyphs.find(item => item.symbolName === sequence[index]);
      assert.ok(glyph, `Glyph ${sequence[index]} was not present in scanner data`);
      operatorClient.send({ type: "interact", module: "glyphs", slot: glyph.slot });
      await operatorClient.waitFor(room => room.puzzleView.progress.glyphProgress >= index + 1 || room.puzzleView.progress.glyphsSolved);
    }
    return;
  }

  const targetByLabel = coolantTargets(scanner.coolant, manual.coolant);
  for (const tank of scanner.coolant) {
    for (let count = 0; count < targetByLabel[tank.label]; count += 1) {
      operatorClient.send({ type: "interact", module: "coolant", action: "cycle", label: tank.label });
      await delay(35);
    }
  }
  operatorClient.send({ type: "interact", module: "coolant", action: "commit" });
}

function glyphSequence(rule) {
  return rule.split(":").at(-1).replace(/\.$/, "").trim().split(/,\s*/).filter(Boolean);
}

function coolantTargets(tanks, rule) {
  const values = {
    hot: Number(rule.match(/горячий(?: бак)?\s*=\s*(\d)/i)?.[1]),
    middle: Number(rule.match(/средний(?: бак)?\s*=\s*(\d)/i)?.[1]),
    cold: Number(rule.match(/холодный(?: бак)?\s*=\s*(\d)/i)?.[1])
  };
  assert.ok(Object.values(values).every(Number.isInteger), `Could not parse coolant rule: ${rule}`);
  const sorted = [...tanks].sort((a, b) => a.temp - b.temp);
  return {
    [sorted[0].label]: values.cold,
    [sorted[1].label]: values.middle,
    [sorted[2].label]: values.hot
  };
}

async function moveToModule(client, moduleId) {
  const target = MODULE_TARGETS[moduleId];
  let player = client.ownPlayer();
  const dx = target.x - player.x;
  if (Math.abs(dx) > 4) await move(client, { [dx > 0 ? "right" : "left"]: true }, Math.abs(dx) / 76 * 1000);
  player = client.ownPlayer();
  const dy = target.y - player.y;
  if (Math.abs(dy) > 4) await move(client, { [dy > 0 ? "down" : "up"]: true }, Math.abs(dy) / 76 * 1000);
}

async function move(client, input, duration) {
  client.send({ type: "input", input });
  await delay(Math.max(80, duration));
  client.send({ type: "input", input: {} });
  await delay(120);
}

async function connect() {
  const socket = new WebSocket("http://127.0.0.1:4173/socket");
  let latestState = null;
  let ownId = null;
  const waiters = [];

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "hello") ownId = message.peerId;
    if (message.type !== "state") return;
    ownId = message.selfId;
    latestState = message.room;
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(latestState)) continue;
      clearTimeout(waiter.timeout);
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(latestState);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    send(payload) {
      socket.send(JSON.stringify(payload));
    },
    waitFor(predicate, timeoutMs = 4000) {
      if (latestState && predicate(latestState)) return Promise.resolve(latestState);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timeout: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error(`Timed out waiting for state. Last phase: ${latestState?.phase || "none"}`));
          }, timeoutMs)
        };
        waiters.push(waiter);
      });
    },
    latest() {
      return latestState;
    },
    ownPlayer() {
      return latestState.players.find(player => player.id === ownId);
    },
    close() {
      socket.close();
    }
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
