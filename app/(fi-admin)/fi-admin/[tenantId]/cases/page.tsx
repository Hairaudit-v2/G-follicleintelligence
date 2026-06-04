import Link from "next/link";
import { CasesIndexTable } from "@/src/components/fi-admin/cases/CasesIndexTable";
import { loadCasesIndexForTenant } from "@/src/lib/cases/caseLoaders";

export const metadata = {
  title: "Cases",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CasesIndexRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const rows = await loadCasesIndexForTenant(tenantId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Cases</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Treatment cases for this tenant — bridge records between CRM leads and SurgeryOS-style planning (Stage 5A:
            list and profile only).
          </p>
        </div>
        <Link href={`/fi-admin/${tenantId}/crm`} className="text-sm text-blue-600 hover:underline">
          CRM
        </Link>
      </div>

      <CasesIndexTable tenantId={tenantId} rows={rows} />
    </div>
  );
}
