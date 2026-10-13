import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const SECRET = "local-integration-secret";
function identity(id) {
  const data = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: `USER-${id}` }) });
  const check = [...data].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const key = createHmac("sha256", "WebAppData").update(SECRET).digest();
  data.set("hash", createHmac("sha256", key).update(check).digest("hex"));
  return data.toString();
}

test("signed players recover roles, outsiders stay blocked and match events follow each room", async t => {
  const requests = [];
  const clients = [];
  const child = fork(fileURLToPath(new URL("../server.mjs", import.meta.url)), [], {
    env: { ...process.env, PORT: "0", HUB_GAME_SECRET: SECRET },
    execArgv: ["--import", new URL("./fixtures/hub-fetch.mjs", import.meta.url).href],
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  t.after(async () => {
    for (const client of clients) client.close();
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.kill();
      await exited;
    }
  });
  child.on("message", message => { if (message.type === "hub-request") requests.push(message); });
  const port = await new Promise((resolve, reject) => {
    let output = "";
    let diagnostics = "";
    child.stderr.on("data", chunk => { diagnostics += chunk; });
    const timeout = setTimeout(() => reject(new Error(`Hub test server did not start: ${diagnostics}`)), 10000);
    child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Hub test server exited (${code}): ${diagnostics}`)); });
    child.once("error", reject);
    child.stdout.on("data", chunk => {
      output += chunk;
      const match = output.match(/running at http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
  });
  const join = async (id, code, extra = {}) => {
    const client = await connect(port);
    clients.push(client);
    client.send({ type: "join", name: "UNTRUSTED-NAME", initData: id ? identity(id) : undefined, roomCode: code, ...extra });
    await client.waitFor(room => Boolean(room));
    return client;
  };

  const operator = await join(101);
  const code = operator.latest().code;
  const lookout = await join(102, code);
  const scribe = await join(103, code);
  const observer = await join(104, code);
  const anonymous = await join(null, code, { tgId: 999 });
  assert.equal(operator.latest().hubAuthenticated, true);
  assert.equal(anonymous.latest().hubAuthenticated, false);
  assert.equal(operator.ownPlayer().nick, "USER-101");
  assert.equal(operator.ownPlayer().tgId, undefined);
  operator.send({ type: "start" });
  await scribe.waitFor(room => room.phase === "playing");
  await until(() => requests.length === 1);
  assert.deepEqual(JSON.parse(requests[0].body).players, [101, 102, 103, 104]);
  assert.equal(JSON.parse(requests[0].body).room, `room_${code}`);

  const outsider = await connect(port);
  clients.push(outsider);
  const denial = outsider.error();
  outsider.send({ type: "join", roomCode: code, initData: identity(999) });
  assert.match(await denial, /Смена уже идёт/);
  assert.equal(outsider.latest(), null);

  scribe.send({ type: "input", input: { right: true } });
  await new Promise(resolve => setTimeout(resolve, 120));
  scribe.send({ type: "input", input: {} });
  const position = scribe.ownPlayer();
  scribe.close();
  await lookout.waitFor(room => room.players.length === 4);
  const forged = outsider.error();
  outsider.send({ type: "join", roomCode: code, tgId: 103, initData: identity(103).replace("USER", "FAKE") });
  assert.match(await forged, /Смена уже идёт/);
  const returned = await join(103, code);
  assert.equal(returned.ownPlayer().role, "scribe");
  assert.ok(Math.abs(returned.ownPlayer().x - position.x) <= 10);
  assert.equal(returned.latest().shiftId, lookout.latest().shiftId);
  assert.equal(requests.length, 1);

  const replacement = await join(104, code);
  assert.equal(replacement.ownPlayer().role, "observer");
  await lookout.waitFor(room => room.players.length === 5);
  assert.equal(lookout.latest().players.filter(player => player.nick === "USER-104").length, 1);
  observer.close();

  const tutorial = await join(105, code, { tutorial: true });
  assert.equal(tutorial.latest().tutorial, true);
  assert.equal(tutorial.latest().hubAuthenticated, false);
  assert.equal(requests.length, 1);
  tutorial.close();

  const secondOperator = await join(201);
  const secondCode = secondOperator.latest().code;
  await join(202, secondCode);
  await join(203, secondCode);
  secondOperator.send({ type: "start" });
  await until(() => requests.length === 2);
  assert.equal(JSON.parse(requests[1].body).room, `room_${secondCode}`);
  assert.deepEqual(JSON.parse(requests[1].body).players, [201, 202, 203]);

  lookout.send({ type: "interact", action: "scan" });
  await lookout.waitFor(room => room.puzzleView?.scanner?.readings);
  const scanner = lookout.latest().puzzleView.scanner;
  const healthy = scanner.readings.find(reading => reading.value >= scanner.normalMin && reading.value <= scanner.normalMax);
  for (let count = 1; count <= 6; count += 1) {
    lookout.send({ type: "interact", action: "route", station: healthy.station });
    await lookout.waitFor(room => room.mistakes === count);
  }
  await until(() => requests.length === 3);
  assert.equal(JSON.parse(requests[2].body).event, "end");
  assert.equal(JSON.parse(requests[2].body).room, `room_${code}`);
  assert.equal(JSON.parse(requests[2].body).players, undefined);
  operator.send({ type: "start" });
  await until(() => requests.length === 4);
  assert.equal(JSON.parse(requests[3].body).event, "start");
  assert.deepEqual(JSON.parse(requests[3].body).players.sort(), [101, 102, 103, 104]);
  for (const request of requests) {
    assert.equal(request.headers["X-Hub-Signature"], createHmac("sha256", SECRET).update(request.body).digest("hex"));
  }
});

async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for hub report");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

async function connect(port) {
  const socket = new WebSocket(`http://127.0.0.1:${port}/socket`);
  let latest = null;
  let ownId;
  const waiters = [];
  const errors = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "state") {
      latest = message.room;
      ownId = message.selfId;
      for (const waiter of [...waiters]) if (waiter.predicate(latest)) waiter.resolve(latest);
    }
    if (message.type === "error") errors.shift()?.(message.message);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return {
    send: payload => socket.send(JSON.stringify(payload)),
    close: () => socket.close(),
    latest: () => latest,
    ownPlayer: () => latest.players.find(player => player.id === ownId),
    error: () => new Promise(resolve => errors.push(resolve)),
    waitFor(predicate) {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for hub game state")), 5000);
        const waiter = { predicate, resolve(value) {
          clearTimeout(timeout);
          waiters.splice(waiters.indexOf(waiter), 1);
          resolve(value);
        } };
        waiters.push(waiter);
      });
    }
  };
}
