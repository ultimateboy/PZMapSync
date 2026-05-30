const fs = require("node:fs");
const path = require("node:path");

const DEBUG_URL = process.env.PZMAPSYNC_DEBUG_URL || "http://127.0.0.1:9223";
const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = process.env.PZMAPSYNC_SNAPSHOT ||
  path.join(ROOT, "extension/public/fixtures/mock-snapshot.json");
const INTERVAL_MS = Number(process.env.PZMAPSYNC_STREAM_INTERVAL || 250);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) {
      return;
    }

    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(JSON.stringify(message.error)));
    } else {
      resolve(message.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const message = { id: ++id, method, params };
        pending.set(message.id, { resolve, reject });
        ws.send(JSON.stringify(message));
      });
    },
    close() {
      ws.close();
    }
  };
}

async function findPage() {
  const tabs = await fetch(`${DEBUG_URL}/json/list`).then((response) => response.json());
  return tabs.find((target) => target.type === "page" && target.url.includes("b42map.com")) ||
    tabs.find((target) => target.type === "page");
}

async function main() {
  const page = await findPage();
  if (!page) {
    throw new Error("No Chrome page target found.");
  }

  const css = fs.readFileSync(path.join(ROOT, "extension/src/content/overlay.css"), "utf8");
  const bridge = fs.readFileSync(path.join(ROOT, "extension/src/content/page-bridge.js"), "utf8");
  const client = await connect(page);

  await client.send("Runtime.enable");
  await client.send("Page.enable");
  if (!page.url.includes("b42map.com")) {
    await client.send("Page.navigate", { url: "https://b42map.com/" });
    await wait(7000);
  }

  await client.send("Runtime.evaluate", {
    expression: `(() => {
      let style = document.querySelector("#pzmapsync-test-style");
      if (!style) {
        style = document.createElement("style");
        style.id = "pzmapsync-test-style";
        document.documentElement.appendChild(style);
      }
      style.textContent = ${JSON.stringify(css)};
    })()`
  });

  await client.send("Runtime.evaluate", {
    expression: bridge
  });

  console.log(`Streaming ${SNAPSHOT_PATH} to ${page.url}`);
  console.log("Press Ctrl+C to stop.");

  let lastSequence = null;
  setInterval(async () => {
    try {
      const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
      if (snapshot.sequence === lastSequence) {
        return;
      }

      lastSequence = snapshot.sequence;
      await client.send("Runtime.evaluate", {
        expression: `window.dispatchEvent(new CustomEvent("PZMapSync:snapshot", { detail: ${JSON.stringify(snapshot)} }));`
      });
      const player = snapshot.players[0];
      process.stdout.write(`\rSequence ${snapshot.sequence}: ${player.x}, ${player.y} ${player.direction}   `);
    } catch (error) {
      process.stdout.write(`\rStream error: ${error.message}   `);
    }
  }, INTERVAL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
