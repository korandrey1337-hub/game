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
  await client.waitFor(room => room.puzzleView?.phase === "route" && room.puzzleView.scanner?.station);
  client.send({ type: "interact", action: "route" });
  await client.waitFor(room => room.puzzleView?.role === "scribe" && room.puzzleView.manual?.solution);

  const manual = client.latest().puzzleView.manual;
  const wrong = manual.choices.find(choice => choice.id !== manual.solution.id);
  client.send({ type: "interact", action: "signal", choice: wrong.id });
  await client.waitFor(room => room.mistakes === 1 && room.puzzleView.chaos);
  assert.equal(client.latest().phase, "playing");

  client.send({ type: "interact", action: "signal", choice: manual.solution.id });
  await client.waitFor(room => room.puzzleView?.role === "operator" && room.puzzleView.team.signalReady);
  const solution = client.latest().puzzleView.training.solution;
  await moveTo(client, client.latest().puzzleView.progress.activeModule);
  client.send({ type: "interact", action: "resolve", choice: solution.id });
  await client.waitFor(room => room.phase === "won");
  assert.equal(client.latest().outcomeReason, "crew_saved");
  assert.equal(client.latest().puzzleView.progress.resolvedCount, 1);
  client.close();
}

async function testFullShift() {
  const { operator, lookout, scribe } = await createCrew("SHIFT");
  operator.send({ type: "start" });
  await Promise.all([
    operator.waitFor(room => room.phase === "playing"),
    lookout.waitFor(room => room.phase === "playing"),
    scribe.waitFor(room => room.phase === "playing")
  ]);

  assert.ok(operator.latest().puzzleView.choices);
  assert.equal(lookout.latest().puzzleView.scanner, null);
  assert.equal(scribe.latest().puzzleView.manual, null);
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
    lookout.send({ type: "interact", action: "route" });
    await scribe.waitFor(room => room.puzzleView?.manual?.solution && room.puzzleView.progress.resolvedCount === index);

    const solution = scribe.latest().puzzleView.manual.solution;
    scribe.send({ type: "interact", action: "signal", choice: solution.id });
    await operator.waitFor(room => room.puzzleView?.team.signalReady && room.puzzleView.progress.resolvedCount === index);

    const station = operator.latest().puzzleView.progress.activeModule;
    await moveTo(operator, station);
    operator.send({ type: "interact", action: "resolve", choice: solution.id });
    await operator.waitFor(room => room.phase === "won" || room.puzzleView.progress.resolvedCount === index + 1, 6000);
  }

  assert.equal(operator.latest().phase, "won");
  assert.equal(operator.latest().puzzleView.progress.resolvedCount, 4);
  assert.equal(operator.latest().mistakes, 0);
  operator.close();
  lookout.close();
  scribe.close();
}

async function testFailure() {
  const { operator, lookout, scribe } = await createCrew("FAIL");
  operator.send({ type: "start" });
  await scribe.waitFor(room => room.phase === "playing");
  lookout.send({ type: "interact", action: "scan" });
  await lookout.waitFor(room => room.puzzleView?.phase === "route");
  lookout.send({ type: "interact", action: "route" });
  await scribe.waitFor(room => room.puzzleView?.manual?.solution);
  const manual = scribe.latest().puzzleView.manual;
  const wrong = manual.choices.find(choice => choice.id !== manual.solution.id);
  for (let count = 1; count <= 6; count += 1) {
    scribe.send({ type: "interact", action: "signal", choice: wrong.id });
    await scribe.waitFor(room => room.mistakes === count || room.phase === "lost");
  }
  await operator.waitFor(room => room.phase === "lost");
  assert.equal(operator.latest().outcomeReason, "mistakes");
  assert.equal(operator.latest().mistakes, 6);
  operator.close();
  lookout.close();
  scribe.close();
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
