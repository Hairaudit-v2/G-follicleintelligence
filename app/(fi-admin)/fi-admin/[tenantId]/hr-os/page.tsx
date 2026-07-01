import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { HrOsClinicalRosteringSection } from "@/src/components/fi/hr-os/HrOsClinicalRosteringSection";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { buildTenantWorkforceIdentityOverview } from "@/src/lib/workforce-os/workforceIdentityTenantOverview.server";
import { buildTenantWorkforceReadinessOverview } from "@/src/lib/workforce-os/workforceReadinessTenantOverview.server";
import {
  loadWorkforceRosterOverview,
  seedDefaultClinicalStaffingTemplatesForTenant,
  seedDefaultProcedurePrivilegeRequirementsForTenant,
} from "@/src/lib/workforce-os/workforceRostering.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export const metadata = {
  title: "HR OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HrOsHomePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) notFound();

  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/hr-os`;
  await seedDefaultClinicalStaffingTemplatesForTenant(tid).catch(() => undefined);
  await seedDefaultProcedurePrivilegeRequirementsForTenant(tid).catch(() => undefined);
  const staff = await loadAllStaffForTenant(tid);
  const [identityOverview, readinessOverview, rosterOverview] = await Promise.all([
    buildTenantWorkforceIdentityOverview(tid, staff),
    buildTenantWorkforceReadinessOverview(tid, staff),
    loadWorkforceRosterOverview(tid),
  ]);

  return (
    <div className="relative z-[1] mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {access.platformAdminPreview ? (
        <InfoNotice variant="info" title="Platform operator preview">
          <p className="text-sm">
            You are viewing HR OS as a platform operator. Tenant entitlement checks are bypassed for
            support and provisioning.
          </p>
        </InfoNotice>
      ) : null}

      <HrOsSubNav tenantId={tid} />

      <header className="mt-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Paid add-on module
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">HR OS</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Workforce operations, staff readiness, and HR sync health for your clinic. This workspace
          is protected by platform entitlements — only verified clinics with an active subscription
          and enabled HR OS access can use it.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-6">
        <h2 className="text-sm font-semibold text-slate-100">Identity layer</h2>
        <p className="mt-2 text-sm text-slate-400">
          Tenant-wide workforce identity link coverage across HR, Academy, and Nexus. Staff Twin
          shows per-person detail.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Active staff</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {identityOverview.activeStaffCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">HR linked</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {identityOverview.hrLinkedCount} / {identityOverview.activeStaffCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Nexus linked</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {identityOverview.nexusLinkedCount} / {identityOverview.activeStaffCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Academy linked</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {identityOverview.academyLinkedCount} / {identityOverview.activeStaffCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Stale identity sync</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {identityOverview.staleIdentityCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Fully linked (3 systems)</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {identityOverview.fullyLinkedCount}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-6">
        <h2 className="text-sm font-semibold text-slate-100">Workforce readiness</h2>
        <p className="mt-2 text-sm text-slate-400">
          Tenant-wide readiness intelligence — 0–100 multi-factor scores across active staff.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Total staff</dt>
            <dd className="mt-1 font-semibold text-slate-100">{readinessOverview.totalStaff}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Average readiness</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {readinessOverview.averageReadinessScore}%
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Staff fully ready</dt>
            <dd className="mt-1 font-semibold text-emerald-300">
              {readinessOverview.fullyReadyCount} / {readinessOverview.activeStaff}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Elite ready</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {readinessOverview.eliteReadyCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Operational warnings</dt>
            <dd className="mt-1 font-semibold text-amber-300">
              {readinessOverview.operationalWarningCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Staff restricted</dt>
            <dd className="mt-1 font-semibold text-amber-200">
              {readinessOverview.restrictedCount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Blocked staff</dt>
            <dd className="mt-1 font-semibold text-rose-300">{readinessOverview.blockedCount}</dd>
          </div>
        </dl>
      </section>

      <HrOsClinicalRosteringSection overview={rosterOverview} tenantId={tid} />

      <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-6">
        <h2 className="text-sm font-semibold text-slate-100">Getting started</h2>
        <p className="mt-2 text-sm text-slate-400">
          HR OS command centre modules will appear here as they ship. Existing HR tooling remains
          available under legacy routes until migration completes.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>
            <a className="text-cyan-400 hover:text-cyan-300" href={`${base}/sync-health`}>
              Sync Health
            </a>
          </li>
          <li>
            <a
              className="text-cyan-400 hover:text-cyan-300"
              href={`${base}/staff-reconciliation`}
            >
              Staff Reconciliation
            </a>
          </li>
          <li>
            <a className="text-cyan-400 hover:text-cyan-300" href={`${base}/duplicates`}>
              Duplicate Review
            </a>
          </li>
          <li>
            <a className="text-cyan-400 hover:text-cyan-300" href={`${base}/offboarding`}>
              Offboarding Centre
            </a>
          </li>
          <li>
            <a className="text-cyan-400 hover:text-cyan-300" href={`${base}/roster`}>
              Roster Command Centre
            </a>
          </li>
          <li>
            <a
              className="text-cyan-400 hover:text-cyan-300"
              href={`/fi-admin/${tenantId.trim()}/staff`}
            >
              Workforce Command Centre
            </a>
          </li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">Module home: {base}</p>
      </section>
    </div>
  );
}
