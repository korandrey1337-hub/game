import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createHubMatchReporter, verifyInitData } from "../hub.mjs";

const SECRET = "local-test-hub-secret";
const NOW = 2000000000;

export function signedInitData(id, secret = SECRET, authDate = Math.floor(Date.now() / 1000), extra = {}) {
  const params = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify({ id, first_name: "SIGNED", ...extra }) });
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const key = createHmac("sha256", "WebAppData").update(secret).digest();
  params.set("hash", createHmac("sha256", key).update(check).digest("hex"));
  return params.toString();
}

test("hub identity requires a valid Telegram-format signature and a recent human ID", () => {
  const valid = signedInitData(12345, SECRET, NOW);
  assert.equal(verifyInitData(valid, SECRET, NOW).id, 12345);
  for (const value of ["", valid.replace("12345", "54321"), valid + "&auth_date=1", "hash=nope", signedInitData(12345, SECRET, NOW - 86401), signedInitData(12345, SECRET, NOW + 301), signedInitData("12345", SECRET, NOW), signedInitData(12345, SECRET, NOW, { is_bot: true })]) {
    assert.equal(verifyInitData(value, SECRET, NOW), null);
  }
  assert.equal(verifyInitData(valid, "wrong-secret", NOW), null);
  assert.equal(verifyInitData(valid, undefined, NOW), null);
});

test("match reports sign the exact JSON, include unique humans and serialize start/end", async () => {
  const requests = [];
  let release;
  const first = new Promise(resolve => { release = resolve; });
  const report = createHubMatchReporter({ secret: SECRET, fetchImpl: async (url, options) => {
    requests.push({ url, ...options });
    if (requests.length === 1) await first;
    return { ok: true };
  } });
  const start = report("start", "room_ABCDE", [123, 123, undefined, "999", 456]);
  const end = report("end", "room_ABCDE");
  await Promise.resolve();
  assert.equal(requests.length, 1);
  release();
  assert.deepEqual(await Promise.all([start, end]), [true, true]);
  assert.deepEqual(requests.map(request => JSON.parse(request.body).event), ["start", "end"]);
  assert.deepEqual(JSON.parse(requests[0].body).players, [123, 456]);
  assert.equal(JSON.parse(requests[1].body).players, undefined);
  for (const request of requests) {
    assert.equal(request.url, "https://chat.hubbo.ru/api/game/match");
    assert.equal(request.method, "POST");
    assert.equal(request.headers["X-Hub-Signature"], createHmac("sha256", SECRET).update(request.body).digest("hex"));
    assert.equal(JSON.parse(request.body).game, "corebelow");
    assert.ok(request.signal instanceof AbortSignal);
  }
});

test("missing identity or secret skips reports; hub failures never reject gameplay", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error("offline"); };
  const warnings = [];
  const report = createHubMatchReporter({ secret: SECRET, fetchImpl, warn: (...args) => warnings.push(args) });
  assert.equal(await report("start", "room_ABCDE", []), false);
  assert.equal(await createHubMatchReporter({ fetchImpl })("start", "room_ABCDE", [123]), false);
  assert.equal(calls, 0);
  assert.equal(await report("start", "room_ABCDE", [123]), false);
  assert.equal(warnings.length, 1);
  const rejected = createHubMatchReporter({ secret: SECRET, fetchImpl: async () => ({ ok: false, status: 403 }), warn: () => {} });
  assert.equal(await rejected("end", "room_ABCDE"), false);
});
