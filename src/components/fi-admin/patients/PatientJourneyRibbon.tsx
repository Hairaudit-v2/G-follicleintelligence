import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
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

  return (
    <section
      className="rounded-xl border border-white/[0.08] bg-[#0c1426]/80 p-4 sm:p-5"
      aria-label="Patient journey"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Patient journey
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-3 py-1 text-sm font-semibold",
                TONE_CLASSES[presentation.tone]
              )}
            >
              {presentation.label}
            </span>
            {manuallyOverridden && derivedState !== state ? (
              <span className="text-xs text-amber-300/90">Manual override active</span>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-slate-400">{presentation.description}</p>
        </div>
        <Link
          href={nextBestAction.href}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
        >
          {nextBestAction.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {blockers.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {blockers.map((b) => (
            <li key={b.kind}>
              {b.href ? (
                <Link
                  href={b.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:border-cyan-500/30",
                    b.severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      : "border-amber-500/25 bg-amber-500/8 text-amber-200"
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {b.label}
                </Link>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-slate-400"
                  title="Ask your clinic admin to configure a fix link for this blocker"
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {b.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}