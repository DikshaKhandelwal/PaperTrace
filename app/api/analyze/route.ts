import { NextRequest, NextResponse } from "next/server";
import { analyzePaper as localAnalyze, AnalysisReport } from "@/lib/detectionEngine";

function getBackendCandidates(request: NextRequest) {
  const deployedBackend = (process.env.PAPERTRACE_BACKEND || "https://papertrace-1.onrender.com").replace(/\/+$/, "");
  const localBackends = ["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:8001", "http://127.0.0.1:8001"];
  const hostname = request.nextUrl.hostname;
  const isLocalRequest = hostname === "localhost" || hostname === "127.0.0.1";

  return isLocalRequest ? [...localBackends, deployedBackend] : [deployedBackend, ...localBackends];
}

async function callBackend(body: any, request: NextRequest) {
  const backendCandidates = getBackendCandidates(request);
  for (const backendUrl of backendCandidates) {
    try {
      console.info(`[api/analyze] trying backend candidate: ${backendUrl}`);
      const res = await fetch(`${backendUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

      if (res.ok) {
        console.info(`[api/analyze] using backend candidate: ${backendUrl}`);
        return await res.json();
      }

      console.warn(`Backend candidate failed ${backendUrl}:`, res.status);
    } catch (err) {
      console.warn(`Backend candidate unavailable ${backendUrl}:`, err);
    }
  }

  console.warn("All backend candidates unavailable, falling back to local engine");
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { title, authors, year, abstractText, fullText, citations, citationInstances, methodologies, coauthorPatterns, fieldHistory } = body;

    if (!title || !authors || !year) {
      return NextResponse.json({ error: "Missing required fields: title, authors, year" }, { status: 400 });
    }

    // First try backend pipeline
    const backendResult = await callBackend({ title, authors, year, abstractText, fullText, citations, citationInstances }, request);
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
