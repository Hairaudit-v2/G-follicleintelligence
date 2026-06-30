"use client";

import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { setGuidedAssistEnabledAction } from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export function GuidedAssistToggle({
  tenantId,
  assistEnabled,
  compact = false,
  className,
  onChanged,
}: {
  tenantId: string;
  assistEnabled: boolean;
  compact?: boolean;
  className?: string;
  onChanged?: (enabled: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !assistEnabled;
    startTransition(async () => {
      const res = await setGuidedAssistEnabledAction(tenantId, next);
      if (res.ok) onChanged?.(next);
    });
  };

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300",
        pending && "opacity-60",
        className
      )}
    >
      <span className={compact ? "sr-only" : undefined}>
        {compact ? "Guided Assist" : "Guided Assist mode"}
      </span>
      {!compact ? (
        <span className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase D</span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={assistEnabled}
        disabled={pending}
        onClick={toggle}
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
        <span className="sr-only">{assistEnabled ? "Disable guided assist" : "Enable guided assist"}</span>
      </button>
      {!compact ? (
        <span className="text-xs text-slate-400">{assistEnabled ? "On" : "Off"}</span>
      ) : null}
    </label>
  );
}
