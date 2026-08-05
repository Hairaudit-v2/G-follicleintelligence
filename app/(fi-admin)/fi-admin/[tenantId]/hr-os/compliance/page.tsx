import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/** Retired in FI-WORKFORCE-COHESION-A2 — /team/compliance is the identical page. */
export default async function HrOsComplianceLegacyRedirectPage({
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
    teamLegacyRedirectHrefForSuffix("hr-os/compliance", base, query) ?? `${base}/team/compliance`
  );
}
