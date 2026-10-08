import assert from "node:assert/strict";

const host = await connect();
host.send({ type: "join", name: "HOST" });
const lobby = await host.waitFor(room => room.phase === "lobby");

const guest = await connect();
guest.send({ type: "join", name: "GUEST", roomCode: lobby.code });
await Promise.all([
  host.waitFor(room => room.players.length === 2),
  guest.waitFor(room => room.players.length === 2)
]);

host.send({ type: "start" });
assert.match(await host.waitForError(message => message.includes("оператор")), /наблюдатель и архивариус/);
assert.equal(host.latest().phase, "lobby");

guest.send({ type: "start" });
assert.match(await guest.waitForError(message => message.includes("командир")), /Только командир/);

host.close();
const transferred = await guest.waitFor(room => room.players.length === 1 && room.isHost);
assert.equal(transferred.players[0].nick, "GUEST");
assert.ok(transferred.logs.some(log => log.text.includes("теперь командир")));

console.log("Lobby smoke test passed: incomplete crews are blocked and command transfers on disconnect.");
guest.close();

async function connect() {
  const socket = new WebSocket(`http://127.0.0.1:${process.env.PORT || 4173}/socket`);
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
    latest() {
      return latest;
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
