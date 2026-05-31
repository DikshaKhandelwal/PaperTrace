/**
 * PaperTrace Detection Engine
 * Analyzes papers for integrity issues using 6 detection signals
 */

export interface DetectionResult {
  signalName: string;
  score: number; // 0-100, higher = more suspicious
  severity: "green" | "yellow" | "red";
  details: string[];
}

export interface AnalysisReport {
  title: string;
  authors: string[];
  year: number;
  overallScore: number; // 0-100
  signals: DetectionResult[];
  timestamp: Date;
}

// Mock cache system
const analysisCache = new Map<string, { data: AnalysisReport; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function getCachedAnalysis(paperHash: string): AnalysisReport | null {
  const cached = analysisCache.get(paperHash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  analysisCache.delete(paperHash);
  return null;
}

export function cacheAnalysis(paperHash: string, report: AnalysisReport): void {
  analysisCache.set(paperHash, { data: report, timestamp: Date.now() });
}

// Signal 1: Citation Integrity
export function analyzeCitationIntegrity(
  citations: { text: string; abstract?: string }[]
): DetectionResult {
  const details: string[] = [];
  let suspiciousCount = 0;

  if (!citations || citations.length === 0) {
    return {
      signalName: "Citation Integrity",
      score: 20,
      severity: "green",
      details: ["No citations found for analysis"],
    };
  }

  citations.forEach((citation, idx) => {
    // Check if citation text contradicts claimed abstract
    if (citation.abstract) {
      const citationWords = citation.text.toLowerCase().split(/\s+/);
      const abstractWords = citation.abstract.toLowerCase().split(/\s+/);

      const commonWords = citationWords.filter((w) => abstractWords.includes(w)).length;
      const similarity = commonWords / Math.max(citationWords.length, abstractWords.length);

      if (similarity < 0.3) {
        suspiciousCount++;
        details.push(
          `Citation ${idx + 1}: Claimed context doesn't match source abstract (${Math.round(similarity * 100)}% similarity)`
        );
      }
    }

    // Check for vague or missing citations
    if (citation.text.length < 20) {
      details.push(`Citation ${idx + 1}: Unusually vague citation text`);
    }
  });

  const score = Math.min(100, (suspiciousCount / citations.length) * 80);
  const severity = score > 60 ? "red" : score > 30 ? "yellow" : "green";

  return {
    signalName: "Citation Integrity",
    score,
    severity,
    details: details.length > 0 ? details : ["Citations appear consistent with sources"],
  };
}

// Signal 2: Temporal Impossibility
export function analyzeTemporalImpossibility(
  paperYear: number,
  citations: { year?: number }[]
): DetectionResult {
  const details: string[] = [];
  let impossibilities = 0;

  if (!citations || citations.length === 0) {
    return {
      signalName: "Temporal Impossibility",
      score: 0,
      severity: "green",
      details: ["No citations with dates to analyze"],
    };
  }

  citations.forEach((citation, idx) => {
    if (citation.year && citation.year > paperYear) {
      impossibilities++;
      details.push(
        `Citation ${idx + 1}: References work from ${citation.year} (paper published ${paperYear})`
      );
    }
  });

  const score = Math.min(100, (impossibilities / citations.length) * 100);
  const severity = score > 50 ? "red" : score > 20 ? "yellow" : "green";

  return {
    signalName: "Temporal Impossibility",
    score,
    severity,
    details: details.length > 0 ? details : ["All citations predate the paper appropriately"],
  };
}

// Signal 3: Internal Consistency
export function analyzeInternalConsistency(text: string, claims: string[]): DetectionResult {
  const details: string[] = [];
  let inconsistencies = 0;

  const textLower = text.toLowerCase();
  const mentionedClaims = new Set<string>();

  claims.forEach((claim, idx) => {
    const claimLower = claim.toLowerCase();
    const occurrences = (textLower.match(new RegExp(claimLower, "g")) || []).length;

    if (occurrences === 1) {
      inconsistencies++;
      details.push(`Claim ${idx + 1}: Only mentioned once, suggesting possible inconsistency`);
    }
  });

  const score = Math.min(100, (inconsistencies / Math.max(claims.length, 1)) * 60);
  const severity = score > 40 ? "red" : score > 20 ? "yellow" : "green";

  return {
    signalName: "Internal Consistency",
    score,
    severity,
    details: details.length > 0 ? details : ["Internal claims appear consistent"],
  };
}

// Signal 4: Methodology Novelty
export function analyzeMethodologyNovelty(
  methodologies: string[],
  fieldHistory: { method: string; year: number }[]
): DetectionResult {
  const details: string[] = [];
  let suspiciousNovelty = 0;

  if (!methodologies || methodologies.length === 0) {
    return {
      signalName: "Methodology Novelty",
      score: 30,
      severity: "yellow",
      details: ["No novel methodology claims detected"],
    };
  }

  methodologies.forEach((method) => {
    const existing = fieldHistory.find((h) =>
      h.method.toLowerCase().includes(method.toLowerCase())
    );
    if (!existing) {
      // Genuinely novel
      details.push(`Method "${method}" appears to be genuinely novel`);
    } else {
      suspiciousNovelty++;
      details.push(
        `Method "${method}" was previously published by others (${existing.year}), but claimed as novel`
      );
    }
  });

  const score = (suspiciousNovelty / methodologies.length) * 80;
  const severity = score > 60 ? "red" : score > 30 ? "yellow" : "green";

  return {
    signalName: "Methodology Novelty",
    score,
    severity,
    details: details.length > 0 ? details : ["Methodology claims appear reasonable"],
  };
}

// Signal 5: Author Footprint
export function analyzeAuthorFootprint(
  authors: string[],
  coauthorPatterns: { coauthor: string; frequency: number }[]
): DetectionResult {
  const details: string[] = [];
  let suspiciousPatterns = 0;

  if (authors.length < 2) {
    return {
      signalName: "Author Footprint",
      score: 10,
      severity: "green",
      details: ["Single author - limited collaboration patterns to analyze"],
    };
  }

  // Check for unusual collaboration patterns
  const avgCollaborations = coauthorPatterns.reduce((sum, p) => sum + p.frequency, 0) / Math.max(coauthorPatterns.length, 1);

  coauthorPatterns.forEach((pattern) => {
    if (pattern.frequency > avgCollaborations * 3) {
      suspiciousPatterns++;
      details.push(
        `Unusual collaboration frequency with ${pattern.coauthor} (${pattern.frequency} papers together)`
      );
    }
  });

  const score = Math.min(100, (suspiciousPatterns / Math.max(coauthorPatterns.length, 1)) * 50);
  const severity = score > 40 ? "red" : score > 20 ? "yellow" : "green";

  return {
    signalName: "Author Footprint",
    score,
    severity,
    details:
      details.length > 0 ? details : ["Author collaboration patterns appear normal"],
  };
}

// Signal 6: Semantic Anomalies
export function analyzeSemanticAnomalies(text: string, abstractText: string): DetectionResult {
  const details: string[] = [];

  // Check title-abstract coherence
  const titleWords = text.toLowerCase().split(/\s+/).slice(0, 10);
  const abstractWords = abstractText.toLowerCase().split(/\s+/);
  const commonWords = titleWords.filter((w) => abstractWords.includes(w)).length;
  const coherenceScore = commonWords / titleWords.length;

  if (coherenceScore < 0.4) {
    details.push("Title and abstract show low semantic coherence");
  }

  // Check for contradictory statements
  const contradictions = [
    { pattern: /novel.*already/gi, issue: "Claims novelty while acknowledging prior work" },
    { pattern: /unable.*successfully/gi, issue: "Claims success while noting failures" },
    { pattern: /impossible.*achieved/gi, issue: "Claims achievement of supposedly impossible task" },
  ];

  let anomalyCount = 0;
  contradictions.forEach(({ pattern, issue }) => {
    if (pattern.test(text)) {
      anomalyCount++;
      details.push(issue);
    }
  });

  // Check for statistical impossibilities
  const probabilityHighClaims = (text.match(/p\s*[<>]=?\s*0\.(0+\d{3,})/gi) || []).length;
  if (probabilityHighClaims > 2) {
    anomalyCount++;
    details.push("Multiple claims of extremely high statistical significance (p < 0.001)");
  }

  const score = Math.min(100, anomalyCount * 25 + (1 - coherenceScore) * 30);
  const severity = score > 50 ? "red" : score > 25 ? "yellow" : "green";

  return {
    signalName: "Semantic Anomalies",
    score,
    severity,
    details: details.length > 0 ? details : ["No major semantic anomalies detected"],
  };
}

// Main analysis orchestrator
export async function analyzePaper(paperData: {
  title: string;
  authors: string[];
  year: number;
  abstractText: string;
  fullText: string;
  citations: { text: string; abstract?: string; year?: number }[];
  methodologies: string[];
  coauthorPatterns: { coauthor: string; frequency: number }[];
  fieldHistory: { method: string; year: number }[];
}): Promise<AnalysisReport> {
  const paperHash = `${paperData.title}-${paperData.authors.join("-")}-${paperData.year}`;
  
  // Check cache first
  const cached = getCachedAnalysis(paperHash);
  if (cached) {
    return cached;
  }

  const signals = [
    analyzeCitationIntegrity(paperData.citations),
    analyzeTemporalImpossibility(paperData.year, paperData.citations),
    analyzeInternalConsistency(paperData.fullText, [
      paperData.title,
      ...paperData.methodologies.slice(0, 3),
    ]),
    analyzeMethodologyNovelty(paperData.methodologies, paperData.fieldHistory),
    analyzeAuthorFootprint(paperData.authors, paperData.coauthorPatterns),
    analyzeSemanticAnomalies(paperData.fullText, paperData.abstractText),
  ];

  const overallScore = signals.reduce((sum, s) => sum + s.score, 0) / signals.length;

  const report: AnalysisReport = {
    title: paperData.title,
    authors: paperData.authors,
    year: paperData.year,
    overallScore: Math.round(overallScore),
    signals,
    timestamp: new Date(),
  };

  cacheAnalysis(paperHash, report);
  return report;
}
