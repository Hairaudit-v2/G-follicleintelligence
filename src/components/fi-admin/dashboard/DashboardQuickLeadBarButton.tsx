"use client";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { dispatchOpenCreateLeadModal } from "@/src/lib/fiAdmin/clinicOsShellCreateLeadEvent";

export function DashboardQuickLeadBarButton(props: { label: string; className?: string }) {
  const { label, className } = props;
  return (
    <button
      type="button"
      onClick={() => dispatchOpenCreateLeadModal()}
      className={cn(
        fiOsChromeClasses.toolbarControlSurface,
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-semibold text-cyan-50",
        className,
      )}
    >
      <span className="text-cyan-400/90" aria-hidden>
        +
      </span>
      {label}
    </button>
  );
}
