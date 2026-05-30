const fs = require("node:fs");

const DEBUG_URL = process.env.PZMAPSYNC_DEBUG_URL || "http://127.0.0.1:9223";
const SCREENSHOT_PATH = process.env.PZMAPSYNC_SCREENSHOT || "extension-overlay-test.png";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
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
  const page = tabs.find((tab) => tab.type === "page" && tab.url.includes("b42map.com")) ||
    tabs.find((tab) => tab.type === "page");
  if (!page) {
    throw new Error("Could not find a page in Chrome's debugging target list.");
  }

  const client = await connect(page.webSocketDebuggerUrl);
  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    if (!page.url.includes("b42map.com")) {
      await client.send("Page.navigate", { url: "https://b42map.com/" });
      await wait(5000);
    }
    await client.send("Page.reload", { ignoreCache: true });
    await wait(8000);

    const expression = `(() => {
      const status = document.querySelector("#pzmapsync-status");
      const pins = [...document.querySelectorAll(".pzmapsync-pin")].map((node) => ({
        id: node.dataset.pzmapsyncId,
        hidden: node.hidden,
        text: node.textContent,
        transform: node.style.transform
      }));
      return {
        status: status && status.textContent,
        statusError: status && status.dataset.error,
        pinCount: pins.length,
        pins,
        hasRoot: Boolean(document.querySelector("#pzmapsync-overlay-root")),
        hasBridge: Boolean(document.querySelector("#pzmapsync-page-bridge")),
        pageGlobalType: typeof window.g,
        url: location.href
      };
    })()`;

    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true
    });
    const value = result.result.value;
    console.log(JSON.stringify(value, null, 2));

    if (!value.hasRoot || !value.hasBridge || value.pinCount < 1) {
      throw new Error("PZMapSync overlay did not render expected DOM.");
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
