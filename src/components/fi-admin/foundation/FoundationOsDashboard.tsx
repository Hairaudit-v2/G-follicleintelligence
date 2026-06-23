import Link from "next/link";
import type { ReactNode } from "react";
import { UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, InfoNotice, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { FoundationOsDashboardPayload } from "@/src/lib/fi/foundation/foundationOsDashboardTypes";
import { buildPatientTwinWorkspaceInsights } from "@/src/lib/fi/foundation/patientTwinWorkspaceInsights";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";

import { PhotoProtocolAlertEventsTable } from "./PhotoProtocolAlertEventsTable";
import { PhotoProtocolAnalyticsCard } from "./PhotoProtocolAnalyticsCard";
import { PhotoProtocolIncompleteSessionsTable } from "./PhotoProtocolIncompleteSessionsTable";
import { FoundationOsBackfillCard } from "./FoundationOsBackfillCard";
import {
  SummaryTile,
  TwinEmptyState,
  TwinListRow,
  TwinSectionCard,
  coveragePercentLabel,
  formatTwinWhen,
  patientTwinSectionClass,
} from "./patientTwinWorkspaceUi";

function isNewClinicSnapshot(data: FoundationOsDashboardPayload): boolean {
  const t = data.integrity.totals;
  return t.fi_cases === 0 && t.fi_patients === 0 && t.fi_persons === 0 && t.fi_timeline_events === 0;
}

function MonoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-mono text-xs text-cyan-300/90 hover:text-cyan-200 hover:underline">
      {children}
    </Link>
  );
}

function redactNormalizedEmailForDisplay(normalized: string): string {
  const s = normalized.trim();
  const at = s.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!domain) return "***";
  const head = local.charAt(0) || "*";
  return `${head}***@${domain}`;
}

function actionLink(href: string, label: string, accent = false) {
  return (
    <Link
      href={href}
      className={cn(
        "font-semibold hover:underline",
        accent ? "text-cyan-300 hover:text-cyan-200" : "text-slate-300 hover:text-slate-100",
      )}
    >
      {label}
    </Link>
  );
}

export function FoundationOsDashboard({
  tenantId,
  data,
  patientOs,
  photoProtocol,
  showDiagnosticsExpanded = false,
}: {
  tenantId: string;
  data: FoundationOsDashboardPayload;
  patientOs: PatientOsOverviewModel;
  photoProtocol?: {
    summary: import("@/src/lib/hair-intelligence/photoProtocols/protocolAnalytics").PhotoProtocolAnalyticsSummary;
    alerts: import("@/src/lib/hair-intelligence/photoProtocols/protocolAlerts").PhotoProtocolAlert[];
    incomplete_sessions: import("@/src/lib/hair-intelligence/photoProtocols/photoProtocolAnalyticsLoader.server").PhotoProtocolIncompleteSessionRow[];
    scan_note: string | null;
    alert_events: import("@/src/lib/hair-intelligence/photoProtocols/types").HliPhotoProtocolAlertEvent[];
  } | null;
  /** When true, system diagnostics `<details>` starts open (platform operators). */
  showDiagnosticsExpanded?: boolean;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const m = data.integrity;
  const newClinic = isNewClinicSnapshot(data);
  const { twin_health: th, identity: id, media: med, timeline_events: te, twin_coverage: tc } = data;
  const insights = buildPatientTwinWorkspaceInsights(data, patientOs);

  const unifiedRecords =
    id.resolution_rows_with_foundation > 0 ? id.resolution_rows_with_foundation : th.foundation_patients;
  const surgeryLinkedPatientsEstimate =
    th.foundation_patients > 0 ? Math.round((tc.surgeryos_linkage_pct / 100) * th.foundation_patients) : 0;
  const missingMediaPatients = Math.max(0, th.foundation_patients - th.patients_with_unified_media_distinct);

  const nextBookingByPatient = new Map(patientOs.upcomingBookings.map((b) => [b.patientId, b]));
  const activeJourneyByPatient = new Map(patientOs.activeJourneys.map((j) => [j.patientId, j]));

  const hasMediaSection =
    photoProtocol != null ||
    th.patients_with_unified_media_distinct > 0 ||
    th.foundation_patients > 0 ||
    med.fi_media_assets > 0;

  return (
    <div className="min-w-0 space-y-6 pb-10">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">FI OS · Clinical intelligence</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Patient Twin</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
            Unified patient identity, media, clinical timeline, and treatment history across FI OS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link
            href={`${base}/patients`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95")}
          >
            Open PatientOS
          </Link>
          <Link
            href={`${base}/cases`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Open SurgeryOS
          </Link>
          <Link
            href={`${base}/audit`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Open AuditOS
          </Link>
          <Link
            href={`${base}/patients/new`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              fiOsChromeClasses.toolbarPrimaryAccent,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-50",
            )}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            New patient
          </Link>
        </div>
      </header>

      {newClinic ? (
        <InfoNotice variant="info" title="Fresh workspace">
          Patient Twin metrics will populate as you onboard patients, link cases, capture media, and record clinical milestones.
        </InfoNotice>
      ) : null}

      <TwinSectionCard id="twin-health" title="Clinical twin health" description="How complete and navigable patient records are across FI OS.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SummaryTile label="Total patients" value={th.foundation_patients} sub="All patient records in this clinic" />
          <SummaryTile
            label="Unified records"
            value={unifiedRecords}
            sub="Linked to a single clinical identity"
            tone={unifiedRecords >= th.foundation_patients * 0.8 ? "info" : "neutral"}
          />
          <SummaryTile
            label="Active case journeys"
            value={patientOs.kpis.patientsWithActiveCases}
            sub="Patients with an open SurgeryOS case"
            tone={patientOs.kpis.patientsWithActiveCases > 0 ? "info" : "neutral"}
          />
          <SummaryTile
            label="Media-linked patients"
            value={th.patients_with_unified_media_distinct}
            sub={coveragePercentLabel(tc.media_coverage_pct) !== "—" ? `${coveragePercentLabel(tc.media_coverage_pct)} of patients` : "Clinical photography linked"}
            tone="info"
          />
          <SummaryTile
            label="Surgery-linked patients"
            value={surgeryLinkedPatientsEstimate}
            sub={`${th.cases_with_foundation_patient} linked case${th.cases_with_foundation_patient === 1 ? "" : "s"} · ${coveragePercentLabel(tc.surgeryos_linkage_pct)} of cases`}
          />
          <SummaryTile
            label="Audit-linked patients"
            value={th.patients_with_audit_case_distinct}
            sub={th.reports_total > 0 ? `${th.reports_total} report${th.reports_total === 1 ? "" : "s"} in pipeline` : "No reports yet"}
            tone={th.patients_with_audit_case_distinct > 0 ? "info" : "neutral"}
          />
          <SummaryTile
            label="Readiness hint"
            value={coveragePercentLabel(tc.twin_readiness_score_hint)}
            sub="Composite readiness across linkage signals"
            tone={tc.twin_readiness_score_hint >= 70 ? "info" : tc.twin_readiness_score_hint < 45 ? "warning" : "neutral"}
          />
        </div>
      </TwinSectionCard>

      {insights.length > 0 ? (
        <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="twin-insights-heading">
          <SectionHeader
            id="twin-insights-heading"
            title="What this means for the clinic"
            description="Interpretation based on current record completeness — no automated decisions."
          />
          <ul className="mt-4 space-y-2.5">
            {insights.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-400/80" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <TwinSectionCard
          id="recent-twins"
          title="Recent patient twins"
          description="Most recently updated patient records — open a twin for the full clinical picture."
        >
          {patientOs.recentPatients.length === 0 ? (
            <TwinEmptyState
              title="No patient records yet"
              description="Create a patient or convert a lead to start building clinical twins for this clinic."
            />
          ) : (
            <ul className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a101f]/50">
              {patientOs.recentPatients.map((p) => {
                const journey = activeJourneyByPatient.get(p.patientId);
                const booking = nextBookingByPatient.get(p.patientId);
                const displayName = p.displayName !== "—" ? p.displayName : p.phone ?? p.email ?? "Unnamed patient";

                return (
                  <TwinListRow
                    key={p.patientId}
                    primary={
                      <Link href={`${base}/patients/${p.patientId}/twin`} className="hover:text-cyan-200 hover:underline">
                        {displayName}
                      </Link>
                    }
                    meta={
                      <>
                        {journey ? <>Case: {journey.caseStatusLabel}</> : "No active case"}
                        <span className="text-slate-600"> · </span>
                        Updated {formatTwinWhen(p.lastActivityAt)}
                        {booking ? (
                          <>
                            <span className="text-slate-600"> · </span>
                            Next booking {formatTwinWhen(booking.startAt)}
                          </>
                        ) : null}
                      </>
                    }
                    actions={
                      <>
                        {actionLink(`${base}/patients/${p.patientId}`, "Open patient", true)}
                        {journey ? actionLink(`${base}/cases/${journey.caseId}`, "Open case") : null}
                        {actionLink(`${base}/patients/${p.patientId}/timeline`, "View timeline")}
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}
        </TwinSectionCard>

        <TwinSectionCard
          id="active-journeys"
          title="Active clinical journeys"
          description="Patients currently moving through SurgeryOS — case status and next steps."
        >
          {patientOs.activeJourneys.length === 0 ? (
            <TwinEmptyState
              title="No active journeys"
              description="When cases are in progress for linked patients, they will appear here with shortcuts into SurgeryOS and the patient twin."
            />
          ) : (
            <ul className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a101f]/50">
              {patientOs.activeJourneys.map((j) => (
                <TwinListRow
                  key={`${j.patientId}-${j.caseId}`}
                  primary={
                    <Link href={`${base}/patients/${j.patientId}/twin`} className="hover:text-cyan-200 hover:underline">
                      {j.displayName !== "—" ? j.displayName : "Patient record"}
                    </Link>
                  }
                  meta={
                    <>
                      {j.caseStatusLabel}
                      <span className="text-slate-600"> · </span>
                      Updated {formatTwinWhen(j.updatedAt)}
                      <span className="text-slate-600"> · </span>
                      Next: review case progress in SurgeryOS
                    </>
                  }
                  actions={
                    <>
                      {actionLink(`${base}/cases/${j.caseId}`, "Open case", true)}
                      {actionLink(`${base}/patients/${j.patientId}/twin`, "Patient twin")}
                      {actionLink(`${base}/audit`, "AuditOS")}
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </TwinSectionCard>
      </div>

      <TwinSectionCard
        id="timeline-highlights"
        title="Clinical timeline highlights"
        description="Recent milestones across consultations, procedures, imaging, and audit activity."
      >
        {patientOs.timelineHighlights.length === 0 ? (
          <TwinEmptyState
            title="No clinical timeline events yet"
            description="Milestones will appear here once consultations, procedures, imaging, or audit reports are linked."
          />
        ) : (
          <ul className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a101f]/50">
            {patientOs.timelineHighlights.map((h) => (
              <TwinListRow
                key={h.id}
                primary={<span className="text-slate-100">{h.title ?? h.eventKind.replace(/_/g, " ")}</span>}
                meta={
                  <>
                    {h.eventKind.replace(/_/g, " ")}
                    {h.patientId ? (
                      <>
                        <span className="text-slate-600"> · </span>
                        <Link href={`${base}/patients/${h.patientId}`} className="text-cyan-300/90 hover:text-cyan-200 hover:underline">
                          {h.patientDisplayName ?? "Patient"}
                        </Link>
                      </>
                    ) : null}
                    <span className="text-slate-600"> · </span>
                    {formatTwinWhen(h.occurredAt)}
                  </>
                }
                actions={
                  <>
                    {h.patientId ? actionLink(`${base}/patients/${h.patientId}/timeline`, "View timeline", true) : null}
                    {actionLink(`${base}/cases/${h.caseId}`, "Open case")}
                  </>
                }
              />
            ))}
          </ul>
        )}
      </TwinSectionCard>

      {hasMediaSection ? (
        <TwinSectionCard
          id="media-readiness"
          title="Media and photo readiness"
          description="Clinical photography coverage and protocol completion for audit-ready records."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              label="Patients with unified media"
              value={th.patients_with_unified_media_distinct}
              sub={coveragePercentLabel(tc.media_coverage_pct) !== "—" ? `${coveragePercentLabel(tc.media_coverage_pct)} coverage` : undefined}
              tone="info"
            />
            <SummaryTile
              label="Missing media links"
              value={missingMediaPatients}
              sub="Patients without linked clinical media"
              tone={missingMediaPatients > 0 ? "warning" : "neutral"}
            />
            <SummaryTile
              label="Incomplete photo sessions"
              value={photoProtocol?.summary.incomplete_session_count ?? "—"}
              sub={photoProtocol ? "Protocol sessions not yet complete" : "Photo protocol analytics unavailable"}
              tone={
                photoProtocol && photoProtocol.summary.incomplete_session_count > 0
                  ? "warning"
                  : "neutral"
              }
            />
            <SummaryTile
              label="Audit-ready photo sets"
              value={
                photoProtocol
                  ? `${Math.round(photoProtocol.summary.audit_readiness_score)} / 100`
                  : coveragePercentLabel(tc.media_coverage_pct)
              }
              sub={
                photoProtocol
                  ? `${Math.round(photoProtocol.summary.protocol_completion_rate * 100)}% session completion`
                  : "Estimated from media linkage"
              }
              tone="info"
            />
          </div>

          {photoProtocol ? (
            <div className="mt-5 space-y-5">
              <PhotoProtocolAnalyticsCard
                tenantId={tid}
                summary={photoProtocol.summary}
                alerts={photoProtocol.alerts}
                scanNote={photoProtocol.scan_note}
                variant="darkGlass"
              />
            </div>
          ) : null}
        </TwinSectionCard>
      ) : null}

      <details className={patientTwinSectionClass} open={showDiagnosticsExpanded}>
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Platform operators</p>
              <h2 className="mt-1 text-base font-semibold text-slate-100">System diagnostics</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                For platform operators only. These checks support data integrity and do not affect day-to-day clinical workflows.
              </p>
            </div>
            <span className="shrink-0 text-xs font-medium text-cyan-400/80">{showDiagnosticsExpanded ? "Collapse" : "Expand"}</span>
          </div>
        </summary>

        <div className="mt-5 space-y-5 border-t border-white/[0.06] pt-5">
          <InfoNotice variant="warning" title="Read-only observability">
            Aggregates tenant-scoped foundation tables and compatibility views. Does not run identity merges, alter RLS, or change ingestion.
            Optional backfill below is a manual operator tool — not automatic repair.
          </InfoNotice>

          <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
            <DashboardCard className="p-4 sm:p-5">
              <SectionHeader title="Identity resolution" description="v_fi_patient_resolution and duplicate heuristics." />
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <span className="text-slate-300">Resolution rows with foundation patient:</span> {id.resolution_rows_with_foundation}
                </li>
                <li>
                  <span className="text-slate-300">Global-only (unresolved) rows:</span> {id.resolution_rows_global_only}
                </li>
                <li>
                  <span className="text-slate-300">Foundation-only (no global stub):</span> {id.resolution_rows_foundation_only_no_global}
                </li>
                <li>
                  <span className="text-slate-300">Duplicate-risk person emails (groups):</span> {id.duplicate_person_email_groups}
                </li>
                <li>
                  <span className="text-slate-300">Duplicate patient rows / person_id:</span> {id.duplicate_patient_rows_same_person_id}
                </li>
              </ul>
            </DashboardCard>

            <DashboardCard id="fi-os-foundation-media" className="scroll-mt-24 p-4 sm:p-5">
              <SectionHeader title="Media health (technical)" description="Legacy uploads, foundation assets, and unified view." />
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <span className="text-slate-300">Legacy fi_uploads:</span> {med.fi_uploads}
                </li>
                <li>
                  <span className="text-slate-300">fi_media_assets:</span> {med.fi_media_assets}
                </li>
                <li>
                  <span className="text-slate-300">Unified media rows:</span> {med.unified_media_rows === null ? "—" : med.unified_media_rows}
                </li>
                <li>
                  <span className="text-slate-300">Unified rows without case:</span> {med.unified_media_without_case}
                </li>
                <li>
                  <span className="text-slate-300">fi_media_assets without case_id:</span> {med.fi_media_assets_without_case_id}
                </li>
                <li>
                  <span className="text-slate-300">Unified rows without patient:</span>{" "}
                  {med.unified_rows_without_patient === null ? "—" : med.unified_rows_without_patient}
                </li>
              </ul>
              {med.fi_uploads > 0 && med.fi_media_assets === 0 ? (
                <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/25 p-2 text-xs text-amber-100/90">
                  fi_uploads has rows but fi_media_assets is empty — confirm foundation media dual-write for this tenant.
                </p>
              ) : null}
            </DashboardCard>
          </div>

          <DashboardCard className="p-4 sm:p-5">
            <SectionHeader title="Timeline / event health" description="Raw ingest vs curated timeline and event linkage chain." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryTile label="fi_events" value={te.fi_events} sub="All statuses" />
              <SummaryTile label="Processed fi_events" value={te.fi_events_processed} sub="status = processed" tone="info" />
              <SummaryTile label="Events (last 7 days)" value={te.fi_events_last_7_days} sub="created_at window" tone="info" />
              <SummaryTile label="fi_timeline_events" value={te.fi_timeline_events} sub="Curated timeline" />
              <SummaryTile label="Timeline w/ patient_id" value={te.timeline_events_with_patient_id} sub="Rows with patient anchor" tone="info" />
              <SummaryTile
                label="Timeline empty detail (sample)"
                value={te.timeline_events_with_empty_detail_sample}
                sub="First 50k rows sampled"
                tone={te.timeline_events_with_empty_detail_sample > 0 ? "warning" : "neutral"}
              />
              <SummaryTile label="Events w/ case link" value={te.events_with_fi_case_link} sub="Latest link has fi_case_id" tone="info" />
              <SummaryTile
                label="Events → foundation patient"
                value={te.events_with_foundation_patient_on_linked_case}
                sub="Linked case has foundation_patient_id"
                tone="info"
              />
              <SummaryTile
                label="Events → person"
                value={te.events_with_person_on_linked_foundation_patient}
                sub="Foundation patient has person_id"
                tone="info"
              />
            </div>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5">
            <SectionHeader
              title="Coverage diagnostics"
              description="Operating ratios from aggregates — not the per-patient Patient Twin completeness score."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryTile label="Identity (global→foundation)" value={coveragePercentLabel(tc.identity_global_resolution_pct)} />
              <SummaryTile label="CRM coverage" value={coveragePercentLabel(tc.crm_coverage_pct)} />
              <SummaryTile label="SurgeryOS linkage" value={coveragePercentLabel(tc.surgeryos_linkage_pct)} />
              <SummaryTile label="AuditOS linkage" value={coveragePercentLabel(tc.audit_case_coverage_pct)} />
              <SummaryTile label="Media coverage" value={coveragePercentLabel(tc.media_coverage_pct)} />
              <SummaryTile label="Timeline coverage" value={coveragePercentLabel(tc.timeline_coverage_pct)} />
            </div>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5">
            <SectionHeader title="Resolution / integrity queue" description="Actionable previews — resolve via PatientOS / SurgeryOS workflows." />
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global patients without foundation link</h3>
                <ul className="mt-2 max-h-48 divide-y divide-white/[0.06] overflow-auto rounded-lg border border-white/[0.06] bg-[#0a101f]/50 text-sm">
                  {m.previews.unresolved_global_patients.length === 0 ? (
                    <li className="px-3 py-3 text-slate-500">None in preview window.</li>
                  ) : (
                    m.previews.unresolved_global_patients.map((r) => (
                      <li key={r.global_patient_id} className="px-3 py-2 text-slate-400">
                        <MonoLink href={`${base}/patients/${r.global_patient_id}`}>{r.global_patient_id}</MonoLink>
                        <span className="text-slate-600">
                          {" "}
                          — {r.source_system}:{r.source_patient_id}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cases missing foundation patient (preview)</h3>
                <ul className="mt-2 max-h-48 divide-y divide-white/[0.06] overflow-auto rounded-lg border border-white/[0.06] bg-[#0a101f]/50 text-sm">
                  {m.previews.unresolved_cases.length === 0 ? (
                    <li className="px-3 py-3 text-slate-500">None in preview window.</li>
                  ) : (
                    m.previews.unresolved_cases.map((r) => (
                      <li key={r.case_id} className="px-3 py-2 text-slate-400">
                        <span className="font-mono text-xs text-slate-500">{r.case_id}</span>
                        <span className="text-slate-600"> — {r.status}</span>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                          <MonoLink href={`${base}/cases/${r.case_id}`}>Open case</MonoLink>
                          {r.global_patient_id ? <MonoLink href={`${base}/patients/${r.global_patient_id}`}>Open patient</MonoLink> : null}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duplicate-risk: shared email_normalized</h3>
              <ul className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/[0.06] bg-[#0a101f]/50 p-2 text-xs text-slate-400">
                {m.previews.duplicate_person_emails.length === 0 ? (
                  <li className="text-slate-500">No duplicate groups in preview.</li>
                ) : (
                  m.previews.duplicate_person_emails.map((r) => (
                    <li key={r.email_normalized} className="py-1">
                      <strong className="text-slate-300" title="Redacted normalized email">
                        {redactNormalizedEmailForDisplay(r.email_normalized)}
                      </strong>{" "}
                      — {r.person_count} persons ({r.person_ids.join(", ")})
                    </li>
                  ))
                )}
              </ul>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              v_fi_case_foundation rows missing foundation patient: {m.risks.unresolved_cases_no_foundation_patient}. Media without case
              (unified view): {m.unified_media_without_case_id}.
            </p>
          </DashboardCard>

          {photoProtocol && photoProtocol.alert_events.length > 0 ? (
            <PhotoProtocolAlertEventsTable tenantId={tid} events={photoProtocol.alert_events} variant="darkGlass" />
          ) : null}

          {photoProtocol && photoProtocol.incomplete_sessions.length > 0 ? (
            <PhotoProtocolIncompleteSessionsTable tenantId={tid} rows={photoProtocol.incomplete_sessions} variant="darkGlass" />
          ) : null}

          {data.scan_notes.length > 0 ? (
            <InfoNotice variant="warning" title="Scan notes">
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {data.scan_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </InfoNotice>
          ) : null}

          <FoundationOsBackfillCard tenantId={tid} variant="darkGlass" />
        </div>
      </details>
    </div>
  );
}
