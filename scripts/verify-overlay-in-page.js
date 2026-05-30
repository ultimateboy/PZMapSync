const fs = require("node:fs");
const path = require("node:path");

const DEBUG_URL = process.env.PZMAPSYNC_DEBUG_URL || "http://127.0.0.1:9223";
const ROOT = path.resolve(__dirname, "..");
const SCREENSHOT_PATH = path.join(ROOT, "extension-overlay-test.png");

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

async function main() {
  const tabs = await fetch(`${DEBUG_URL}/json/list`).then((response) => response.json());
  const page = tabs.find((target) => target.type === "page");
  if (!page) {
    throw new Error("No Chrome page target found.");
  }

  const css = fs.readFileSync(path.join(ROOT, "extension/src/content/overlay.css"), "utf8");
  const bridge = fs.readFileSync(path.join(ROOT, "extension/src/content/page-bridge.js"), "utf8");
  const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, "extension/public/fixtures/mock-snapshot.json"), "utf8"));

  const client = await connect(page);
  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Page.navigate", { url: "https://b42map.com/" });
    await wait(7000);

    await client.send("Runtime.evaluate", {
      expression: `(() => {
        const style = document.createElement("style");
        style.id = "pzmapsync-test-style";
        style.textContent = ${JSON.stringify(css)};
        document.documentElement.appendChild(style);
      })()`
    });

    await client.send("Runtime.evaluate", {
      expression: bridge
    });

    await client.send("Runtime.evaluate", {
      expression: `window.dispatchEvent(new CustomEvent("PZMapSync:snapshot", { detail: ${JSON.stringify(snapshot)} }));`
    });

    await wait(3000);

    const result = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const status = document.querySelector("#pzmapsync-status");
        const pins = [...document.querySelectorAll(".pzmapsync-pin")].map((node) => ({
          id: node.dataset.pzmapsyncId,
          hidden: node.hidden,
          text: node.textContent,
          transform: node.style.transform,
          rect: (() => {
            const r = node.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          })()
        }));
        return {
          status: status && status.textContent,
          statusError: status && status.dataset.error,
          pinCount: pins.length,
          pins,
          hasRoot: Boolean(document.querySelector("#pzmapsync-overlay-root")),
          pageGlobalType: typeof window.g,
          url: location.href
        };
      })()`,
      returnByValue: true
    });

    const value = result.result.value;
    console.log(JSON.stringify(value, null, 2));

    if (!value.hasRoot || value.pinCount < 5) {
      throw new Error("Mock overlay did not render all expected pins.");
    }

    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false
    });
    fs.writeFileSync(SCREENSHOT_PATH, Buffer.from(screenshot.data, "base64"));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
