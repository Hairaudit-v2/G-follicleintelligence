import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/**
 * Retired in FI-WORKFORCE-COHESION-A2 — the Team overview at /team renders the
 * same WorkforceCommandCentreClient. Module routes under /workforce-os/* stay
 * live and are still reached from the overview's module tiles.
 */
export default async function WorkforceOsLegacyRedirectPage({
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
  redirect(teamLegacyRedirectHrefForSuffix("workforce-os", base, query) ?? `${base}/team`);
}
