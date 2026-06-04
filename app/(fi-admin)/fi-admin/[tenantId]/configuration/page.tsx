import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FiTenantBrandFrame } from "@/src/components/fi/FiTenantBrandFrame";
import { TenantConfigurationPanel } from "@/src/components/fi/TenantConfigurationPanel";
import { loadTenantConfigurationOverview, resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";

export const dynamic = "force-dynamic";

export default async function TenantConfigurationPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: { organisationId?: string; clinicId?: string };
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const organisationId =
    typeof searchParams.organisationId === "string" && searchParams.organisationId.trim()
      ? searchParams.organisationId.trim()
      : null;
  const clinicId =
    typeof searchParams.clinicId === "string" && searchParams.clinicId.trim() ? searchParams.clinicId.trim() : null;

  const overview = await loadTenantConfigurationOverview(tenantId);
  const effective = await resolveEffectiveBranding({ tenantId, organisationId, clinicId });

  const showCascadePreview = Boolean(organisationId || clinicId);

  return (
    <div className="space-y-4">
      {showCascadePreview ? <FiTenantBrandFrame effective={effective} variant="page-preview" /> : null}
      <div>
        <h1 className="text-base font-medium text-gray-900">Configuration</h1>
        <p className="mt-1 max-w-3xl text-xs text-gray-600">
          Tenant-scoped branding and operational defaults. FI admins can edit settings below using the server{" "}
          <code className="rounded bg-gray-100 px-1">FI_ADMIN_API_KEY</code>; all writes use the Supabase service role on
          the server. See design doc 15 (<span className="font-mono">15-configuration-admin-editing.md</span>) for fields
          and access control.
        </p>
      </div>
      <TenantConfigurationPanel
        tenantId={tenantId}
        overview={overview}
        effective={effective}
        previewOrganisationId={organisationId}
        previewClinicId={clinicId}
      />
    </div>
  );
}
