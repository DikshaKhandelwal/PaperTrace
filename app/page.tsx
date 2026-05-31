"use client";

import { useState } from "react";
import { PaperUpload } from "@/components/PaperUpload";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { AnalysisReport } from "@/lib/detectionEngine";

export default function Page() {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = async (data: {
    title: string;
    authors: string[];
    year: number;
    abstractText: string;
    fullText: string;
    citations: { text: string; abstract?: string; year?: number }[];
    methodologies: string[];
    coauthorPatterns: { coauthor: string; frequency: number }[];
    fieldHistory: { method: string; year: number }[];
  }) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const result: AnalysisReport = await response.json();
      setReport(result);
    } catch (error) {
      console.error("[v0] Error analyzing paper:", error);
      alert("Failed to analyze paper. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            PaperTrace
          </h1>
          <p className="text-slate-400 text-lg">
            Advanced Research Paper Integrity Analysis
          </p>
        </div>

        {/* Content */}
        {!report ? (
          <PaperUpload onUpload={handleUpload} isLoading={isLoading} />
        ) : (
          <ResultsDashboard
            report={report}
            onBack={() => setReport(null)}
          />
        )}
      </div>
    </main>
  );
}
