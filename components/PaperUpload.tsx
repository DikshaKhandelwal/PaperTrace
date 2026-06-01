"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Newspaper, ArrowRight, BookOpen, Download } from "lucide-react";

interface UploadProps {
  onPipelineUpdate?: (steps: Array<{
    id: string;
    label: string;
    status: "pending" | "running" | "done" | "warning" | "fail";
    detail?: string;
  }>) => void;
  onUpload: (data: {
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
      refData?: { doi?: string; title?: string; year?: number; authors?: string };
      citationType?: string;
      year?: number;
      title?: string;
      doi?: string;
    }[];
    methodologies: string[];
    coauthorPatterns: { coauthor: string; frequency: number }[];
    fieldHistory: { method: string; year: number }[];
  }) => void;
  isLoading?: boolean;
}

export function PaperUpload({ onUpload, isLoading, onPipelineUpdate }: UploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    year: new Date().getFullYear().toString(),
    abstractText: "",
    fullText: "",
    citations: "",
    methodology: "",
  });

  const backendUrls = [
    process.env.NEXT_PUBLIC_PAPERTRACE_BACKEND || "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8001",
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf")) {
        setFile(selectedFile);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf")) {
        setFile(selectedFile);
      }
    }
  };

  const handleSubmitFile = async () => {
    if (!file) return;

    try {
      onPipelineUpdate?.([
        { id: "parse-start", label: "Parsing PDF", status: "running", detail: "Sending file to backend parser" },
        { id: "citation-extract", label: "Extracting citations", status: "pending", detail: "GROBID + regex fallback" },
        { id: "analyze-start", label: "Analyzing evidence", status: "pending", detail: "Will run after parsing" },
      ]);

      const form = new FormData();
      form.set("file", file);

      let lastError: unknown = null;
      let parsed: any = null;

      for (const baseUrl of backendUrls) {
        try {
          const response = await fetch(`${baseUrl}/parse-pdf`, {
            method: "POST",
            body: form,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err?.error || `Parse failed: ${response.status}`);
          }

          parsed = await response.json();
          onPipelineUpdate?.([
            { id: "parse-start", label: "Parsing PDF", status: "done", detail: "PDF text extracted with PyMuPDF" },
            { id: "citation-extract", label: "Extracting citations", status: parsed?.citationSource === "grobid" ? "done" : "warning", detail: `Citation source: ${parsed?.citationSource || "unknown"}` },
            { id: "analyze-start", label: "Analyzing evidence", status: "pending", detail: "Waiting for scoring stage" },
          ]);
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!parsed) {
        throw lastError || new Error("Unable to reach PDF parsing backend");
      }

      const citations = Array.isArray(parsed?.citations) ? parsed.citations : [];
      const citationInstances = Array.isArray(parsed?.citationInstances) ? parsed.citationInstances : [];

      const data = {
        title: parsed?.title || file.name.replace(".pdf", "").replace(/[-_]/g, " "),
        authors: Array.isArray(parsed?.authors) && parsed.authors.length > 0 ? parsed.authors : ["Author from PDF"],
        year: new Date().getFullYear(),
        abstractText: parsed?.abstractText || "No abstract found",
        fullText: parsed?.fullText || "",
        citations,
        citationInstances,
        methodologies: parsed?.methodologies || [],
        coauthorPatterns: parsed?.coauthorPatterns || [],
        fieldHistory: parsed?.fieldHistory || [],
      };

      onPipelineUpdate?.([
        { id: "parse-start", label: "Parsing PDF", status: "done", detail: "Parsed PDF text and citations" },
        { id: "citation-extract", label: "Extracting citations", status: (citationInstances.length > 0 || citations.length > 0) ? "done" : "warning", detail: `${citationInstances.length || citations.length} citation instance(s) ready for analysis` },
        { id: "analyze-start", label: "Analyzing evidence", status: "running", detail: "Sending parsed paper into the scoring pipeline" },
      ]);

      onUpload(data);
    } catch (error) {
      onPipelineUpdate?.([
        { id: "parse-start", label: "Parsing PDF", status: "fail", detail: "Backend parse failed" },
        { id: "citation-extract", label: "Extracting citations", status: "pending", detail: "Not executed" },
        { id: "analyze-start", label: "Analyzing evidence", status: "pending", detail: "Not executed" },
      ]);
      alert("Error parsing PDF via backend. Ensure backend is running and (optionally) GROBID is available.\nYou can also use Manual Entry.");
      console.error("[v0] PDF read error:", error);
    }
  };

  const handleSubmitManual = () => {
    if (!formData.title || !formData.authors || !formData.abstractText) {
      alert("Please fill in all required fields");
      return;
    }

    // Parse citations from text
    const citationLines = formData.citations
      .split("\n")
      .filter((line) => line.trim())
      .map((text, idx) => ({
        text,
        abstract: `Abstract for citation ${idx + 1}`,
        year: parseInt(formData.year) - (idx % 5),
        authors: `Author ${idx + 1}`,
      }));

    const methodologies = formData.methodology
      .split("\n")
      .filter((line) => line.trim());

    onUpload({
      title: formData.title,
      authors: formData.authors.split(",").map((a) => a.trim()),
      year: parseInt(formData.year),
      abstractText: formData.abstractText,
      fullText: formData.fullText || formData.abstractText,
      citations: citationLines,
      methodologies,
      coauthorPatterns: [],
      fieldHistory: [],
    });
  };

  return (
    <div className="min-h-screen paper-texture bg-[radial-gradient(circle_at_top,_rgba(139,94,52,0.10),_transparent_28%),linear-gradient(180deg,_#f7efe0,_#efe0c1)] p-6 text-[#1b140e]">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Newspaper className="w-8 h-8 text-[#8b5e34]" />
            <h1 className="text-4xl font-serif font-bold text-[#1b140e]">PaperTrace</h1>
          </div>
          <Button asChild variant="outline" className="border-[#d5c3a4] bg-[#fbf7ef] text-[#4b3a2a] hover:bg-[#f2e8d6]">
            <a href="/papertrace-extension.zip" download>
              <Download className="mr-2 h-4 w-4" />
              Download Extension
            </a>
          </Button>
        </div>
        <p className="text-lg font-serif italic text-[#6d5c48]">Research Quality Auditor</p>
        <p className="mt-2 max-w-3xl text-[#594735]">
          Detect research integrity issues in seconds. Citation verification, temporal anomalies,
          statistical provenance, methodology gaps, and more.
        </p>
      </div>

      {/* Main Card */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-[#d5c3a4] bg-[#fbf7ef]/95 backdrop-blur shadow-[0_16px_60px_rgba(80,57,31,0.08)]">
          <CardHeader className="border-b border-[#d5c3a4]">
            <CardTitle className="text-2xl font-serif text-[#1b140e]">Analyze a Paper</CardTitle>
            <CardDescription className="text-[#665544]">
              Upload a PDF or enter details manually. Analysis takes 30-60 seconds.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#e7d7bb]">
                <TabsTrigger value="upload" className="data-[state=active]:bg-[#8b5e34] data-[state=active]:text-[#fff8ef]">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload PDF
                </TabsTrigger>
                <TabsTrigger value="manual" className="data-[state=active]:bg-[#8b5e34] data-[state=active]:text-[#fff8ef]">
                  <FileText className="w-4 h-4 mr-2" />
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-4 mt-6">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition cursor-pointer ${
                    dragActive
                      ? "border-[#8b5e34] bg-[#f8efe1]"
                      : "border-[#d5c3a4] hover:border-[#b48a5a] hover:bg-[#f8efe3]"
                  }`}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? "text-[#8b5e34]" : "text-[#7b6a55]"}`} />
                  <p className="mb-2 font-semibold text-[#1b140e]">
                    {file ? file.name : "Drag & drop your PDF here"}
                  </p>
                  <p className="mb-4 text-sm text-[#665544]">
                    {file ? "Ready to analyze" : "or click to browse for a file"}
                  </p>

                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload">
                    <Button variant="outline" className="border-[#d5c3a4] text-[#4b3a2a] bg-[#fbf7ef]" asChild>
                      <span>Choose File</span>
                    </Button>
                  </label>

                  {file && (
                    <Button
                      onClick={handleSubmitFile}
                      disabled={isLoading}
                      className="ml-4 bg-[#8b5e34] text-[#fff8ef] hover:bg-[#6f4726]"
                    >
                      {isLoading ? "Analyzing..." : "Analyze Paper"}
                      {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  )}
                </div>

                <div className="rounded-lg border border-[#d5c3a4] bg-[#fffaf2] p-4 text-sm text-[#4b3a2a]">
                  <BookOpen className="mr-2 inline h-4 w-4 text-[#8b5e34]" />
                  Supported formats: PDF files up to 50MB. Scanned PDFs may have reduced accuracy.
                </div>
              </TabsContent>

              {/* Manual Entry Tab */}
              <TabsContent value="manual" className="space-y-4 mt-6">
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1b140e]">
                      Paper Title *
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter paper title"
                      className="border-[#d5c3a4] bg-[#fffaf2] text-[#1b140e] placeholder:text-[#8d7a64]"
                    />
                  </div>

                  {/* Authors */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1b140e]">
                      Authors * (comma-separated)
                    </label>
                    <Input
                      value={formData.authors}
                      onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                      placeholder="Dr. Smith, Prof. Johnson"
                      className="border-[#d5c3a4] bg-[#fffaf2] text-[#1b140e] placeholder:text-[#8d7a64]"
                    />
                  </div>

                  {/* Year */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1b140e]">Year *</label>
                    <Input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="border-[#d5c3a4] bg-[#fffaf2] text-[#1b140e]"
                    />
                  </div>

                  {/* Abstract */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1b140e]">
                      Abstract *
                    </label>
                    <Textarea
                      value={formData.abstractText}
                      onChange={(e) => setFormData({ ...formData, abstractText: e.target.value })}
                      placeholder="Enter the paper abstract..."
                      className="min-h-24 border-[#d5c3a4] bg-[#fffaf2] text-[#1b140e] placeholder:text-[#8d7a64]"
                    />
                  </div>

                  {/* Methodology */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1b140e]">
                      Methodology (one per line)
                    </label>
                    <Textarea
                      value={formData.methodology}
                      onChange={(e) => setFormData({ ...formData, methodology: e.target.value })}
                      placeholder="Method 1&#10;Method 2&#10;Method 3"
                      className="min-h-20 border-[#d5c3a4] bg-[#fffaf2] text-[#1b140e] placeholder:text-[#8d7a64]"
                    />
                  </div>

                  {/* Citations */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1b140e]">
                      Citations (one per line)
                    </label>
                    <Textarea
                      value={formData.citations}
                      onChange={(e) => setFormData({ ...formData, citations: e.target.value })}
                      placeholder="Citation 1 (Author et al., Year)&#10;Citation 2 (Author et al., Year)"
                      className="min-h-20 border-[#d5c3a4] bg-[#fffaf2] text-[#1b140e] placeholder:text-[#8d7a64]"
                    />
                  </div>

                  {/* Full Text */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1b140e]">
                      Full Text (optional)
                    </label>
                    <Textarea
                      value={formData.fullText}
                      onChange={(e) => setFormData({ ...formData, fullText: e.target.value })}
                      placeholder="Enter or paste the full paper text..."
                      className="min-h-24 border-[#d5c3a4] bg-[#fffaf2] text-[#1b140e] placeholder:text-[#8d7a64]"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmitManual}
                    disabled={isLoading}
                    className="h-10 w-full bg-[#8b5e34] font-semibold text-[#fff8ef] hover:bg-[#6f4726]"
                  >
                    {isLoading ? "Analyzing..." : "Analyze Paper"}
                    {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {[
            {
              title: "Citation Integrity",
              desc: "Verify citations against source materials",
            },
            {
              title: "Temporal Analysis",
              desc: "Detect impossible publication timelines",
            },
            {
              title: "Statistical Verification",
              desc: "Check statistic provenance and sources",
            },
            {
              title: "Methodology Review",
              desc: "Identify novelty vs implementation gaps",
            },
          ].map((feature, idx) => (
            <div key={idx} className="rounded-lg border border-[#d5c3a4] bg-[#fbf7ef] p-4">
              <h4 className="mb-1 text-sm font-semibold text-[#1b140e]">{feature.title}</h4>
              <p className="text-xs text-[#665544]">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
