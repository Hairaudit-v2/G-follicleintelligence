import Link from "next/link";
import { CrmCreateLeadSmoke } from "@/src/components/fi/crm/CrmCreateLeadSmoke";
import { CrmLeadIdJump } from "@/src/components/fi/crm/CrmLeadIdJump";
import { CrmPipelinePanel } from "@/src/components/fi/crm/CrmDataPanels";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellPipelineStages } from "@/src/lib/crm/crmShellLoaders";

export const metadata = {
  title: "CRM shell",
  robots: { index: false, follow: false },
};

export default async function CrmShellPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const session = await assertCrmShellPageAccess(tenantId);
  const stages = await loadCrmShellPipelineStages(tenantId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-gray-900">CRM (internal shell)</h1>
        <p className="text-sm text-gray-600">
          Signed in as tenant user <code className="rounded bg-gray-100 px-1 text-xs">{session.fiUserId}</code> with role{" "}
          <strong>{session.role}</strong>. This is not the final sales UI — read panels and smoke actions only.
        </p>
        <p className="text-sm text-gray-600">
          <Link href={`/fi-admin/${tenantId}/cases`} className="text-blue-600 hover:underline">
            ← Back to cases
          </Link>
        </p>
      </header>

      <CrmPipelinePanel stages={stages} />

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Open a lead</h2>
        <p className="mb-3 text-sm text-gray-600">
          There is no lead directory in this shell yet. Paste a lead UUID from your database or create one below, then open it.
        </p>
        <CrmLeadIdJump tenantId={tenantId} />
      </section>

      <CrmCreateLeadSmoke tenantId={tenantId} />
    </div>
  );
}
