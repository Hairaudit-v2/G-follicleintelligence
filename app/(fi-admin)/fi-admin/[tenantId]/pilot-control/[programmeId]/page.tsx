import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PilotControlPage } from "@/src/components/pilotControl/PilotControlPage";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  checkPilotControlMigrationsPresent,
  resolvePilotControlPageAccess,
} from "@/src/lib/pilotControl/ui/pilotControlPageAccess.server";

export const metadata = {
  title: "Pilot Control Centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminPilotControlProgrammePage({
  params,
}: {
  params: Promise<{ tenantId: string; programmeId: string }>;
}) {
  noStore();
  const { tenantId, programmeId } = await params;
  const tid = tenantId?.trim();
  const pid = programmeId?.trim();
  if (!tid || !pid) notFound();

  await assertFiTenantPortalAccess(tid);

  const access = await resolvePilotControlPageAccess(tid);
  if (!access.allowed) notFound();

  const migrations = await checkPilotControlMigrationsPresent(tid).catch(() => ({
    ok: false,
    missing: ["lookup_failed"],
  }));

  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-3 p-4 sm:p-6" aria-busy="true">
          <div className="h-8 w-64 rounded bg-white/5" />
          <div className="h-28 rounded-xl bg-white/5" />
        </div>
      }
    >
      <PilotControlPage
        tenantId={tid}
        role={access.role}
        initialProgrammeId={pid}
        migrationsOk={migrations.ok}
        tenantLabel={tid}
      />
    </Suspense>
  );
}
