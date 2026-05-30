const B42MAP_MATCH = "https://b42map.com/*";
const NATIVE_HOST = "com.pzmapsync.host";

function readLiveSnapshot() {
  return new Promise((resolve) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, {
      type: "getSnapshot"
    }, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        resolve({
          ok: false,
          error: lastError.message || String(lastError)
        });
        return;
      }

      resolve(response || {
        ok: false,
        error: "Native host returned an empty response"
      });
    });
  });
}

async function injectPZMapSync(tabId, url) {
  if (!url || !url.startsWith("https://b42map.com/")) {
    return;
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["src/content/overlay.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/content-script.js"]
    });
  } catch (error) {
    console.error("[PZMapSync] Failed to inject content script", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: B42MAP_MATCH }, (tabs) => {
    for (const tab of tabs) {
      injectPZMapSync(tab.id, tab.url);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    injectPZMapSync(tabId, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "PZMapSync:getSnapshot") {
    return false;
  }

  readLiveSnapshot()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    });

  return true;
});
