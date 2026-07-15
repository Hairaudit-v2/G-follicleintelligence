import { redirect } from "next/navigation";

export const metadata = { title: "HubSpot import review", robots: { index: false, follow: false } };

export default async function LegacyHubspotImportReviewPage({ params }: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/fi-admin/${tenantId}/settings/integrations/hubspot?tab=import-review`);
}
