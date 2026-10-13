import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/client.js", import.meta.url), "utf8");
const start = source.indexOf("function connect(tutorial,");
const end = source.indexOf("function socketEndpoint()", start);
assert.ok(start >= 0 && end > start);
const connectSource = source.slice(start, end);

function harness() {
  const sockets = [];
  const lines = [];
  const timers = [];
  class Socket {
    static OPEN = 1;
    readyState = 0;
    callbacks = new Map();
    sent = [];
    constructor() { sockets.push(this); }
    addEventListener(type, callback) { this.callbacks.set(type, callback); }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    close() { this.readyState = 3; }
    async emit(type, payload) {
      if (type === "open") this.readyState = 1;
      await this.callbacks.get(type)?.(type === "message" ? { data: JSON.stringify(payload) } : {});
    }
  }
  const classList = { add() {}, remove() {} };
  const context = {
    socket: null, reconnectTimer: null, reconnectAttempts: 0,
    returningToMenu: false, focusedAfterJoin: false, state: null,
    selfId: null, stateReceivedAt: 0, nameInput: { value: "TEST" }, roomInput: { value: "ABCDE" },
    joinButton: { disabled: false, textContent: "ВОЙТИ" }, tutorialButton: { disabled: false, textContent: "УЧЕБА" },
    connectionStatus: { textContent: "" }, document: { body: { classList } },
    bootScreen: { classList }, gameShell: { classList }, canvas: { focus() {} },
    performance, clearTimeout() {}, setTimeout(callback) { timers.push(callback); return timers.length; }, requestAnimationFrame: callback => callback(),
    dismissKeyboard() {}, socketEndpoint: () => "ws://local.test/socket", WebSocket: Socket,
    hubBridge: { ready: Promise.resolve(), leave() {}, update() {}, joinData: name => ({ name }) },
    updateTutorialGate() { context.joinButton.disabled = false; }, markTutorialComplete() {}, trackPlayerStats() {},
    audio: { sync() {} }, renderUi() {}, addClientLine: text => lines.push(text),
    send(payload) { if (!context.socket) return false; context.socket.send(JSON.stringify(payload)); return true; }
  };
  vm.runInNewContext(connectSource, context);
  return { context, sockets, lines, timers };
}

test("rejected joins close their socket and stale close events cannot overwrite the next attempt", async () => {
  const { context, sockets, lines } = harness();
  context.connect(false);
  const first = sockets[0];
  await first.emit("open");
  await first.emit("message", { type: "error", message: "Смена уже идёт — зайдите после неё" });
  assert.equal(context.socket, null);
  assert.equal(first.readyState, 3);
  assert.equal(context.joinButton.disabled, false);
  context.connect(false);
  const second = sockets[1];
  await first.emit("close");
  assert.equal(context.joinButton.disabled, true);
  assert.equal(context.connectionStatus.textContent, "ПОДКЛЮЧЕНИЕ К СЕРВЕРУ...");
  await second.emit("open");
  await first.emit("message", { type: "error", message: "STALE" });
  await second.emit("message", { type: "error", message: "Смена уже идёт — зайдите после неё" });
  await second.emit("close");
  assert.equal(context.connectionStatus.textContent, "Смена уже идёт — зайдите после неё");
  assert.deepEqual(lines, []);
});

test("superseded sockets cannot join, render state or unlock controls", async () => {
  const { context, sockets } = harness();
  context.connect(false);
  context.connect(false);
  const [first, second] = sockets;
  await first.emit("open");
  await first.emit("message", { type: "state", selfId: "STALE", room: {} });
  await first.emit("close");
  assert.equal(first.sent.length, 0);
  assert.equal(context.state, null);
  assert.equal(context.joinButton.disabled, true);
  await second.emit("open");
  assert.equal(second.sent[0].roomCode, "ABCDE");
});

test("verified reconnects keep the room and resend signed identity", async () => {
  const { context, sockets, timers } = harness();
  context.hubBridge.joinData = () => ({ name: "SIGNED", initData: "signed-data" });
  context.connect(false);
  await sockets[0].emit("open");
  await sockets[0].emit("message", { type: "state", selfId: "FIRST", room: { code: "FGHIJ", hubAuthenticated: true } });
  await sockets[0].emit("close");
  assert.equal(timers.length, 1);
  timers[0]();
  await sockets[1].emit("open");
  assert.equal(sockets[1].sent[0].roomCode, "FGHIJ");
  assert.equal(sockets[1].sent[0].initData, "signed-data");
  await sockets[0].emit("message", { type: "state", selfId: "STALE", room: {} });
  assert.equal(context.selfId, "FIRST");
});
