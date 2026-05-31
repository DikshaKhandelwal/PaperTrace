"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Newspaper, ArrowRight, BookOpen } from "lucide-react";

interface UploadProps {
  onUpload: (data: {
    title: string;
    authors: string[];
    year: number;
    abstractText: string;
    fullText: string;
    citations: { text: string; abstract?: string; year?: number; authors?: string }[];
    methodologies: string[];
    coauthorPatterns: { coauthor: string; frequency: number }[];
    fieldHistory: { method: string; year: number }[];
  }) => void;
  isLoading?: boolean;
}

export function PaperUpload({ onUpload, isLoading }: UploadProps) {
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

    // Simulate PDF extraction
    const mockData = {
      title: `Research Paper from ${file.name.replace(".pdf", "")}`,
      authors: ["Dr. Smith", "Prof. Johnson"],
      year: new Date().getFullYear(),
      abstractText:
        "This paper presents findings on academic integrity and research quality assessment. We develop novel approaches to detect inconsistencies in published research through citation analysis and temporal validation.",
      fullText: `Abstract: This paper presents findings on academic integrity and research quality assessment...
      Methods: We employ semantic similarity analysis and temporal validation techniques...
      Results: Our analysis reveals significant patterns in research integrity across domains...
      Conclusion: These findings suggest the need for enhanced verification mechanisms...`,
      citations: [
        {
          text: "Smith et al. (2020) demonstrated novel approaches to citation analysis",
          abstract: "This work explores methods for analyzing academic citations",
          year: 2020,
          authors: "Smith et al.",
        },
        {
          text: "Johnson (2019) showed that temporal validation is critical",
          abstract: "Temporal aspects of scientific publishing have been understudied",
          year: 2019,
          authors: "Johnson",
        },
      ],
      methodologies: ["Semantic similarity analysis", "Temporal validation", "Citation extraction"],
      coauthorPatterns: [],
      fieldHistory: [],
    };

    onUpload(mockData);
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Newspaper className="w-8 h-8 text-blue-400" />
          <h1 className="text-4xl font-serif font-bold text-white">PaperTrace</h1>
        </div>
        <p className="text-lg text-slate-300 font-serif italic">Research Quality Auditor</p>
        <p className="text-slate-400 mt-2">
          Detect research integrity issues in seconds. Citation verification, temporal anomalies,
          statistical provenance, methodology gaps, and more.
        </p>
      </div>

      {/* Main Card */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-2xl font-serif text-white">Analyze a Paper</CardTitle>
            <CardDescription className="text-slate-300">
              Upload a PDF or enter details manually. Analysis takes 30-60 seconds.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
                <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload PDF
                </TabsTrigger>
                <TabsTrigger value="manual" className="data-[state=active]:bg-blue-600">
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
                      ? "border-blue-400 bg-blue-900/20"
                      : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/30"
                  }`}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? "text-blue-400" : "text-slate-500"}`} />
                  <p className="text-white font-semibold mb-2">
                    {file ? file.name : "Drag & drop your PDF here"}
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
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
                    <Button variant="outline" className="border-slate-600 text-slate-300" asChild>
                      <span>Choose File</span>
                    </Button>
                  </label>

                  {file && (
                    <Button
                      onClick={handleSubmitFile}
                      disabled={isLoading}
                      className="ml-4 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isLoading ? "Analyzing..." : "Analyze Paper"}
                      {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  )}
                </div>

                <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 text-sm text-slate-300">
                  <BookOpen className="w-4 h-4 inline mr-2 text-blue-400" />
                  Supported formats: PDF files up to 50MB. Scanned PDFs may have reduced accuracy.
                </div>
              </TabsContent>

              {/* Manual Entry Tab */}
              <TabsContent value="manual" className="space-y-4 mt-6">
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">
                      Paper Title *
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter paper title"
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                    />
                  </div>

                  {/* Authors */}
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">
                      Authors * (comma-separated)
                    </label>
                    <Input
                      value={formData.authors}
                      onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                      placeholder="Dr. Smith, Prof. Johnson"
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                    />
                  </div>

                  {/* Year */}
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">Year *</label>
                    <Input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  {/* Abstract */}
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">
                      Abstract *
                    </label>
                    <Textarea
                      value={formData.abstractText}
                      onChange={(e) => setFormData({ ...formData, abstractText: e.target.value })}
                      placeholder="Enter the paper abstract..."
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-24"
                    />
                  </div>

                  {/* Methodology */}
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">
                      Methodology (one per line)
                    </label>
                    <Textarea
                      value={formData.methodology}
                      onChange={(e) => setFormData({ ...formData, methodology: e.target.value })}
                      placeholder="Method 1&#10;Method 2&#10;Method 3"
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-20"
                    />
                  </div>

                  {/* Citations */}
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">
                      Citations (one per line)
                    </label>
                    <Textarea
                      value={formData.citations}
                      onChange={(e) => setFormData({ ...formData, citations: e.target.value })}
                      placeholder="Citation 1 (Author et al., Year)&#10;Citation 2 (Author et al., Year)"
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-20"
                    />
                  </div>

                  {/* Full Text */}
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">
                      Full Text (optional)
                    </label>
                    <Textarea
                      value={formData.fullText}
                      onChange={(e) => setFormData({ ...formData, fullText: e.target.value })}
                      placeholder="Enter or paste the full paper text..."
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-24"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmitManual}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10"
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
            <div key={idx} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
              <h4 className="text-white font-semibold text-sm mb-1">{feature.title}</h4>
              <p className="text-slate-400 text-xs">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
