import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PatientTwinDashboard } from "@/src/components/fi-admin/patientTwin/PatientTwinDashboard";
import { loadPatientTwinV1 } from "@/src/lib/patientTwin/patientTwinLoader.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}): Promise<Metadata> {
  const { patientId } = await params;
  const name = patientId.trim().slice(0, 8);
  return {
    title: `Patient Twin · ${name}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Read-only Patient Twin V1 dashboard (foundation patient). Tenant access is enforced by
 * `assertFiTenantPortalAccess` in the parent `[tenantId]` layout.
 */
export default async function PatientTwinV1RoutePage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}) {
  const { tenantId, patientId } = await params;
  const tid = tenantId?.trim();
  const pid = patientId?.trim();
  if (!tid || !pid) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <p className="text-sm text-amber-200/90">
        Server misconfigured (Supabase). Patient Twin cannot be loaded.
      </p>
    );
  }

  const twin = await loadPatientTwinV1({ tenantId: tid, foundationPatientId: pid });
  if (!twin) notFound();

  const profileHref = `/fi-admin/${tid}/patients/${pid}`;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link
        href={profileHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#94A3B8] transition hover:text-[#E2E8F0]"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to patient profile
      </Link>
      <PatientTwinDashboard tenantId={tid} patientId={pid} twin={twin} />
    </div>
  );
}
