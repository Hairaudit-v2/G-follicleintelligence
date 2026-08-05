import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  buildLegacyRedirectQuery,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

export const dynamic = "force-dynamic";

/**
 * Retired in FI-WORKFORCE-COHESION-A2 — /team/onboarding renders the identical
 * OnboardingCentreClient. The token-authenticated invite accept flow lives at
 * /onboarding/invite/[token] and is unaffected.
 */
export default async function HrOsOnboardingLegacyRedirectPage({
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
    teamLegacyRedirectHrefForSuffix("hr-os/onboarding", base, query) ?? `${base}/team/onboarding`
  );
}
