import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ClinicDiscoverySection } from "@/src/components/fi-admin/settings/ClinicDiscoverySection";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadClinicDiscoveryAdminContext } from "@/src/lib/hairaudit/clinicDiscovery/publicClinicProfileSettings.server";

export const metadata = {
  title: "HairAudit Clinic Discovery",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

export default async function HairAuditClinicDiscoveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();
  await assertFiTenantPortalAccess(tenantId);

  const supabase = supabaseAdmin();
  const { data: clinics, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tenantId.trim())
    .order("display_name");
  if (error || !clinics?.length) notFound();

  const sp = (await searchParams) ?? {};
  const rawClinic = sp.clinicId;
  const clinicIdParam =
    typeof rawClinic === "string" && rawClinic.trim() ? rawClinic.trim() : null;
  const resolvedClinicId =
    clinicIdParam && clinics.some((c) => c.id === clinicIdParam)
      ? clinicIdParam
      : String((clinics[0] as { id: string }).id);

  const context = await loadClinicDiscoveryAdminContext(tenantId, resolvedClinicId);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link
            href={`/fi-admin/${tenantId}/configuration`}
            className="text-[#22C1FF] hover:underline"
          >
            Configuration
          </Link>{" "}
          / HairAudit Clinic Discovery
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          HairAudit public clinic discovery
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Opt in to HairAudit public clinic search. Profiles stay private until you enable
          discovery and search visibility. No patient, case, or report data is published.
        </p>
      </div>
      <ClinicDiscoverySection
        tenantId={tenantId}
        clinicId={resolvedClinicId}
        clinics={clinics.map((row) => ({
          id: String((row as { id: string }).id),
          display_name: String((row as { display_name: string }).display_name),
        }))}
        initialSettings={context.settings}
        hairauditClinicId={context.hairauditClinicId}
        previewBlockingReasons={context.preview.blockingReasons}
      />
    </div>
  );
}