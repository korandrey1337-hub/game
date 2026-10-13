import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyInitData(raw, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof raw !== "string" || !raw || raw.length > 16384) return null;
  try {
    const data = new URLSearchParams(raw);
    if (new Set(data.keys()).size !== data.size) return null;
    const hash = data.get("hash");
    if (!/^[a-f0-9]{64}$/i.test(hash || "")) return null;
    data.delete("hash");
    const check = [...data.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, value]) => `${key}=${value}`).join("\n");
    const key = createHmac("sha256", "WebAppData").update(secret).digest();
    const expected = createHmac("sha256", key).update(check).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;
    const issued = Number(data.get("auth_date"));
    if (!Number.isInteger(issued) || issued <= 0 || issued > now + 300 || now - issued > 86400) return null;
    const user = JSON.parse(data.get("user") || "null");
    if (!Number.isSafeInteger(user?.id) || user.id <= 0 || user.is_bot === true) return null;
    return user;
  } catch {
    return null;
  }
}

export function createHubMatchReporter({ secret, fetchImpl = fetch, warn = console.warn } = {}) {
  const queues = new Map();
  return (event, room, players = []) => {
    if (!secret || !["start", "end"].includes(event) || !/^room_[A-Z0-9]{5}$/.test(room)) return Promise.resolve(false);
    const ids = [...new Set(players.filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 64);
    if (event === "start" && !ids.length) return Promise.resolve(false);
    const body = { game: "corebelow", room, event, ts: Math.floor(Date.now() / 1000) };
    if (event === "start") body.players = ids;
    const raw = JSON.stringify(body);
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    // Preserve start/end order even if a shift ends before the first request completes.
    const pending = (queues.get(room) || Promise.resolve()).then(async () => {
      try {
        const response = await fetchImpl("https://chat.hubbo.ru/api/game/match", {
          method: "POST", body: raw, signal: AbortSignal.timeout(5000),
          headers: { "Content-Type": "application/json", "X-Hub-Signature": signature }
        });
        if (!response.ok) warn("[hub] match", event, room, response.status);
        return response.ok;
      } catch (error) {
        warn("[hub] match", event, room, error.message);
        return false;
      }
    });
    queues.set(room, pending);
    void pending.then(() => { if (queues.get(room) === pending) queues.delete(room); });
    return pending;
  };
}
