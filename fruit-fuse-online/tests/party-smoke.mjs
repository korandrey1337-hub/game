import assert from "node:assert/strict";

const TARGETS = {
  wires: { x: 106, y: 86 },
  glyphs: { x: 363, y: 88 },
  coolant: { x: 238, y: 198 }
};

await testTutorial();
await testFullShift();
await testFailure();
console.log("Party-game smoke test passed: tutorial, four incidents, role limits and final failure work.");

async function testTutorial() {
  const client = await connect();
  client.send({ type: "join", name: "TRAINEE", tutorial: true });
  await client.waitFor(room => room.tutorial && room.phase === "playing" && room.puzzleView?.role === "lookout");
  assert.equal(client.latest().puzzleView.phase, "scan");

  client.send({ type: "interact", action: "scan" });
  await client.waitFor(room => room.puzzleView?.scanner?.readings);
  const scanner = client.latest().puzzleView.scanner;
  const station = faultStation(scanner);
  const healthy = scanner.readings.find(reading => reading.station !== station);
  client.send({ type: "interact", action: "route", station: healthy.station });
  await client.waitFor(room => room.mistakes === 1);
  assert.equal(client.latest().puzzleView.progress.activeModule, null);
  client.send({ type: "interact", action: "route", station });
  await client.waitFor(room => room.puzzleView.phase === "report");
  const clue = diagnosticCode(client.latest().puzzleView.scanner);
  const wrongCode = client.latest().puzzleView.scanner.legend.find(code => code.id !== clue).id;
  client.send({ type: "interact", action: "report", code: wrongCode });
  await client.waitFor(room => room.mistakes === 2);
  assert.equal(client.latest().puzzleView.team.clueReported, null);
  client.send({ type: "interact", action: "report", code: clue });
  await client.waitFor(room => room.puzzleView.role === "operator");
  await moveTo(client, station);
  await client.waitFor(room => room.puzzleView.terminal);
  client.send({ type: "interact", action: "terminal", mode: client.latest().puzzleView.terminal.mode });
  await client.waitFor(room => room.puzzleView.role === "scribe" && room.puzzleView.manual?.rules);

  const manual = client.latest().puzzleView.manual;
  assert.equal(manual.solution, undefined);
  const solution = inferTool(client.latest().puzzleView);
  const wrong = manual.choices.find(choice => choice.id !== solution);
  client.send({ type: "interact", action: "signal", choice: wrong.id });
  await client.waitFor(room => room.mistakes === 3 && room.puzzleView.chaos);
  assert.equal(client.latest().phase, "playing");

  client.send({ type: "interact", action: "signal", choice: solution });
  await client.waitFor(room => room.puzzleView?.role === "operator" && room.puzzleView.team.signalReady);
  assert.equal(client.latest().puzzleView.training, undefined);
  client.send({ type: "interact", action: "prepare", choice: solution });
  await client.waitFor(room => room.puzzleView.role === "lookout" && room.puzzleView.team.operatorArmed);
  client.send({ type: "interact", action: "cue" });
  await client.waitFor(room => room.puzzleView.role === "operator" && room.puzzleView.team.cueRemainingMs > 0);
  client.send({ type: "interact", action: "resolve" });
  await client.waitFor(room => room.phase === "won");
  assert.equal(client.latest().outcomeReason, "crew_saved");
  assert.equal(client.latest().puzzleView.progress.resolvedCount, 1);
  client.close();
}

async function testFullShift() {
  const { operator, lookout, scribe } = await createCrew("SHIFT");
  const observer = await connect();
  observer.send({ type: "join", name: "LOBBY-OBSERVER", roomCode: operator.latest().code });
  await observer.waitFor(room => room.phase === "lobby" && room.players.length === 4);
  assert.equal(observer.ownPlayer().role, "observer");
  operator.send({ type: "start" });
  await Promise.all([
    operator.waitFor(room => room.phase === "playing"),
    lookout.waitFor(room => room.phase === "playing"),
    scribe.waitFor(room => room.phase === "playing")
  ]);

  const lateGuest = await connect();
  lateGuest.send({ type: "join", name: "LATE-GUEST", roomCode: operator.latest().code });
  assert.equal(await lateGuest.waitForError(message => message.includes("Смена уже идёт")), "Смена уже идёт — зайдите после неё");
  assert.equal(lateGuest.latest(), null);
  assert.equal(operator.latest().players.length, 4);

  const hostId = operator.ownPlayer().id;
  operator.send({ type: "join", name: "REJOIN", roomCode: operator.latest().code });
  await operator.waitForError(message => message.includes("Смена уже идёт"));
  assert.equal(operator.ownPlayer().id, hostId);
  assert.equal(operator.ownPlayer().nick, "SHIFT-OP");
  assert.equal(operator.latest().isHost, true);

  const trainee = await connect();
  trainee.send({ type: "join", name: "INDEPENDENT-TRAINING", roomCode: operator.latest().code, tutorial: true });
  await trainee.waitFor(room => room.tutorial && room.phase === "playing");
  assert.notEqual(trainee.latest().code, operator.latest().code);
  trainee.close();

  assert.ok(operator.latest().puzzleView.choices);
  assert.equal(lookout.latest().puzzleView.scanner, null);
  assert.equal(scribe.latest().puzzleView.manual, null);
  assert.equal(operator.latest().puzzleView.progress.activeModule, null);
  assert.deepEqual(operator.latest().puzzleView.progress.moduleOrder, []);
  assert.equal(operator.latest().puzzleView.terminal, null);
  assert.equal(operator.latest().maxMistakes, 6);
  assert.equal(operator.latest().scenario.durationSec, 240);

  const lookoutBefore = lookout.ownPlayer();
  lookout.send({ type: "input", input: { right: true } });
  await delay(220);
  lookout.send({ type: "input", input: {} });
  await delay(100);
  assert.deepEqual(
    { x: lookout.ownPlayer().x, y: lookout.ownPlayer().y },
    { x: lookoutBefore.x, y: lookoutBefore.y }
  );

  scribe.send({ type: "chat", text: "blocked" });
  assert.match(await scribe.waitForError(message => message.includes("Голосовой модуль")), /используйте сигналы/);

  for (let index = 0; index < 4; index += 1) {
    lookout.send({ type: "interact", action: "scan" });
    await lookout.waitFor(room => room.puzzleView?.phase === "route");
    const station = faultStation(lookout.latest().puzzleView.scanner);
    lookout.send({ type: "interact", action: "route", station });
    await lookout.waitFor(room => room.puzzleView.phase === "report");
    lookout.send({ type: "interact", action: "report", code: diagnosticCode(lookout.latest().puzzleView.scanner) });
    await operator.waitFor(room => room.puzzleView?.team.routeReady && room.puzzleView.progress.resolvedCount === index);
    await moveTo(operator, station);
    await operator.waitFor(room => room.puzzleView.terminal);
    operator.send({ type: "interact", action: "terminal", mode: operator.latest().puzzleView.terminal.mode });
    await scribe.waitFor(room => room.puzzleView?.manual?.rules && room.puzzleView.team.clueReported !== null && room.puzzleView.team.modeReported !== null && room.puzzleView.progress.resolvedCount === index);

    assert.equal(scribe.latest().puzzleView.manual.solution, undefined);
    assert.equal(scribe.latest().puzzleView.terminal, undefined);
    assert.equal(scribe.latest().puzzleView.pressure, undefined);
    const solution = inferTool(scribe.latest().puzzleView);
    scribe.send({ type: "interact", action: "signal", choice: solution });
    await operator.waitFor(room => room.puzzleView?.team.signalReady && room.puzzleView.progress.resolvedCount === index);

    operator.send({ type: "interact", action: "prepare", choice: solution });
    await operator.waitFor(room => room.puzzleView.team.operatorArmed);
    if (index === 0) {
      operator.send({ type: "interact", action: "resolve" });
      await operator.waitFor(room => room.mistakes === 1);
      await lookout.waitFor(room => room.puzzleView.pressure < 10 || room.puzzleView.pressure > 90);
      lookout.send({ type: "interact", action: "cue" });
      await lookout.waitFor(room => room.mistakes === 2);
    }
    await lookout.waitFor(room => room.puzzleView.team.operatorArmed && room.puzzleView.pressure >= 35 && room.puzzleView.pressure <= 65);
    lookout.send({ type: "interact", action: "cue" });
    await operator.waitFor(room => room.puzzleView.team.cueRemainingMs > 0);
    if (index === 0) {
      await operator.waitFor(room => room.puzzleView.team.cueRemainingMs === 0, 6000);
      assert.equal(operator.latest().puzzleView.progress.resolvedCount, 0);
      await lookout.waitFor(room => room.puzzleView.pressure >= 35 && room.puzzleView.pressure <= 65);
      lookout.send({ type: "interact", action: "cue" });
      await operator.waitFor(room => room.puzzleView.team.cueRemainingMs > 0);
    }
    assert.equal(operator.latest().puzzleView.pressure, undefined);
    operator.send({ type: "interact", action: "resolve" });
    await operator.waitFor(room => room.phase === "won" || room.puzzleView.progress.resolvedCount === index + 1, 6000);
  }

  assert.equal(operator.latest().phase, "won");
  assert.equal(operator.latest().puzzleView.progress.resolvedCount, 4);
  assert.equal(operator.latest().mistakes, 2);
  lateGuest.send({ type: "join", name: "AFTER-WIN", roomCode: operator.latest().code });
  await lateGuest.waitFor(room => room.phase === "won" && room.players.length === 5);
  assert.equal(lateGuest.ownPlayer().role, "observer");
  lateGuest.close();
  observer.close();
  operator.close();
  lookout.close();
  scribe.close();
}

async function testFailure() {
  const { operator, lookout, scribe } = await createCrew("FAIL");
  operator.send({ type: "start" });
  await scribe.waitFor(room => room.phase === "playing");
  operator.close();
  await lookout.waitFor(room => room.phase === "playing" && room.players.length === 2);
  const replacement = await connect();
  replacement.send({ type: "join", name: "LATE-REPLACEMENT", roomCode: lookout.latest().code });
  await replacement.waitForError(message => message.includes("Смена уже идёт"));
  assert.equal(replacement.latest(), null);
  lookout.send({ type: "interact", action: "scan" });
  await lookout.waitFor(room => room.puzzleView?.phase === "route");
  const scanner = lookout.latest().puzzleView.scanner;
  const station = faultStation(scanner);
  const wrong = scanner.readings.find(reading => reading.station !== station).station;
  for (let count = 1; count <= 6; count += 1) {
    lookout.send({ type: "interact", action: "route", station: wrong });
    await scribe.waitFor(room => room.mistakes === count || room.phase === "lost");
  }
  await lookout.waitFor(room => room.phase === "lost");
  assert.equal(lookout.latest().outcomeReason, "mistakes");
  assert.equal(lookout.latest().mistakes, 6);
  replacement.send({ type: "join", name: "AFTER-LOSS", roomCode: lookout.latest().code });
  await replacement.waitFor(room => room.phase === "lost" && room.players.length === 3);
  assert.equal(replacement.ownPlayer().role, "operator");
  replacement.close();
  lookout.close();
  scribe.close();
}

function faultStation(scanner) {
  return scanner.readings.find(reading => reading.value < scanner.normalMin || reading.value > scanner.normalMax).station;
}

function diagnosticCode(scanner) {
  return scanner.legend.find(code => code.pattern === scanner.pattern).id;
}

function inferTool(view) {
  const row = view.manual.rules.find(rule => rule.id === view.team.clueReported);
  return row[view.team.modeReported ? "inverted" : "normal"];
}

async function createCrew(prefix) {
  const operator = await connect();
  operator.send({ type: "join", name: `${prefix}-OP` });
  const lobby = await operator.waitFor(room => room.phase === "lobby");
  const lookout = await connect();
  lookout.send({ type: "join", name: `${prefix}-LOOK`, roomCode: lobby.code });
  const scribe = await connect();
  scribe.send({ type: "join", name: `${prefix}-SCRIBE`, roomCode: lobby.code });
  await operator.waitFor(room => room.players.length === 3 && room.crewReady);
  return { operator, lookout, scribe };
}

async function moveTo(client, station) {
  const target = TARGETS[station];
  let player = client.ownPlayer();
  const dx = target.x - player.x;
  if (Math.abs(dx) > 5) await move(client, { [dx > 0 ? "right" : "left"]: true }, Math.abs(dx) / 76 * 1100);
  player = client.ownPlayer();
  const dy = target.y - player.y;
  if (Math.abs(dy) > 5) await move(client, { [dy > 0 ? "down" : "up"]: true }, Math.abs(dy) / 76 * 1100);
}

async function move(client, input, duration) {
  client.send({ type: "input", input });
  await delay(Math.max(90, duration));
  client.send({ type: "input", input: {} });
  await delay(120);
}

async function connect() {
  const socket = new WebSocket(`http://127.0.0.1:${process.env.PORT || 4173}/socket`);
  let latest = null;
  let ownId = null;
  const stateWaiters = [];
  const errorWaiters = [];

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "hello") ownId = message.peerId;
    if (message.type === "state") {
      latest = message.room;
      ownId = message.selfId;
      flush(stateWaiters, latest);
    }
    if (message.type === "error") flush(errorWaiters, message.message);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    send: payload => socket.send(JSON.stringify(payload)),
    latest: () => latest,
    ownPlayer: () => latest.players.find(player => player.id === ownId),
    close: () => socket.close(),
    waitFor: (predicate, timeoutMs = 5000) => waitFor(stateWaiters, () => latest, predicate, timeoutMs),
    waitForError: (predicate, timeoutMs = 5000) => waitFor(errorWaiters, () => null, predicate, timeoutMs)
  };
}

function flush(waiters, value) {
  for (const waiter of [...waiters]) {
    if (!waiter.predicate(value)) continue;
    clearTimeout(waiter.timeout);
    waiters.splice(waiters.indexOf(waiter), 1);
    waiter.resolve(value);
  }
}

function waitFor(waiters, current, predicate, timeoutMs) {
  const value = current();
  if (value && predicate(value)) return Promise.resolve(value);
  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve,
      timeout: setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error("Timed out waiting for WebSocket state."));
      }, timeoutMs)
    };
    waiters.push(waiter);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
