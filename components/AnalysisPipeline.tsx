"use client";

type PipelineStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "warning" | "fail";
  detail?: string;
};

interface AnalysisPipelineProps {
  steps: PipelineStep[];
  headline?: string;
  subheadline?: string;
}

export function AnalysisPipeline({
  steps,
  headline = "PaperTrace Editorial Room",
  subheadline = "We are checking the paper in public, step by step, before reaching a conclusion.",
}: AnalysisPipelineProps) {
  const completed = steps.filter((step) => step.status === "done" || step.status === "warning").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="min-h-screen paper-texture bg-[radial-gradient(circle_at_top,_rgba(139,94,52,0.12),_transparent_28%),linear-gradient(180deg,_#f7efe0,_#efe0c1)] px-6 py-8 text-[#1b140e]">
      <div className="mx-auto max-w-6xl animate-page-fade-in">
        <div className="mb-6 border-b border-[#c8b08f] pb-4">
          <p className="text-xs uppercase tracking-[0.35em] text-[#8b5e34]">PaperTrace Daily Edition</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight font-bold text-[#1b140e] md:text-5xl">
            {headline}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#564534] md:text-base">{subheadline}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-[#d5c3a4] bg-[#fbf7ef]/90 p-5 shadow-[0_18px_60px_rgba(80,57,31,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-dashed border-[#d5c3a4] pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#7b6a55]">Live pipeline</p>
                <p className="font-serif text-lg font-semibold text-[#1b140e]">What PaperTrace is checking right now</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7b6a55]">Progress</p>
                <p className="font-serif text-2xl font-bold text-[#8b5e34]">{progress}%</p>
              </div>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#e7d7bb]">
              <div
                className="h-full rounded-full bg-[#8b5e34] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`rounded-xl border p-4 transition-all duration-300 ${
                    step.status === "running"
                      ? "border-[#8b5e34] bg-[#f8efe1] shadow-[0_10px_30px_rgba(139,94,52,0.08)]"
                      : step.status === "done"
                        ? "border-[#c5ae89] bg-[#fcf8f2]"
                        : step.status === "warning"
                          ? "border-[#b78732] bg-[#fff8e8]"
                          : step.status === "fail"
                            ? "border-[#9b342e] bg-[#fff1f0]"
                            : "border-[#d9c7a9] bg-[#fcf8f1]"
                  } animate-[page-fade-in_380ms_ease-out]`}
                  style={{ animationDelay: `${idx * 70}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-base font-semibold text-[#1b140e]">{step.label}</p>
                      <p className="mt-1 text-xs leading-5 text-[#665544]">{step.detail}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        step.status === "done"
                          ? "bg-[#2d6a4f] text-[#f8f1e6]"
                          : step.status === "running"
                            ? "bg-[#8b5e34] text-[#fff8ef] animate-pulse"
                            : step.status === "warning"
                              ? "bg-[#b78732] text-[#fff8ef]"
                              : step.status === "fail"
                                ? "bg-[#9b342e] text-[#fff8ef]"
                                : "bg-[#d8c7a8] text-[#534231]"
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  {step.status === "running" && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eadfc9]">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-[#8b5e34]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#d5c3a4] bg-[#fbf7ef]/90 p-5 shadow-[0_18px_60px_rgba(80,57,31,0.05)]">
              <p className="text-xs uppercase tracking-[0.3em] text-[#7b6a55]">Current beat</p>
              <p className="mt-2 font-serif text-2xl font-bold leading-tight text-[#1b140e]">
                Claims, dates, numbers, methods, and authors are being checked as evidence arrives.
              </p>
              <p className="mt-3 text-sm leading-6 text-[#594735]">
                This page is intentionally visible while the backend resolves citations and computes the six signals.
              </p>
            </div>

            <div className="rounded-2xl border border-[#d5c3a4] bg-[#fbf7ef]/90 p-5 shadow-[0_18px_60px_rgba(80,57,31,0.05)]">
              <p className="text-xs uppercase tracking-[0.3em] text-[#7b6a55]">Notes</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#594735]">
                <li>• Citation integrity is checked against source abstracts and claim contexts.</li>
                <li>• Temporal checks compare citation dates against the paper year.</li>
                <li>• Statistic provenance scans numeric claims and compares them to sources.</li>
                <li>• Method novelty and internal consistency are scored after parsing finishes.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}