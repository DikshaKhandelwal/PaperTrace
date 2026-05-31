import { NextRequest, NextResponse } from "next/server";

function getFilenameFromUrl(pdfUrl: string) {
  try {
    const url = new URL(pdfUrl);
    const rawName = url.pathname.split("/").pop() || "paper.pdf";
    return rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName}.pdf`;
  } catch {
    return "paper.pdf";
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let file: File | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const pdfUrl = body?.pdfUrl;

      if (!pdfUrl || typeof pdfUrl !== "string") {
        return NextResponse.json({ error: "No PDF URL provided" }, { status: 400 });
      }

      const pdfResponse = await fetch(pdfUrl, {
        headers: {
          "User-Agent": "PaperTrace/1.0",
          Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        },
      });

      if (!pdfResponse.ok) {
        return NextResponse.json(
          { error: `Failed to fetch PDF from source: ${pdfResponse.status}` },
          { status: 502 }
        );
      }

      const pdfBlob = await pdfResponse.blob();
      file = new File([pdfBlob], getFilenameFromUrl(pdfUrl), {
        type: pdfBlob.type || "application/pdf",
      });
    } else {
      const form = await request.formData();
      const formFile = form.get("file");
      if (formFile instanceof File) {
        file = formFile;
      }
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    const backendUrls = [
      process.env.PAPERTRACE_BACKEND || "http://localhost:8000",
      "http://127.0.0.1:8000",
      "http://localhost:8001",
    ];

    let lastErrorText = "";

    for (const backendUrl of backendUrls) {
      const backendForm = new FormData();
      backendForm.set("file", file, file.name);

      const res = await fetch(`${backendUrl}/parse-pdf`, {
        method: "POST",
        body: backendForm,
      });

      if (res.ok) {
        const parsed = await res.json();
        return NextResponse.json(parsed);
      }

      lastErrorText = await res.text();
    }

    return NextResponse.json(
      { error: `Backend parse failed on all endpoints: ${lastErrorText}` },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to parse PDF: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 500 }
    );
  }
}
