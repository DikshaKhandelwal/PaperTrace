// PaperTrace Content Script - Injects into paper websites

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractPaperData") {
    const paperData = extractPaperInfo();
    sendResponse(paperData);
  }
});

function extractPaperInfo() {
  const data = {
    title: "",
    authors: [],
    year: null,
    abstract: "",
    text: "",
    citations: [],
    methodologies: [],
    coauthorPatterns: [],
    fieldHistory: [],
  };

  // Try to detect which site we're on and extract accordingly
  const host = window.location.hostname;

  if (host.includes("scholar.google.com")) {
    extractFromScholar(data);
  } else if (host.includes("arxiv.org")) {
    extractFromArxiv(data);
  } else if (host.includes("doi.org")) {
    extractFromDOI(data);
  } else if (host.includes("researchgate.net")) {
    extractFromResearchGate(data);
  } else if (host.includes("semanticscholar.org")) {
    extractFromSemanticScholar(data);
  }

  // Fallback: try generic extraction
  if (!data.title) {
    extractGeneric(data);
  }

  return data;
}

function extractFromScholar(data) {
  // Google Scholar
  const titleEl = document.querySelector("h3");
  if (titleEl) data.title = titleEl.textContent.trim();

  const authorEl = document.querySelector("[data-cid]");
  if (authorEl) {
    data.authors = [authorEl.textContent.split(" - ")[0]];
  }

  const yearMatch = document.body.textContent.match(/20\d{2}|19\d{2}/);
  if (yearMatch) data.year = parseInt(yearMatch[0]);
}

function extractFromArxiv(data) {
  // arXiv
  const titleEl = document.querySelector("h1.title");
  if (titleEl) {
    data.title = titleEl.textContent.replace("Title:", "").trim();
  }

  const authorEls = document.querySelectorAll(".author");
  authorEls.forEach((el) => {
    data.authors.push(el.textContent.trim());
  });

  const abstractEl = document.querySelector(".abstract");
  if (abstractEl) {
    data.abstract = abstractEl.textContent.replace("Abstract:", "").trim();
  }

  const dateMatch = document.body.textContent.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) data.year = parseInt(dateMatch[1]);
}

function extractFromDOI(data) {
  // DOI website
  const titleEl = document.querySelector("h1");
  if (titleEl) data.title = titleEl.textContent.trim();

  const authorEls = document.querySelectorAll("[itemprop='author']");
  authorEls.forEach((el) => {
    data.authors.push(el.textContent.trim());
  });
}

function extractFromResearchGate(data) {
  // ResearchGate
  const titleEl = document.querySelector('[data-testid="publication-title"]');
  if (titleEl) data.title = titleEl.textContent.trim();

  const authorEls = document.querySelectorAll('[data-testid="author-name"]');
  authorEls.forEach((el) => {
    data.authors.push(el.textContent.trim());
  });
}

function extractFromSemanticScholar(data) {
  // Semantic Scholar
  const titleEl = document.querySelector("h1");
  if (titleEl) data.title = titleEl.textContent.trim();

  const authorEls = document.querySelectorAll('[data-test-id="author-link"]');
  authorEls.forEach((el) => {
    data.authors.push(el.textContent.trim());
  });

  const abstractEl = document.querySelector("p.text-lg");
  if (abstractEl) data.abstract = abstractEl.textContent.trim();
}

function extractGeneric(data) {
  // Fallback generic extraction
  const titleEl = document.querySelector("h1") || document.querySelector("h2");
  if (titleEl) data.title = titleEl.textContent.trim();

  // Extract text from main content
  const mainEl = document.querySelector("main") || document.querySelector("article") || document.body;
  data.text = mainEl.textContent.substring(0, 5000); // First 5000 chars

  // Try to find abstract
  const abstractEl = Array.from(document.querySelectorAll("p")).find(
    (p) => p.textContent.toLowerCase().includes("abstract")
  );
  if (abstractEl) {
    data.abstract = abstractEl.textContent.replace("Abstract", "").trim();
  }

  // Extract year from page
  const yearMatch = document.body.textContent.match(/20\d{2}|19\d{2}/);
  if (yearMatch) data.year = parseInt(yearMatch[0]);
}

console.log("[PaperTrace] Content script injected");
