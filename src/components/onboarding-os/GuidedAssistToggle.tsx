"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setGuidedAssistEnabledAction } from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

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

  const toggle = () => {
    const next = !assistEnabled;
    setError(null);
    startTransition(async () => {
      const res = await setGuidedAssistEnabledAction(tenantId, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onChanged?.(next);
      if (refreshOnChange) router.refresh();
    });
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <label
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300",
          pending && "opacity-60"
        )}
      >
        <span className={compact ? "sr-only" : undefined}>Clinic guide</span>
        {!compact ? (
          <span className={fiOsChromeClasses.sectionEyebrow}>Help for staff</span>
        ) : null}
        <button
          type="button"
          role="switch"
          aria-checked={assistEnabled}
          disabled={pending}
          onClick={toggle}
          data-testid="guided-assist-toggle"
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
            assistEnabled
              ? "border-cyan-500/60 bg-cyan-600/30"
              : "border-slate-600 bg-slate-800/80"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-[#0F1629]/80 backdrop-blur-md shadow transition-transform",
              assistEnabled ? "translate-x-5" : "translate-x-0.5"
            )}
          />
          <span className="sr-only">
            {assistEnabled ? "Disable clinic guide" : "Enable clinic guide"}
          </span>
        </button>
        {!compact ? (
          <span className="text-xs text-slate-400">{assistEnabled ? "On" : "Off"}</span>
        ) : null}
      </label>
      {error ? <p className="max-w-[12rem] text-[10px] text-amber-300">{error}</p> : null}
    </div>
  );
}
