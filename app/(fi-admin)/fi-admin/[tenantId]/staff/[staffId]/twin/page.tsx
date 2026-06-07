import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ExternalLink } from "lucide-react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { loadStaffTwinPage } from "@/src/lib/staff/staffTwinLoader.server";

export const metadata = {
  title: "Staff Twin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function isSafeExternalHref(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith("https://") || u.startsWith("http://");
}

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

  const data = await loadStaffTwinPage(tid, sid);
  if (!data) notFound();

  const base = `/fi-admin/${tid}`;
  const { staff, linkedUser, sourceIds, workingHoursSummary, schedulingTimezoneLabel } = data;

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
          </div>
          <span
            className={
              staff.is_active
                ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200"
                : "rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100"
            }
          >
            {staff.is_active ? "Active" : "Inactive"}
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
      </DashboardCard>

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
                {row.source_url && isSafeExternalHref(row.source_url) ? (
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

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "HR employment record", body: "Payroll dates, contracts, and position history will appear when HR integrations are enabled." },
          { title: "IIOHR training", body: "Mandatory training and certifications will surface from your HR workspace when linked." },
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
