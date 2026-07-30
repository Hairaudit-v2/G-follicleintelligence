"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { PilotBlockerBadge } from "@/src/components/pilotControl/PilotBlockerBadge";
import { PilotReadinessBadge } from "@/src/components/pilotControl/PilotReadinessBadge";
import type { PilotPatientRegisterRow } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlPagination } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";
import {
  formatDateTime,
  formatProgrammeStatus,
  registerDimensionDisplay,
} from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import type { PilotPatientFilterState } from "@/src/lib/pilotControl/ui/pilotControlFilters";
import {
  columnsForViewport,
  defaultRegisterColumnsForRole,
  type PilotRegisterColumnId,
} from "@/src/lib/pilotControl/ui/pilotControlRoleColumns";
import { PILOT_CONTROL_SEARCH_DEBOUNCE_MS } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";

function cellValue(
  row: PilotPatientRegisterRow,
  id: PilotRegisterColumnId
): ReactNode {
  switch (id) {
    case "patient":
      return (
        <span>
          <span className="font-medium text-slate-100">{row.patient.displayName}</span>
          {row.patient.reference ? (
            <span className="ml-1 text-[11px] text-slate-500">{row.patient.reference}</span>
          ) : null}
        </span>
      );
    case "pilotStatus":
      return formatProgrammeStatus(row.pilotStatus);
    case "milestone":
      return row.journey.milestoneLabel || row.journey.milestone || "—";
    case "overallReadiness":
      return <PilotReadinessBadge value={row.readiness.overall} />;
    case "clinical": {
      const d = registerDimensionDisplay(row.readiness.clinical);
      return <PilotReadinessBadge value={d.label} approximate={d.approximate} />;
    }
    case "financial": {
      const d = registerDimensionDisplay(row.readiness.financial);
      return <PilotReadinessBadge value={d.label} approximate={d.approximate} />;
    }
    case "patientDim": {
      const d = registerDimensionDisplay(row.readiness.patient);
      return <PilotReadinessBadge value={d.label} approximate={d.approximate} />;
    }
    case "operational": {
      const d = registerDimensionDisplay(row.readiness.operational);
      return <PilotReadinessBadge value={d.label} approximate={d.approximate} />;
    }
    case "technical": {
      const d = registerDimensionDisplay(row.readiness.technical);
      return <PilotReadinessBadge value={d.label} approximate={d.approximate} />;
    }
    case "primaryBlocker":
      return row.blockerSummary.primaryBlocker?.title ?? "—";
    case "blockerSeverity":
      return row.blockerSummary.highestSeverity ? (
        <PilotBlockerBadge severity={row.blockerSummary.highestSeverity} />
      ) : (
        "—"
      );
    case "nextPatientAction":
      return row.nextActions.patient?.label ?? "—";
    case "nextClinicAction":
      return row.nextActions.clinic?.label ?? "—";
    case "appActivation":
      return row.app.activationState || "—";
    case "operationalOwner":
      return row.ownership.operationalOwnerName || row.ownership.operationalOwnerType || "—";
    case "lastActivity":
      return formatDateTime(
        row.activity.lastPatientActivityAt ?? row.activity.lastStaffActivityAt
      );
    case "evaluatedAt":
      return formatDateTime(row.evaluatedAt);
    default:
      return "—";
  }
}

export function PilotPatientRegisterFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: PilotPatientFilterState;
  onChange: (next: PilotPatientFilterState) => void;
  onReset: () => void;
}) {
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");

  useEffect(() => {
    setSearchDraft(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchDraft.trim() || undefined;
      if (next === filters.search) return;
      onChange({ ...filters, search: next, page: 1 });
    }, PILOT_CONTROL_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-slate-400">
        Search
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Patient name or reference"
          className="mt-1 block w-48 rounded-md border border-white/10 bg-[#0B1220] px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label="Search patients"
        />
      </label>
      <label className="text-xs text-slate-400">
        Pilot status
        <select
          value={filters.status ?? ""}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value || undefined, page: 1 })
          }
          className="mt-1 block rounded-md border border-white/10 bg-[#0B1220] px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <option value="">All</option>
          <option value="approved">Approved</option>
          <option value="invited">Invited</option>
          <option value="activated">Activated</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Severity
        <select
          value={filters.severity ?? ""}
          onChange={(e) =>
            onChange({ ...filters, severity: e.target.value || undefined, page: 1 })
          }
          className="mt-1 block rounded-md border border-white/10 bg-[#0B1220] px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="attention">Attention</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Owner
        <select
          value={filters.ownerType ?? ""}
          onChange={(e) =>
            onChange({ ...filters, ownerType: e.target.value || undefined, page: 1 })
          }
          className="mt-1 block rounded-md border border-white/10 bg-[#0B1220] px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <option value="">All</option>
          <option value="patient">Patient</option>
          <option value="clinical">Clinical</option>
          <option value="reception">Reception</option>
          <option value="finance">Finance</option>
          <option value="technical">Technical</option>
        </select>
      </label>
      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        Reset filters
      </button>
    </div>
  );
}

export function PilotPatientRegister({
  rows,
  pagination,
  filters,
  role,
  loading,
  onFiltersChange,
  onResetFilters,
  onSelectPatient,
}: {
  rows: PilotPatientRegisterRow[];
  pagination: PilotControlPagination | null;
  filters: PilotPatientFilterState;
  role: PilotControlRoleKey;
  loading?: boolean;
  onFiltersChange: (next: PilotPatientFilterState) => void;
  onResetFilters: () => void;
  onSelectPatient: (patientId: string) => void;
}) {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      if (w < 640) setViewport("mobile");
      else if (w < 1024) setViewport("tablet");
      else setViewport("desktop");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const columns = useMemo(
    () => columnsForViewport(defaultRegisterColumnsForRole(role), viewport),
    [role, viewport]
  );

  return (
    <section className="space-y-3" aria-labelledby="pilot-register-heading">
      <SectionHeader
        id="pilot-register-heading"
        title="Patient register"
        description="Server-paginated enrolments only. Missing readiness cells are not fabricated."
      />
      <PilotPatientRegisterFilters
        filters={filters}
        onChange={onFiltersChange}
        onReset={onResetFilters}
      />

      {viewport === "mobile" ? (
        <ul className="space-y-2 md:hidden">
          {rows.map((row) => (
            <li key={row.enrolmentId}>
              <button
                type="button"
                onClick={() => onSelectPatient(row.patientId)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#141C33]/55 p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <div className="font-medium text-slate-100">{row.patient.displayName}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <PilotReadinessBadge value={row.readiness.overall} />
                  {row.blockerSummary.highestSeverity ? (
                    <PilotBlockerBadge severity={row.blockerSummary.highestSeverity} />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Owner: {row.ownership.operationalOwnerType ?? "—"} ·{" "}
                  {row.blockerSummary.primaryBlocker?.title ?? "No primary blocker"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={`${viewport === "mobile" ? "hidden" : "block"} overflow-x-auto`}>
        <table className="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              {columns.map((c) => (
                <th key={c.id} scope="col" className="px-2 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 text-slate-400">
                  {loading
                    ? "Loading register…"
                    : "No enrolled patients match the current filters. Non-enrolled patients never appear."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.enrolmentId}
                  className="border-b border-white/[0.06] hover:bg-white/[0.03]"
                >
                  {columns.map((c) => (
                    <td key={c.id} className="px-2 py-2 align-top text-slate-200">
                      {c.id === "patient" ? (
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                          onClick={() => onSelectPatient(row.patientId)}
                        >
                          {cellValue(row, c.id)}
                        </button>
                      ) : (
                        cellValue(row, c.id)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            Showing page {pagination.page} of {pagination.totalPages || 1} · {pagination.total}{" "}
            total
          </span>
          <div className="flex items-center gap-2">
            <label>
              Page size
              <select
                value={filters.pageSize}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    pageSize: Number(e.target.value),
                    page: 1,
                  })
                }
                className="ml-1 rounded border border-white/10 bg-[#0B1220] px-1 py-0.5"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!pagination.hasPreviousPage}
              onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
              className="rounded border border-white/15 px-2 py-1 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
              className="rounded border border-white/15 px-2 py-1 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
