"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";

import { applyClinicBookingSetupAutoFixAction } from "@/lib/actions/fi-clinic-booking-setup-autofix-actions";
import { runClinicBookingSetupTestAction } from "@/lib/actions/fi-clinic-booking-setup-test-actions";
import type { ClinicBookingSetupAutoFixResult } from "@/src/lib/clinicSetup/clinicBookingSetupAutoFixTypes";
import type {
  ClinicBookingSetupHygieneRow,
  ClinicBookingSetupTestResult,
  ClinicBookingSetupTestRow,
  ClinicBookingSetupTestRowStatus,
} from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";
import { cn } from "@/lib/utils";

/** Must match `AUTOFIX_KEY_PERTH_PHYSICAL_ALIASES` in `clinicBookingSetupAutoFix.server.ts` (client-safe). */
const PERTH_PHYSICAL_ALIASES_FIX_KEY = "perth_physical_aliases";

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
  if (status === "pass") return isDark ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30" : "bg-emerald-500/10 text-emerald-300 ring-emerald-200";
  if (status === "warning") return isDark ? "bg-amber-500/15 text-amber-100 ring-amber-500/30" : "bg-amber-400/10 text-amber-200 ring-amber-200";
  return isDark ? "bg-rose-500/15 text-rose-100 ring-rose-500/35" : "bg-rose-500/10 text-rose-200 ring-rose-200";
}

function collectAutoFixKeys(
  result: ClinicBookingSetupTestResult,
  opts?: { includePerthAliases?: boolean }
): string[] {
  const includePerth = Boolean(opts?.includePerthAliases);
  const keys: string[] = [];
  for (const t of result.tests) {
    if (t.status === "pass") continue;
    for (const k of t.fixKeys ?? []) {
      if (k === PERTH_PHYSICAL_ALIASES_FIX_KEY && !includePerth) continue;
      keys.push(k);
    }
  }
  for (const h of result.hygiene) {
    if (h.status === "pass") continue;
    for (const k of h.fixKeys ?? []) {
      if (k === PERTH_PHYSICAL_ALIASES_FIX_KEY && !includePerth) continue;
      keys.push(k);
    }
  }
  return Array.from(new Set(keys));
}

function hygieneRowHasPerthAliasFix(h: ClinicBookingSetupHygieneRow): boolean {
  return Boolean(h.fixKeys?.includes(PERTH_PHYSICAL_ALIASES_FIX_KEY));
}

function formatAutofixSummary(outcome: ClinicBookingSetupAutoFixResult): string {
  const parts: string[] = [];
  if (outcome.applied.length) {
    parts.push(
      `Applied: ${outcome.applied.map((a) => a.message).join(" ")}`.trim()
    );
  }
  if (outcome.skipped.length) {
    parts.push(`Skipped: ${outcome.skipped.map((s) => `${s.key} (${s.reason})`).join("; ")}`);
  }
  if (outcome.errors.length) {
    parts.push(`Errors: ${outcome.errors.map((e) => `${e.key}: ${e.message}`).join("; ")}`);
  }
  return parts.join(" · ") || "No changes.";
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
  const [autofixSummary, setAutofixSummary] = useState<string | null>(null);
  const [perthPhysicalAliasConfirmed, setPerthPhysicalAliasConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (result) setPerthPhysicalAliasConfirmed(false);
  }, [result]);

  const runTestOnly = async () => {
    const r = await runClinicBookingSetupTestAction(tid, { clinicId: cid });
    if (!r.ok) {
      setError(r.error);
      setResult(null);
      return;
    }
    setResult(r.result);
  };

  const run = () => {
    if (!cid) return;
    setError(null);
    setAutofixSummary(null);
    startTransition(async () => {
      await runTestOnly();
    });
  };

  const applyFixes = (fixKeys: string[], opts?: { confirmPerthAliases?: boolean }) => {
    if (!cid || fixKeys.length === 0) return;
    setError(null);
    setAutofixSummary(null);
    startTransition(async () => {
      const r = await applyClinicBookingSetupAutoFixAction(tid, {
        clinicId: cid,
        fixKeys,
        confirmPerthAliases: opts?.confirmPerthAliases,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAutofixSummary(formatAutofixSummary(r.outcome));
      await runTestOnly();
    });
  };

  const allSafeKeys = result ? collectAutoFixKeys(result, { includePerthAliases: perthPhysicalAliasConfirmed }) : [];
  const showFixAll = allSafeKeys.length >= 2;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3 sm:px-4",
        isDark ? "border-white/[0.08] bg-black/25" : "border-white/[0.08] bg-white/[0.03]",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={cn("text-[10px] font-semibold uppercase tracking-wider", isDark ? "text-slate-500" : "text-gray-500")}>
            Booking setup test
          </p>
          <p className={cn("text-sm font-medium", isDark ? "text-slate-100" : "text-slate-100")}>
            Safe diagnostic — no bookings created
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showFixAll ? (
            <button
              type="button"
              disabled={pending || !cid}
              onClick={() =>
                applyFixes(allSafeKeys, {
                  confirmPerthAliases:
                    perthPhysicalAliasConfirmed && allSafeKeys.includes(PERTH_PHYSICAL_ALIASES_FIX_KEY),
                })
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                isDark ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-violet-600 text-white hover:bg-violet-500"
              )}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Wrench className="h-3.5 w-3.5" aria-hidden />}
              Fix all safe issues
            </button>
          ) : null}
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
      </div>

      <p className={cn("mt-2 text-xs leading-relaxed", isDark ? "text-slate-400" : "text-slate-400")}>
        Checks consultation, PRP / exosomes, surgery, and follow-up paths: catalogue service, room links, preferred room,
        staff rules, calendar-visible clinical assignees (reception excluded), and the same next-slot search used in the
        calendar — read-only.
      </p>

      {error ? (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      ) : null}
      {autofixSummary ? (
        <p className={cn("mt-2 text-xs leading-relaxed", isDark ? "text-slate-300" : "text-slate-300")}>{autofixSummary}</p>
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
                  isDark ? "border-white/[0.06] bg-slate-950/40" : "border-white/[0.06] bg-[#0F1629]/80 backdrop-blur-md"
                )}
              >
                <div className="flex min-w-0 gap-2">
                  {(() => {
                    const Icon = STATUS_ICON[t.status];
                    return <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_COLOR[t.status])} aria-hidden />;
                  })()}
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", isDark ? "text-slate-100" : "text-slate-100")}>
                      {t.label}: <span className="font-semibold">{rowHeadline(t.status)}</span>
                    </p>
                    <p className={cn("mt-0.5 text-xs leading-relaxed", isDark ? "text-slate-400" : "text-slate-400")}>
                      {t.message}
                    </p>
                    {t.suggestedAction ? (
                      <p className={cn("mt-1 text-xs", isDark ? "text-amber-100/90" : "text-amber-200")}>{t.suggestedAction}</p>
                    ) : null}
                    {t.status !== "pass" && t.fixKeys?.length ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          disabled={pending || !cid}
                          onClick={() => applyFixes(t.fixKeys ?? [])}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition disabled:opacity-50",
                            isDark ? "bg-violet-600/90 text-white hover:bg-violet-500" : "bg-violet-600 text-white hover:bg-violet-500"
                          )}
                        >
                          {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Wrench className="h-3 w-3" aria-hidden />}
                          Fix automatically
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {t.href ? (
                  <Link
                    href={t.href}
                    className={cn(
                      "shrink-0 text-xs font-medium hover:underline sm:pt-0.5",
                      isDark ? "text-cyan-400" : "text-cyan-300"
                    )}
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>

          {result.hygiene.length ? (
            <div className="mt-3 space-y-2">
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider", isDark ? "text-slate-500" : "text-gray-500")}>
                Clinic hygiene
              </p>
              <ul className="space-y-2">
                {result.hygiene.map((h: ClinicBookingSetupHygieneRow) => (
                  <li
                    key={h.id}
                    className={cn(
                      "flex flex-col gap-1 rounded-md border px-2.5 py-2 sm:flex-row sm:items-start sm:justify-between",
                      isDark ? "border-white/[0.06] bg-slate-950/40" : "border-white/[0.06] bg-[#0F1629]/80 backdrop-blur-md"
                    )}
                  >
                    <div className="flex min-w-0 gap-2">
                      {(() => {
                        const Icon = STATUS_ICON[h.status];
                        return <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_COLOR[h.status])} aria-hidden />;
                      })()}
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", isDark ? "text-slate-100" : "text-slate-100")}>{h.label}</p>
                        <p className={cn("mt-0.5 text-xs leading-relaxed", isDark ? "text-slate-400" : "text-slate-400")}>
                          {h.message}
                        </p>
                        {h.suggestedAction ? (
                          <p className={cn("mt-1 text-xs", isDark ? "text-amber-100/90" : "text-amber-200")}>{h.suggestedAction}</p>
                        ) : null}
                        {h.status !== "pass" && h.fixKeys?.length ? (
                          <div className="mt-2 space-y-2">
                            {hygieneRowHasPerthAliasFix(h) ? (
                              <>
                                <label
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2 text-xs leading-snug",
                                    isDark ? "text-slate-200" : "text-slate-200"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className={cn(
                                      "mt-0.5 h-3.5 w-3.5 shrink-0 rounded border",
                                      isDark
                                        ? "border-slate-500 bg-slate-900 accent-violet-400"
                                        : "border-slate-600 bg-[#0F1629]/80 backdrop-blur-md accent-violet-600"
                                    )}
                                    checked={perthPhysicalAliasConfirmed}
                                    onChange={(e) => setPerthPhysicalAliasConfirmed(e.target.checked)}
                                  />
                                  <span>
                                    Confirm Consult Room 2 / Patient Room 2 and PRP Room 2 / Surgery 2 are shared
                                    physical rooms.
                                  </span>
                                </label>
                                <p
                                  className={cn(
                                    "text-[11px] leading-relaxed pl-5 sm:pl-6",
                                    isDark ? "text-slate-500" : "text-slate-400"
                                  )}
                                >
                                  This prevents FI OS from double-booking the same physical room under two different
                                  room names.
                                </p>
                              </>
                            ) : null}
                            <button
                              type="button"
                              disabled={
                                pending ||
                                !cid ||
                                (hygieneRowHasPerthAliasFix(h) && !perthPhysicalAliasConfirmed)
                              }
                              onClick={() =>
                                applyFixes(h.fixKeys ?? [], {
                                  confirmPerthAliases:
                                    hygieneRowHasPerthAliasFix(h) && perthPhysicalAliasConfirmed,
                                })
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition disabled:opacity-50",
                                isDark ? "bg-violet-600/90 text-white hover:bg-violet-500" : "bg-violet-600 text-white hover:bg-violet-500"
                              )}
                            >
                              {pending ? (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                              ) : (
                                <Wrench className="h-3 w-3" aria-hidden />
                              )}
                              Fix automatically
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {h.href ? (
                      <Link
                        href={h.href}
                        className={cn(
                          "shrink-0 text-xs font-medium hover:underline sm:pt-0.5",
                          isDark ? "text-cyan-400" : "text-cyan-300"
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
      ) : null}
    </div>
  );
}
