"use client";

import { useState } from "react";
import { PaperUpload } from "@/components/PaperUpload";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { analyzePaper } from "@/lib/detectionEngine";
import type { AnalysisReport } from "@/lib/detectionEngine";

export default function Page() {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = async (data: {
    title: string;
    authors: string[];
    year: number;
    abstractText: string;
    fullText: string;
    citations: { text: string; abstract?: string; year?: number; authors?: string }[];
    methodologies: string[];
    coauthorPatterns: { coauthor: string; frequency: number }[];
    fieldHistory: { method: string; year: number }[];
  }) => {
    setIsLoading(true);
    try {
      // Run analysis locally using detection engine
      const analysisResult = analyzePaper(
        data.title,
        data.authors,
        data.year,
        data.abstractText,
        data.methodologies.join("\n"),
        data.fullText,
        data.citations.map((c, idx) => ({
          id: `citation-${idx}`,
          text: c.text,
          year: c.year,
          authors: c.authors,
          abstract: c.abstract,
        }))
      );

      setReport(analysisResult);
    } catch (error) {
      console.error("[v0] Error analyzing paper:", error);
      alert("Failed to analyze paper. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {!report ? (
        <PaperUpload onUpload={handleUpload} isLoading={isLoading} />
      ) : (
        <ResultsDashboard
          report={report}
          onBack={() => setReport(null)}
        />
      )}
    </main>
  );
}
