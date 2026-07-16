"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setGuidedAssistEnabledAction } from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { cn } from "@/lib/utils";

/**
 * Clinic guide on/off switch — dark theme, cyan accent when enabled.
 * Accessible: role="switch", aria-checked, keyboard (Space/Enter via button).
 */
export function GuidedAssistToggle({
  tenantId,
  assistEnabled,
  compact = false,
  className,
  onChanged,
  refreshOnChange = true,
}: {
  tenantId: string;
  assistEnabled: boolean;
  compact?: boolean;
  className?: string;
  onChanged?: (enabled: boolean) => void;
  /** Revalidate RSC trees so tips reload after toggle (default true). */
  refreshOnChange?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** Optimistic mirror of server preference for instant thumb position. */
  const [on, setOn] = useState(Boolean(assistEnabled));

  useEffect(() => {
    setOn(Boolean(assistEnabled));
  }, [assistEnabled]);

  const toggle = () => {
    if (pending) return;
    const next = !on;
    setError(null);
    setOn(next);
    onChanged?.(next);
    startTransition(async () => {
      const res = await setGuidedAssistEnabledAction(tenantId, next);
      if (!res.ok) {
        setOn(!next);
        onChanged?.(!next);
        setError(res.error);
        return;
      }
      if (refreshOnChange) router.refresh();
    });
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-0.5", className)}>
      <div className={cn("inline-flex items-center gap-2", pending && "opacity-70")}>
        {!compact ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Clinic guide
          </span>
        ) : null}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? "Turn Clinic guide off" : "Turn Clinic guide on"}
          disabled={pending}
          onClick={toggle}
          data-testid="guided-assist-toggle"
          data-state={on ? "on" : "off"}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border p-0.5",
            "transition-colors duration-200 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071018]",
            "disabled:cursor-wait disabled:opacity-60",
            on
              ? "border-cyan-400/55 bg-cyan-500/40"
              : "border-white/20 bg-slate-800"
          )}
        >
          {/* Track status text sits behind the thumb */}
          <span
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center text-[8px] font-bold uppercase tracking-wider",
              on ? "justify-start pl-1.5 text-cyan-50/95" : "justify-end pr-1.5 text-slate-400"
            )}
            aria-hidden
          >
            {on ? "On" : "Off"}
          </span>
          {/* Thumb — flex justify so on/off position is exact */}
          <span
            className={cn(
              "relative z-[1] flex w-full items-center transition-[justify-content] duration-200",
              on ? "justify-end" : "justify-start"
            )}
            aria-hidden
          >
            <span
              className={cn(
                "block h-5 w-5 rounded-full shadow-md ring-1 transition-colors duration-200",
                on
                  ? "bg-white ring-cyan-200/40 shadow-cyan-950/40"
                  : "bg-slate-300 ring-white/10 shadow-black/50"
              )}
            />
          </span>
        </button>
        {!compact ? (
          <span
            className={cn(
              "min-w-[1.75rem] text-xs font-medium",
              on ? "text-cyan-200/90" : "text-slate-500"
            )}
            aria-hidden
          >
            {on ? "On" : "Off"}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-[11rem] text-right text-[10px] leading-snug text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
