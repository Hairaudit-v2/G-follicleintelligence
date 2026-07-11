import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { buildFrontDeskLegacyRedirectPath } from "@/src/lib/fiOs/frontDesk/frontDeskRedirect";

export const dynamic = "force-dynamic";

/** S3.4E — legacy staff route → Front Desk Tomorrow. */
export default async function FiAdminTomorrowLegacyRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();
  const sp = await searchParams;
  redirect(buildFrontDeskLegacyRedirectPath(tenantId, { kind: "tomorrow" }, sp));
}
