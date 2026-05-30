(function initPZMapSyncContentScript() {
  const BRIDGE_ID = "pzmapsync-page-bridge";
  const SNAPSHOT_EVENT = "PZMapSync:snapshot";
  const STATUS_EVENT = "PZMapSync:status";
  const READY_EVENT = "PZMapSync:ready";
  const LIVE_POLL_MS = 250;
  const MOCK_POLL_MS = 1000;

  let latestSnapshot = null;
  let bridgeReady = false;
  let latestSequence = null;
  let useMockFallback = false;

  function injectBridge() {
    if (document.getElementById(BRIDGE_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = BRIDGE_ID;
    script.src = chrome.runtime.getURL("src/content/page-bridge.js");
    script.async = false;
    (document.documentElement || document.head).appendChild(script);
  }

  async function loadMockSnapshot() {
    const url = new URL(chrome.runtime.getURL("public/fixtures/mock-snapshot.json"));
    url.searchParams.set("t", String(Date.now()));
    const response = await fetch(url.href, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load mock snapshot: ${response.status}`);
    }
    return response.json();
  }

  function sendSnapshot(snapshot) {
    if (!snapshot || snapshot.sequence === latestSequence) {
      return;
    }

    latestSequence = snapshot.sequence;
    latestSnapshot = snapshot;
    if (!bridgeReady) {
      return;
    }

    window.dispatchEvent(new CustomEvent(SNAPSHOT_EVENT, {
      detail: snapshot
    }));
  }

  function sendStatus(status) {
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, {
      detail: status
    }));
  }

  window.addEventListener(READY_EVENT, () => {
    bridgeReady = true;
    if (latestSnapshot) {
      sendSnapshot(latestSnapshot);
    }
  });

  injectBridge();

  async function loadLiveSnapshot() {
    const response = await chrome.runtime.sendMessage({
      type: "PZMapSync:getSnapshot"
    });

    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Native host did not return a snapshot");
    }

    return response.snapshot;
  }

  async function pollLiveSnapshot() {
    try {
      const snapshot = await loadLiveSnapshot();
      useMockFallback = false;
      sendStatus({
        mode: "live",
        ok: true,
        path: snapshot && snapshot.__sourcePath
      });
      sendSnapshot(snapshot);
    } catch (error) {
      sendStatus({
        mode: useMockFallback ? "mock" : "live",
        ok: false,
        error: error.message || String(error)
      });
      useMockFallback = true;
      await pollMockSnapshot();
    }
  }

  async function pollMockSnapshot() {
    try {
      sendStatus({
        mode: "mock",
        ok: true
      });
      sendSnapshot(await loadMockSnapshot());
    } catch (error) {
      console.error("[PZMapSync] Unable to load mock snapshot", error);
    }
  }

  pollLiveSnapshot();
  window.setInterval(pollLiveSnapshot, LIVE_POLL_MS);
  window.setInterval(() => {
    if (useMockFallback) {
      pollMockSnapshot();
    }
  }, MOCK_POLL_MS);
})();
