import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
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

  const base = `/fi-admin/${tenantId.trim()}/hr-os`;

  return (
    <div className="relative z-[1] mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {access.platformAdminPreview ? (
        <InfoNotice variant="info" title="Platform operator preview">
          <p className="text-sm">
            You are viewing HR OS as a platform operator. Tenant entitlement checks are bypassed for support and
            provisioning.
          </p>
        </InfoNotice>
      ) : null}

      <header className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Paid add-on module</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">HR OS</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Workforce operations, staff readiness, and HR sync health for your clinic. This workspace is protected by
          platform entitlements — only verified clinics with an active subscription and enabled HR OS access can use it.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-6">
        <h2 className="text-sm font-semibold text-slate-100">Getting started</h2>
        <p className="mt-2 text-sm text-slate-400">
          HR OS command centre modules will appear here as they ship. Existing HR tooling remains available under legacy
          routes until migration completes.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>
            <a className="text-cyan-400 hover:text-cyan-300" href={`/fi-admin/${tenantId.trim()}/hr/staff-readiness`}>
              Staff readiness
            </a>
          </li>
          <li>
            <a className="text-cyan-400 hover:text-cyan-300" href={`/fi-admin/${tenantId.trim()}/hr/sync-health`}>
              HR sync health
            </a>
          </li>
          <li>
            <a className="text-cyan-400 hover:text-cyan-300" href={`/fi-admin/${tenantId.trim()}/staff`}>
              Staff directory
            </a>
          </li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">Module home: {base}</p>
      </section>
    </div>
  );
}
