"use client";

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
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-green-900 text-green-100";
      case "B":
        return "bg-blue-900 text-blue-100";
      case "C":
        return "bg-yellow-900 text-yellow-100";
      case "D":
        return "bg-orange-900 text-orange-100";
      case "F":
        return "bg-red-900 text-red-100";
      default:
        return "bg-slate-900 text-slate-100";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "green":
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case "yellow":
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case "red":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "green":
        return "bg-green-900/20 border-green-700";
      case "yellow":
        return "bg-yellow-900/20 border-yellow-700";
      case "red":
        return "bg-red-900/20 border-red-700";
      default:
        return "bg-slate-700/20 border-slate-600";
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-slate-300 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </Button>

        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-white mb-2">{report.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
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
        <Card className="border-slate-700 bg-gradient-to-r from-slate-800 to-slate-800/50 backdrop-blur mb-8 overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-sm font-semibold mb-2">OVERALL ASSESSMENT</p>
                <h2 className="text-white text-sm mb-4">Research Quality Grade</h2>
                <p className="text-slate-300 text-sm">
                  {gradeDescription[report.overallGrade as keyof typeof gradeDescription]}
                </p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`w-24 h-24 rounded-lg flex items-center justify-center text-4xl font-serif font-bold ${getGradeColor(report.overallGrade)}`}
                >
                  {report.overallGrade}
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Risk Score</p>
                  <p className="text-2xl font-bold text-white">{report.overallScore}%</p>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-700">
              <div>
                <p className="text-xs text-slate-400 mb-1">Confidence Level</p>
                <p className="text-xl font-bold text-white">{report.confidence}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Citations Analyzed</p>
                <p className="text-xl font-bold text-white">
                  {report.verifiedCitations}/{report.citationCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Analyzed</p>
                <p className="text-xl font-bold text-white">
                  {report.timestamp.toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detection Signals */}
        <Tabs defaultValue="overview" className="mb-8">
          <TabsList className="grid w-full grid-cols-3 bg-slate-700/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">
              <Eye className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="signals" className="data-[state=active]:bg-blue-600">
              <Zap className="w-4 h-4 mr-2" />
              Signals
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-blue-600">
              <Search className="w-4 h-4 mr-2" />
              Details
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-6">
            {/* Summary Alert */}
            {report.overallScore > 60 && (
              <Alert className="border-red-700 bg-red-900/20">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertTitle className="text-red-200 ml-2">High Risk Assessment</AlertTitle>
                <AlertDescription className="text-red-300 ml-2 mt-2">
                  This paper shows multiple integrity concerns. Recommend editorial review before
                  publication or citation.
                </AlertDescription>
              </Alert>
            )}

            {report.overallScore > 35 && report.overallScore <= 60 && (
              <Alert className="border-yellow-700 bg-yellow-900/20">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <AlertTitle className="text-yellow-200 ml-2">Moderate Concerns</AlertTitle>
                <AlertDescription className="text-yellow-300 ml-2 mt-2">
                  Several areas warrant further investigation. Verify claims and citations before
                  relying on findings.
                </AlertDescription>
              </Alert>
            )}

            {report.overallScore <= 35 && (
              <Alert className="border-green-700 bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertTitle className="text-green-200 ml-2">Research Appears Sound</AlertTitle>
                <AlertDescription className="text-green-300 ml-2 mt-2">
                  No major integrity concerns detected. This paper passes basic quality checks.
                </AlertDescription>
              </Alert>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {report.signals.map((signal, idx) => (
                <Card key={idx} className="border-slate-700 bg-slate-800/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2 mb-2">
                      {getSeverityIcon(signal.severity)}
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-300 truncate">
                          {signal.signalName}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-white">{signal.score}</p>
                    <p className="text-xs text-slate-400 mt-1">Risk Score</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals" className="space-y-4 mt-6">
            {report.signals.map((signal, idx) => (
              <Card key={idx} className={`border ${getSeverityBg(signal.severity)} bg-slate-800/30`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeverityIcon(signal.severity)}
                      <div className="flex-1">
                        <CardTitle className="text-white flex items-center gap-2">
                          {signal.signalName}
                          <Badge
                            variant="outline"
                            className={`ml-auto ${
                              signal.severity === "green"
                                ? "bg-green-900/30 border-green-700 text-green-300"
                                : signal.severity === "yellow"
                                  ? "bg-yellow-900/30 border-yellow-700 text-yellow-300"
                                  : "bg-red-900/30 border-red-700 text-red-300"
                            }`}
                          >
                            Score: {signal.score}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-slate-400 mt-2">
                          Confidence: {signal.confidence}%
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {signal.details.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-300">Key Findings:</p>
                      <ul className="space-y-1">
                        {signal.details.map((detail, didx) => (
                          <li key={didx} className="text-sm text-slate-300 flex gap-2">
                            <span className="text-slate-500">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {signal.evidence.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-sm font-semibold text-slate-300 mb-2">Evidence:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {signal.evidence.slice(0, 5).map((ev, eidx) => (
                          <div
                            key={eidx}
                            className="text-xs bg-slate-900/30 rounded p-2 flex gap-2 items-start"
                          >
                            <span
                              className={`mt-0.5 flex-shrink-0 ${
                                ev.status === "pass"
                                  ? "text-green-400"
                                  : ev.status === "warning"
                                    ? "text-yellow-400"
                                    : "text-red-400"
                              }`}
                            >
                              {ev.status === "pass" ? "✓" : ev.status === "warning" ? "⚠" : "✗"}
                            </span>
                            <div>
                              <p className="text-slate-300 font-semibold">{ev.claim}</p>
                              <p className="text-slate-400 mt-1">{ev.details}</p>
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

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-6">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Paper Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Title</p>
                    <p className="text-white">{report.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Publication Year</p>
                    <p className="text-white">{report.year}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-slate-400 mb-1">Authors</p>
                    <p className="text-white">{report.authors.join(", ")}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-slate-400 mb-1">Abstract</p>
                    <p className="text-slate-300 text-sm">{report.abstract.substring(0, 300)}...</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white">Analysis Methodology</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 space-y-2">
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
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Download className="w-4 h-4" />
            Export as PDF
          </Button>
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 gap-2">
            <Share2 className="w-4 h-4" />
            Share Report
          </Button>
        </div>
      </div>
    </div>
  );
}
