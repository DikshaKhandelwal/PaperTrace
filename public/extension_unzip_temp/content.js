// PaperTrace Content Script - Injects into paper websites

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractPaperData") {
    const paperData = extractPaperInfo();
    sendResponse(paperData);
  }
});

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function metaContent(selector) {
  const el = document.querySelector(selector);
  return cleanText(el?.getAttribute("content") || el?.textContent || "");
}

function unique(items) {
  return [...new Set(items.map((item) => cleanText(item)).filter(Boolean))];
}

function guessYear(text) {
  const match = cleanText(text).match(/(?:19|20)\d{2}/);
  return match ? parseInt(match[0], 10) : null;
}

function detectPdfUrl() {
  const candidates = [
    document.querySelector('a[title="Download PDF"]')?.href,
    document.querySelector('a[href*="/pdf/"]')?.href,
    document.querySelector('meta[name="citation_pdf_url"]')?.getAttribute("content"),
    document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
  ].filter(Boolean);

  if (window.location.hostname.includes("arxiv.org") && window.location.pathname.startsWith("/abs/")) {
    candidates.unshift(window.location.href.replace("/abs/", "/pdf/") + ".pdf");
  }

  return candidates.find((value) => String(value).includes("pdf")) || "";
}

function detectDoi() {
  const doiFromMeta = metaContent('meta[name="citation_doi"]') || metaContent('meta[name="dc.Identifier"]');
  if (doiFromMeta) {
    return doiFromMeta.replace(/^https?:\/\/doi\.org\//i, "");
  }

  const doiLink = document.querySelector('a[href*="doi.org/"]')?.href || "";
  if (doiLink) {
    return doiLink.replace(/^https?:\/\/doi\.org\//i, "");
  }

  const bodyMatch = document.body.textContent.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return bodyMatch ? bodyMatch[0] : "";
}

function detectArxivId() {
  const metaId = metaContent('meta[name="citation_arxiv_id"]');
  if (metaId) {
    return metaId;
  }

  const pathname = window.location.pathname || "";
  const match = pathname.match(/\/(abs|pdf)\/([^/?#]+?)(?:\.pdf)?$/);
  return match ? match[2] : "";
}

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
    pageUrl: window.location.href,
    sourceSite: window.location.hostname,
    doi: "",
    arxivId: "",
    pdfUrl: "",
  };

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

  if (!data.title) {
    extractGeneric(data);
  }

  data.title = cleanText(data.title || metaContent('meta[name="citation_title"]') || document.title.replace(/\s*\|.*$/, ""));
  data.authors = unique(data.authors.length ? data.authors : Array.from(document.querySelectorAll('meta[name="citation_author"]')).map((el) => el.getAttribute("content") || ""));
  data.abstract = cleanText(data.abstract || metaContent('meta[name="description"]') || metaContent('meta[name="citation_abstract"]'));
  data.text = cleanText(data.text || "").slice(0, 8000);
  data.year = data.year || guessYear(metaContent('meta[name="citation_publication_date"]') || document.body.textContent);
  data.doi = detectDoi();
  data.arxivId = detectArxivId();
  data.pdfUrl = detectPdfUrl();

  return data;
}

function extractFromScholar(data) {
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
  const titleEl = document.querySelector("h1.title");
  if (titleEl) {
    data.title = titleEl.textContent.replace("Title:", "").trim();
  }

  const authorEls = document.querySelectorAll(".authors a, .author");
  authorEls.forEach((el) => {
    data.authors.push(el.textContent.trim());
  });

  const abstractEl = document.querySelector(".abstract");
  if (abstractEl) {
    data.abstract = abstractEl.textContent.replace("Abstract:", "").trim();
  }

  const dateMatch = document.body.textContent.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) data.year = parseInt(dateMatch[1]);

  const pdfLink = document.querySelector('a[title="Download PDF"]');
  if (pdfLink?.href) {
    data.pdfUrl = pdfLink.href;
  }
}

function extractFromDOI(data) {
  const titleEl = document.querySelector("h1");
  if (titleEl) data.title = titleEl.textContent.trim();

  const authorEls = document.querySelectorAll("[itemprop='author']");
  authorEls.forEach((el) => {
    data.authors.push(el.textContent.trim());
  });
}

function extractFromResearchGate(data) {
  const titleEl = document.querySelector('[data-testid="publication-title"]');
  if (titleEl) data.title = titleEl.textContent.trim();

  const authorEls = document.querySelectorAll('[data-testid="author-name"]');
  authorEls.forEach((el) => {
    data.authors.push(el.textContent.trim());
  });
}

function extractFromSemanticScholar(data) {
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
  const titleEl = document.querySelector("h1") || document.querySelector("h2");
  if (titleEl) data.title = titleEl.textContent.trim();

  const mainEl = document.querySelector("main") || document.querySelector("article") || document.body;
  data.text = mainEl.textContent.substring(0, 5000); // First 5000 chars

  const abstractEl = Array.from(document.querySelectorAll("p")).find(
    (p) => p.textContent.toLowerCase().includes("abstract")
  );
  if (abstractEl) {
    data.abstract = abstractEl.textContent.replace("Abstract", "").trim();
  }

  const yearMatch = document.body.textContent.match(/20\d{2}|19\d{2}/);
  if (yearMatch) data.year = parseInt(yearMatch[0]);
}

console.log("[PaperTrace] Content script injected");
