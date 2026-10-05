import { writeFile } from "node:fs/promises";

const [widthArg, heightArg, outputPath, telegramArg = "false", playerCountArg = "2", stateArg = "play"] =
  process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);

if (!width || !height || !outputPath) {
  throw new Error("Usage: node capture-responsive.mjs <width> <height> <output.png> [telegram]");
}

const target = await fetch(
  `http://127.0.0.1:9223/json/new?${encodeURIComponent("http://127.0.0.1:5174/?qa=1")}`,
  { method: "PUT" },
).then((response) => response.json());

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: width,
  screenHeight: height,
  screenOrientation: {
    type: width > height ? "landscapePrimary" : "portraitPrimary",
    angle: width > height ? 90 : 0,
  },
});
await send("Page.navigate", { url: "http://127.0.0.1:5174/?qa=1" });
await new Promise((resolve) => setTimeout(resolve, 3200));

await send("Runtime.evaluate", {
  expression: `
    const playerCount = document.querySelector("#player-count");
    playerCount.value = ${JSON.stringify(playerCountArg)};
    playerCount.dispatchEvent(new Event("change", { bubbles: true }));
  `,
});
await new Promise((resolve) => setTimeout(resolve, 250));

if (telegramArg === "telegram") {
  await send("Runtime.evaluate", {
    expression: `
      document.documentElement.classList.add("is-telegram");
      document.documentElement.style.setProperty("--tg-hud-top", "92px");
      window.dispatchEvent(new Event("resize"));
    `,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

if (stateArg === "gameover") {
  await send("Runtime.evaluate", {
    expression: `document.querySelector(".app-shell").dataset.gameOver = "true";`,
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
}

if (stateArg === "tutorial") {
  await send("Runtime.evaluate", {
    expression: `document.querySelector("#tutorial-open").click();`,
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
}

const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
socket.close();
await fetch(`http://127.0.0.1:9223/json/close/${target.id}`);
