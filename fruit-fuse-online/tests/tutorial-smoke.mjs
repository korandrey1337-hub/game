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

send({ type: "join", name: "SMOKE", tutorial: true });
await waitFor(room => room.tutorial && room.phase === "playing" && room.puzzleView?.role === "lookout");

assert.ok(latest.puzzleView.scanner);
assert.equal(latest.puzzleView.training, undefined);

send({ type: "tutorialRole", role: "scribe" });
await waitFor(room => room.puzzleView?.role === "scribe");
assert.ok(latest.puzzleView.manual);
send({ type: "symbol", tokens: ["🟦", "2"] });
await waitFor(room => room.logs.some(log => log.tone === "symbol" && log.text.includes("🟦 2")));

send({ type: "tutorialRole", role: "operator" });
await waitFor(room => room.puzzleView?.role === "operator" && room.puzzleView?.training);

assert.equal(latest.puzzleView.training.wireSlot, 2);
assert.deepEqual(latest.puzzleView.training.glyphSlots, [3, 1, 2]);

await move({ up: true }, 900);
assert.equal(latest.players[0].facing, "up");
assert.equal(latest.players[0].moving, false);
const actionSeqBeforeTerminal = latest.players[0].actionSeq;
send({ type: "interact", module: "wires", slot: 2 });
await waitFor(room => room.players[0].action === "wires");
assert.equal(latest.players[0].actionSeq, actionSeqBeforeTerminal + 1);
assert.ok(latest.players[0].actionAgeMs >= 0);
await waitFor(room => room.puzzleView.progress.wiresSolved);

await move({ right: true }, 3300);
assert.equal(latest.players[0].facing, "right");
for (const slot of [3, 1, 2]) {
  send({ type: "interact", module: "glyphs", slot });
  await delay(90);
}
await waitFor(room => room.puzzleView.progress.glyphsSolved);

await move({ left: true, down: true }, 2200);
for (let count = 0; count < 3; count += 1) send({ type: "interact", module: "coolant", action: "cycle", label: "A" });
send({ type: "interact", module: "coolant", action: "cycle", label: "B" });
for (let count = 0; count < 2; count += 1) send({ type: "interact", module: "coolant", action: "cycle", label: "C" });
await delay(120);
send({ type: "interact", module: "coolant", action: "commit" });
await waitFor(room => room.phase === "won");

assert.equal(latest.mistakes, 0);
assert.equal(latest.outcomeReason, "stabilized");
assert.ok(latest.outcomeAgeMs >= 0);
assert.ok(latest.timer > 0);
console.log("Tutorial smoke test passed: all three modules solved.");
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
