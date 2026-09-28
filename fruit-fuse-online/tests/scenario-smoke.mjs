import assert from "node:assert/strict";

const client = await connect();
client.send({ type: "join", name: "SCENARIO-SMOKE" });
const lobby = await client.waitFor(room => room.phase === "lobby");

const seen = [];
let previousSerial = null;
for (let round = 0; round < 3; round += 1) {
  client.send({ type: "start" });
  const state = await client.waitFor(room => {
    const serial = room.puzzleView?.progress?.serial;
    return room.phase === "playing" && room.scenario && serial && serial !== previousSerial;
  });

  const { scenario, puzzleView, modules } = state;
  assert.ok(["reactor", "cryo", "signal"].includes(scenario.id));
  assert.match(scenario.background, /^\.\/assets\/.+\.png$/);
  assert.equal(puzzleView.progress.moduleOrder.length, 3);
  assert.equal(puzzleView.progress.activeModule, puzzleView.progress.moduleOrder[0]);
  assert.equal(Object.keys(modules).length, 3);
  assert.notEqual(scenario.id, seen.at(-1));

  seen.push(scenario.id);
  previousSerial = puzzleView.progress.serial;
}

assert.equal(new Set(seen).size, 3, `Expected all scenarios, saw ${seen.join(", ")}`);
assert.equal(lobby.code.length, 5);
console.log(`Scenario smoke test passed: ${seen.join(" -> ")}.`);
client.close();

async function connect() {
  const socket = new WebSocket("http://127.0.0.1:4173/socket");
  let latest = null;
  const waiters = [];

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type !== "state") return;
    latest = message.room;
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(latest)) continue;
      clearTimeout(waiter.timeout);
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(latest);
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
    waitFor(predicate, timeoutMs = 3000) {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timeout: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error(`Timed out waiting for state. Last phase: ${latest?.phase || "none"}`));
          }, timeoutMs)
        };
        waiters.push(waiter);
      });
    },
    close() {
      socket.close();
    }
  };
}
