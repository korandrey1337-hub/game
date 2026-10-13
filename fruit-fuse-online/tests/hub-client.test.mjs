import test from "node:test";
import assert from "node:assert/strict";
import { createHubBridge, hubStartRoom } from "../public/hub-integration.js";

test("hub context supplies signed join data and room invites without leaking a server secret", async () => {
  const calls = [];
  let callback;
  const hub = { inHub: true, start: "room_ABCDE", ready: fn => { callback = fn; }, room: code => calls.push(["room", code]), invite: (...args) => calls.push(["invite", ...args]) };
  const bridge = createHubBridge(hub);
  callback({ initData: "signed-init-data", user: { first_name: "Анна" } });
  await bridge.ready;
  assert.deepEqual(bridge.joinData("fallback"), { name: "Анна", initData: "signed-init-data" });
  assert.equal(bridge.startRoom, "ABCDE");
  bridge.update({ code: "ABCDE", hubAuthenticated: true, phase: "lobby" });
  bridge.update({ code: "ABCDE", hubAuthenticated: true, phase: "playing" });
  bridge.update({ code: "ABCDE", hubAuthenticated: true, phase: "won" });
  assert.deepEqual(calls, [["room", "room_ABCDE"]]);
  assert.equal(bridge.invite("ABCDE"), true);
  assert.equal(calls[1][1], "room_ABCDE");
  bridge.leave();
  bridge.leave();
  assert.deepEqual(calls.at(-1), ["room", ""]);
  assert.equal(calls.length, 3);
});

test("standalone, unsigned and tutorial sessions never enter hub voice", async () => {
  assert.equal(hubStartRoom("corebelow__room_ABCDE"), "ABCDE");
  for (const value of ["room_abcde", "room_ABCDEF", "other__room_ABCDE", "room_<tag>"]) assert.equal(hubStartRoom(value), "");
  const outside = createHubBridge(undefined);
  await outside.ready;
  assert.deepEqual(outside.joinData("STAЖЁР"), { name: "STAЖЁР" });
  assert.equal(outside.invite("ABCDE"), false);
  const calls = [];
  const bridge = createHubBridge({ inHub: true, ready: cb => cb({ initData: "test" }), room: code => calls.push(code) });
  bridge.update({ code: "ABCDE", hubAuthenticated: false });
  bridge.update({ code: "ABCDE", hubAuthenticated: true, tutorial: true });
  assert.deepEqual(calls, []);
  bridge.update({ code: "ABCDE", hubAuthenticated: true });
  bridge.update({ code: "FGHIJ", hubAuthenticated: true });
  bridge.update({ code: "FGHIJ", hubAuthenticated: true, tutorial: true });
  assert.deepEqual(calls, ["room_ABCDE", "room_FGHIJ", ""]);
});

test("SDK errors do not break standalone gameplay", async () => {
  const bridge = createHubBridge({ inHub: true, ready: () => { throw new Error("not available"); }, room: () => { throw new Error("offline"); } }, { warn: () => {} });
  await bridge.ready;
  assert.doesNotThrow(() => bridge.update({ code: "ABCDE", hubAuthenticated: true }));
});
