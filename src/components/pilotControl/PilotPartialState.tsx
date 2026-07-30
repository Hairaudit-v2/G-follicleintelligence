"use client";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import {
  PARTIAL_RESPONSE_MESSAGE,
  PERMISSION_LIMITED_MESSAGE,
} from "@/src/lib/pilotControl/ui/pilotControlUiConstants";
import type { PilotControlApiWarning } from "@/src/lib/pilotControl/api/pilotControlApiTypes";

export function PilotPartialState({
  warnings,
  staleSources,
}: {
  warnings?: PilotControlApiWarning[];
  staleSources?: string[];
}) {
  return (
    <InfoNotice variant="warning" title="Partial or stale evaluation">
      <p className="whitespace-pre-line text-sm">{PARTIAL_RESPONSE_MESSAGE}</p>
      {staleSources && staleSources.length > 0 ? (
        <p className="mt-2 text-xs">
          Stale sources: {staleSources.join(", ")}. Readiness may be affected.
        </p>
      ) : null}
      {warnings && warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          {warnings.map((w) => (
            <li key={`${w.code}-${w.message}`}>
              {w.sourceCategory ? `${w.sourceCategory}: ` : ""}
              {w.message}
              {w.readinessDowngraded ? " (readiness downgraded)" : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </InfoNotice>
  );
}

export function PilotPermissionLimitedNotice() {
  return (
    <InfoNotice variant="info" title="Role-limited view">
      <p className="text-sm">{PERMISSION_LIMITED_MESSAGE}</p>
    </InfoNotice>
  );
}

export function PilotErrorState({
  message,
  correlationId,
  onRetry,
}: {
  message: string;
  correlationId?: string;
  onRetry?: () => void;
}) {
  return (
    <InfoNotice variant="danger" title="Pilot Control could not load">
      <p className="text-sm">{message}</p>
      {correlationId ? (
        <p className="mt-2 text-xs font-mono text-rose-100/80">
          Correlation ID: {correlationId}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-rose-300/40 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-50 hover:bg-rose-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Retry
        </button>
      ) : null}
    </InfoNotice>
  );
}
