import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PatientTwinDashboard } from "@/src/components/fi-admin/patientTwin/PatientTwinDashboard";
import {
  derivePatientTwinIntegritySignals,
  type PatientClinicalIntelligenceView,
} from "@/src/lib/fi-os/clinicalIntelligenceSignals";
import {
  loadPatientOutcomeMeasurements,
  loadPatientOutcomeProtocols,
} from "@/src/lib/fi-os/outcomeIntelligence.server";
import { loadPatientTwinV1 } from "@/src/lib/patientTwin/patientTwinLoader.server";
import { loadPatientIntelligenceOverview } from "@/src/lib/patientTwin/patientTwinOverviewLoader.server";
import { resolvePatientProfile } from "@/src/lib/patients/resolvePatientProfile.server";
import { buildCanonicalPatientProfileHref } from "@/src/lib/patients/resolvePatientProfile";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}): Promise<Metadata> {
  const { patientId } = await params;
  const name = patientId.trim().slice(0, 8);
  return {
    title: `Health record · ${name}`,
    robots: { index: false, follow: false },
  };
}

function isPresentationQuery(searchParams: {
  presentation?: string | string[];
  demo?: string | string[];
}): boolean {
  const presentation = Array.isArray(searchParams.presentation)
    ? searchParams.presentation[0]
    : searchParams.presentation;
  const demo = Array.isArray(searchParams.demo) ? searchParams.demo[0] : searchParams.demo;
  return presentation === "1" || demo === "overview";
}

/**
 * Read-only Health record V1 dashboard (foundation patient). Tenant access is enforced by
 * `assertFiTenantPortalAccess` in the parent `[tenantId]` layout.
 */
export default async function PatientTwinV1RoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
  searchParams?: Promise<{ presentation?: string | string[]; demo?: string | string[] }>;
}) {
  const { tenantId, patientId } = await params;
  const query = (await searchParams) ?? {};
  const presentationMode = isPresentationQuery(query);
  const tid = tenantId?.trim();
  const pid = patientId?.trim();
  if (!tid || !pid) notFound();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <p className="text-sm text-amber-200/90">
        Server misconfigured (Supabase). Health record cannot be loaded.
      </p>
    );
  }

  const resolved = await resolvePatientProfile({ tenantId: tid, patientId: pid });
  if (!resolved.ok) notFound();
  const canonicalPatientId = resolved.data.patientId;

  const twin = await loadPatientTwinV1({
    tenantId: tid,
    foundationPatientId: canonicalPatientId,
  });
  if (!twin) notFound();

  const [outcomeMeasurements, outcomeProtocols, overview] = await Promise.all([
    loadPatientOutcomeMeasurements(tid, canonicalPatientId),
    loadPatientOutcomeProtocols(tid, canonicalPatientId),
    loadPatientIntelligenceOverview({
      tenantId: tid,
      patientId: canonicalPatientId,
      twin,
      presentationMode,
    }).catch(() => null),
  ]);

  const clinicalIntel: PatientClinicalIntelligenceView = {
    signals: derivePatientTwinIntegritySignals(twin),
    recommendedNextStep: twin.completeness?.recommended_actions?.[0]?.label ?? null,
  };

  const profileHref = buildCanonicalPatientProfileHref(tid, canonicalPatientId);
  const maxWidth = presentationMode ? "max-w-7xl" : "max-w-6xl";

  return (
    <div className={`mx-auto ${maxWidth} space-y-5`}>
      <Link
        href={profileHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#94A3B8] transition hover:text-[#E2E8F0]"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to patient profile
      </Link>
      <PatientTwinDashboard
        tenantId={tid}
        patientId={canonicalPatientId}
        twin={twin}
        clinicalIntel={clinicalIntel}
        outcomeMeasurements={outcomeMeasurements}
        outcomeProtocols={outcomeProtocols}
        overview={overview}
      />
    </div>
  );
}
