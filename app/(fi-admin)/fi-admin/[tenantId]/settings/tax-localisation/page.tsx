import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { TaxLocalisationSection } from "@/src/components/fi-admin/settings/TaxLocalisationSection";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { getTaxLocalisationAccess } from "@/src/lib/taxLocalisation/taxLocalisationAccess.server";
import { loadClinicsForTenant, resolveTaxLocalisationDocumentOrDefault } from "@/src/lib/taxLocalisation/taxLocalisationSettings.server";

export const metadata = {
  title: "Tax & Localisation",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

export default async function TaxLocalisationSettingsPage({
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

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const access = await getTaxLocalisationAccess(tenantId);
  if (!access.canView) {
    notFound();
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const sp = (await searchParams) ?? {};
  const rawClinic = sp.clinicId;
  const clinicIdParam = typeof rawClinic === "string" && rawClinic.trim() ? rawClinic.trim() : null;

  const clinics = await loadClinicsForTenant(tenantId);
  let resolvedClinicId: string | null = null;
  if (clinicIdParam && clinics.some((c) => c.id === clinicIdParam)) {
    resolvedClinicId = clinicIdParam;
  }

  const initialDocument = await resolveTaxLocalisationDocumentOrDefault({
    tenantId,
    clinicId: resolvedClinicId,
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link href={`/fi-admin/${tenantId}/configuration`} className="text-[#22C1FF] hover:underline">
            Configuration
          </Link>{" "}
          / Tax &amp; Localisation
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">Tax &amp; Localisation</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Configure tax, currency, invoice, and regional business settings for this clinic. Scoped rows support a tenant
          default plus optional per-clinic overrides; use <span className="text-[#CBD5E1]">effective from</span> when
          scheduling rate or rule changes.
        </p>
      </div>
      <TaxLocalisationSection
        tenantId={tenantId}
        clinicId={resolvedClinicId}
        clinics={clinics}
        initialDocument={initialDocument}
        canEdit={access.canEdit}
      />
    </div>
  );
}
