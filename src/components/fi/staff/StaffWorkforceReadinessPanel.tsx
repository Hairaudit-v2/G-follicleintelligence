"use client";

import { AlertTriangle, Ban, ShieldCheck } from "lucide-react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { fiBadgeIntentClassNames } from "@/src/components/fi-design/fiDesignTokens";
import {
  WORKFORCE_READINESS_BLOCKING_LABELS,
  WORKFORCE_READINESS_WARNING_LABELS,
  type WorkforceReadinessScoreResult,
} from "@/src/lib/workforce-os/workforceReadinessEngine";

function scoreBarColor(score: number, maxScore: number): string {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.95) return "bg-emerald-500";
  if (ratio >= 0.7) return "bg-amber-400";
  return "bg-rose-500";
}

function FactorRow({
  label,
  score,
  maxScore,
  variant,
}: {
  label: string;
  score: number;
  maxScore: number;
  variant: "dark" | "light";
}) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const textMuted = variant === "dark" ? "text-[#94A3B8]" : "text-slate-500";
  const textMain = variant === "dark" ? "text-[#E2E8F0]" : "text-slate-200";
  const track = variant === "dark" ? "bg-white/10" : "bg-slate-700/50";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={textMain}>{label}</span>
        <span className={`tabular-nums ${textMuted}`}>
          {score}/{maxScore}
        </span>
      </div>
      <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${track}`}>
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(score, maxScore)}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={maxScore}
          aria-label={`${label}: ${score} of ${maxScore}`}
        />
      </div>
    </div>
  );
}

export function StaffWorkforceReadinessPanel({
  readiness,
  variant = "dark",
}: {
  readiness: WorkforceReadinessScoreResult;
  variant?: "dark" | "light";
}) {
  const textMuted = variant === "dark" ? "text-[#94A3B8]" : "text-slate-500";
  const textMain = variant === "dark" ? "text-[#F8FAFC]" : "text-slate-50";
  const badgeBase = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={`text-lg font-semibold ${textMain}`}>Workforce Readiness Intelligence</h2>
          <p className={`mt-1 text-sm ${textMuted}`}>
            Multi-factor operational readiness score — runs alongside legacy readiness states.
          </p>
        </div>
        <span className={`${badgeBase} ${fiBadgeIntentClassNames[readiness.bandDetail.variant]}`}>
          {readiness.bandLabel}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>Readiness score</p>
          <p className={`mt-1 text-4xl font-bold tabular-nums tracking-tight ${textMain}`}>
            {readiness.score}
            <span className={`ml-1 text-lg font-medium ${textMuted}`}>/ 100</span>
          </p>
        </div>
        {readiness.blocking_issues.length === 0 ? (
          <div className={`flex items-center gap-1.5 text-sm text-emerald-300/90`}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            No hard blocks
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-rose-300/90">
            <Ban className="h-4 w-4" aria-hidden />
            {readiness.blocking_issues.length} blocking issue
            {readiness.blocking_issues.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {readiness.factors.map((factor) => (
          <FactorRow
            key={factor.key}
            label={factor.label}
            score={factor.score}
            maxScore={factor.maxScore}
            variant={variant}
          />
        ))}
      </div>

      {readiness.warnings.length > 0 ? (
        <div
          className={
            variant === "dark"
              ? "mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3"
              : "mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
          }
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={variant === "dark" ? "mt-0.5 h-4 w-4 shrink-0 text-amber-300" : "mt-0.5 h-4 w-4 shrink-0 text-amber-700"}
              aria-hidden
            />
            <div>
              <p className={variant === "dark" ? "text-sm font-medium text-amber-100" : "text-sm font-medium text-amber-950"}>
                Warnings
              </p>
              <ul className={`mt-2 space-y-1 text-sm ${variant === "dark" ? "text-amber-100/90" : "text-amber-900"}`}>
                {readiness.warnings.map((w) => (
                  <li key={w}>• {WORKFORCE_READINESS_WARNING_LABELS[w]}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {readiness.blocking_issues.length > 0 ? (
        <div
          className={
            variant === "dark"
              ? "mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3"
              : "mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3"
          }
        >
          <div className="flex items-start gap-2">
            <Ban
              className={variant === "dark" ? "mt-0.5 h-4 w-4 shrink-0 text-rose-300" : "mt-0.5 h-4 w-4 shrink-0 text-rose-700"}
              aria-hidden
            />
            <div>
              <p className={variant === "dark" ? "text-sm font-medium text-rose-100" : "text-sm font-medium text-rose-950"}>
                Blocking issues — cannot assign to surgery
              </p>
              <ul className={`mt-2 space-y-1 text-sm ${variant === "dark" ? "text-rose-100/90" : "text-rose-900"}`}>
                {readiness.blocking_issues.map((b) => (
                  <li key={b}>• {WORKFORCE_READINESS_BLOCKING_LABELS[b]}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StaffWorkforceReadinessCard({
  readiness,
  variant = "dark",
}: {
  readiness: WorkforceReadinessScoreResult;
  variant?: "dark" | "light";
}) {
  return (
    <DashboardCard className="p-6 sm:p-8">
      <StaffWorkforceReadinessPanel readiness={readiness} variant={variant} />
    </DashboardCard>
  );
}
