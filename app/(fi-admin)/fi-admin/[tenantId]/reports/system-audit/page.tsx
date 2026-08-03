import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { SystemAuditAdminClient } from "@/src/components/system-audit/SystemAuditAdminClient";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewSystemAuditAdmin } from "@/src/lib/systemAudit/systemAuditAccess.server";
import { listSystemAuditEvents } from "@/src/lib/systemAudit/systemAuditLoaders.server";

export const metadata = {
  title: "System audit trail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SystemAuditAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);
  if (!(await canViewSystemAuditAdmin(tid))) {
    redirect(`/fi-admin/${tid}/reports`);
  }

  const sp = (await searchParams) ?? {};
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };

  const filters = {
    from: one("from"),
    to: one("to"),
    action: one("action"),
    entityType: one("entityType"),
    actorUserId: one("actor"),
  };

  const events = await listSystemAuditEvents(tid, {
    from: filters.from || null,
    to: filters.to || null,
    action: filters.action || null,
    entityType: filters.entityType || null,
    actorUserId: filters.actorUserId || null,
    limit: 150,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <FiPageHeader
        variant="clinicLight"
        title="System audit trail"
        description="Append-only log of who did what, to which record, and when. Phase 1 covers patients, notes, payments, inbox leads, images, and login."
      />
      <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
        <SystemAuditAdminClient tenantId={tid} events={events} filters={filters} />
      </Suspense>
    </div>
  );
}
