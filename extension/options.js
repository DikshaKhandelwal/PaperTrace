// PaperTrace Options Page

const appBaseUrlInput = document.getElementById("appBaseUrl");
const apiUrlInput = document.getElementById("apiUrl");
const autoAnalyzeCheckbox = document.getElementById("autoAnalyze");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const messageDiv = document.getElementById("message");

const DEFAULT_SETTINGS = {
  appBaseUrl: "http://localhost:3000",
  apiUrl: "http://localhost:3000/api/analyze",
  autoAnalyze: false,
};

// Load saved settings
chrome.storage.sync.get(["appBaseUrl", "apiUrl", "autoAnalyze"], (items) => {
  appBaseUrlInput.value = items.appBaseUrl || DEFAULT_SETTINGS.appBaseUrl;
  apiUrlInput.value = items.apiUrl || DEFAULT_SETTINGS.apiUrl;
  autoAnalyzeCheckbox.checked = items.autoAnalyze || false;
});

// Save settings
saveBtn.addEventListener("click", () => {
  const settings = {
    appBaseUrl: appBaseUrlInput.value || DEFAULT_SETTINGS.appBaseUrl,
    apiUrl: apiUrlInput.value || DEFAULT_SETTINGS.apiUrl,
    autoAnalyze: autoAnalyzeCheckbox.checked,
  };

  chrome.storage.sync.set(settings, () => {
    showMessage("Settings saved successfully!", "success");
  });
});

// Reset to defaults
resetBtn.addEventListener("click", () => {
  appBaseUrlInput.value = DEFAULT_SETTINGS.appBaseUrl;
  apiUrlInput.value = DEFAULT_SETTINGS.apiUrl;
  autoAnalyzeCheckbox.checked = DEFAULT_SETTINGS.autoAnalyze;

  chrome.storage.sync.set(
    DEFAULT_SETTINGS,
    () => {
      showMessage("Settings reset to defaults", "success");
    }
  );
});

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = "block";

  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 3000);
}
