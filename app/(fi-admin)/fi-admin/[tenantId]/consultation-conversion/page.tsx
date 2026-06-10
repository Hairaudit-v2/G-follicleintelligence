import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ConsultationConversionBoard } from "@/src/components/fi-admin/consultations/ConsultationConversionBoard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";

export const metadata = {
  title: "Consultation conversion",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsultationConversionRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <div className="px-3 py-4 sm:px-4 sm:py-5">
        <InfoNotice variant="danger" title="Server misconfigured">
          <p className="text-sm">Supabase environment variables are missing. Check deployment configuration.</p>
        </InfoNotice>
      </div>
    );
  }

  let data;
  try {
    data = await loadConsultationConversionBoardPayload(tenantId.trim());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5">
      <ConsultationConversionBoard tenantId={tenantId.trim()} data={data} />
    </div>
  );
}
