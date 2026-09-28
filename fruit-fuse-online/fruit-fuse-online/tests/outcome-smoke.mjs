import assert from "node:assert/strict";

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

send({ type: "join", name: "FAILURE-SMOKE", tutorial: true });
await waitFor(room => room.tutorial && room.phase === "playing");
await move({ up: true }, 900);

for (const [index, slot] of [1, 3, 4].entries()) {
  send({ type: "interact", module: "wires", slot });
  await waitFor(room => room.mistakes === index + 1);
}

await waitFor(room => room.phase === "lost");
assert.equal(latest.outcomeReason, "mistakes");
assert.equal(latest.mistakes, 3);
assert.equal(latest.timer, 0);
assert.ok(latest.outcomeAgeMs >= 0);
console.log("Outcome smoke test passed: three mistakes destroy the reactor.");
socket.close();

function send(payload) {
  socket.send(JSON.stringify(payload));
}

async function move(direction, duration) {
  send({ type: "input", input: direction });
  await delay(duration);
  send({ type: "input", input: {} });
  await delay(120);
}

function waitFor(predicate, timeoutMs = 3000) {
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
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
