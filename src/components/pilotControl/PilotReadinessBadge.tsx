"use client";

import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import {
  formatReadinessLabel,
  readinessLooksReady,
  readinessMustNotLookReady,
} from "@/src/lib/pilotControl/ui/pilotControlFormatters";

export function PilotReadinessBadge({
  value,
  approximate,
  size = "sm",
  title,
}: {
  value: string | null | undefined;
  approximate?: boolean;
  size?: "sm" | "md";
  title?: string;
}) {
  const label = formatReadinessLabel(value);
  const isReady = readinessLooksReady(value) && !readinessMustNotLookReady(value);
  const tone =
    label === "Not applicable"
      ? "neutral"
      : label === "Unknown" ||
          label === "Not evaluated" ||
          label === "Not evaluated in register" ||
          label === "Blocker-derived attention" ||
          label === "Partial evaluation"
        ? "neutral"
        : label === "Blocked" || label === "Attention required"
          ? "danger"
          : isReady
            ? "success"
            : "warning";

  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <FiStatusBadge tone={tone} className={size === "sm" ? "text-[10px]" : undefined}>
        <span className="sr-only">Readiness status: </span>
        {label}
      </FiStatusBadge>
      {approximate ? (
        <span
          className="text-[10px] text-amber-300/90"
          title="Approximate or blocker-derived value"
          aria-label="Approximate value"
        >
          ≈
        </span>
      ) : null}
    </span>
  );
}
