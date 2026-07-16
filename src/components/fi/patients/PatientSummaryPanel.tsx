"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Copy, RefreshCw, Sparkles, X } from "lucide-react";

import { generatePatientAiSummaryAction } from "@/lib/actions/patient-ai-summary-actions";
import { cn } from "@/lib/utils";
import type { PatientAiSummaryResult } from "@/src/lib/patients/ai-summary/patientAiSummaryTypes";
import { PATIENT_AI_SUMMARY_DISCLAIMER } from "@/src/lib/patients/ai-summary/patientAiSummaryTypes";

/**
 * Operational AI Patient Summary side panel.
 * No clinical advice — facts from the record only.
 */
export function PatientSummaryPanel({
  tenantId,
  patientId,
  open,
  onClose,
}: {
  tenantId: string;
  patientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<PatientAiSummaryResult | null>(null);
  const [noteText, setNoteText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    (forceRefresh = false) => {
      setError(null);
      setCopied(false);
      startTransition(() => {
        void generatePatientAiSummaryAction(tenantId, patientId, { forceRefresh }).then((res) => {
          if (!res.ok) {
            setError(res.error);
            setSummary(null);
            return;
          }
          setSummary(res.summary);
          setNoteText(res.noteText);
        });
      });
    },
    [tenantId, patientId]
  );

  useEffect(() => {
    if (!open) return;
    setSummary(null);
    setNoteText("");
    setError(null);
    load(false);
  }, [open, tenantId, patientId, load]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="AI Patient Summary"
      data-testid="patient-ai-summary-panel"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close summary overlay"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0B1220] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI Summary
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-slate-100">
              Let’s get a clear overview
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Operational record snapshot for clinic staff
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <p
            className="rounded-xl border border-amber-400/25 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90"
            role="note"
          >
            {PATIENT_AI_SUMMARY_DISCLAIMER}
          </p>

          {pending && !summary ? (
            <div className="space-y-3" aria-busy="true" aria-label="Generating summary">
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
              <div className="h-20 animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="h-24 animate-pulse rounded-xl bg-white/[0.06]" />
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-amber-200" role="alert">
              {error}
            </p>
          ) : null}

          {summary ? (
            <>
              <p className="text-xs leading-relaxed text-cyan-100/80">{summary.intro}</p>
              <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Overview
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{summary.overview}</p>
                <p className="mt-2 text-[10px] text-slate-600">
                  Source: {summary.source}
                  {summary.model ? ` · ${summary.model}` : ""}
                  {summary.cacheHit ? " · cached" : ""}
                </p>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Timeline highlights
                </h3>
                <ul className="mt-2 space-y-2">
                  {summary.timelineHighlights.map((t, i) => (
                    <li
                      key={`${t.occurredOn}-${t.kind}-${i}`}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-xs text-slate-300"
                    >
                      <span className="tabular-nums text-slate-500">{t.occurredOn}</span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      {t.label}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Operational status
                </h3>
                {summary.operationalFlags.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No operational gaps flagged.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {summary.operationalFlags.map((f) => (
                      <li
                        key={f.code}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-xs",
                          f.severity === "attention"
                            ? "border-amber-400/25 bg-amber-950/20 text-amber-50/90"
                            : "border-white/[0.06] bg-white/[0.02] text-slate-300"
                        )}
                      >
                        {f.label}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Suggested next steps
                </h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-300">
                  {summary.suggestedNextSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Quick links
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.quickLinks.map((q) => (
                    <Link
                      key={q.code}
                      href={q.href}
                      className="inline-flex min-h-9 items-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/20"
                    >
                      {q.label}
                    </Link>
                  ))}
                </div>
              </section>

              {summary.requiresHumanReview ? (
                <p className="rounded-lg border border-amber-400/30 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-100">
                  Flagged for human review — double-check the record before acting on any step.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            disabled={pending || !noteText}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(noteText);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-50"
            data-testid="patient-ai-summary-copy"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copied ? "Copied" : "Copy to note"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => load(true)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50"
            aria-label="Refresh summary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} aria-hidden />
            Refresh
          </button>
        </footer>
      </aside>
    </div>
  );
}

/** Header trigger button + panel mount. */
export function PatientAiSummaryTrigger({
  tenantId,
  patientId,
  className,
}: {
  tenantId: string;
  patientId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
          className
        )}
        data-testid="patient-ai-summary-open"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        AI Summary
      </button>
      <PatientSummaryPanel
        tenantId={tenantId}
        patientId={patientId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
