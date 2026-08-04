import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TrichoscopyPatientWorkspace } from "@/src/components/trichoscopy/TrichoscopyPatientWorkspace";
import { listEvidencePacksForLink, listOpenTrichoscopyActions, listTrichoscopyLinksForPatient } from "@/src/lib/integrations/hliTrichoscopy/queries";
import { resolveTrichoscopyRouteAccess } from "@/src/lib/platform/entitlements/trichoscopyRouteGate.server";
import { resolveFiosTrichoscopyAccess } from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";
import { resolvePatientProfile } from "@/src/lib/patients/resolvePatientProfile.server";
import type { FiosTrichoscopyStatus } from "@/src/lib/integrations/hliTrichoscopy/types";

export const dynamic = "force-dynamic";

export default async function PatientTrichoscopyPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, patientId } = await params;
  const tid = tenantId?.trim();
  const pid = patientId?.trim();
  if (!tid || !pid) notFound();

  const routeAccess = await resolveTrichoscopyRouteAccess(tid);
  if (!routeAccess.ok) notFound();

  const resolved = await resolvePatientProfile({ tenantId: tid, patientId: pid });
  if (!resolved.ok) notFound();
  const canonicalPatientId = resolved.data.patientId;

  const access = await resolveFiosTrichoscopyAccess({
    tenantId: tid,
    userId: routeAccess.fiUserId,
    capability: "trichoscopy.view",
    patientId: canonicalPatientId,
  });
  if (!access.allowed && !(access.historicalReadOnly && access.capabilityIncluded)) {
    notFound();
  }

  const links = await listTrichoscopyLinksForPatient({
    tenantId: tid,
    patientId: canonicalPatientId,
  });
  const openActions = await listOpenTrichoscopyActions({
    tenantId: tid,
    patientId: canonicalPatientId,
  });

  const packsByLink: Record<string, Array<Record<string, unknown>>> = {};
  for (const link of links) {
    packsByLink[link.id] = await listEvidencePacksForLink({
      tenantId: tid,
      linkId: link.id,
    });
  }

  const sp = (await searchParams) ?? {};
  const openRequest =
    (Array.isArray(sp.action) ? sp.action[0] : sp.action) === "request" &&
    access.enabledCapabilities.includes("trichoscopy.request") &&
    !routeAccess.historicalReadOnly;
  const consultationIdRaw = Array.isArray(sp.consultationId)
    ? sp.consultationId[0]
    : sp.consultationId;
  const consultationId = consultationIdRaw?.trim() || null;

  const profileHref = `/fi-admin/${tid}/patients/${canonicalPatientId}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-6">
      <Link
        href={profileHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-100"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to patient profile
      </Link>

      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Trichoscopy
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          Patient trichoscopy workspace
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Linked HLI episodes, confirmed evidence packs, outstanding clinic actions, and sync health
          for this patient.
        </p>
      </header>

      <TrichoscopyPatientWorkspace
        tenantId={tid}
        patientId={canonicalPatientId}
        consultationId={consultationId}
        links={links.map((l) => ({
          id: l.id,
          purpose: l.purpose,
          status: l.status as FiosTrichoscopyStatus,
          requestedAt: l.requested_at,
          lastSyncedAt: l.last_synced_at,
          episodeId: l.hli_episode_id,
        }))}
        packsByLink={packsByLink}
        openActions={openActions}
        canRequest={access.enabledCapabilities.includes("trichoscopy.request") && access.allowed}
        openRequestModal={Boolean(openRequest)}
        historicalReadOnly={routeAccess.historicalReadOnly || Boolean(access.historicalReadOnly)}
        enabledCapabilities={access.enabledCapabilities}
      />
    </div>
  );
}
