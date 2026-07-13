import { redirect } from "next/navigation";

/**
 * FI-UX-REBUILD-1 S4.5E — consultation conversion URL soft-redirects to Pipeline.
 * Canonical enquiry workspace is `/crm` (Pipeline). Route kept for bookmarks.
 */
export const dynamic = "force-dynamic";

export default async function ConsultationConversionLegacyRedirectPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) {
    redirect("/fi-admin");
  }
  redirect(`/fi-admin/${encodeURIComponent(tid)}/crm`);
}
