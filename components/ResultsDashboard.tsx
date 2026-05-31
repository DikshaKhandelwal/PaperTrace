"use client";

import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  ArrowLeft,
  BookOpen,
  Users,
  Eye,
  BarChart3,
  Zap,
  Search,
} from "lucide-react";
import type { AnalysisReport } from "@/lib/detectionEngine";

interface ResultsDashboardProps {
  report: AnalysisReport;
  onBack: () => void;
}

export function ResultsDashboard({ report, onBack }: ResultsDashboardProps) {
  const addWrappedText = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 7) => {
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    lines.forEach((line) => {
      doc.text(line, x, y);
      y += lineHeight;
    });
    return y;
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const ensurePage = (extraSpace = 18) => {
      if (y + extraSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const sectionTitle = (title: string) => {
      ensurePage(20);
      doc.setFont("times", "bold");
      doc.setFontSize(15);
      doc.text(title, margin, y);
      y += 4;
      doc.setDrawColor(139, 94, 52);
      doc.line(margin, y + 1, pageWidth - margin, y + 1);
      y += 7;
    };

    doc.setFillColor(247, 240, 227);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setTextColor(27, 20, 14);

    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.text("PaperTrace Report", margin, y);
    y += 8;

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    y = addWrappedText(doc, report.title, margin, y, contentWidth);
    y = addWrappedText(doc, `Authors: ${report.authors.join(", ")}`, margin, y + 1, contentWidth);
    y = addWrappedText(
      doc,
      `Overall grade: ${report.overallGrade} | Risk score: ${report.overallScore}% | Confidence: ${report.confidence}%`,
      margin,
      y + 1,
      contentWidth,
    );

    sectionTitle("Pipeline");
    (report.pipelineTrace || []).forEach((step) => {
      ensurePage(14);
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.text(`${step.stage} [${step.status}]`, margin, y);
      y += 5;
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      y = addWrappedText(doc, step.detail, margin, y, contentWidth);
      y += 1;
    });

    sectionTitle("Signals");
    report.signals.forEach((signal) => {
      ensurePage(22);
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(`${signal.signalName} (${signal.score})`, margin, y);
      y += 5;
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      signal.details.forEach((detail) => {
        ensurePage(10);
        y = addWrappedText(doc, `• ${detail}`, margin + 2, y, contentWidth - 2, 5.5);
      });
      y += 2;
    });

    sectionTitle("Citations Found");
    y = addWrappedText(doc, `${report.citationCount} citation instance(s) detected in the paper.`, margin, y, contentWidth);
    y = addWrappedText(
      doc,
      `${report.verifiedCitations} citation(s) verified, ${report.citationMismatchCount ?? 0} mismatched, ${report.citationUnverifiableCount ?? 0} unverifiable.`,
      margin,
      y + 1,
      contentWidth,
    );

    if (report.citationDetails && report.citationDetails.length > 0) {
      sectionTitle("Citation Verdicts");
      report.citationDetails.slice(0, 8).forEach((citation, index) => {
        ensurePage(28);
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text(`Citation ${index + 1}: ${citation.verdict || "unverifiable"}`, margin, y);
        y += 5;
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        y = addWrappedText(doc, `Claim: ${(citation.claim || citation.sentence || "").slice(0, 220)}`, margin, y, contentWidth);
        y = addWrappedText(doc, `Passage: ${(citation.bestMatchingPassage || citation.sourceSnippet || citation.sourceAbstract || "").slice(0, 260)}`, margin, y + 1, contentWidth);
        y = addWrappedText(
          doc,
          `Scores: semantic ${citation.semanticScore ?? 0}, keyword ${citation.keywordScore ?? 0}, numeric ${citation.numericScore ?? 0} | source ${citation.sourceUsed || "not_found"}`,
          margin,
          y + 1,
          contentWidth,
        );
        y += 2;
      });
    }

    doc.save(`PaperTrace-${report.title.slice(0, 24).replace(/[^a-z0-9]+/gi, "-") || "report"}.pdf`);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-[#f0f7f2] text-[#2d6a4f]";
      case "B":
        return "bg-[#eef4fb] text-[#355c88]";
      case "C":
        return "bg-[#fff8e8] text-[#8b5e34]";
      case "D":
        return "bg-[#fff1e6] text-[#a45e2b]";
      case "F":
        return "bg-[#fff1ef] text-[#9b342e]";
      default:
        return "bg-[#f3ead6] text-[#1b140e]";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "green":
        return <CheckCircle2 className="w-5 h-5 text-[#2d6a4f]" />;
      case "yellow":
        return <AlertTriangle className="w-5 h-5 text-[#a66a10]" />;
      case "red":
        return <AlertCircle className="w-5 h-5 text-[#9b342e]" />;
      default:
        return null;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "green":
        return "bg-[#f0f7f2] border-[#9ec4b1]";
      case "yellow":
        return "bg-[#fff8e8] border-[#d5b56e]";
      case "red":
        return "bg-[#fff1ef] border-[#d09a95]";
      default:
        return "bg-[#fcf8f1] border-[#d5c3a4]";
    }
  };

  const getVerdictTone = (verdict?: string) => {
    switch (verdict) {
      case "verified":
        return "bg-[#f0f7f2] text-[#2d6a4f] border-[#9ec4b1]";
      case "partial":
        return "bg-[#fff8e8] text-[#8b5e34] border-[#d5b56e]";
      case "mismatch":
        return "bg-[#fff1ef] text-[#9b342e] border-[#d09a95]";
      default:
        return "bg-[#fcf8f1] text-[#4b3a2a] border-[#d5c3a4]";
    }
  };

  const getPipelineStatusTone = (status: string) => {
    switch (status) {
      case "done":
        return "bg-[#f0f7f2] text-[#2d6a4f] border border-[#9ec4b1]";
      case "running":
        return "bg-[#f4eadb] text-[#8b5e34] border border-[#cda979]";
      case "warning":
        return "bg-[#fff8e8] text-[#8b5e34] border border-[#d5b56e]";
      case "fail":
        return "bg-[#fff1ef] text-[#9b342e] border border-[#d09a95]";
      default:
        return "bg-[#f3ead6] text-[#5f4d3a] border border-[#d5c3a4]";
    }
  };

  const getAlertTone = (level: "high" | "medium" | "low") => {
    switch (level) {
      case "high":
        return {
          wrapper: "border-[#d09a95] bg-[#fff1ef]",
          icon: "text-[#9b342e]",
          title: "text-[#7f2823] ml-2",
          description: "text-[#6f332f] ml-2 mt-2",
        };
      case "medium":
        return {
          wrapper: "border-[#d5b56e] bg-[#fff8e8]",
          icon: "text-[#a66a10]",
          title: "text-[#7b5522] ml-2",
          description: "text-[#6b5332] ml-2 mt-2",
        };
      default:
        return {
          wrapper: "border-[#9ec4b1] bg-[#f0f7f2]",
          icon: "text-[#2d6a4f]",
          title: "text-[#2d6a4f] ml-2",
          description: "text-[#3f5b4f] ml-2 mt-2",
        };
    }
  };

  const getEvidenceTone = (status: string) => {
    switch (status) {
      case "pass":
        return {
          row: "bg-[#f8f4ec] border-[#d5c3a4]",
          mark: "text-[#2d6a4f]",
        };
      case "warning":
        return {
          row: "bg-[#fff8e8] border-[#e1c78b]",
          mark: "text-[#a66a10]",
        };
      default:
        return {
          row: "bg-[#fff1ef] border-[#e0b3ae]",
          mark: "text-[#9b342e]",
        };
    }
  };

  const gradeDescription = {
    A: "Research appears sound and credible",
    B: "Minor concerns, generally acceptable",
    C: "Moderate issues requiring review",
    D: "Significant integrity concerns",
    F: "Major red flags, likely fabricated",
  };

  return (
    <div className="min-h-screen bg-[#f3ead6] p-6 text-[#1b140e]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-[#6b5740] hover:bg-[#eadfc7] hover:text-[#1b140e]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </Button>

        {/* Title Section */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-serif font-bold text-[#1b140e]">{report.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-[#6a5843]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{report.authors.join(", ")}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{report.year}</span>
            </div>
          </div>
        </div>

        {/* Grade Card */}
        <Card className="mb-8 overflow-hidden border-[#d5c3a4] bg-[#fbf7ef] shadow-[0_16px_60px_rgba(80,57,31,0.08)]">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7b6a55]">Overall assessment</p>
                <h2 className="mb-4 text-sm text-[#1b140e]">Research Quality Grade</h2>
                <p className="text-sm text-[#554534]">
                  {gradeDescription[report.overallGrade as keyof typeof gradeDescription]}
                </p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`w-24 h-24 rounded-lg flex items-center justify-center border border-[#d5c3a4] text-4xl font-serif font-bold ${getGradeColor(report.overallGrade)}`}
                >
                  {report.overallGrade}
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b6a55]">Risk Score</p>
                  <p className="text-2xl font-bold text-[#1b140e]">{report.overallScore}%</p>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[#d5c3a4] pt-6 md:grid-cols-4">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#7b6a55]">Confidence Level</p>
                <p className="text-xl font-bold text-[#1b140e]">{report.confidence}%</p>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#7b6a55]">Citations Detected</p>
                <p className="text-xl font-bold text-[#1b140e]">
                  {report.citationCount}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#7b6a55]">Grounded citations</p>
                <p className="text-xl font-bold text-[#1b140e]">
                  {report.verifiedCitations}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#7b6a55]">Analyzed</p>
                <p className="text-xl font-bold text-[#1b140e]">{report.timestamp.toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {report.pipelineTrace && report.pipelineTrace.length > 0 && (
          <Card className="mb-8 border-[#d5c3a4] bg-[#fbf7ef] shadow-[0_16px_48px_rgba(80,57,31,0.05)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1b140e]">
                <Zap className="w-5 h-5" />
                Transparent Analysis Pipeline
              </CardTitle>
              <CardDescription className="text-[#665544]">
                What was checked, in the order PaperTrace reached its conclusion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.pipelineTrace.map((step, idx) => (
                <div key={`${step.stage}-${idx}`} className="rounded-xl border border-[#d5c3a4] bg-[#fffaf2] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#1b140e]">{step.stage}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${getPipelineStatusTone(step.status)}`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#665544]">{step.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Detection Signals */}
        <Tabs defaultValue="overview" className="mb-8">
          <TabsList className="grid w-full grid-cols-4 bg-[#e7d7bb]">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#8b5e34] data-[state=active]:text-[#fff8ef]">
              <Eye className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="signals" className="data-[state=active]:bg-[#8b5e34] data-[state=active]:text-[#fff8ef]">
              <Zap className="w-4 h-4 mr-2" />
              Signals
            </TabsTrigger>
            <TabsTrigger value="citations" className="data-[state=active]:bg-[#8b5e34] data-[state=active]:text-[#fff8ef]">
              <Search className="w-4 h-4 mr-2" />
              Citations
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-[#8b5e34] data-[state=active]:text-[#fff8ef]">
              <Search className="w-4 h-4 mr-2" />
              Details
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-6">
            {/* Summary Alert */}
            {report.overallScore > 60 && (
              <Alert className={getAlertTone("high").wrapper}>
                <AlertCircle className={`h-4 w-4 ${getAlertTone("high").icon}`} />
                <AlertTitle className={getAlertTone("high").title}>High Risk Assessment</AlertTitle>
                <AlertDescription className={getAlertTone("high").description}>
                  This paper shows multiple integrity concerns. Recommend editorial review before
                  publication or citation.
                </AlertDescription>
              </Alert>
            )}

            {report.overallScore > 35 && report.overallScore <= 60 && (
              <Alert className={getAlertTone("medium").wrapper}>
                <AlertTriangle className={`h-4 w-4 ${getAlertTone("medium").icon}`} />
                <AlertTitle className={getAlertTone("medium").title}>Moderate Concerns</AlertTitle>
                <AlertDescription className={getAlertTone("medium").description}>
                  Several areas warrant further investigation. Verify claims and citations before
                  relying on findings.
                </AlertDescription>
              </Alert>
            )}

            {report.overallScore <= 35 && (
              <Alert className={getAlertTone("low").wrapper}>
                <CheckCircle2 className={`h-4 w-4 ${getAlertTone("low").icon}`} />
                <AlertTitle className={getAlertTone("low").title}>Research Appears Sound</AlertTitle>
                <AlertDescription className={getAlertTone("low").description}>
                  No major integrity concerns detected. This paper passes basic quality checks.
                </AlertDescription>
              </Alert>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {report.signals.map((signal, idx) => (
                <Card key={idx} className="border-[#d5c3a4] bg-[#fbf7ef] shadow-[0_10px_30px_rgba(80,57,31,0.04)]">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2 mb-2">
                      {getSeverityIcon(signal.severity)}
                      <div className="flex-1">
                        <p className="truncate text-xs font-semibold text-[#4b3a2a]">
                          {signal.signalName}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-[#1b140e]">{signal.score}</p>
                    <p className="mt-1 text-xs text-[#7b6a55]">Risk Score</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals" className="space-y-4 mt-6">
            {report.signals.map((signal, idx) => (
              <Card key={idx} className={`border ${getSeverityBg(signal.severity)} shadow-[0_12px_36px_rgba(80,57,31,0.04)]`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeverityIcon(signal.severity)}
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-[#1b140e]">
                          {signal.signalName}
                          <Badge
                            variant="outline"
                            className={`ml-auto ${
                              signal.severity === "green"
                                ? "bg-[#f0f7f2] border-[#9ec4b1] text-[#2d6a4f]"
                                : signal.severity === "yellow"
                                  ? "bg-[#fff8e8] border-[#d5b56e] text-[#8b5e34]"
                                  : "bg-[#fff1ef] border-[#d09a95] text-[#9b342e]"
                            }`}
                          >
                            Score: {signal.score}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-2 text-[#665544]">
                          Confidence: {signal.confidence}%
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {signal.details.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#4b3a2a]">Key Findings:</p>
                      <ul className="space-y-1">
                        {signal.details.map((detail, didx) => (
                          <li key={didx} className="flex gap-2 text-sm text-[#3c2f22]">
                            <span className="text-[#8b5e34]">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {signal.evidence.length > 0 && (
                    <div className="mt-4 border-t border-[#d5c3a4] pt-4">
                      <p className="mb-2 text-sm font-semibold text-[#4b3a2a]">Evidence:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {signal.evidence.slice(0, 5).map((ev, eidx) => (
                          <div
                            key={eidx}
                            className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${getEvidenceTone(ev.status).row}`}
                          >
                            <span
                              className={`mt-0.5 flex-shrink-0 ${getEvidenceTone(ev.status).mark}`}
                            >
                              {ev.status === "pass" ? "✓" : ev.status === "warning" ? "⚠" : "✗"}
                            </span>
                            <div>
                              <p className="font-semibold text-[#2f241b]">{ev.claim}</p>
                              <p className="mt-1 text-[#665544]">{ev.details}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Citations Tab */}
          <TabsContent value="citations" className="space-y-4 mt-6">
            <Card className="border-[#d5c3a4] bg-[#fbf7ef]">
              <CardHeader>
                <CardTitle className="text-[#1b140e] flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Citation-by-Citation Verification
                </CardTitle>
                <CardDescription className="text-[#665544]">
                  Each card compares the claim sentence, the best matching passage from the cited paper, and the verdict.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.citationDetails && report.citationDetails.length > 0 ? (
                  report.citationDetails.map((citation, idx) => (
                    <div key={`${citation.citedDoi || citation.citedTitle || idx}-${idx}`} className="grid gap-4 rounded-xl border border-[#d5c3a4] bg-[#fffaf2] p-4 lg:grid-cols-[1.2fr_1.2fr_0.8fr]">
                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#7b6a55]">Claim sentence</p>
                        <p className="text-sm leading-6 text-[#2f241b]">{citation.claim || citation.sentence || "No claim extracted"}</p>
                        <p className="text-xs text-[#7b6a55]">Type: {citation.citationType || "supporting"}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#7b6a55]">Best matching passage</p>
                        <p className="text-sm leading-6 text-[#2f241b]">{citation.bestMatchingPassage || citation.sourceSnippet || citation.sourceAbstract || "No source text could be retrieved"}</p>
                        <p className="text-xs text-[#7b6a55]">Source: {citation.sourceUsed || "not_found"}</p>
                      </div>

                      <div className="space-y-3 lg:text-right">
                        <Badge className={`inline-flex border px-3 py-1 text-xs uppercase tracking-[0.18em] ${getVerdictTone(citation.verdict)}`}>
                          {citation.verdict || "unverifiable"}
                        </Badge>
                        <div className="space-y-1 text-sm text-[#2f241b] lg:text-right">
                          <p>Semantic: {citation.semanticScore ?? 0}</p>
                          <p>Keyword: {citation.keywordScore ?? 0}</p>
                          <p>Numeric: {citation.numericScore ?? 0}</p>
                          <p>Composite: {citation.compositeScore ?? 0}</p>
                          <p>Confidence: {citation.confidence || "low"}</p>
                        </div>
                        <p className="text-xs text-[#7b6a55] lg:text-right">
                          {citation.citedTitle || "Unknown source"}
                          {citation.citedYear ? ` • ${citation.citedYear}` : ""}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[#d5c3a4] bg-[#fffaf2] p-8 text-center text-[#665544]">
                    No detailed citation verdicts were returned for this report.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-6">
            <Card className="border-[#d5c3a4] bg-[#fbf7ef]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1b140e]">
                  <BookOpen className="w-5 h-5" />
                  Paper Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#7b6a55] mb-1 uppercase tracking-[0.2em]">Title</p>
                        <p className="text-[#1b140e]">{report.title}</p>
                  </div>
                  <div>
                        <p className="text-xs font-semibold text-[#7b6a55] mb-1 uppercase tracking-[0.2em]">Publication Year</p>
                        <p className="text-[#1b140e]">{report.year}</p>
                  </div>
                  <div className="col-span-2">
                        <p className="text-xs font-semibold text-[#7b6a55] mb-1 uppercase tracking-[0.2em]">Authors</p>
                        <p className="text-[#1b140e]">{report.authors.join(", ")}</p>
                  </div>
                  <div className="col-span-2">
                        <p className="text-xs font-semibold text-[#7b6a55] mb-1 uppercase tracking-[0.2em]">Abstract</p>
                        <p className="text-[#3c2f22] text-sm">{report.abstract.substring(0, 300)}...</p>
                  </div>
                </div>
              </CardContent>
            </Card>

                <Card className="border-[#d5c3a4] bg-[#fbf7ef]">
              <CardHeader>
                    <CardTitle className="text-[#1b140e]">Analysis Methodology</CardTitle>
              </CardHeader>
                  <CardContent className="space-y-2 text-sm text-[#3c2f22]">
                <p>
                  This analysis employed the following detection signals ranked by signal strength:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>
                    <strong>Citation Integrity</strong> - Semantic similarity between claims and
                    cited sources
                  </li>
                  <li>
                    <strong>Temporal Impossibility</strong> - Detection of future-dated citations
                  </li>
                  <li>
                    <strong>Statistic Provenance</strong> - Verification of numerical claims
                  </li>
                  <li>
                    <strong>Methodology Novelty Gap</strong> - Analysis of claimed vs implemented
                    novelty
                  </li>
                  <li>
                    <strong>Internal Consistency</strong> - Detection of logical contradictions
                  </li>
                  <li>
                    <strong>Author Footprint</strong> - Verification of author credentials
                  </li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <Button onClick={handleExportPdf} className="gap-2 bg-[#8b5e34] text-[#fff8ef] hover:bg-[#6f4726]">
            <Download className="w-4 h-4" />
            Export as PDF
          </Button>
          <Button variant="outline" className="gap-2 border-[#d5c3a4] bg-[#fbf7ef] text-[#4b3a2a] hover:bg-[#f2e8d6]">
            <Share2 className="w-4 h-4" />
            Share Report
          </Button>
        </div>
      </div>
    </div>
  );
}
