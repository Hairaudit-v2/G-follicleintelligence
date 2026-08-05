import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/**
 * Retired in FI-WORKFORCE-COHESION-A2 — the roster command centre now lives at
 * /team/roster, which renders the same RosterCommandCentreView and applies the
 * canonical capability-based tab gate. Roster filters (period, clinic, staff,
 * event type, status, preselected event) are preserved.
 */
export default async function WorkforceOsRosterLegacyRedirectPage({
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
    teamLegacyRedirectHrefForSuffix("workforce-os/roster", base, query) ?? `${base}/team/roster`
  );
}
