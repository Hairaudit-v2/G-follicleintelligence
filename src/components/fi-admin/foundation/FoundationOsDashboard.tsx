import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, ListChecks, ShieldAlert, Users } from "lucide-react";

import type { FoundationIntegrityMetrics } from "@/src/lib/fi/foundation/integrity";
import type { FoundationOsDashboardPayload } from "@/src/lib/fi/foundation/foundationOsDashboardTypes";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";

import { PhotoProtocolAlertEventsTable } from "./PhotoProtocolAlertEventsTable";
import { PhotoProtocolAnalyticsCard } from "./PhotoProtocolAnalyticsCard";
import { PhotoProtocolIncompleteSessionsTable } from "./PhotoProtocolIncompleteSessionsTable";
import { FoundationOsBackfillCard } from "./FoundationOsBackfillCard";

function isNewClinicSnapshot(m: FoundationIntegrityMetrics): boolean {
  const t = m.totals;
  return t.fi_cases === 0 && t.fi_patients === 0 && t.fi_persons === 0 && t.fi_timeline_events === 0;
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <FiCard>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </FiCard>
  );
}

function MonoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-mono text-sm text-sky-700 hover:underline">
      {children}
    </Link>
  );
}

/** Avoid showing full normalized emails in the admin shell (duplicate-risk preview is still keyed internally). */
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

function coveragePercentLabel(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

export function FoundationOsDashboard({
  tenantId,
  data,
  photoProtocol,
}: {
  tenantId: string;
  data: FoundationOsDashboardPayload;
  photoProtocol?: {
    summary: import("@/src/lib/hair-intelligence/photoProtocols/protocolAnalytics").PhotoProtocolAnalyticsSummary;
    alerts: import("@/src/lib/hair-intelligence/photoProtocols/protocolAlerts").PhotoProtocolAlert[];
    incomplete_sessions: import("@/src/lib/hair-intelligence/photoProtocols/photoProtocolAnalyticsLoader.server").PhotoProtocolIncompleteSessionRow[];
    scan_note: string | null;
    alert_events: import("@/src/lib/hair-intelligence/photoProtocols/types").HliPhotoProtocolAlertEvent[];
  } | null;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const m = data.integrity;
  const newClinic = isNewClinicSnapshot(m);
  const { twin_health: th, identity: id, media: med, timeline_events: te, twin_coverage: tc } = data;

  return (
    <div className="min-w-0 space-y-6">
      <FiPageHeader
        eyebrow="FI OS"
        title="FoundationOS"
        description="Patient identity resolution, media unification, timelines, events, and Patient Twin health. This dashboard is read-only — it does not auto-merge identities or modify source records."
        titleId="foundationos-dashboard-heading"
        primaryAction={
          <Link
            href={`${base}/patients`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            Open PatientOS
          </Link>
        }
        secondaryAction={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Link
              href={`${base}/cases`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Open SurgeryOS
            </Link>
            <Link
              href={`${base}/audit`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Open AuditOS
            </Link>
          </div>
        }
      />

      <FiCard className="border-amber-200 bg-amber-50/50">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div className="min-w-0 text-sm text-amber-950">
            <p className="font-semibold text-amber-900">Read-only observability</p>
            <p className="mt-1 leading-relaxed text-amber-950/90">
              FoundationOS aggregates tenant-scoped foundation tables and compatibility views. It does not run identity merges, alter RLS, or change ingestion. Optional backfill below is the same manual operator tool as before — it is not automatic repair.
            </p>
          </div>
        </div>
      </FiCard>

      {newClinic ? (
        <FiEmptyState
          title="Fresh workspace"
          description="Zeros are normal until patients, cases, and timeline activity exist. Event totals may still appear from platform ingestion — watch persons, patients, cases, and timeline as you onboard."
        />
      ) : null}

      <SectionCard
        title="Twin health KPIs"
        description="Foundation patient graph, linkage, and coverage proxies (distinct patient counts use capped scans — see notes at bottom when present)."
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <FiKpiTile label="Foundation patients" value={String(th.foundation_patients)} description="fi_patients" tone="info" />
          <FiKpiTile label="Persons" value={String(th.persons)} description="fi_persons" tone="neutral" />
          <FiKpiTile label="Cases (total)" value={String(th.cases_total)} description="fi_cases" tone="neutral" />
          <FiKpiTile
            label="Cases missing foundation patient"
            value={String(th.cases_missing_foundation_patient)}
            description="fi_cases rows without foundation_patient_id"
            tone={th.cases_missing_foundation_patient > 0 ? "warning" : "neutral"}
          />
          <FiKpiTile
            label="Patients w/ timeline"
            value={String(th.patients_with_timeline_events_distinct)}
            description="Distinct patient_id on fi_timeline_events"
            tone="info"
          />
          <FiKpiTile
            label="Patients w/ unified media"
            value={String(th.patients_with_unified_media_distinct)}
            description="Distinct foundation_patient_id on v_fi_media_unified"
            tone="info"
          />
          <FiKpiTile
            label="Patients w/ CRM lead"
            value={String(th.patients_with_crm_lead_distinct)}
            description="Distinct patient_id on fi_crm_leads"
            tone="info"
          />
          <FiKpiTile
            label="Patients w/ audit case"
            value={String(th.patients_with_audit_case_distinct)}
            description="Distinct foundation patients on cases that have fi_reports"
            tone={th.reports_total > 0 ? "info" : "neutral"}
          />
          <FiKpiTile label="Reports (fi_reports)" value={String(th.reports_total)} description="HairAudit / report pipeline rows" tone="neutral" />
        </div>
      </SectionCard>

      {photoProtocol ? (
        <div className="space-y-6">
          <PhotoProtocolAnalyticsCard
            tenantId={tid}
            summary={photoProtocol.summary}
            alerts={photoProtocol.alerts}
            scanNote={photoProtocol.scan_note}
          />
          <PhotoProtocolAlertEventsTable tenantId={tid} events={photoProtocol.alert_events} />
          <PhotoProtocolIncompleteSessionsTable tenantId={tid} rows={photoProtocol.incomplete_sessions} />
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Identity resolution"
          description="From v_fi_patient_resolution and existing duplicate heuristics (email / person_id)."
        >
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <span className="font-medium text-slate-900">Resolution rows with foundation patient:</span> {id.resolution_rows_with_foundation}
            </li>
            <li>
              <span className="font-medium text-slate-900">Global-only (unresolved) rows:</span> {id.resolution_rows_global_only}
            </li>
            <li>
              <span className="font-medium text-slate-900">Foundation-only (no global stub):</span> {id.resolution_rows_foundation_only_no_global}
            </li>
            <li>
              <span className="font-medium text-slate-900">Duplicate-risk person emails (groups):</span> {id.duplicate_person_email_groups}
            </li>
            <li>
              <span className="font-medium text-slate-900">Duplicate patient rows / person_id:</span> {id.duplicate_patient_rows_same_person_id}
            </li>
          </ul>
        </SectionCard>

        <div id="fi-os-foundation-media" className="scroll-mt-24">
          <SectionCard title="Media health" description="Legacy uploads, foundation assets, and unified view (read models only).">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <span className="font-medium text-slate-900">Legacy fi_uploads:</span> {med.fi_uploads}
            </li>
            <li>
              <span className="font-medium text-slate-900">fi_media_assets:</span> {med.fi_media_assets}
            </li>
            <li>
              <span className="font-medium text-slate-900">Unified media rows:</span> {med.unified_media_rows === null ? "—" : med.unified_media_rows}
            </li>
            <li>
              <span className="font-medium text-slate-900">Unified rows without case:</span> {med.unified_media_without_case}
            </li>
            <li>
              <span className="font-medium text-slate-900">fi_media_assets without case_id:</span> {med.fi_media_assets_without_case_id}
            </li>
            <li>
              <span className="font-medium text-slate-900">Unified rows without patient:</span>{" "}
              {med.unified_rows_without_patient === null ? "—" : med.unified_rows_without_patient}
            </li>
          </ul>
          {med.fi_uploads > 0 && med.fi_media_assets === 0 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-950">
              <span className="font-medium text-amber-900">Check dual-write:</span> fi_uploads has rows but fi_media_assets is empty. Legacy files may still be authoritative; confirm whether foundation media dual-write is expected for this tenant before relying on fi_media_assets.
            </p>
          ) : null}
        </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Timeline / event health"
        description="Raw ingest vs processed events, timeline rows, and event→case→patient chain (latest fi_event_links per event, up to 200k events — see integrity notes)."
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <FiKpiTile label="fi_events" value={String(te.fi_events)} description="All statuses" tone="neutral" />
          <FiKpiTile label="Processed fi_events" value={String(te.fi_events_processed)} description="status = processed" tone="info" />
          <FiKpiTile label="Events (last 7 days)" value={String(te.fi_events_last_7_days)} description="created_at window" tone="info" />
          <FiKpiTile label="fi_timeline_events" value={String(te.fi_timeline_events)} description="Curated timeline" tone="neutral" />
          <FiKpiTile
            label="Timeline w/ patient_id"
            value={String(te.timeline_events_with_patient_id)}
            description="Rows with patient anchor"
            tone="info"
          />
          <FiKpiTile
            label="Timeline empty detail (sample)"
            value={String(te.timeline_events_with_empty_detail_sample)}
            description="First 50k rows sampled in integrity"
            tone={te.timeline_events_with_empty_detail_sample > 0 ? "warning" : "neutral"}
          />
          <FiKpiTile label="Events w/ case link" value={String(te.events_with_fi_case_link)} description="Latest link has fi_case_id" tone="info" />
          <FiKpiTile
            label="Events → foundation patient"
            value={String(te.events_with_foundation_patient_on_linked_case)}
            description="Linked case has foundation_patient_id"
            tone="info"
          />
          <FiKpiTile
            label="Events → person"
            value={String(te.events_with_person_on_linked_foundation_patient)}
            description="Foundation patient has person_id"
            tone="info"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Unsupported event-type breakdown is deferred — it would require mapping the full event catalogue beyond this read-only summary.
        </p>
      </SectionCard>

      <SectionCard
        title="Coverage hints (not the Patient Twin score)"
        description="Operating ratios from aggregates and capped scans — not the per-patient Patient Twin completeness algorithm. “—” means the ratio does not apply or data was skipped (see scan notes). The readiness hint averages only the six coverage rows above it (skips —)."
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <FiKpiTile
            label="Identity (global→foundation)"
            value={coveragePercentLabel(tc.identity_global_resolution_pct)}
            description={
              tc.identity_global_resolution_pct === null
                ? "No global stub rows in v_fi_patient_resolution"
                : "Global rows in view that also have a foundation patient / all global rows"
            }
            tone="neutral"
          />
          <FiKpiTile label="CRM coverage" value={coveragePercentLabel(tc.crm_coverage_pct)} description="Distinct leads with patient_id / foundation patients" tone="neutral" />
          <FiKpiTile label="SurgeryOS linkage" value={coveragePercentLabel(tc.surgeryos_linkage_pct)} description="Cases with foundation_patient_id / cases" tone="neutral" />
          <FiKpiTile
            label="AuditOS linkage"
            value={coveragePercentLabel(tc.audit_case_coverage_pct)}
            description={
              tc.audit_case_coverage_pct === null
                ? "Audit linkage query failed — see scan notes"
                : "Distinct foundation patients on cases that have fi_reports / foundation patients"
            }
            tone="neutral"
          />
          <FiKpiTile
            label="Media coverage"
            value={coveragePercentLabel(tc.media_coverage_pct)}
            description={
              tc.media_coverage_pct === null
                ? "Unified media distinct scan skipped — see scan notes"
                : "Distinct patients in v_fi_media_unified / foundation patients (capped scan)"
            }
            tone="neutral"
          />
          <FiKpiTile
            label="Timeline coverage"
            value={coveragePercentLabel(tc.timeline_coverage_pct)}
            description="Distinct patients on fi_timeline_events / foundation patients (capped scan)"
            tone="neutral"
          />
          <FiKpiTile
            label="Readiness hint"
            value={coveragePercentLabel(tc.twin_readiness_score_hint)}
            description="Mean of the six coverage signals above when numeric (excludes —)"
            tone="info"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Resolution / integrity queue"
        description="Actionable previews from existing integrity loader — use PatientOS / SurgeryOS workflows to resolve; no auto-merge here."
      >
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global patients without foundation link</h3>
            <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-100 text-sm">
              {m.previews.unresolved_global_patients.length === 0 ? (
                <li className="px-3 py-3 text-slate-500">None in preview window.</li>
              ) : (
                m.previews.unresolved_global_patients.map((r) => (
                  <li key={r.global_patient_id} className="px-3 py-2 text-slate-700">
                    <MonoLink href={`${base}/patients/${r.global_patient_id}`}>{r.global_patient_id}</MonoLink>
                    <span className="text-slate-500">
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
            <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-100 text-sm">
              {m.previews.unresolved_cases.length === 0 ? (
                <li className="px-3 py-3 text-slate-500">None in preview window.</li>
              ) : (
                m.previews.unresolved_cases.map((r) => (
                  <li key={r.case_id} className="px-3 py-2 text-slate-700">
                    <span className="font-mono text-xs text-slate-600">{r.case_id}</span>
                    <span className="text-slate-500"> — {r.status}</span>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                      <MonoLink href={`${base}/cases/${r.case_id}`}>Open case (SurgeryOS)</MonoLink>
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
          <ul className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-100 p-2 text-xs text-slate-700">
            {m.previews.duplicate_person_emails.length === 0 ? (
              <li className="text-slate-500">No duplicate groups in preview.</li>
            ) : (
              m.previews.duplicate_person_emails.map((r) => (
                <li key={r.email_normalized} className="py-1">
                  <strong className="text-slate-900" title="Redacted normalized email">
                    {redactNormalizedEmailForDisplay(r.email_normalized)}
                  </strong>{" "}
                  — {r.person_count} persons ({r.person_ids.join(", ")})
                </li>
              ))
            )}
          </ul>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          v_fi_case_foundation rows missing foundation patient (integrity risk): {m.risks.unresolved_cases_no_foundation_patient}. Media without case (unified view):{" "}
          {m.unified_media_without_case_id}.
        </p>
      </SectionCard>

      <SectionCard title="Foundation search / deep links" description="Existing FI OS routes — no new search UI.">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <FiQuickActionCard
            title="PatientOS — patients"
            description="Profiles and charts for foundation-linked patients."
            href={`${base}/patients`}
            icon={<Users className="h-5 w-5" aria-hidden />}
            showOpenAffordance={false}
            className="!min-h-0 sm:!min-h-0"
          />
          <FiQuickActionCard
            title="Tenant directory"
            description="Directory and lookups (foundation-backed search where enabled)."
            href={`${base}/directory`}
            icon={<Users className="h-5 w-5 text-slate-600" aria-hidden />}
            showOpenAffordance={false}
            className="!min-h-0 sm:!min-h-0"
          />
          <FiQuickActionCard
            title="SurgeryOS — cases"
            description="Case worklist and detail (foundation_patient_id on cases)."
            href={`${base}/cases`}
            icon={<ClipboardList className="h-5 w-5" aria-hidden />}
            showOpenAffordance={false}
            className="!min-h-0 sm:!min-h-0"
          />
          <FiQuickActionCard
            title="AuditOS"
            description="Report queue and decisions when HairAudit-style reports exist."
            href={`${base}/audit`}
            icon={<ListChecks className="h-5 w-5" aria-hidden />}
            showOpenAffordance={false}
            className="!min-h-0 sm:!min-h-0"
          />
        </div>
      </SectionCard>

      {data.scan_notes.length > 0 ? (
        <FiCard className="border-amber-200 bg-amber-50/60">
          <p className="text-sm font-semibold text-amber-900">Scan notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950/90">
            {data.scan_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </FiCard>
      ) : null}

      <FoundationOsBackfillCard tenantId={tid} />
    </div>
  );
}
