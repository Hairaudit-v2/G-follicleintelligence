"use client";

import Link from "next/link";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { PilotBlockerBadge } from "@/src/components/pilotControl/PilotBlockerBadge";
import type { PilotBlockerListItem } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlPagination } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";
import { formatAgeSeconds, formatDateTime } from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import {
  canShowPauseRecommendation,
  shouldSuppressPatientSafeSummary,
} from "@/src/lib/pilotControl/ui/pilotControlUiAccess";
import { HISTORY_BLOCKER_STATES } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";

export function PilotBlockerList({
  items,
  pagination,
  role,
  mode,
  onModeChange,
  onPageChange,
}: {
  items: PilotBlockerListItem[];
  pagination: PilotControlPagination | null;
  role: PilotControlRoleKey;
  mode: "active" | "history";
  onModeChange: (mode: "active" | "history") => void;
  onPageChange?: (page: number) => void;
}) {
  const showPause = canShowPauseRecommendation(role);

  return (
    <section className="space-y-3" aria-labelledby="pilot-blockers-heading">
      <SectionHeader
        id="pilot-blockers-heading"
        title="Blockers"
        description="Active and history views respect recurrence (new occurrence on reopen)."
      />
      <div className="flex gap-2" role="tablist" aria-label="Blocker views">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "active"}
          onClick={() => onModeChange("active")}
          className={`rounded-md px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            mode === "active" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400"
          }`}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "history"}
          onClick={() => onModeChange("history")}
          className={`rounded-md px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            mode === "history" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400"
          }`}
        >
          History
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((b) => {
          const isHistory = (HISTORY_BLOCKER_STATES as readonly string[]).includes(b.state);
          if (mode === "active" && isHistory) return null;
          if (mode === "history" && !isHistory) return null;
          const pause = showPause && Boolean(b.escalation.requiresPilotPause);
          const showSafe =
            b.patientSafeSummary && !shouldSuppressPatientSafeSummary(b.category);
          return (
            <li
              key={b.id}
              className="rounded-xl border border-white/[0.08] bg-[#141C33]/50 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <PilotBlockerBadge severity={b.severity} pause={pause} />
                <span className="text-slate-300">{b.state}</span>
              </div>
              <p className="mt-1 text-sm text-slate-100">{b.title}</p>
              <p className="text-slate-400">
                First detected: {formatDateTime(b.firstDetectedAt)} · Age:{" "}
                {formatAgeSeconds(b.ageSeconds)} · Owner: {b.ownership.ownerType}
              </p>
              {mode === "history" ? (
                <p className="text-slate-500">
                  Last confirmed: {formatDateTime(b.lastConfirmedAt)} · Episode remains separate
                  under new_occurrence_on_reopen.
                </p>
              ) : (
                <p className="text-cyan-100/90">Next: {b.recommendedNextAction}</p>
              )}
              {showSafe ? <p className="text-slate-500">{b.patientSafeSummary}</p> : null}
              {b.sourceLink?.href ? (
                <Link
                  href={b.sourceLink.href}
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  {b.sourceLink.label}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pagination && onPageChange ? (
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
            className="rounded border border-white/15 px-2 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
            className="rounded border border-white/15 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
