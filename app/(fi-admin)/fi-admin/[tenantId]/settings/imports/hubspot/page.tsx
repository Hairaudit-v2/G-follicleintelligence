import { redirect } from "next/navigation";

export const metadata = { title: "HubSpot CRM import", robots: { index: false, follow: false } };

export default async function LegacyHubspotCrmImportPage({ params, searchParams }: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ batchId?: string }>;
}) {
  const { tenantId } = await params;
  const { batchId } = await searchParams;
  const query = new URLSearchParams({ tab: "import-review" });
  if (typeof batchId === "string" && batchId.trim()) query.set("batchId", batchId.trim());
  redirect(`/fi-admin/${tenantId}/settings/integrations/hubspot?${query.toString()}`);
}
