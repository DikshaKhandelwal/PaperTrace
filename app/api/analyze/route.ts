import { NextRequest, NextResponse } from "next/server";
import { analyzePaper, AnalysisReport } from "@/lib/detectionEngine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      title,
      authors,
      year,
      abstractText,
      fullText,
      citations,
      methodologies,
      coauthorPatterns,
      fieldHistory,
    } = body;

    // Validate required fields
    if (!title || !authors || !year) {
      return NextResponse.json(
        { error: "Missing required fields: title, authors, year" },
        { status: 400 }
      );
    }

    const report: AnalysisReport = await analyzePaper({
      title,
      authors: Array.isArray(authors) ? authors : [authors],
      year: parseInt(year),
      abstractText: abstractText || "",
      fullText: fullText || "",
      citations: citations || [],
      methodologies: methodologies || [],
      coauthorPatterns: coauthorPatterns || [],
      fieldHistory: fieldHistory || [],
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("[v0] Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze paper" },
      { status: 500 }
    );
  }
}
