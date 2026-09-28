import assert from "node:assert/strict";

const operator = await connect();
operator.send({ type: "join", name: "OPERATOR" });
const lobby = await operator.waitFor(room => room.phase === "lobby");

const lookout = await connect();
lookout.send({ type: "join", name: "LOOKOUT", roomCode: lobby.code });
await operator.waitFor(room => room.players.length === 2);

const scribe = await connect();
scribe.send({ type: "join", name: "SCRIBE", roomCode: lobby.code });
await operator.waitFor(room => room.players.length === 3);

operator.send({ type: "start" });
const [operatorState, lookoutState, scribeState] = await Promise.all([
  operator.waitFor(room => room.phase === "playing" && room.puzzleView?.role === "operator"),
  lookout.waitFor(room => room.phase === "playing" && room.puzzleView?.role === "lookout"),
  scribe.waitFor(room => room.phase === "playing" && room.puzzleView?.role === "scribe")
]);

assert.ok(operatorState.puzzleView.wires);
assert.ok(operatorState.puzzleView.glyphs);
assert.ok(operatorState.puzzleView.coolant);
assert.equal(operatorState.puzzleView.scanner, undefined);
assert.equal(operatorState.puzzleView.manual, undefined);

assert.ok(lookoutState.puzzleView.scanner);
assert.equal(lookoutState.puzzleView.wires, undefined);
assert.equal(lookoutState.puzzleView.manual, undefined);

assert.ok(scribeState.puzzleView.manual);
assert.equal(scribeState.puzzleView.wires, undefined);
assert.equal(scribeState.puzzleView.scanner, undefined);

scribe.send({ type: "chat", text: "This must be blocked" });
const blockedMessage = await scribe.waitForError(message => message.includes("Голосовой модуль"));
assert.match(blockedMessage, /используйте сигналы/);

lookout.send({ type: "ping", text: "СКАН ГОТОВ" });
const pingState = await operator.waitFor(room => room.logs.some(log => log.text.includes("СКАН ГОТОВ")));
assert.ok(pingState.logs.some(log => log.tone === "ping"));

console.log("Role smoke test passed: operator, lookout and scribe have distinct information and communication rules.");
operator.close();
lookout.close();
scribe.close();

async function connect() {
  const socket = new WebSocket("http://127.0.0.1:4173/socket");
  let latest = null;
  const stateWaiters = [];
  const errorWaiters = [];

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "state") {
      latest = message.room;
      flush(stateWaiters, latest);
    }
    if (message.type === "error") flush(errorWaiters, message.message);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    send(payload) {
      socket.send(JSON.stringify(payload));
    },
    waitFor(predicate, timeoutMs = 3000) {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return makeWaiter(stateWaiters, predicate, timeoutMs);
    },
    waitForError(predicate, timeoutMs = 3000) {
      return makeWaiter(errorWaiters, predicate, timeoutMs);
    },
    close() {
      socket.close();
    }
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

function makeWaiter(waiters, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve,
      timeout: setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error("Timed out waiting for WebSocket message."));
      }, timeoutMs)
    };
    waiters.push(waiter);
  });
}
