"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { RosterAvailabilityPanel } from "@/src/components/fi/workforce/RosterAvailabilityPanel";
import { RosterEventStaffingCard } from "@/src/components/fi/workforce/RosterEventStaffingCard";
import { RosterShiftPanel } from "@/src/components/fi/workforce/RosterShiftPanel";
import type { RosterCommandCentrePayload } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  buildRosterCommandCentreHref,
  type RosterStaffingStatusFilter,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";

const STATUS_FILTERS: Array<{ id: RosterStaffingStatusFilter | ""; label: string }> = [
  { id: "", label: "All statuses" },
  { id: "ready", label: "Ready" },
  { id: "missing_roles", label: "Missing roles" },
  { id: "warning", label: "Warning" },
  { id: "blocked", label: "Blocked" },
  { id: "no_template", label: "No template" },
];

export type RosterCommandCentreViewProps = {
  tenantId: string;
  payload: RosterCommandCentrePayload;
  eventDetails: Record<
    string,
    { candidatesByRole: Record<string, RosterAssignableCandidate[]> } | undefined
  >;
  filters: {
    dateFrom: string;
    dateTo: string;
    clinicId: string;
    eventType: string;
    status: RosterStaffingStatusFilter | "";
  };
};

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function RosterCommandCentreView({
  tenantId,
  payload,
  eventDetails,
  filters,
}: RosterCommandCentreViewProps) {
  const router = useRouter();
  const [selectedEventKey, setSelectedEventKey] = useState(payload.preselectedEventKey);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const staffPickerOptions = useMemo(
    () => payload.staffOptions.map((s) => ({ id: s.id, name: s.name })),
    [payload.staffOptions]
  );

  function pushFilters(next: Partial<RosterCommandCentreViewProps["filters"]>) {
    const merged = { ...filters, ...next };
    router.push(
      buildRosterCommandCentreHref({
        tenantId,
        dateFrom: merged.dateFrom,
        dateTo: merged.dateTo,
        clinicId: merged.clinicId || null,
        eventType: merged.eventType || null,
        status: merged.status || null,
        eventSource: selectedEventKey?.split(":")[0] as "booking" | undefined,
        eventId: selectedEventKey?.split(":")[1] ?? null,
      })
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">WorkforceOS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Roster Command Centre
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Operational staffing command centre for clinical days, surgeries, consultations, and
          procedure events. Review gaps, rank eligible staff, assign safely, and manage shifts and
          availability.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <Link href={`/fi-admin/${tenantId}/hr-os`} className="text-cyan-400 hover:text-cyan-300">
            ← Back to HR OS
          </Link>
        </p>
      </header>

      <section className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-xs text-slate-400">
            From
            <input
              type="date"
              value={toDateInputValue(filters.dateFrom)}
              onChange={(e) => {
                const d = new Date(`${e.target.value}T00:00:00.000Z`);
                pushFilters({ dateFrom: d.toISOString() });
              }}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-400">
            To
            <input
              type="date"
              value={toDateInputValue(filters.dateTo)}
              onChange={(e) => {
                const d = new Date(`${e.target.value}T23:59:59.999Z`);
                pushFilters({ dateTo: d.toISOString() });
              }}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Clinic
            <select
              value={filters.clinicId}
              onChange={(e) => pushFilters({ clinicId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All clinics</option>
              {payload.clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Event type
            <input
              value={filters.eventType}
              onChange={(e) => pushFilters({ eventType: e.target.value })}
              placeholder="e.g. surgery"
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Staffing status
            <select
              value={filters.status}
              onChange={(e) =>
                pushFilters({ status: e.target.value as RosterStaffingStatusFilter | "" })
              }
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.label} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clinical events", value: payload.summary.totalClinicalEvents },
          { label: "Ready", value: payload.summary.readyEvents, tone: "text-emerald-300" },
          {
            label: "Missing roles",
            value: payload.summary.missingRoleEvents,
            tone: "text-amber-300",
          },
          { label: "Open roles", value: payload.summary.openRequiredRoles, tone: "text-rose-300" },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <p className="text-xs text-slate-500">{tile.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${tile.tone ?? "text-slate-100"}`}>
              {tile.value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Clinical events</h2>
          {payload.events.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No clinical events match the current filters.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {payload.events.map((event) => (
                <RosterEventStaffingCard
                  key={event.eventKey}
                  tenantId={tenantId}
                  event={event}
                  selected={selectedEventKey === event.eventKey}
                  candidatesByRole={eventDetails[event.eventKey]?.candidatesByRole}
                  onSelect={() => setSelectedEventKey(event.eventKey)}
                  onRefresh={refresh}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <RosterShiftPanel
            tenantId={tenantId}
            shifts={payload.shifts}
            staffOptions={staffPickerOptions}
            clinics={payload.clinics}
            onChanged={refresh}
          />
          <RosterAvailabilityPanel
            tenantId={tenantId}
            blocks={payload.availabilityBlocks}
            staffOptions={staffPickerOptions}
            clinics={payload.clinics}
            onChanged={refresh}
          />
        </div>
      </section>
    </div>
  );
}
