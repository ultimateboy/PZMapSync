(function initPZMapSyncContentScript() {
  const BRIDGE_ID = "pzmapsync-page-bridge";
  const SNAPSHOT_EVENT = "PZMapSync:snapshot";
  const READY_EVENT = "PZMapSync:ready";
  const MOCK_POLL_MS = 250;

  let latestSnapshot = null;
  let bridgeReady = false;
  let latestSequence = null;

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
    if (snapshot.sequence === latestSequence) {
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

  window.addEventListener(READY_EVENT, () => {
    bridgeReady = true;
    if (latestSnapshot) {
      sendSnapshot(latestSnapshot);
    }
  });

  injectBridge();

  async function pollMockSnapshot() {
    try {
      sendSnapshot(await loadMockSnapshot());
    } catch (error) {
      console.error("[PZMapSync] Unable to load mock snapshot", error);
    }
  }

  pollMockSnapshot();
  window.setInterval(pollMockSnapshot, MOCK_POLL_MS);
})();
