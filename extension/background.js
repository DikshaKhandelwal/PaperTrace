// PaperTrace Background Service Worker

const DEFAULT_SETTINGS = {
  appBaseUrl: "http://localhost:3000",
  apiUrl: "http://localhost:3000/api/analyze",
  autoAnalyze: false,
};

chrome.runtime.onInstalled.addListener(() => {
  console.log("[PaperTrace] Extension installed");

  chrome.storage.sync.get(["appBaseUrl", "apiUrl", "autoAnalyze"], (items) => {
    chrome.storage.sync.set({
      appBaseUrl: items.appBaseUrl || DEFAULT_SETTINGS.appBaseUrl,
      apiUrl: items.apiUrl || DEFAULT_SETTINGS.apiUrl,
      autoAnalyze: typeof items.autoAnalyze === "boolean" ? items.autoAnalyze : DEFAULT_SETTINGS.autoAnalyze,
    });
  });
});

console.log("[PaperTrace] Background service worker ready");
