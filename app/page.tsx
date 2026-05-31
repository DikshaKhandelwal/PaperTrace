"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisPipeline } from "@/components/AnalysisPipeline";
import { PaperUpload } from "@/components/PaperUpload";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import type { AnalysisReport } from "@/lib/detectionEngine";

type PipelineStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "warning" | "fail";
  detail?: string;
};

type PaperInput = {
  title: string;
  authors: string[];
  year: number;
  abstractText: string;
  fullText: string;
  citations: { text: string; abstract?: string; year?: number; authors?: string; doi?: string }[];
  citationInstances?: {
    sentence: string;
    claim?: string;
    citationMarker?: string;
    refId?: string;
    refData?: { doi?: string; title?: string; year?: number; authors?: string; referenceText?: string };
    citationType?: string;
    year?: number;
    title?: string;
    doi?: string;
  }[];
  methodologies: string[];
  coauthorPatterns: { coauthor: string; frequency: number }[];
  fieldHistory: { method: string; year: number }[];
  pdfUrl?: string;
  pageUrl?: string;
  sourceSite?: string;
  doi?: string;
  arxivId?: string;
};

export default function Page() {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [view, setView] = useState<"upload" | "pipeline" | "results">("upload");
  const consumedExtensionQuery = useRef(false);

  const setInitialAnalysisPipeline = () => {
    setPipelineSteps([
      { id: "resolve-citations", label: "Resolving citation sources", status: "running", detail: "Looking up abstracts, dates, and metadata" },
      { id: "embed-claims", label: "Embedding claim contexts", status: "pending", detail: "Using all-MiniLM-L6-v2 locally" },
      { id: "score-signals", label: "Scoring six integrity signals", status: "pending", detail: "Citation, temporal, statistic, methodology, consistency, author" },
      { id: "finalize", label: "Preparing conclusion", status: "pending", detail: "Computing score, grade, and confidence" },
    ]);
  };

  const handleUpload = useCallback(async (data: PaperInput) => {
    setIsLoading(true);
    setView("pipeline");
    setInitialAnalysisPipeline();
    try {
      setPipelineSteps((steps) =>
        steps.map((step) =>
          step.id === "resolve-citations"
            ? { ...step, status: "done", detail: `${data.citations.length} citation(s) queued for scoring` }
            : step.id === "embed-claims"
              ? { ...step, status: "running" }
              : step
        )
      );

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          citations: data.citations.map((c, idx) => ({
            id: `citation-${idx}`,
            text: c.text,
            year: c.year,
            authors: c.authors,
            abstract: c.abstract,
            doi: c.doi,
          })),
          citationInstances: data.citationInstances || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Analyze request failed: ${response.status}`);
      }

      const analysisResult = await response.json();

      // API returns timestamp as string; normalize for dashboard rendering
      if (analysisResult?.timestamp) {
        analysisResult.timestamp = new Date(analysisResult.timestamp);
      }

      setPipelineSteps(
        (analysisResult?.pipelineTrace || []).map((step: any, index: number) => ({
          id: `backend-${index}`,
          label: step.stage,
          status: step.status,
          detail: step.detail,
        }))
      );

      setReport(analysisResult);
      setView("results");
    } catch (error) {
      console.error("[v0] Error analyzing paper:", error);
      setPipelineSteps((steps) =>
        steps.map((step) =>
          step.status === "running" ? { ...step, status: "fail", detail: "Analysis request failed" } : step
        )
      );
      setView("pipeline");
      alert("Failed to analyze paper. Please try again.");
    } finally {
      setIsLoading(false);
      setPipelineSteps((steps) =>
        steps.map((step) => (step.status === "running" ? { ...step, status: "done" } : step))
      );
    }
  }, []);

  const handlePdfUrlUpload = useCallback(async (payload: Partial<PaperInput>) => {
    const pdfUrl = payload?.pdfUrl;
    if (!pdfUrl) {
      return;
    }

    setIsLoading(true);
    setView("pipeline");
    setPipelineSteps([
      { id: "pdf-fetch", label: "Fetching linked PDF", status: "running", detail: pdfUrl },
      { id: "pdf-parse", label: "Parsing PDF", status: "pending", detail: "Sending PDF into PaperTrace parser" },
      { id: "pdf-analyze", label: "Preparing analysis", status: "pending", detail: "Will score extracted claims and citations after parsing" },
    ]);

    try {
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrl }),
      });

      if (!response.ok) {
        throw new Error(`PDF parse request failed: ${response.status}`);
      }

      const parsed = await response.json();
      setPipelineSteps([
        { id: "pdf-fetch", label: "Fetching linked PDF", status: "done", detail: payload?.pageUrl || pdfUrl },
        { id: "pdf-parse", label: "Parsing PDF", status: parsed?.citationSource === "grobid" ? "done" : "warning", detail: `Citation source: ${parsed?.citationSource || "unknown"}` },
        { id: "pdf-analyze", label: "Preparing analysis", status: "running", detail: `${parsed?.citationDetectedCount || parsed?.citations?.length || 0} citation instance(s) ready for scoring` },
      ]);

      await handleUpload({
        title: parsed?.title || payload?.title || "Untitled Paper",
        authors: Array.isArray(parsed?.authors) && parsed.authors.length > 0 ? parsed.authors : Array.isArray(payload?.authors) && payload?.authors.length > 0 ? payload.authors : ["Unknown"],
        year: Number(parsed?.year) || Number(payload?.year) || new Date().getFullYear(),
        abstractText: parsed?.abstractText || payload?.abstractText || "",
        fullText: parsed?.fullText || payload?.fullText || "",
        citations: Array.isArray(parsed?.citations) ? parsed.citations : [],
        citationInstances: Array.isArray(parsed?.citationInstances) ? parsed.citationInstances : [],
        methodologies: Array.isArray(parsed?.methodologies) ? parsed.methodologies : Array.isArray(payload?.methodologies) ? payload.methodologies : [],
        coauthorPatterns: Array.isArray(parsed?.coauthorPatterns) ? parsed.coauthorPatterns : Array.isArray(payload?.coauthorPatterns) ? payload.coauthorPatterns : [],
        fieldHistory: Array.isArray(parsed?.fieldHistory) ? parsed.fieldHistory : Array.isArray(payload?.fieldHistory) ? payload.fieldHistory : [],
        pdfUrl,
        pageUrl: payload?.pageUrl,
        sourceSite: payload?.sourceSite,
        doi: payload?.doi,
        arxivId: payload?.arxivId,
      });
    } catch (error) {
      console.error("[PaperTrace] Error parsing linked PDF:", error);
      setPipelineSteps((steps) =>
        steps.map((step) =>
          step.status === "running" || step.status === "pending"
            ? { ...step, status: step.id === "pdf-analyze" ? "pending" : "fail", detail: step.id === "pdf-fetch" ? "Failed to fetch PDF" : step.id === "pdf-parse" ? "Failed to parse PDF" : "Analysis did not start" }
            : step
        )
      );
      alert("Failed to fetch and parse the linked PDF. You can still retry from the source page or use manual upload.");
      setIsLoading(false);
    }
  }, [handleUpload]);

  const readExtensionHandoff = useCallback(() => {
    if (typeof window === "undefined") {
      return { reportParam: null as string | null, payloadParam: null as string | null };
    }

    const queryParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);

    return {
      reportParam: queryParams.get("paperTraceReport") || hashParams.get("paperTraceReport"),
      payloadParam: queryParams.get("paperTracePayload") || hashParams.get("paperTracePayload"),
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || consumedExtensionQuery.current) {
      return;
    }

    const { reportParam, payloadParam } = readExtensionHandoff();

    if (!reportParam && !payloadParam) {
      return;
    }

    consumedExtensionQuery.current = true;

    try {
      if (reportParam) {
        const parsedReport = JSON.parse(reportParam);
        if (parsedReport?.timestamp) {
          parsedReport.timestamp = new Date(parsedReport.timestamp);
        }
        setReport(parsedReport);
        setView("results");
        setPipelineSteps([]);
      } else if (payloadParam) {
        const parsedPayload = JSON.parse(payloadParam);
        if (parsedPayload?.pdfUrl) {
          handlePdfUrlUpload(parsedPayload);
        } else {
          handleUpload({
          title: parsedPayload?.title || "Untitled Paper",
          authors: Array.isArray(parsedPayload?.authors) && parsedPayload.authors.length > 0 ? parsedPayload.authors : ["Unknown"],
          year: Number(parsedPayload?.year) || new Date().getFullYear(),
          abstractText: parsedPayload?.abstractText || parsedPayload?.abstract || "",
          fullText: parsedPayload?.fullText || parsedPayload?.text || "",
          citations: Array.isArray(parsedPayload?.citations) ? parsedPayload.citations : [],
          citationInstances: Array.isArray(parsedPayload?.citationInstances) ? parsedPayload.citationInstances : [],
          methodologies: Array.isArray(parsedPayload?.methodologies) ? parsedPayload.methodologies : [],
          coauthorPatterns: Array.isArray(parsedPayload?.coauthorPatterns) ? parsedPayload.coauthorPatterns : [],
          fieldHistory: Array.isArray(parsedPayload?.fieldHistory) ? parsedPayload.fieldHistory : [],
          pdfUrl: parsedPayload?.pdfUrl || "",
          pageUrl: parsedPayload?.pageUrl || "",
          sourceSite: parsedPayload?.sourceSite || "",
          doi: parsedPayload?.doi || "",
          arxivId: parsedPayload?.arxivId || "",
        });
        }
      }
    } catch (error) {
      console.error("[PaperTrace] Failed to consume extension payload:", error);
    } finally {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [handlePdfUrlUpload, handleUpload, readExtensionHandoff]);

  return (
    <main className="min-h-screen bg-[#f3ead6] text-[#1b140e]">
      {view === "upload" && (
          <PaperUpload onUpload={handleUpload} isLoading={isLoading} onPipelineUpdate={setPipelineSteps} />
      )}

      {view === "pipeline" && (
        <AnalysisPipeline steps={pipelineSteps} />
      )}

      {view === "results" && report && (
        <ResultsDashboard
          report={report}
          onBack={() => {
            setReport(null);
            setView("upload");
            setPipelineSteps([]);
          }}
        />
      )}
    </main>
  );
}
