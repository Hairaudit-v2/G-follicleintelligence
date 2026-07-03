import Link from "next/link";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import type { LiveDataHealthSummary } from "@/src/lib/integrations/liveDataHealth.server";

function formatWhen(iso: string | null): string {
  if (!iso?.trim()) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
          : "inline-flex rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-300"
      }
    >
      {label}
    </span>
  );
}

export function LiveDataHealthDiagnosticsCard({
  tenantId,
  health,
}: {
  tenantId: string;
  health: LiveDataHealthSummary;
}) {
  const base = `/fi-admin/${tenantId}`;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Live data health</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
            End-to-end visibility for external calendar, CRM, and activity inputs. Generated{" "}
            {formatWhen(health.generatedAt)}.
          </p>
        </div>
        <Link
          href={`${base}/onboarding-os/import-review`}
          className="text-sm text-[#22C1FF] hover:underline"
        >
          Import review →
        </Link>
      </div>

      {health.warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          {health.warnings.map((warning) => (
            <InfoNotice key={warning} variant="warning" title="Attention">
              <p className="text-sm">{warning}</p>
            </InfoNotice>
          ))}
        </div>
      ) : (
        <InfoNotice variant="success" title="No warnings" className="mt-4">
          <p className="text-sm">Connected inputs look fresh for this tenant.</p>
        </InfoNotice>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">Google Calendar / Timely</h3>
            <StatusPill ok={health.googleCalendarConnected} label={health.googleCalendarConnected ? "Connected" : "Not connected"} />
          </div>
          <dl className="mt-3 space-y-2 text-sm text-[#94A3B8]">
            <div className="flex justify-between gap-4">
              <dt>Last sync</dt>
              <dd className="text-[#CBD5E1]">{formatWhen(health.googleCalendarLastSyncAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>OnboardingOS staged events</dt>
              <dd className="text-[#CBD5E1]">{health.googleCalendarStagedEventCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Promoted (fi_calendar_events + Timely)</dt>
              <dd className="text-[#CBD5E1]">{health.googleCalendarPromotedAppointmentCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Last backfill</dt>
              <dd className="text-[#CBD5E1]">{formatWhen(health.googleCalendarBackfillLastRunAt)}</dd>
            </div>
            {health.googleCalendarBackfillLastRangeStart &&
            health.googleCalendarBackfillLastRangeEnd ? (
              <div className="flex justify-between gap-4">
                <dt>Backfill range</dt>
                <dd className="text-[#CBD5E1]">
                  {health.googleCalendarBackfillLastRangeStart} →{" "}
                  {health.googleCalendarBackfillLastRangeEnd}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-xs text-[#64748B]">
            Calendar UI reads <code className="text-[#94A3B8]">fi_calendar_events</code> and{" "}
            <code className="text-[#94A3B8]">fi_bookings</code>. OnboardingOS staging is preview-only.
          </p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">HubSpot</h3>
            <StatusPill ok={health.hubSpotConnected} label={health.hubSpotConnected ? "Connected" : "Not connected"} />
          </div>
          <dl className="mt-3 space-y-2 text-sm text-[#94A3B8]">
            <div className="flex justify-between gap-4">
              <dt>Last connector sync</dt>
              <dd className="text-[#CBD5E1]">{formatWhen(health.hubSpotLastSyncAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Staged contacts / deals</dt>
              <dd className="text-[#CBD5E1]">
                {health.hubSpotStagedContactCount} / {health.hubSpotStagedDealCount}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Promoted leads / opportunities</dt>
              <dd className="text-[#CBD5E1]">
                {health.hubSpotPromotedLeadCount} / {health.hubSpotPromotedOpportunityCount}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[#64748B]">
            LeadFlow webhook path writes <code className="text-[#94A3B8]">fi_leads</code>; OnboardingOS F5
            writes <code className="text-[#94A3B8]">fi_crm_leads</code>.
          </p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/50 p-4 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">Email / activity</h3>
            <div className="flex flex-wrap gap-2">
              <StatusPill
                ok={health.emailIngestionConfigured}
                label={health.emailIngestionConfigured ? "Pathology enabled" : "Pathology off"}
              />
              <StatusPill
                ok={health.genericEmailConfigured}
                label={health.genericEmailConfigured ? "Generic email on" : "Generic email off"}
              />
            </div>
          </div>
          <dl className="mt-3 grid gap-2 text-sm text-[#94A3B8] sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt>CRM activity (24h)</dt>
              <dd className="text-[#CBD5E1]">{health.recentActivityEventCount}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt>Generic email last ingested</dt>
              <dd className="text-[#CBD5E1]">{formatWhen(health.genericEmailLastIngestedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt>Generic email activity (24h)</dt>
              <dd className="text-[#CBD5E1]">{health.genericEmailRecentActivityCount}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt>Unmatched / ambiguous (24h)</dt>
              <dd className="text-[#CBD5E1]">
                {health.genericEmailUnmatchedCount} / {health.genericEmailAmbiguousMatchCount}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[#64748B]">
            Pathology email ingestion is isolated from generic clinic email activity (
            <code className="text-[#94A3B8]">fi_generic_clinic_email_activities</code>). Generic
            email projects to LeadFlow/CRM when confidently matched.
          </p>
        </div>
      </div>
    </section>
  );
}
