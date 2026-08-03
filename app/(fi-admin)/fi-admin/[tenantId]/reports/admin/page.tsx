import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { canViewFiOsNavigationAudit } from "@/src/lib/fiOs/navigation/fiOsNavigationAuditAccess.server";
import {
  FI_OS_REPORTS_ADMIN_LEGACY_ROUTES,
  buildFiOsReportsLegacyHref,
} from "@/src/lib/fiOs/reports/reportsWorkspaceCore";

export const metadata = {
  title: "Admin audit",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminReportsAdminAuditPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  const allowed = await canViewFiOsNavigationAudit(tid);
  if (!allowed) {
    redirect(`/fi-admin/${tid}/reports`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Admin audit</h1>
        <p className="mt-1 text-sm text-slate-400">
          Platform and operator surfaces for navigation validation, signal learning, presence
          review, and intelligence bake checks. Preserved legacy routes remain live.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/fi-admin/${tid}/reports/system-audit`}
          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-500/15"
        >
          System audit trail
        </Link>
        {FI_OS_REPORTS_ADMIN_LEGACY_ROUTES.map((route) => (
          <Link
            key={route.id}
            href={buildFiOsReportsLegacyHref(tid, route.suffix)}
            className="rounded-full border border-white/[0.08] bg-[#0F1629]/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/[0.14] hover:text-slate-100"
          >
            {route.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
