import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const url = `http://127.0.0.1:${process.env.PORT || 4173}/assets/core-below-intro.mp4`;
const source = await readFile(new URL("../public/assets/core-below-intro.mp4", import.meta.url));
const full = await fetch(url);
assert.equal(full.status, 200);
assert.equal(full.headers.get("content-type"), "video/mp4");
assert.equal(full.headers.get("accept-ranges"), "bytes");
assert.deepEqual(Buffer.from(await full.arrayBuffer()), source);

for (const [range, start, end] of [
  ["bytes=0-1", 0, 1],
  ["bytes=100-199", 100, 199],
  ["bytes=-16", source.length - 16, source.length - 1],
  [`bytes=${source.length - 16}-`, source.length - 16, source.length - 1]
]) {
  const response = await fetch(url, { headers: { Range: range } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), `bytes ${start}-${end}/${source.length}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), source.subarray(start, end + 1));
}
for (const range of ["bytes=-0", "bytes=50-10", `bytes=${source.length}-`, "bytes=bad"]) {
  const response = await fetch(url, { headers: { Range: range } });
  assert.equal(response.status, 416);
  assert.equal(response.headers.get("content-range"), `bytes */${source.length}`);
  await response.arrayBuffer();
}
const head = await fetch(url, { method: "HEAD" });
assert.equal(head.status, 200);
assert.equal(Number(head.headers.get("content-length")), source.length);
assert.equal((await head.arrayBuffer()).byteLength, 0);
console.log("Intro smoke test passed: video, byte ranges, invalid ranges and HEAD work.");
