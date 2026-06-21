import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ExternalLink } from "lucide-react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { StaffHrNotificationDetailCard } from "@/src/components/fi/staff/StaffHrNotificationBadge";
import { StaffPayrollMetadataPanel } from "@/src/components/fi/staff/StaffPayrollMetadataPanel";
import { pickStaffHrNotificationFromSourceRows } from "@/src/lib/staff/staffHrNotificationSummary";
import { StaffPinSettingsPanel } from "@/src/components/fi/staff/StaffPinSettingsPanel";
import { StaffTwinIiohrComplianceCard } from "@/src/components/staff/staffComplianceReadOnly";
import { StaffWorkforceIdentityPanel } from "@/src/components/fi/staff/StaffWorkforceIdentityPanel";
import { StaffWorkforceReadinessCard } from "@/src/components/fi/staff/StaffWorkforceReadinessPanel";
import { StaffWorkforceRosterPanel } from "@/src/components/fi/staff/StaffWorkforceRosterPanel";
import { loadStaffRosterProfile } from "@/src/lib/workforce-os/workforceRostering.server";
import { buildWorkforceIdentitySummaryFromSourceRows } from "@/src/lib/workforce-os/workforceIdentitySummary";
import { calculateWorkforceReadinessScore } from "@/src/lib/workforce-os/workforceReadinessEngine";
import { isAllowedHrPortalUrl } from "@/src/lib/staff/myHrPortalSelection";
import { pickPayrollSourceDisplayFromRows } from "@/src/lib/staff/staffPayrollSourceDisplay";
import { isStaffRoleNeedsReview } from "@/src/lib/staff/staffRolePolicy";
import { loadStaffTwinPage } from "@/src/lib/staff/staffTwinLoader.server";

export const metadata = {
  title: "Staff Twin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffTwinPage({
  params,
}: {
  params: Promise<{ tenantId: string; staffId: string }>;
}) {
  noStore();
  const { tenantId, staffId } = await params;
  const tid = tenantId?.trim();
  const sid = staffId?.trim();
  if (!tid || !sid) notFound();

  const [data, rosterProfile] = await Promise.all([
    loadStaffTwinPage(tid, sid),
    loadStaffRosterProfile(tid, sid),
  ]);
  if (!data) notFound();

  const base = `/fi-admin/${tid}`;
  const {
    staff,
    linkedUser,
    sourceIds,
    workingHoursSummary,
    schedulingTimezoneLabel,
    complianceSummary,
    canManageStaffPin,
    pinMetadata,
  } = data;
  const payroll = pickPayrollSourceDisplayFromRows(sourceIds);
  const hrNotification = pickStaffHrNotificationFromSourceRows(
    sourceIds.map((row) => ({
      source_system: row.source_system,
      source_url: row.source_url,
      metadata: row.metadata,
    }))
  );
  const identitySummary = buildWorkforceIdentitySummaryFromSourceRows(
    sourceIds.map((row) => ({
      source_system: row.source_system,
      source_staff_id: row.source_staff_id,
      metadata: row.metadata,
    }))
  );
  const identityRows = sourceIds.map((row) => ({
    source_system: row.source_system,
    source_staff_id: row.source_staff_id,
    metadata: row.metadata,
  }));
  const workforceReadiness = calculateWorkforceReadinessScore({
    is_active: staff.is_active,
    staff_role: staff.staff_role,
    working_hours: staff.working_hours,
    hr: hrNotification,
    identityRows,
    compliance: complianceSummary,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">Staff Twin</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">{staff.full_name}</h1>
        <p className="mt-2 text-sm text-[#94A3B8]">
          Read-only foundation view. Scheduling and identity links are shown here; deeper HR and clinical modules will
          connect in later phases.
        </p>
      </div>

      <DashboardCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Profile</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">From <span className="font-mono text-xs text-[#64748B]">fi_staff</span></p>
            <p className="mt-2 text-sm">
            <Link href={`${base}/staff/role-review`} className="text-[#22C1FF] underline-offset-2 hover:underline">
              Assign roles workflow
            </Link>
            </p>
          </div>
          <span
            className={
              staff.is_active
                ? isStaffRoleNeedsReview(staff.staff_role)
                  ? "rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100"
                  : "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200"
                : "rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100"
            }
          >
            {!staff.is_active ? "Inactive" : isStaffRoleNeedsReview(staff.staff_role) ? "Needs review" : "Active"}
          </span>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[#64748B]">Role</dt>
            <dd className="mt-1 font-medium text-[#E2E8F0]">{staff.staff_role}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Email</dt>
            <dd className="mt-1 text-[#E2E8F0]">{staff.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Mobile</dt>
            <dd className="mt-1 text-[#E2E8F0]">{staff.mobile ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Calendar colour</dt>
            <dd className="mt-1 flex items-center gap-2 text-[#E2E8F0]">
              {staff.calendar_color ? (
                <>
                  <span
                    className="inline-block h-4 w-4 rounded border border-white/20"
                    style={{ backgroundColor: staff.calendar_color }}
                    title={staff.calendar_color}
                  />
                  <span className="font-mono text-xs">{staff.calendar_color}</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        {isStaffRoleNeedsReview(staff.staff_role) ? (
          <p className="mt-4 text-sm text-amber-100/90">
            This profile cannot be used as a clinical booking assignee until a proper role is set in{" "}
            <Link href={`${base}/staff?staff_role=needs_review`} className="underline-offset-2 hover:underline">
              Staff directory
            </Link>
            .
          </p>
        ) : null}
      </DashboardCard>

      {payroll ? (
        <DashboardCard className="p-6 sm:p-8">
          <StaffPayrollMetadataPanel payroll={payroll} variant="dark" />
        </DashboardCard>
      ) : null}

      <DashboardCard className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">FI login</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">Linked row in <span className="font-mono text-xs text-[#64748B]">fi_users</span> (tenant-scoped)</p>
        {linkedUser ? (
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-[#64748B]">User id</dt>
              <dd className="mt-1 font-mono text-xs text-[#CBD5E1]">{linkedUser.id}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Email</dt>
              <dd className="mt-1 text-[#E2E8F0]">{linkedUser.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Role</dt>
              <dd className="mt-1 text-[#E2E8F0]">{linkedUser.role ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-[#94A3B8]">No FI user is linked to this staff profile.</p>
        )}
      </DashboardCard>

      <DashboardCard className="p-6 sm:p-8">
        <StaffWorkforceIdentityPanel summary={identitySummary} variant="dark" />
      </DashboardCard>

      <StaffWorkforceReadinessCard readiness={workforceReadiness} variant="dark" />

      <StaffWorkforceRosterPanel profile={rosterProfile} variant="dark" />

      <DashboardCard className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">External systems</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">Identifiers from <span className="font-mono text-xs text-[#64748B]">fi_staff_source_ids</span></p>
        {sourceIds.length === 0 ? (
          <p className="mt-4 text-sm text-[#94A3B8]">No external source ids recorded.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sourceIds.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-[#E2E8F0]">{row.source_system}</p>
                  <p className="mt-0.5 font-mono text-xs text-[#94A3B8]">{row.source_staff_id}</p>
                </div>
                {row.source_url && isAllowedHrPortalUrl(row.source_url) ? (
                  <a
                    href={row.source_url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#22C1FF] underline-offset-2 hover:underline"
                  >
                    Open
                    <ExternalLink className="h-3.5 w-3.5 opacity-90" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Calendar &amp; scheduling</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">Wall times use the staff timezone below.</p>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-[#64748B]">Timezone</dt>
            <dd className="mt-1 font-mono text-xs text-[#CBD5E1]">{schedulingTimezoneLabel}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Weekly hours</dt>
            <dd className="mt-1 text-[#E2E8F0]">{workingHoursSummary || "No weekly pattern configured."}</dd>
          </div>
        </dl>
      </DashboardCard>

      {canManageStaffPin && pinMetadata ? (
        <DashboardCard className="p-6 sm:p-8">
          <StaffPinSettingsPanel
            tenantId={tid}
            staffId={staff.id}
            staffName={staff.full_name}
            metadata={pinMetadata}
          />
        </DashboardCard>
      ) : null}

      <DashboardCard className="p-6 sm:p-8">
        <StaffHrNotificationDetailCard summary={hrNotification} variant="dark" />
      </DashboardCard>

      <DashboardCard className="p-6 sm:p-8">
        <StaffTwinIiohrComplianceCard summary={complianceSummary} />
      </DashboardCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "HR employment record", body: "Payroll dates, contracts, and position history will appear when HR integrations are enabled." },
          { title: "Surgical participation", body: "Theatre lists, procedures assisted, and case attribution will be summarised here." },
          { title: "Patient outcomes", body: "Aggregated outcome metrics tied to this clinician will display with appropriate governance." },
          { title: "Audit performance", body: "Quality audits and corrective actions will roll up into this panel." },
        ].map((panel) => (
          <DashboardCard key={panel.title} className="p-5">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">{panel.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{panel.body}</p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-[#475569]">Placeholder</p>
          </DashboardCard>
        ))}
      </div>

      <p className="text-center text-sm text-[#64748B]">
        <Link href={`${base}/staff`} className="text-[#94A3B8] underline-offset-2 hover:text-[#CBD5E1] hover:underline">
          Back to staff directory
        </Link>
        {" · "}
        <Link href={base} className="text-[#94A3B8] underline-offset-2 hover:text-[#CBD5E1] hover:underline">
          Tenant home
        </Link>
      </p>
    </div>
  );
}
