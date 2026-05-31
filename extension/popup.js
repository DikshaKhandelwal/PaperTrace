// PaperTrace Extension - Popup Script

const API_ENDPOINT = "http://localhost:3000/api/analyze"; // Change to your deployed URL
const FULL_APP_URL = "http://localhost:3000"; // Change to your deployed URL

document.getElementById("analyzeBtn").addEventListener("click", analyzePaper);
document.getElementById("settingsBtn").addEventListener("click", openSettings);
document.getElementById("fullReport").addEventListener("click", openFullReport);

async function analyzePaper() {
  const status = document.getElementById("status");
  const results = document.getElementById("results");
  const noResults = document.getElementById("noResults");
  const analyzeBtn = document.getElementById("analyzeBtn");

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Extract paper info from page
  const paperData = await chrome.tabs.sendMessage(tab.id, {
    action: "extractPaperData",
  });

  if (!paperData.title) {
    showStatus(
      status,
      "Could not extract paper information from this page",
      "error"
    );
    return;
  }

  showStatus(status, "Analyzing paper...", "loading");
  analyzeBtn.disabled = true;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: paperData.title,
        authors: paperData.authors || ["Unknown"],
        year: paperData.year || new Date().getFullYear(),
        abstractText: paperData.abstract || "",
        fullText: paperData.text || "",
        citations: paperData.citations || [],
        methodologies: paperData.methodologies || [],
        coauthorPatterns: paperData.coauthorPatterns || [],
        fieldHistory: paperData.fieldHistory || [],
      }),
    });

    if (!response.ok) throw new Error("API error");

    const report = await response.json();

    // Store report for full view
    await chrome.storage.local.set({ lastReport: report });

    // Display results
    displayResults(report, results, noResults, status);
    showStatus(status, "Analysis complete", "success");
  } catch (error) {
    console.error("[PaperTrace] Error:", error);
    showStatus(
      status,
      "Analysis failed. Make sure the app is running.",
      "error"
    );
  } finally {
    analyzeBtn.disabled = false;
  }
}

function displayResults(report, resultsDiv, noResultsDiv, statusDiv) {
  noResultsDiv.style.display = "none";
  resultsDiv.style.display = "block";

  const overallScore = report.overallScore;
  const scoreColor =
    overallScore < 30 ? "signal-green" : overallScore < 60 ? "signal-yellow" : "signal-red";

  let html = `<div class="signal-name">Overall Score: <span class="${scoreColor}">${overallScore}</span>/100</div>`;

  report.signals.forEach((signal) => {
    const color =
      signal.severity === "green" ? "signal-green" : signal.severity === "yellow" ? "signal-yellow" : "signal-red";
    html += `
      <div class="result-item">
        <div class="signal-name">${signal.signalName}</div>
        <div class="signal-score">
          Risk Score: <span class="${color}">${Math.round(signal.score)}</span>
        </div>
      </div>
    `;
  });

  resultsDiv.innerHTML = html;
}

function showStatus(statusDiv, message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = "block";
}

function openSettings() {
  chrome.runtime.openOptionsPage?.() ||
    chrome.tabs.create({ url: "options.html" });
}

function openFullReport(e) {
  e.preventDefault();
  chrome.storage.local.get("lastReport", (data) => {
    if (data.lastReport) {
      chrome.tabs.create({ url: FULL_APP_URL + "?report=" + encodeURIComponent(JSON.stringify(data.lastReport)) });
    } else {
      alert("No report to display. Please run an analysis first.");
    }
  });
}
