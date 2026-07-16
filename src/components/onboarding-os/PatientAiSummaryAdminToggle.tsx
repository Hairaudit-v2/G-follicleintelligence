"use client";

import { useEffect, useState, useTransition } from "react";

import {
  getPatientAiSummaryEnabledAction,
  setPatientAiSummaryEnabledAction,
} from "@/lib/actions/patient-ai-summary-actions";
import { cn } from "@/lib/utils";

/**
 * Admin toggle: enable/disable AI Patient Summary for the tenant.
 */
export function PatientAiSummaryAdminToggle({ tenantId }: { tenantId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getPatientAiSummaryEnabledAction(tenantId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEnabled(res.enabled);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const toggle = () => {
    if (enabled == null) return;
    const next = !enabled;
    setError(null);
    startTransition(() => {
      void setPatientAiSummaryEnabledAction(tenantId, next).then((res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setEnabled(res.enabled);
      });
    });
  };

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 sm:p-5"
      data-testid="patient-ai-summary-admin-toggle"
    >
      <h2 className="text-sm font-semibold text-slate-100">AI Patient Summary</h2>
      <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
        Operational overview on patient profiles (timeline, media gaps, bookings). Never clinical
        advice. Calls are logged with user and patient id. Requires{" "}
        <code className="rounded bg-white/5 px-1">XAI_API_KEY</code> for LLM wording; otherwise a
        safe template is used.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || enabled == null}
          onClick={toggle}
          className={cn(
            "inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-50",
            enabled
              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
              : "border-white/15 bg-white/[0.04] text-slate-200"
          )}
          aria-pressed={enabled === true}
        >
          {enabled == null ? "Loading…" : enabled ? "Enabled" : "Disabled"}
        </button>
        <span className="text-xs text-slate-500">
          {enabled
            ? "Staff can open AI Summary on patient profiles."
            : "Feature is off for this clinic."}
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
