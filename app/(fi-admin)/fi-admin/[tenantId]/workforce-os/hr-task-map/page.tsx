import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/**
 * Moved in FI-WORKFORCE-COHESION-A2 to the /team/admin diagnostics namespace.
 * staffId / category / task deep links are carried across.
 */
export default async function StaffHrTaskMapLegacyRedirectPage({
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
    teamLegacyRedirectHrefForSuffix("workforce-os/hr-task-map", base, query) ??
      `${base}/team/admin/access-task-map`
  );
}
