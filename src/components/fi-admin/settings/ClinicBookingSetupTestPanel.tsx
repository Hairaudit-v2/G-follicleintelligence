"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { runClinicBookingSetupTestAction } from "@/lib/actions/fi-clinic-booking-setup-test-actions";
import type {
  ClinicBookingSetupTestResult,
  ClinicBookingSetupTestRow,
  ClinicBookingSetupTestRowStatus,
} from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";
import { cn } from "@/lib/utils";

function rowHeadline(status: ClinicBookingSetupTestRowStatus): string {
  if (status === "pass") return "Ready";
  if (status === "warning") return "Needs attention";
  return "Needs setup";
}

const STATUS_ICON: Record<ClinicBookingSetupTestRowStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  fail: XCircle,
};

const STATUS_COLOR: Record<ClinicBookingSetupTestRowStatus, string> = {
  pass: "text-emerald-400",
  warning: "text-amber-400",
  fail: "text-rose-400",
};

function overallBadgeClass(status: ClinicBookingSetupTestRowStatus, isDark: boolean): string {
  if (status === "pass") return isDark ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30" : "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "warning") return isDark ? "bg-amber-500/15 text-amber-100 ring-amber-500/30" : "bg-amber-50 text-amber-950 ring-amber-200";
  return isDark ? "bg-rose-500/15 text-rose-100 ring-rose-500/35" : "bg-rose-50 text-rose-950 ring-rose-200";
}

export function ClinicBookingSetupTestPanel({
  tenantId,
  clinicId,
  variant = "dark",
  className,
}: {
  tenantId: string;
  clinicId: string;
  variant?: "dark" | "light";
  className?: string;
}) {
  const tid = tenantId.trim();
  const cid = clinicId.trim();
  const isDark = variant === "dark";
  const [result, setResult] = useState<ClinicBookingSetupTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (!cid) return;
    setError(null);
    startTransition(async () => {
      const r = await runClinicBookingSetupTestAction(tid, { clinicId: cid });
      if (!r.ok) {
        setError(r.error);
        setResult(null);
        return;
      }
      setResult(r.result);
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3 sm:px-4",
        isDark ? "border-white/[0.08] bg-black/25" : "border-gray-200 bg-gray-50/90",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={cn("text-[10px] font-semibold uppercase tracking-wider", isDark ? "text-slate-500" : "text-gray-500")}>
            Booking setup test
          </p>
          <p className={cn("text-sm font-medium", isDark ? "text-slate-100" : "text-gray-900")}>
            Safe diagnostic — no bookings created
          </p>
        </div>
        <button
          type="button"
          disabled={pending || !cid}
          onClick={run}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
            isDark ? "bg-cyan-600 text-white hover:bg-cyan-500" : "bg-sky-600 text-white hover:bg-sky-500"
          )}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Run booking setup test
        </button>
      </div>

      <p className={cn("mt-2 text-xs leading-relaxed", isDark ? "text-slate-400" : "text-gray-600")}>
        Checks consultation, PRP / exosomes, surgery, and follow-up paths: catalogue service, room links, preferred room,
        staff rules, calendar-visible clinical assignees (reception excluded), and the same next-slot search used in the
        calendar — read-only.
      </p>

      {error ? (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                overallBadgeClass(result.overallStatus, isDark)
              )}
            >
              Overall: {result.overallStatus === "pass" ? "Pass" : result.overallStatus === "warning" ? "Warning" : "Fail"}
            </span>
          </div>
          <ul className="space-y-2">
            {result.tests.map((t: ClinicBookingSetupTestRow) => (
              <li
                key={t.profile}
                className={cn(
                  "flex flex-col gap-1 rounded-md border px-2.5 py-2 sm:flex-row sm:items-start sm:justify-between",
                  isDark ? "border-white/[0.06] bg-slate-950/40" : "border-gray-100 bg-white"
                )}
              >
                <div className="flex min-w-0 gap-2">
                  {(() => {
                    const Icon = STATUS_ICON[t.status];
                    return <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_COLOR[t.status])} aria-hidden />;
                  })()}
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", isDark ? "text-slate-100" : "text-gray-900")}>
                      {t.label}: <span className="font-semibold">{rowHeadline(t.status)}</span>
                    </p>
                    <p className={cn("mt-0.5 text-xs leading-relaxed", isDark ? "text-slate-400" : "text-gray-600")}>
                      {t.message}
                    </p>
                    {t.suggestedAction ? (
                      <p className={cn("mt-1 text-xs", isDark ? "text-amber-100/90" : "text-amber-900/90")}>{t.suggestedAction}</p>
                    ) : null}
                  </div>
                </div>
                {t.href ? (
                  <Link
                    href={t.href}
                    className={cn(
                      "shrink-0 text-xs font-medium hover:underline sm:pt-0.5",
                      isDark ? "text-cyan-400" : "text-sky-700"
                    )}
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
