"use client";

import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import { formatSeverityLabel } from "@/src/lib/pilotControl/ui/pilotControlFormatters";

export function PilotBlockerBadge({
  severity,
  pause,
}: {
  severity: string | null | undefined;
  pause?: boolean;
}) {
  const label = formatSeverityLabel(severity);
  const v = String(severity ?? "").toLowerCase();
  const tone =
    v === "critical" ? "danger" : v === "high" ? "warning" : v === "attention" ? "info" : "neutral";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <FiStatusBadge tone={tone}>
        <span aria-hidden>{v === "critical" ? "▲ " : v === "high" ? "◆ " : ""}</span>
        <span className="sr-only">Severity: </span>
        {label}
      </FiStatusBadge>
      {pause ? (
        <FiStatusBadge tone="danger">
          <span className="sr-only">Pilot pause: </span>
          Pilot pause recommended
        </FiStatusBadge>
      ) : null}
    </span>
  );
}
