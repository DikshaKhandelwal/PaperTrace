// PaperTrace Options Page

const apiUrlInput = document.getElementById("apiUrl");
const autoAnalyzeCheckbox = document.getElementById("autoAnalyze");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const messageDiv = document.getElementById("message");

// Load saved settings
chrome.storage.sync.get(["apiUrl", "autoAnalyze"], (items) => {
  apiUrlInput.value = items.apiUrl || "http://localhost:3000/api/analyze";
  autoAnalyzeCheckbox.checked = items.autoAnalyze || false;
});

// Save settings
saveBtn.addEventListener("click", () => {
  const settings = {
    apiUrl: apiUrlInput.value,
    autoAnalyze: autoAnalyzeCheckbox.checked,
  };

  chrome.storage.sync.set(settings, () => {
    showMessage("Settings saved successfully!", "success");
  });
});

// Reset to defaults
resetBtn.addEventListener("click", () => {
  apiUrlInput.value = "http://localhost:3000/api/analyze";
  autoAnalyzeCheckbox.checked = false;

  chrome.storage.sync.set(
    {
      apiUrl: "http://localhost:3000/api/analyze",
      autoAnalyze: false,
    },
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
