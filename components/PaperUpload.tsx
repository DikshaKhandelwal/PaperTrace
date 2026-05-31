"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, AlertCircle } from "lucide-react";

interface UploadProps {
  onUpload: (data: {
    title: string;
    authors: string[];
    year: number;
    abstractText: string;
    fullText: string;
    citations: { text: string; abstract?: string; year?: number }[];
    methodologies: string[];
    coauthorPatterns: { coauthor: string; frequency: number }[];
    fieldHistory: { method: string; year: number }[];
  }) => void;
  isLoading?: boolean;
}

export function PaperUpload({ onUpload, isLoading }: UploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [manualInput, setManualInput] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    year: new Date().getFullYear().toString(),
    abstractText: "",
    fullText: "",
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
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const mockCitations = [
      { text: "Smith et al. (2020) demonstrated novel findings", abstract: "We present a new approach", year: 2020 },
      { text: "Johnson (2019) showed similar results", abstract: "Building on previous work", year: 2019 },
      { text: "Lee & Wu (2021) found contradictory evidence", abstract: "Our results differ significantly", year: 2021 },
    ];

    const mockMethodologies = [
      "Deep learning architecture",
      "Statistical regression analysis",
      "Novel clustering algorithm",
    ];

    const mockCoauthorPatterns = [
      { coauthor: "Alice Chen", frequency: 5 },
      { coauthor: "Bob Smith", frequency: 3 },
      { coauthor: "Carol Johnson", frequency: 2 },
    ];

    const mockFieldHistory = [
      { method: "Deep learning", year: 2012 },
      { method: "Statistical analysis", year: 1990 },
      { method: "Clustering", year: 2000 },
    ];

    onUpload({
      title: formData.title,
      authors: formData.authors.split(",").map((a) => a.trim()),
      year: parseInt(formData.year),
      abstractText: formData.abstractText,
      fullText: formData.fullText,
      citations: mockCitations,
      methodologies: mockMethodologies,
      coauthorPatterns: mockCoauthorPatterns,
      fieldHistory: mockFieldHistory,
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-2xl text-blue-400">PaperTrace Analysis</CardTitle>
          <CardDescription className="text-slate-400">
            Upload or enter a research paper for integrity analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!manualInput ? (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative rounded-lg border-2 border-dashed p-8 transition-colors ${
                  dragActive
                    ? "border-blue-400 bg-blue-900 bg-opacity-20"
                    : "border-slate-600 hover:border-slate-500"
                }`}
              >
                <input
                  type="file"
                  onChange={handleFileInput}
                  accept=".pdf,.txt"
                  className="absolute inset-0 hidden"
                />
                <div className="flex flex-col items-center justify-center gap-3">
                  <Upload className="h-10 w-10 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-200">
                      {file ? file.name : "Drop your PDF or text file here"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      or click to browse
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full text-slate-300 border-slate-600 hover:bg-slate-700"
                onClick={() => setManualInput(!manualInput)}
              >
                Or enter details manually
              </Button>

              {file && (
                <Button
                  onClick={() => {
                    onUpload({
                      title: "Sample Research Paper",
                      authors: ["Dr. Smith", "Prof. Johnson"],
                      year: 2024,
                      abstractText:
                        "This paper presents novel findings in machine learning using advanced statistical methods.",
                      fullText: "Our research demonstrates significant improvements over prior work...",
                      citations: [
                        { text: "Previous work by Chen et al.", year: 2022 },
                        { text: "Smith showed similar results", year: 2020 },
                      ],
                      methodologies: ["Deep Learning", "Bayesian Analysis"],
                      coauthorPatterns: [
                        { coauthor: "Co-researcher A", frequency: 3 },
                      ],
                      fieldHistory: [
                        { method: "Deep Learning", year: 2012 },
                      ],
                    });
                  }}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? "Analyzing..." : "Analyze Paper"}
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Paper Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter paper title"
                  className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Authors (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.authors}
                  onChange={(e) =>
                    setFormData({ ...formData, authors: e.target.value })
                  }
                  placeholder="John Doe, Jane Smith"
                  className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Year of Publication
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) =>
                    setFormData({ ...formData, year: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Abstract
                </label>
                <textarea
                  value={formData.abstractText}
                  onChange={(e) =>
                    setFormData({ ...formData, abstractText: e.target.value })
                  }
                  placeholder="Paper abstract..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Full Text (excerpt)
                </label>
                <textarea
                  value={formData.fullText}
                  onChange={(e) =>
                    setFormData({ ...formData, fullText: e.target.value })
                  }
                  placeholder="Paper content..."
                  rows={6}
                  className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? "Analyzing..." : "Analyze Paper"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManualInput(false)}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700"
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
