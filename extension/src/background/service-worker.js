const B42MAP_MATCH = "https://b42map.com/*";

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
