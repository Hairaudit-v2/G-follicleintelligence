import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/**
 * Retired in FI-WORKFORCE-COHESION-A2 — the Identity & access tab renders the
 * same StaffAccessCentreClient.
 *
 * Only this index page redirects. The token-authenticated children
 * (accept/[token], pin-setup/[setupToken]) are separate routes that keep
 * rendering: invitees following an emailed link must never be bounced.
 */
export default async function WorkforceOsStaffAccessLegacyRedirectPage({
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
    teamLegacyRedirectHrefForSuffix("workforce-os/staff-access", base, query) ??
      `${base}/team/identity`
  );
}
