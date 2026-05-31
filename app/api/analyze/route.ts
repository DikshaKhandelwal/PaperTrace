import { NextRequest, NextResponse } from "next/server";
import { analyzePaper as localAnalyze, AnalysisReport } from "@/lib/detectionEngine";

async function callBackend(body: any) {
  try {
    const BACKEND_URL = process.env.PAPERTRACE_BACKEND || "http://localhost:8000";
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Backend unavailable, falling back to local engine:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { title, authors, year, abstractText, fullText, citations, citationInstances, methodologies, coauthorPatterns, fieldHistory } = body;

    if (!title || !authors || !year) {
      return NextResponse.json({ error: "Missing required fields: title, authors, year" }, { status: 400 });
    }

    // First try backend pipeline
    const backendResult = await callBackend({ title, authors, year, abstractText, fullText, citations, citationInstances });
    if (backendResult) {
      if (backendResult?.signals) {
        return NextResponse.json({
          ...backendResult,
          timestamp: backendResult.timestamp || new Date().toISOString(),
        });
      }

      return NextResponse.json(backendResult);
    }

    // Fallback to local detection engine
    const report: AnalysisReport = localAnalyze(
      title,
      Array.isArray(authors) ? authors : [authors],
      parseInt(year as any),
      abstractText || "",
      (methodologies && methodologies.join ? methodologies.join(" ") : (methodologies || "")) as any,
      fullText || "",
      citations || []
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("[v1] Analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze paper" }, { status: 500 });
  }
}
