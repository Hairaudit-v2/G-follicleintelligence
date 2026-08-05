import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/** Moved in FI-WORKFORCE-COHESION-A2 to the /team/admin diagnostics namespace. */
export default async function HrOsSyncHealthLegacyRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const base = `/fi-admin/${tenantId.trim()}`;
  const query = buildLegacyRedirectQuery(await searchParams);
  redirect(
    teamLegacyRedirectHrefForSuffix("hr-os/sync-health", base, query) ??
      `${base}/team/admin/sync-health`
  );
}
