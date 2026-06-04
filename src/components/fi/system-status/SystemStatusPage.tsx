import Link from "next/link";

import type { FeatureRolloutStatus } from "@/src/lib/systemStatus/systemFeatureRegistry";
import { resolveFeatureInventoryStatuses } from "@/src/lib/systemStatus/systemFeatureRegistry";
import type { SystemStatusPayload, TrafficLight } from "@/src/lib/systemStatus/systemStatusTypes";

import { SystemStatusBadge } from "./SystemStatusBadge";
import { SystemStatusCard } from "./SystemStatusCard";
import { SystemStatusMetric } from "./SystemStatusMetric";
import { SystemStatusSection } from "./SystemStatusSection";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return String(n);
}

function stripBorder(t: TrafficLight): string {
  if (t === "green") return "border-l-emerald-500";
  if (t === "amber") return "border-l-amber-500";
  return "border-l-rose-500";
}

function featureTraffic(s: FeatureRolloutStatus): TrafficLight | null {
  if (s === "ready") return "green";
  if (s === "partial") return "amber";
  return null;
}

function featureLabel(s: FeatureRolloutStatus): string {
  if (s === "ready") return "Ready";
  if (s === "partial") return "Partial";
  return "Planned";
}

export function SystemStatusPage({ data }: { data: SystemStatusPayload }) {
  const features = resolveFeatureInventoryStatuses(data);
  const groups = ["CRM", "Bookings", "Patients", "HairAudit", "SurgeryOS", "IIOHR"] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold text-gray-900">System Status</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Tenant-safe operational snapshot: schema presence, row volumes, calendar stack, and planned product areas.
          Generated <time dateTime={data.generatedAtIso}>{data.generatedAtIso}</time>.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          <Link href={`/fi-admin/${data.tenantId}/crm`} className="text-blue-600 hover:underline">
            ← CRM
          </Link>
          <Link href={`/fi-admin/${data.tenantId}/patients`} className="text-blue-600 hover:underline">
            Patients
          </Link>
        </p>
      </header>

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_2fr]">
        <div className="flex flex-col justify-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">System readiness score</p>
          <p className="text-4xl font-semibold tabular-nums text-gray-900">{data.readiness.scorePercent}%</p>
          <p className="text-sm text-gray-600">{data.readiness.headline}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {data.summaryStrip.map((s) => (
            <div
              key={s.id}
              className={`rounded-md border border-gray-100 bg-gray-50/90 px-3 py-2 border-l-4 ${stripBorder(s.traffic)}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{s.label}</div>
              <div className="mt-1">
                <SystemStatusBadge traffic={s.traffic}>{s.traffic === "green" ? "OK" : s.traffic === "amber" ? "Watch" : "Gap"}</SystemStatusBadge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SystemStatusSection
        id="feature-inventory"
        title="Feature inventory"
        description="Central registry mapped to this tenant snapshot. “Planned” marks roadmap areas not yet shipped as first-class UI in this repo."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <SystemStatusCard key={g} title={g}>
              <ul className="space-y-2">
                {features
                  .filter((f) => f.group === g)
                  .map((f) => {
                    const tr = featureTraffic(f.status);
                    return (
                    <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-gray-800">{f.label}</span>
                      {tr ? (
                        <SystemStatusBadge traffic={tr}>{featureLabel(f.status)}</SystemStatusBadge>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-inset ring-slate-500/20">
                          {featureLabel(f.status)}
                        </span>
                      )}
                    </li>
                  );
                  })}
              </ul>
            </SystemStatusCard>
          ))}
        </div>
      </SystemStatusSection>

      <SystemStatusSection id="crm" title="1. CRM" description="Commercial module tables and row counts for this tenant.">
        <SystemStatusCard title="CRM tables" subtitle={data.crm.overallLabel}>
          <div className="flex flex-wrap gap-2">
            <SystemStatusBadge traffic={data.crm.traffic}>{data.crm.overallLabel}</SystemStatusBadge>
          </div>
          <ul className="list-inside list-disc text-sm text-gray-700">
            {data.crm.tables.map((t) => (
              <li key={t.name}>
                <code className="text-xs">{t.name}</code> — {t.exists ? "exists" : "missing"}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SystemStatusMetric label="Leads" value={fmt(data.crm.counts.leads)} />
            <SystemStatusMetric label="Tasks" value={fmt(data.crm.counts.tasks)} />
            <SystemStatusMetric label="Notes" value={fmt(data.crm.counts.notes)} />
            <SystemStatusMetric label="Communications" value={fmt(data.crm.counts.communications)} />
          </div>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="conversion" title="2. Conversion" description="Lead conversion signals (requires `fi_crm_leads` + conversion columns).">
        <SystemStatusCard title="Conversion metrics">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SystemStatusMetric label="Converted leads" value={fmt(data.conversion.convertedLeads)} />
            <SystemStatusMetric label="Leads w/ person_id" value={fmt(data.conversion.leadsWithPersonId)} />
            <SystemStatusMetric label="Leads w/ patient_id" value={fmt(data.conversion.leadsWithPatientId)} />
            <SystemStatusMetric label="Leads w/ case_id" value={fmt(data.conversion.leadsWithCaseId)} />
          </div>
          {!data.conversion.readable ? <p className="text-xs text-amber-700">Lead table not readable — conversion metrics unavailable.</p> : null}
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="bookings" title="3. Bookings" description="Platform scheduling layer (`fi_bookings`).">
        <SystemStatusCard title="Bookings" subtitle={data.bookings.tableExists ? "Table present" : "Table missing"}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SystemStatusMetric label="Total" value={fmt(data.bookings.counts.total)} />
            <SystemStatusMetric label="Future" value={fmt(data.bookings.counts.future)} />
            <SystemStatusMetric label="Completed" value={fmt(data.bookings.counts.completed)} />
            <SystemStatusMetric label="Cancelled" value={fmt(data.bookings.counts.cancelled)} />
          </div>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="calendar" title="4. Calendar" description="FI Admin calendar route and server loaders.">
        <SystemStatusCard title="Calendar stack" subtitle={data.calendar.label}>
          <div className="flex flex-wrap gap-2 text-sm text-gray-700">
            <span>Route: {data.calendar.routeEnabled ? "enabled" : "disabled"}</span>
            <span>·</span>
            <span>Loaders: {data.calendar.loadersAvailable ? "available" : "unavailable"}</span>
          </div>
          <SystemStatusBadge traffic={data.calendar.traffic}>{data.calendar.label}</SystemStatusBadge>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="patients" title="5. Patients" description="Foundation persons and clinical patients.">
        <SystemStatusCard title="Patients & persons" subtitle={data.patients.label}>
          <p className="mt-2 text-sm text-gray-700">
            Open the{" "}
            <Link href={`/fi-admin/${data.tenantId}/patients`} className="text-blue-600 hover:underline">
              patient directory
            </Link>{" "}
            for foundation profiles (Stage 4A).
          </p>
          <SystemStatusBadge traffic={data.patients.traffic}>{data.patients.label}</SystemStatusBadge>
          <div className="grid grid-cols-2 gap-2">
            <SystemStatusMetric label="fi_persons rows" value={fmt(data.patients.personsCount)} />
            <SystemStatusMetric label="fi_patients rows" value={fmt(data.patients.patientsCount)} />
            <SystemStatusMetric
              label="fi_patient_clinical_details"
              value={data.patients.clinicalDetailsTable ? "present" : "missing"}
            />
          </div>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="cases" title="6. Cases" description="Hair audit / intake cases (`fi_cases.status` buckets).">
        <SystemStatusCard title="Cases">
          <div className="grid grid-cols-2 gap-2">
            <SystemStatusMetric label="Active (draft / submitted / processing)" value={fmt(data.cases.active)} />
            <SystemStatusMetric label="Completed" value={fmt(data.cases.completed)} />
          </div>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="activity" title="7. Activity stream" description="CRM-native activity (`fi_crm_activity_events`).">
        <SystemStatusCard title="Activity" subtitle={data.activity.tableExists ? "Table present" : "Table missing"}>
          <div className="grid grid-cols-2 gap-2">
            <SystemStatusMetric label="Events today (UTC)" value={fmt(data.activity.eventsToday)} />
            <SystemStatusMetric label="Events last 7 days" value={fmt(data.activity.eventsLast7Days)} />
          </div>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="users" title="8. Users" description="Tenant membership in `fi_users` (active = linked auth user).">
        <SystemStatusCard title="FI users">
          <div className="grid grid-cols-2 gap-2">
            <SystemStatusMetric label="Active (auth linked)" value={fmt(data.users.activeUsers)} />
            <SystemStatusMetric label="Total rows" value={fmt(data.users.totalUsers)} />
          </div>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="db-health" title="9. Database health" description="Core tables required for CRM + bookings + foundation admin.">
        <SystemStatusCard title="Table presence">
          <ul className="grid gap-1 sm:grid-cols-2">
            {data.databaseHealth.map((r) => (
              <li key={r.table} className="flex items-center justify-between gap-2 text-sm">
                <code className="text-xs text-gray-800">{r.table}</code>
                <span className={r.present ? "text-emerald-700" : "text-rose-700"}>{r.present ? "Present" : "Missing"}</span>
              </li>
            ))}
          </ul>
        </SystemStatusCard>
      </SystemStatusSection>

      <SystemStatusSection id="migrations" title="10. Migration health" description="Latest SQL migration filename from repo `supabase/migrations` (best-effort on this host).">
        <SystemStatusCard title="Migrations">
          <p className="text-sm text-gray-700">
            Status: <strong>{data.migrationHealth.label}</strong>
          </p>
          {data.migrationHealth.latestMigrationFilename ? (
            <p className="break-all font-mono text-xs text-gray-600">{data.migrationHealth.latestMigrationFilename}</p>
          ) : (
            <p className="text-xs text-gray-500">No migration metadata available on this deployment path.</p>
          )}
        </SystemStatusCard>
      </SystemStatusSection>
    </div>
  );
}
