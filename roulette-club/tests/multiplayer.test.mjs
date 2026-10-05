import assert from "node:assert/strict";
import test from "node:test";

import { createRouletteServer } from "../server.mjs";

test("online room synchronizes turns and keeps the chamber secret", async (context) => {
  const app = createRouletteServer();
  const address = await app.listen(0, "127.0.0.1");
  const endpoint = `ws://127.0.0.1:${address.port}/socket`;
  const host = await connect(endpoint);
  const guest = await connect(endpoint);

  context.after(async () => {
    host.close();
    guest.close();
    await app.close();
  });

  host.send({ type: "join", create: true, name: "Аня", playerCount: 2, weaponSkin: "revolver" });
  const hostWelcome = await host.next((message) => message.type === "welcome");
  const roomCode = hostWelcome.roomCode;
  assert.match(roomCode, /^[A-Z0-9]{5}$/);

  guest.send({ type: "join", roomCode, name: "Борис" });
  await guest.next((message) => message.type === "welcome");
  const joined = await guest.next((message) => message.type === "state" && message.room.players.length === 2);
  assert.equal(joined.room.players[1].name, "Борис");

  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  await host.next((message) => message.type === "state" && message.room.canStart);
  host.send({ type: "start" });

  const hostGame = await host.next((message) => message.type === "state" && message.room.phase === "playing");
  const guestGame = await guest.next((message) => message.type === "state" && message.room.phase === "playing");
  assert.equal(Object.hasOwn(hostGame.room.game, "shells"), false);
  assert.equal(Object.hasOwn(guestGame.room.game, "shells"), false);
  assert.equal(hostGame.room.game.players[0].isHuman, true);
  assert.equal(guestGame.room.game.players[1].isHuman, true);

  const room = app.rooms.get(roomCode);
  host.send({ type: "action", action: "shoot", targetId: "p1" });
  const introLocked = await host.next((message) => message.type === "error");
  assert.match(introLocked.message, /ход ещё заканчивается/i);
  room.lockUntil = 0;
  room.game.state.players[0].items = ["tarot"];
  room.game.state.shells = ["live", "blank"];
  host.send({ type: "action", action: "item", itemId: "tarot" });
  const hostPeek = await host.next((message) => message.type === "state" && message.room.game?.lastEvent?.itemId === "tarot");
  const guestPeek = await guest.next((message) => message.type === "state" && message.room.game?.lastEvent?.itemId === "tarot");
  assert.equal(hostPeek.room.game.peekedShell, "live");
  assert.equal(guestPeek.room.game.peekedShell, null);
  assert.equal(Object.hasOwn(guestPeek.room.game.lastEvent, "peekedShell"), false);
  assert.equal(guestPeek.room.game.log.some((entry) => entry.includes("следующий заряд")), false);

  host.send({ type: "action", action: "shoot", targetId: "p1" });
  const afterShot = await guest.next((message) => message.type === "state" && message.room.game?.lastEvent?.type === "shot");
  assert.equal(afterShot.room.game.currentPlayerId, "p1");
  assert.equal(afterShot.room.game.players[1].hp, 3);

  guest.send({ type: "action", action: "shoot", targetId: "p0" });
  const lockedAction = await guest.next((message) => message.type === "error");
  assert.match(lockedAction.message, /ход ещё заканчивается/i);
});

test("four-player room starts together and restores a disconnected seat", async (context) => {
  const app = createRouletteServer();
  const address = await app.listen(0, "127.0.0.1");
  const endpoint = `ws://127.0.0.1:${address.port}/socket`;
  const clients = await Promise.all(Array.from({ length: 4 }, () => connect(endpoint)));
  let reconnected = null;

  context.after(async () => {
    for (const client of clients) client.close();
    reconnected?.close();
    await app.close();
  });

  clients[0].send({ type: "join", create: true, name: "Хост", playerCount: 4, weaponSkin: "shotgun" });
  const hostWelcome = await clients[0].next((message) => message.type === "welcome");
  const welcomes = [hostWelcome];

  for (let index = 1; index < clients.length; index += 1) {
    clients[index].send({ type: "join", roomCode: hostWelcome.roomCode, name: `Игрок ${index + 1}` });
    welcomes[index] = await clients[index].next((message) => message.type === "welcome");
  }

  await clients[0].next((message) => message.type === "state" && message.room.players.length === 4);
  for (const client of clients) client.send({ type: "ready", ready: true });
  await clients[0].next((message) => message.type === "state" && message.room.canStart);
  clients[0].send({ type: "start" });

  const started = await Promise.all(clients.map((client) => client.next(
    (message) => message.type === "state" && message.room.phase === "playing",
  )));
  for (const [index, message] of started.entries()) {
    assert.equal(message.room.game.playerCount, 4);
    assert.equal(message.room.game.weaponSkin, "shotgun");
    assert.equal(message.room.game.players[index].isHuman, true);
    assert.equal(Object.hasOwn(message.room.game, "shells"), false);
  }

  clients[2].close();
  reconnected = await connect(endpoint);
  reconnected.send({
    type: "join",
    roomCode: hostWelcome.roomCode,
    name: "Игрок 3",
    resumeToken: welcomes[2].resumeToken,
  });
  const resumeWelcome = await reconnected.next((message) => message.type === "welcome");
  const resumedState = await reconnected.next((message) => message.type === "state" && message.room.phase === "playing");
  assert.equal(resumeWelcome.playerId, welcomes[2].playerId);
  assert.equal(resumedState.room.selfId, welcomes[2].playerId);
  assert.equal(resumedState.room.players[2].connected, true);

  clients[0].close();
  const migrated = await clients[1].next(
    (message) => message.type === "state" && message.room.players.some((player) => player.id === "p1" && player.isHost),
  );
  assert.equal(migrated.room.isHost, true);
});

test("malformed static URL returns 400 without stopping the server", async (context) => {
  const app = createRouletteServer();
  const address = await app.listen(0, "127.0.0.1");
  context.after(() => app.close());

  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${base}/%E0%A4%A`);
  assert.equal(response.status, 400);
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
});

test("lobby seats compact after a player leaves and a smaller match can start", async (context) => {
  const app = createRouletteServer();
  const address = await app.listen(0, "127.0.0.1");
  const endpoint = `ws://127.0.0.1:${address.port}/socket`;
  const clients = await Promise.all(Array.from({ length: 3 }, () => connect(endpoint)));

  context.after(async () => {
    for (const client of clients) client.close();
    await app.close();
  });

  clients[0].send({ type: "join", create: true, name: "Хост", playerCount: 4 });
  const created = await clients[0].next((message) => message.type === "welcome");
  for (let index = 1; index < clients.length; index += 1) {
    clients[index].send({ type: "join", roomCode: created.roomCode, name: `Игрок ${index + 1}` });
    await clients[index].next((message) => message.type === "welcome");
  }
  await clients[0].next((message) => message.type === "state" && message.room.players.length === 3);

  clients[0].send({ type: "leave" });
  const compacted = await clients[1].next(
    (message) => message.type === "state" && message.room.players.length === 2 && message.room.selfId === "p0",
  );
  assert.deepEqual(compacted.room.players.map((player) => player.id), ["p0", "p1"]);
  assert.equal(compacted.room.isHost, true);

  clients[1].send({ type: "configure", playerCount: 2 });
  clients[1].send({ type: "ready", ready: true });
  clients[2].send({ type: "ready", ready: true });
  await clients[1].next((message) => message.type === "state" && message.room.canStart);
  clients[1].send({ type: "start" });
  const started = await clients[2].next((message) => message.type === "state" && message.room.phase === "playing");
  assert.equal(started.room.game.playerCount, 2);
  assert.equal(started.room.selfId, "p1");
});

function connect(endpoint) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const queue = [];
    const waiters = [];
    const timeout = setTimeout(() => reject(new Error("WebSocket connection timeout")), 3000);

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const waiterIndex = waiters.findIndex((waiter) => waiter.predicate(message));
      if (waiterIndex >= 0) {
        const [waiter] = waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(message);
      } else {
        queue.push(message);
      }
    });
    socket.addEventListener("error", reject, { once: true });
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve({
        send(payload) {
          socket.send(JSON.stringify(payload));
        },
        next(predicate = () => true, timeoutMs = 3000) {
          const queueIndex = queue.findIndex(predicate);
          if (queueIndex >= 0) return Promise.resolve(queue.splice(queueIndex, 1)[0]);
          return new Promise((resolveMessage, rejectMessage) => {
            const waiter = {
              predicate,
              resolve: resolveMessage,
              timeout: setTimeout(() => {
                const index = waiters.indexOf(waiter);
                if (index >= 0) waiters.splice(index, 1);
                rejectMessage(new Error("Timed out waiting for WebSocket message"));
              }, timeoutMs),
            };
            waiters.push(waiter);
          });
        },
        close() {
          socket.close();
        },
      });
    }, { once: true });
  });
}
