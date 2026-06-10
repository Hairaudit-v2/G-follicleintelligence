import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { SurgeryReadinessBoard } from "@/src/components/fi-admin/surgery/SurgeryReadinessBoard";
import { loadSurgeryReadinessBoardPayload } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";

export const metadata = {
  title: "Surgery readiness",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SurgeryReadinessRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const data = await loadSurgeryReadinessBoardPayload(tenantId);

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5">
      <SurgeryReadinessBoard tenantId={tenantId} data={data} />
    </div>
  );
}
