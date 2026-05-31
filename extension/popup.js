// PaperTrace Extension - Popup Script

const DEFAULT_APP_BASE_URLS = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"];
const DEFAULT_BACKEND_BASE_URLS = ["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:8001", "http://127.0.0.1:8001"];
const DEFAULT_SETTINGS = {
  apiUrl: "http://localhost:3000/api/analyze",
  appBaseUrl: "http://localhost:3000",
  autoAnalyze: false,
};

let lastWorkingBaseUrl = DEFAULT_SETTINGS.appBaseUrl;

document.getElementById("analyzeBtn").addEventListener("click", analyzePaper);
document.getElementById("openAppBtn").addEventListener("click", openFullAppWithCurrentPaper);
document.getElementById("settingsBtn").addEventListener("click", openSettings);
document.getElementById("fullReport").addEventListener("click", openFullReport);

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function deriveBaseUrlFromApi(apiUrl) {
  const normalized = normalizeBaseUrl(apiUrl);
  return normalized.replace(/\/api\/analyze$/i, "");
}

function deriveBackendBaseFromApi(apiUrl) {
  const normalized = normalizeBaseUrl(apiUrl);
  return normalized.replace(/\/api\/analyze$/i, "").replace(/\/analyze$/i, "");
}

async function getSettings() {
  const settings = await chrome.storage.sync.get(["apiUrl", "appBaseUrl", "autoAnalyze"]);
  return {
    apiUrl: settings.apiUrl || DEFAULT_SETTINGS.apiUrl,
    appBaseUrl: settings.appBaseUrl || deriveBaseUrlFromApi(settings.apiUrl || DEFAULT_SETTINGS.apiUrl) || DEFAULT_SETTINGS.appBaseUrl,
    autoAnalyze: Boolean(settings.autoAnalyze),
  };
}

function getApiCandidates(settings) {
  const configuredApi = normalizeBaseUrl(settings.apiUrl);
  const configuredBase = normalizeBaseUrl(settings.appBaseUrl || deriveBaseUrlFromApi(configuredApi));
  const configuredBackendBase = normalizeBaseUrl(deriveBackendBaseFromApi(configuredApi));
  const candidates = [
    configuredApi,
    configuredBase ? `${configuredBase}/api/analyze` : "",
    configuredBackendBase ? `${configuredBackendBase}/analyze` : "",
    ...DEFAULT_APP_BASE_URLS.map((base) => `${base}/api/analyze`),
    ...DEFAULT_BACKEND_BASE_URLS.map((base) => `${base}/analyze`),
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function getAppBaseCandidates(settings) {
  const configuredBase = normalizeBaseUrl(settings.appBaseUrl || deriveBaseUrlFromApi(settings.apiUrl));
  const candidates = [configuredBase, ...DEFAULT_APP_BASE_URLS].filter(Boolean);
  return [...new Set(candidates)];
}

function getParseCandidates(settings) {
  const configuredApi = normalizeBaseUrl(settings.apiUrl);
  const configuredAppBase = normalizeBaseUrl(settings.appBaseUrl || deriveBaseUrlFromApi(configuredApi));
  const configuredBackendBase = normalizeBaseUrl(deriveBackendBaseFromApi(configuredApi));
  const candidates = [
    configuredAppBase ? `${configuredAppBase}/api/parse-pdf` : "",
    configuredBackendBase ? `${configuredBackendBase}/parse-pdf-url` : "",
    ...DEFAULT_APP_BASE_URLS.map((base) => `${base}/api/parse-pdf`),
    ...DEFAULT_BACKEND_BASE_URLS.map((base) => `${base}/parse-pdf-url`),
  ].filter(Boolean);
  return [...new Set(candidates)];
}

async function postAnalyze(payload, settings) {
  let lastError = null;
  for (const apiUrl of getApiCandidates(settings)) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        lastWorkingBaseUrl = deriveBaseUrlFromApi(apiUrl) || settings.appBaseUrl || DEFAULT_SETTINGS.appBaseUrl;
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status} from ${apiUrl}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No configured PaperTrace endpoint is reachable");
}

async function parsePdfFromUrl(pdfUrl, settings) {
  let lastError = null;
  for (const parseUrl of getParseCandidates(settings)) {
    try {
      const response = await fetch(parseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrl }),
      });

      if (response.ok) {
        return await response.json();
      }

      const errorText = await response.text();
      lastError = new Error(`HTTP ${response.status} from ${parseUrl}: ${errorText}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No configured PDF parse endpoint is reachable");
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractCurrentPaperData() {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    throw new Error("No active tab available");
  }

  try {
    const paperData = await chrome.tabs.sendMessage(tab.id, { action: "extractPaperData" });
    return paperData;
  } catch (error) {
    throw new Error("This page is not ready for PaperTrace extraction yet. Reload the page and try again.");
  }
}

function buildAnalyzePayload(paperData) {
  return {
    title: paperData.title,
    authors: paperData.authors || ["Unknown"],
    year: paperData.year || new Date().getFullYear(),
    abstractText: paperData.abstract || "",
    fullText: paperData.text || "",
    citations: paperData.citations || [],
    citationInstances: paperData.citationInstances || [],
    methodologies: paperData.methodologies || [],
    coauthorPatterns: paperData.coauthorPatterns || [],
    fieldHistory: paperData.fieldHistory || [],
    doi: paperData.doi || "",
    arxivId: paperData.arxivId || "",
    pdfUrl: paperData.pdfUrl || "",
    pageUrl: paperData.pageUrl || "",
    sourceSite: paperData.sourceSite || "",
  };
}

function buildAppHandoffPayload(payload) {
  if (!payload) {
    return null;
  }

  return {
    title: payload.title || "",
    authors: payload.authors || ["Unknown"],
    year: payload.year || new Date().getFullYear(),
    abstractText: payload.abstractText || "",
    fullText: payload.pdfUrl ? "" : (payload.fullText || payload.text || "").slice(0, 4000),
    citations: Array.isArray(payload.citations) ? payload.citations.slice(0, 50) : [],
    citationInstances: Array.isArray(payload.citationInstances) ? payload.citationInstances.slice(0, 80) : [],
    methodologies: Array.isArray(payload.methodologies) ? payload.methodologies.slice(0, 20) : [],
    coauthorPatterns: Array.isArray(payload.coauthorPatterns) ? payload.coauthorPatterns.slice(0, 20) : [],
    fieldHistory: Array.isArray(payload.fieldHistory) ? payload.fieldHistory.slice(0, 20) : [],
    doi: payload.doi || "",
    arxivId: payload.arxivId || "",
    pdfUrl: payload.pdfUrl || "",
    pageUrl: payload.pageUrl || "",
    sourceSite: payload.sourceSite || "",
  };
}

async function openAppUrlWithParam(key, value, settings) {
  for (const baseUrl of getAppBaseCandidates(settings)) {
    try {
      const targetUrl = `${normalizeBaseUrl(baseUrl)}#${key}=${encodeURIComponent(JSON.stringify(value))}`;
      await chrome.tabs.create({ url: targetUrl });
      lastWorkingBaseUrl = normalizeBaseUrl(baseUrl);
      return;
    } catch (error) {
      // Try next candidate.
    }
  }

  throw new Error("Unable to open the full PaperTrace app. Check the configured app URL in Settings.");
}

async function analyzePaper() {
  const status = document.getElementById("status");
  const results = document.getElementById("results");
  const noResults = document.getElementById("noResults");
  const analyzeBtn = document.getElementById("analyzeBtn");

  let paperData;
  let settings;

  try {
    settings = await getSettings();
    paperData = await extractCurrentPaperData();
  } catch (error) {
    showStatus(status, error.message || "Could not extract paper information from this page", "error");
    return;
  }

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
    const payload = buildAnalyzePayload(paperData);

    if (payload.pdfUrl) {
      await chrome.storage.local.set({ lastPaperData: payload });
      showStatus(status, "PDF detected — parsing through backend...", "loading");

      const parsed = await parsePdfFromUrl(payload.pdfUrl, settings);
      const parsedPayload = {
        title: parsed?.title || payload.title,
        authors: Array.isArray(parsed?.authors) && parsed.authors.length > 0 ? parsed.authors : payload.authors,
        year: Number(parsed?.year) || payload.year,
        abstractText: parsed?.abstractText || payload.abstractText || "",
        fullText: parsed?.fullText || payload.fullText || "",
        citations: Array.isArray(parsed?.citations) ? parsed.citations : [],
        citationInstances: Array.isArray(parsed?.citationInstances) ? parsed.citationInstances : [],
        methodologies: Array.isArray(parsed?.methodologies) ? parsed.methodologies : payload.methodologies || [],
        coauthorPatterns: Array.isArray(parsed?.coauthorPatterns) ? parsed.coauthorPatterns : payload.coauthorPatterns || [],
        fieldHistory: Array.isArray(parsed?.fieldHistory) ? parsed.fieldHistory : payload.fieldHistory || [],
        doi: payload.doi || "",
        arxivId: payload.arxivId || "",
        pdfUrl: payload.pdfUrl || "",
        pageUrl: payload.pageUrl || "",
        sourceSite: payload.sourceSite || "",
      };

      const report = await postAnalyze(parsedPayload, settings);
      await chrome.storage.local.set({ lastReport: report, lastPaperData: buildAppHandoffPayload(parsedPayload) });
      displayResults(report, results, noResults, status);
      showStatus(status, "Analysis complete", "success");
      return;
    }

    const report = await postAnalyze(payload, settings);

    await chrome.storage.local.set({ lastReport: report, lastPaperData: buildAppHandoffPayload(payload) });

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

async function openFullAppWithCurrentPaper() {
  const status = document.getElementById("status");

  try {
    const settings = await getSettings();
    const paperData = await extractCurrentPaperData();
    if (!paperData.title) {
      showStatus(status, "Could not extract enough paper information to open the full app", "error");
      return;
    }

    const payload = buildAnalyzePayload(paperData);
    const handoffPayload = buildAppHandoffPayload(payload);
    await chrome.storage.local.set({ lastPaperData: handoffPayload });
    await openAppUrlWithParam("paperTracePayload", handoffPayload, settings);
    showStatus(status, "Opening full PaperTrace app...", "success");
  } catch (error) {
    console.error("[PaperTrace] Open app error:", error);
    showStatus(status, error.message || "Could not open the full app", "error");
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
  Promise.all([chrome.storage.local.get(["lastReport", "lastPaperData"]), getSettings()])
    .then(async ([data, settings]) => {
      const serializedReport = data.lastReport ? JSON.stringify(data.lastReport) : "";
      const reportIsSmallEnough = serializedReport.length > 0 && serializedReport.length < 1500;

      if (data.lastReport && reportIsSmallEnough) {
        await openAppUrlWithParam("paperTraceReport", data.lastReport, settings);
        return;
      }

      if (data.lastPaperData) {
        await openAppUrlWithParam("paperTracePayload", buildAppHandoffPayload(data.lastPaperData), settings);
        return;
      }

      alert("No report or paper context is available yet. Run an analysis first or use Open Full App.");
    })
    .catch((error) => {
      console.error("[PaperTrace] Open full report error:", error);
      alert("Could not open the full PaperTrace app. Check the Settings page.");
    });
}
