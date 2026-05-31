// PaperTrace Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("[PaperTrace] Extension installed");

  // Set default settings
  chrome.storage.sync.get(["apiUrl", "autoAnalyze"], (items) => {
    if (!items.apiUrl) {
      chrome.storage.sync.set({
        apiUrl: "http://localhost:3000/api/analyze",
        autoAnalyze: false,
      });
    }
  });
});

// Handle tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    const url = new URL(tab.url);
    const supportedHosts = [
      "scholar.google.com",
      "arxiv.org",
      "doi.org",
      "researchgate.net",
      "semanticscholar.org",
    ];

    if (supportedHosts.some((host) => url.hostname.includes(host))) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    }
  }
});

console.log("[PaperTrace] Background service worker ready");
