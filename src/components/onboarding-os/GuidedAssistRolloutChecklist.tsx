"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, PartyPopper, Sparkles } from "lucide-react";

import {
  loadGuidedAssistRolloutSnapshotAction,
  setGuidedAssistRolloutItemAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { GuidedAssistRolloutSnapshot } from "@/src/lib/onboarding-os/guidedAssistTypes";

/**
 * Admin one-time Clinic guide rollout checklist (tenant-scoped).
 * Progress stored on tenant default prefs metadata.guided_assist_rollout_status.
 */
export function GuidedAssistRolloutChecklist({ tenantId }: { tenantId: string }) {
  const [rollout, setRollout] = useState<GuidedAssistRolloutSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadGuidedAssistRolloutSnapshotAction(tenantId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRollout(res.rollout);
      if (res.rollout.isComplete) setCelebrate(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const toggle = (itemId: string, completed: boolean) => {
    setError(null);
    startTransition(() => {
      void setGuidedAssistRolloutItemAction(tenantId, itemId, completed).then((res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const wasComplete = rollout?.isComplete;
        setRollout(res.rollout);
        if (res.rollout.isComplete && !wasComplete) {
          setCelebrate(true);
        }
        if (!res.rollout.isComplete) {
          setCelebrate(false);
        }
      });
    });
  };

  if (error && !rollout) {
    return (
      <p className="text-sm text-slate-400" role="alert">
        {error}
      </p>
    );
  }

  if (!rollout) {
    return (
      <div
        className="space-y-3"
        aria-busy="true"
        aria-label="Loading rollout checklist"
        data-testid="guided-assist-rollout-skeleton"
      >
        <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
        <div className="h-2 animate-pulse rounded-full bg-white/10" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      className="space-y-4"
      data-testid="guided-assist-rollout-checklist"
      aria-label="Clinic guide rollout checklist"
    >
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Clinic guide · Rollout</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-[#F8FAFC] sm:text-lg">
          Rollout checklist
        </h3>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
          A gentle launch list for this clinic — tick items as you go. Nothing here changes patient
          records; it only helps the team feel ready.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-300">
            {rollout.completedCount} of {rollout.totalCount} complete
          </p>
          <p className="text-xs font-semibold tabular-nums text-cyan-200/90">{rollout.percent}%</p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={rollout.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Rollout progress ${rollout.percent} percent`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-emerald-400/80 transition-[width] duration-500 ease-out"
            style={{ width: `${rollout.percent}%` }}
          />
        </div>
      </div>

      {celebrate && rollout.isComplete ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/35 p-3.5 transition-opacity duration-500 sm:p-4"
          role="status"
          data-testid="guided-assist-rollout-celebration"
        >
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-50">You did it — rollout complete</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
              The Clinic guide is ready for everyday use. Keep an eye on Guide Health in the first
              weeks, and rewrite any pain-point tips if the team needs a warmer hand.
            </p>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2" role="list">
        {rollout.items.map((item) => (
          <li key={item.id}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition sm:px-3.5",
                item.completed
                  ? "border-emerald-400/25 bg-emerald-950/20"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                pending && "opacity-80"
              )}
            >
              <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={item.completed}
                  disabled={pending}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                  data-testid={`guided-assist-rollout-${item.id}`}
                />
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-400/50",
                    item.completed
                      ? "border-emerald-400/50 bg-emerald-500/30 text-emerald-50"
                      : "border-white/20 bg-black/20"
                  )}
                  aria-hidden
                >
                  {item.completed ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    item.completed ? "text-emerald-50/95" : "text-slate-100"
                  )}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  {item.description}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {!rollout.isComplete ? (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500/70" aria-hidden />
          Tick items as they feel true for this clinic — you can uncheck anytime if something needs
          another pass.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
