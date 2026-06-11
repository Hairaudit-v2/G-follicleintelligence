import { redirect } from "next/navigation";

export const metadata = {
  title: "HubSpot CRM import",
  robots: { index: false, follow: false } as const,
};

/**
 * Alias route requested for FI OS settings. Requires `?tenantId=<uuid>` to redirect into the FI Admin shell.
 */
export default function FollicleIntelligenceHubspotImportRedirectPage({
  searchParams,
}: {
  searchParams: { tenantId?: string };
}) {
  const tenantId = typeof searchParams.tenantId === "string" ? searchParams.tenantId.trim() : "";
  if (tenantId) {
    redirect(`/fi-admin/${tenantId}/settings/imports/hubspot`);
  }
  return (
    <div className="mx-auto max-w-lg p-8 text-slate-200">
      <h1 className="text-lg font-semibold">HubSpot import</h1>
      <p className="mt-2 text-sm text-slate-400">
        Add <span className="font-mono text-cyan-300">?tenantId=</span> with your tenant UUID to open the import centre, or use
        the FI Admin path <span className="font-mono text-cyan-300">/fi-admin/&lt;tenantId&gt;/settings/imports/hubspot</span>.
      </p>
    </div>
  );
}
