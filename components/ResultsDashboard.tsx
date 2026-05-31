"use client";

import { AnalysisReport, DetectionResult } from "@/lib/detectionEngine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface ResultsDashboardProps {
  report: AnalysisReport;
  onBack: () => void;
}

function getSeverityStyles(severity: "green" | "yellow" | "red") {
  switch (severity) {
    case "green":
      return "border-green-900 bg-green-950 text-green-200";
    case "yellow":
      return "border-yellow-900 bg-yellow-950 text-yellow-200";
    case "red":
      return "border-red-900 bg-red-950 text-red-200";
  }
}

function getSeverityIcon(severity: "green" | "yellow" | "red") {
  switch (severity) {
    case "green":
      return <CheckCircle className="h-5 w-5" />;
    case "yellow":
      return <AlertTriangle className="h-5 w-5" />;
    case "red":
      return <AlertCircle className="h-5 w-5" />;
  }
}

function getOverallSeverity(score: number): "green" | "yellow" | "red" {
  if (score < 30) return "green";
  if (score < 60) return "yellow";
  return "red";
}

export function ResultsDashboard({ report, onBack }: ResultsDashboardProps) {
  const overallSeverity = getOverallSeverity(report.overallScore);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-100">{report.title}</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                By {report.authors.join(", ")} ({report.year})
              </CardDescription>
            </div>
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-slate-200 text-sm px-3 py-1 rounded border border-slate-600 hover:bg-slate-700"
            >
              Back
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* Overall Score */}
      <Card className={`border-2 border-solid ${getSeverityStyles(overallSeverity)}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Integrity Score</CardTitle>
              <CardDescription className="text-slate-300 mt-1">
                {report.overallScore < 30
                  ? "Paper appears reliable"
                  : report.overallScore < 60
                    ? "Moderate concerns detected"
                    : "High risk of integrity issues"}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{report.overallScore}</div>
              <div className="text-sm text-slate-300">out of 100</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Detection Signals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {report.signals.map((signal, idx) => (
          <Card
            key={idx}
            className={`border-2 border-solid ${getSeverityStyles(signal.severity)} transition-all hover:shadow-lg`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(signal.severity)}
                  <div>
                    <CardTitle className="text-base">{signal.signalName}</CardTitle>
                    <CardDescription className="text-sm mt-1 text-inherit opacity-90">
                      Risk Score: {Math.round(signal.score)}
                    </CardDescription>
                  </div>
                </div>
                <div className="text-2xl font-bold opacity-75">{Math.round(signal.score)}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {signal.details.slice(0, 3).map((detail, detailIdx) => (
                  <p key={detailIdx} className="text-sm opacity-85 leading-relaxed">
                    • {detail}
                  </p>
                ))}
                {signal.details.length > 3 && (
                  <p className="text-xs opacity-60 pt-2">
                    +{signal.details.length - 3} more findings
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analysis */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-100">Detailed Findings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {report.signals.map((signal, idx) => (
            <div key={idx} className="border-b border-slate-700 pb-6 last:border-0">
              <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                {getSeverityIcon(signal.severity)}
                {signal.signalName}
              </h3>
              <ul className="space-y-2">
                {signal.details.map((detail, detailIdx) => (
                  <li
                    key={detailIdx}
                    className="text-sm text-slate-400 leading-relaxed flex gap-2"
                  >
                    <span className="text-slate-500 mt-0.5">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-100">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="text-sm text-slate-400 flex gap-3">
              <span className="text-blue-400 font-bold min-w-fit">1.</span>
              <span>Verify all citations against original sources to confirm accuracy</span>
            </li>
            <li className="text-sm text-slate-400 flex gap-3">
              <span className="text-blue-400 font-bold min-w-fit">2.</span>
              <span>Check publication dates for temporal consistency</span>
            </li>
            <li className="text-sm text-slate-400 flex gap-3">
              <span className="text-blue-400 font-bold min-w-fit">3.</span>
              <span>Validate methodology claims against established literature</span>
            </li>
            <li className="text-sm text-slate-400 flex gap-3">
              <span className="text-blue-400 font-bold min-w-fit">4.</span>
              <span>Review author collaboration patterns for potential conflicts</span>
            </li>
            <li className="text-sm text-slate-400 flex gap-3">
              <span className="text-blue-400 font-bold min-w-fit">5.</span>
              <span>Examine semantic consistency between abstract and content</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
