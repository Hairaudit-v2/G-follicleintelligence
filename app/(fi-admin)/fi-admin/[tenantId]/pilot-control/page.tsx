import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PilotControlPage } from "@/src/components/pilotControl/PilotControlPage";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
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

export default async function FiAdminPilotControlPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  const sp = (await searchParams) ?? {};
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  const access = await resolvePilotControlPageAccess(tid);
  if (!access.allowed) {
    // Hidden nav must not be the only control — deny direct route access.
    notFound();
  }

  const migrations = await checkPilotControlMigrationsPresent(tid).catch(() => ({
    ok: false,
    missing: ["lookup_failed"],
  }));

  const programmeId =
    typeof sp.programmeId === "string"
      ? sp.programmeId.trim()
      : Array.isArray(sp.programmeId)
        ? String(sp.programmeId[0] ?? "").trim()
        : null;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Server misconfigured">
          <p className="text-sm">
            Supabase environment variables are missing. Check deployment configuration.
          </p>
        </InfoNotice>
      </div>
    );
  }

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
        initialProgrammeId={programmeId || null}
        migrationsOk={migrations.ok}
        tenantLabel={tid}
      />
    </Suspense>
  );
}
