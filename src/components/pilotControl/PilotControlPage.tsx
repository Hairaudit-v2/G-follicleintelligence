"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { PilotAdoptionSection } from "@/src/components/pilotControl/PilotAdoptionSection";
import { PilotActivationSection } from "@/src/components/pilotControl/PilotActivationSection";
import { PilotActivityTimeline } from "@/src/components/pilotControl/PilotActivityTimeline";
import { PilotAttentionQueue } from "@/src/components/pilotControl/PilotAttentionQueue";
import { PilotBlockerList } from "@/src/components/pilotControl/PilotBlockerList";
import { PilotEmptyState } from "@/src/components/pilotControl/PilotEmptyState";
import { PilotErrorState, PilotPartialState } from "@/src/components/pilotControl/PilotPartialState";
import { PilotExportDialog } from "@/src/components/pilotControl/PilotExportDialog";
import { PilotHealthBanner } from "@/src/components/pilotControl/PilotHealthBanner";
import {
  PilotEvidenceMetadata,
  PilotJourneySummary,
  PilotTechnicalHealth,
} from "@/src/components/pilotControl/PilotJourneySummary";
import { PilotMetricCards } from "@/src/components/pilotControl/PilotMetricCards";
import { PilotPatientDetailDrawer } from "@/src/components/pilotControl/PilotPatientDetailDrawer";
import { PilotPatientRegister } from "@/src/components/pilotControl/PilotPatientRegister";
import { PilotProgrammeHeader } from "@/src/components/pilotControl/PilotProgrammeHeader";
import {
  usePilotActivity,
  usePilotAdoption,
  usePilotBlockers,
  usePilotExport,
  usePilotHealth,
  usePilotOverview,
  usePilotPatientDetail,
  usePilotPatients,
  usePilotProgrammes,
} from "@/src/hooks/pilotControl/usePilotControl";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";
import {
  activityDateRangeIso,
  formatDateTime,
} from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import {
  blockerFiltersToQuery,
  parsePatientFiltersFromSearchParams,
  patientFiltersToQuery,
  resetPatientFilters,
  type PilotPatientFilterState,
} from "@/src/lib/pilotControl/ui/pilotControlFilters";
import { canShowExportControl } from "@/src/lib/pilotControl/ui/pilotControlUiAccess";
import { PilotControlClientError } from "@/src/lib/pilotControl/ui/pilotControlClient";
import { ACTIVE_BLOCKER_STATES, HISTORY_BLOCKER_STATES } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";

export type PilotControlPageProps = {
  tenantId: string;
  role: PilotControlRoleKey;
  initialProgrammeId?: string | null;
  migrationsOk?: boolean;
  tenantLabel?: string;
};

export function PilotControlPage({
  tenantId,
  role,
  initialProgrammeId,
  migrationsOk = true,
  tenantLabel,
}: PilotControlPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const programmes = usePilotProgrammes({ tenantId });
  const programmeId =
    initialProgrammeId ||
    searchParams.get("programmeId") ||
    programmes.data?.[0]?.id ||
    null;

  const [filters, setFilters] = useState<PilotPatientFilterState>(() =>
    parsePatientFiltersFromSearchParams(
      Object.fromEntries(searchParams.entries()),
      programmeId || ""
    )
  );

  useEffect(() => {
    if (!programmeId) return;
    setFilters((prev) =>
      prev.programmeId === programmeId ? prev : { ...prev, programmeId, page: 1 }
    );
  }, [programmeId]);

  useEffect(() => {
    if (!filters.programmeId) return;
    const q = patientFiltersToQuery(filters);
    const sp = new URLSearchParams(q);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [filters, pathname, router]);

  const overview = usePilotOverview({
    programmeId,
    tenantId,
    autoRefresh: true,
  });
  const health = usePilotHealth({
    programmeId,
    tenantId,
    autoRefresh: true,
  });
  const adoptionRange = useMemo(() => activityDateRangeIso("30d"), []);
  const adoption = usePilotAdoption({
    programmeId,
    tenantId,
    from: adoptionRange.from,
    to: adoptionRange.to,
    autoRefresh: true,
  });

  const patientQuery = useMemo(
    () => (filters.programmeId ? patientFiltersToQuery(filters) : null),
    [filters]
  );
  const patients = usePilotPatients({ query: patientQuery, autoRefresh: false });

  const [blockerMode, setBlockerMode] = useState<"active" | "history">("active");
  const [blockerPage, setBlockerPage] = useState(1);
  const blockerQuery = useMemo(() => {
    if (!programmeId) return null;
    return blockerFiltersToQuery({
      programmeId,
      page: blockerPage,
      pageSize: 25,
      state:
        blockerMode === "active"
          ? ACTIVE_BLOCKER_STATES.join(",")
          : HISTORY_BLOCKER_STATES.join(","),
      sort: "severity",
      direction: "asc",
    });
  }, [programmeId, blockerMode, blockerPage]);
  const blockers = usePilotBlockers({ query: blockerQuery, autoRefresh: true });

  const [activityPreset, setActivityPreset] = useState<"today" | "7d" | "30d">("7d");
  const [activityPage, setActivityPage] = useState(1);
  const activityQuery = useMemo(() => {
    if (!programmeId) return null;
    const range = activityDateRangeIso(activityPreset);
    return {
      programmeId,
      page: String(activityPage),
      pageSize: "25",
      from: range.from,
      to: range.to,
      sort: "occurredAt",
      direction: "desc",
    };
  }, [programmeId, activityPreset, activityPage]);
  const activity = usePilotActivity({ query: activityQuery, autoRefresh: false });

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const detail = usePilotPatientDetail({
    patientId: selectedPatientId,
    programmeId,
    tenantId,
  });

  const [exportOpen, setExportOpen] = useState(false);
  const exporter = usePilotExport();
  const canExport = canShowExportControl(role);

  const refreshAll = useCallback(() => {
    void programmes.refresh();
    void overview.refresh();
    void health.refresh();
    void patients.refresh();
    void blockers.refresh();
    void activity.refresh();
  }, [programmes, overview, health, patients, blockers, activity]);

  const emptyCohort =
    overview.data &&
    overview.data.cohort.totalApproved === 0 &&
    overview.data.cohort.active === 0;

  const pageError =
    programmes.error ||
    (programmeId ? overview.error : null) ||
    (programmeId ? health.error : null);

  if (!migrationsOk) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <PilotErrorState
          message="Required Pilot Control migrations are not present. Apply governed migrations before using this surface. The UI will not auto-apply schema changes."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          kicker="Clinic Operations"
          title="Pilot Control Centre"
          description="Read-only operational view over approved 1A.4 APIs."
        />
        <div className="flex flex-wrap items-center gap-2">
          {overview.refreshing || blockers.refreshing ? (
            <span className="text-[11px] text-cyan-300/80" aria-live="polite">
              Refreshing…
            </span>
          ) : null}
          <span className="text-[11px] text-slate-500">
            Last refreshed:{" "}
            {overview.lastRefreshedAt
              ? formatDateTime(overview.lastRefreshedAt.toISOString())
              : "—"}
          </span>
          <button
            type="button"
            onClick={refreshAll}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-100 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Refresh
          </button>
          {canExport && programmeId ? (
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Export
            </button>
          ) : null}
        </div>
      </div>

      {pageError ? (
        <PilotErrorState
          message={pageError.message}
          correlationId={
            pageError instanceof PilotControlClientError
              ? pageError.correlationId
              : undefined
          }
          onRetry={refreshAll}
        />
      ) : null}

      {overview.loading && !overview.data ? (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="h-28 rounded-xl bg-white/5" />
          <div className="h-24 rounded-xl bg-white/5" />
          <div className="grid gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      ) : null}

      {overview.data ? (
        <>
          <PilotProgrammeHeader
            overview={overview.data}
            meta={overview.meta}
            tenantLabel={tenantLabel}
          />
          <PilotHealthBanner
            overview={overview.data}
            health={health.data}
            role={role}
          />
          {(overview.meta?.partial ||
            (overview.meta?.evaluation?.staleSources?.length ?? 0) > 0) && (
            <PilotPartialState
              warnings={overview.meta?.warnings}
              staleSources={overview.meta?.evaluation?.staleSources}
            />
          )}
          {emptyCohort ? (
            <PilotEmptyState
              programmeName={overview.data.programme.name}
              programmeStatus={overview.data.programme.status}
              realInvitesEnabled={overview.data.programme.realPatientInvitesEnabled}
              migrationsOk={migrationsOk}
            />
          ) : null}
          <PilotMetricCards overview={overview.data} />
        </>
      ) : null}

      {blockers.data ? (
        <PilotAttentionQueue
          blockers={blockers.data.filter((b) =>
            (ACTIVE_BLOCKER_STATES as readonly string[]).includes(b.state)
          )}
          role={role}
          onSelectPatient={setSelectedPatientId}
        />
      ) : blockers.error && overview.data ? (
        <PilotErrorState
          message={`Attention queue unavailable: ${blockers.error.message}`}
          correlationId={
            blockers.error instanceof PilotControlClientError
              ? blockers.error.correlationId
              : undefined
          }
          onRetry={() => void blockers.refresh()}
        />
      ) : null}

      {programmeId ? (
        <PilotPatientRegister
          rows={patients.data ?? []}
          pagination={patients.pagination}
          filters={filters}
          role={role}
          loading={patients.loading}
          onFiltersChange={setFilters}
          onResetFilters={() =>
            setFilters(resetPatientFilters(programmeId))
          }
          onSelectPatient={setSelectedPatientId}
        />
      ) : null}

      {blockers.data ? (
        <PilotBlockerList
          items={blockers.data}
          pagination={blockers.pagination}
          role={role}
          mode={blockerMode}
          onModeChange={(m) => {
            setBlockerMode(m);
            setBlockerPage(1);
          }}
          onPageChange={setBlockerPage}
        />
      ) : null}

      {overview.data ? <PilotJourneySummary overview={overview.data} /> : null}

      <PilotAdoptionSection adoption={adoption.data} />

      <PilotActivationSection overview={overview.data} role={role} />

      <PilotActivityTimeline
        items={activity.data ?? []}
        pagination={activity.pagination}
        preset={activityPreset}
        onPresetChange={(p) => {
          setActivityPreset(p);
          setActivityPage(1);
        }}
        onPageChange={setActivityPage}
      />

      <PilotTechnicalHealth health={health.data} meta={health.meta ?? overview.meta} />

      {overview.data?.urgentItems?.length ? (
        <section className="space-y-2">
          <SectionHeader title="Recent critical events" />
          <ul className="space-y-1 text-xs text-slate-300">
            {overview.data.urgentItems.slice(0, 8).map((u, i) => (
              <li key={`${u.title}-${i}`}>
                [{u.severity}] {u.title}
                {u.recommendedNextAction ? ` — ${u.recommendedNextAction}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PilotEvidenceMetadata
        meta={overview.meta}
        lastRefreshedAt={overview.lastRefreshedAt}
      />

      <PilotPatientDetailDrawer
        open={Boolean(selectedPatientId)}
        onClose={() => setSelectedPatientId(null)}
        detail={detail.data}
        loading={detail.loading}
        error={detail.error}
        role={role}
        onRefresh={() => void detail.refresh()}
      />

      {programmeId && canExport ? (
        <PilotExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          programmeId={programmeId}
          tenantId={tenantId}
          busy={exporter.busy}
          error={exporter.error}
          onExport={async (args) => {
            await exporter.runExport(args);
            setExportOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
