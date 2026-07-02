import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  humanizePatientJourneyBlocker,
  PATIENT_JOURNEY_PIPELINE,
  patientJourneyPipelineIndex,
  patientJourneyProgressPercent,
} from "@/src/lib/fiOs/staffUxPresentation";
import type { PatientJourneySnapshot } from "@/src/lib/patientJourney/patientJourneyState.server";

const TONE_CLASSES: Record<PatientJourneySnapshot["presentation"]["tone"], string> = {
  neutral: "border-slate-600/40 bg-slate-900/50 text-slate-300",
  info: "border-cyan-500/30 bg-cyan-950/40 text-cyan-200",
  warning: "border-amber-500/35 bg-amber-950/35 text-amber-200",
  success: "border-emerald-500/35 bg-emerald-950/40 text-emerald-200",
  critical: "border-rose-500/35 bg-rose-950/40 text-rose-200",
};

export function PatientJourneyRibbon({ journey }: { journey: PatientJourneySnapshot }) {
  const { presentation, blockers, nextBestAction, manuallyOverridden, derivedState, state } =
    journey;
  const pipelineIdx = patientJourneyPipelineIndex(state);
  const progressPct = patientJourneyProgressPercent(state);

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-[#0c1426]/90 p-5 sm:p-6"
      aria-label="Patient journey"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Patient journey
            </p>
            <p className="text-sm font-semibold tabular-nums text-cyan-300/90">{progressPct}% complete</p>
          </div>

          <ol className="flex flex-wrap items-center gap-1 sm:gap-2" aria-label="Journey stages">
            {PATIENT_JOURNEY_PIPELINE.map((stage, idx) => {
              const active = idx === pipelineIdx;
              const done = idx < pipelineIdx;
              return (
                <li key={stage.id} className="flex items-center gap-1 sm:gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold sm:text-sm",
                      active && "border-cyan-400/50 bg-cyan-500/15 text-cyan-100",
                      done && !active && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90",
                      !active && !done && "border-white/[0.08] bg-black/20 text-slate-500"
                    )}
                  >
                    {stage.label}
                  </span>
                  {idx < PATIENT_JOURNEY_PIPELINE.length - 1 ? (
                    <span className="hidden text-slate-600 sm:inline" aria-hidden>
                      →
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-emerald-500/80 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold",
                TONE_CLASSES[presentation.tone]
              )}
            >
              {presentation.label}
            </span>
            {manuallyOverridden && derivedState !== state ? (
              <span className="text-xs text-amber-300/90">Manual override active</span>
            ) : null}
          </div>
          <p className="max-w-2xl text-base text-slate-300">{presentation.description}</p>
        </div>

        <div className="shrink-0 space-y-2 lg:max-w-xs lg:text-right">
          <p className="text-xs font-medium text-slate-500">Recommended next step</p>
          <Link
            href={nextBestAction.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/22 lg:w-auto"
          >
            {nextBestAction.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {nextBestAction.description ? (
            <p className="text-xs text-slate-500 lg:text-right">{nextBestAction.description}</p>
          ) : null}
        </div>
      </div>

      {blockers.length > 0 ? (
        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            What needs attention
          </p>
          <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {blockers.map((b) => (
              <li key={b.kind}>
                {b.href ? (
                  <Link
                    href={b.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:border-cyan-500/30",
                      b.severity === "critical"
                        ? "border-rose-500/35 bg-rose-500/12 text-rose-100"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-100"
                    )}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    {humanizePatientJourneyBlocker(b.kind, b.label)}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-slate-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    {humanizePatientJourneyBlocker(b.kind, b.label)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}