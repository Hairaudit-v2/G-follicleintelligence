import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/**
 * Retired in FI-WORKFORCE-COHESION-A2 — the staff directory now lives at
 * /team/staff. Directory filters are carried across so bookmarked filtered
 * views keep working. Sub-routes (/staff/link-users, /staff/role-review, …)
 * are unaffected: the map matches this path exactly, not by prefix.
 */
export default async function StaffDirectoryLegacyRedirectPage({
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
  redirect(teamLegacyRedirectHrefForSuffix("staff", base, query) ?? `${base}/team/staff`);
}
