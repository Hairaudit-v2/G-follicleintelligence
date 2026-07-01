import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { OnboardingInviteClient } from "@/src/components/fi-admin/hr/OnboardingInviteClient";
import { loadOnboardingInviteByToken } from "@/src/lib/workforce/onboarding/onboardingInvitation.server";

export const metadata = {
  title: "Staff onboarding invitation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingInvitePage({
  params,
}: {
  params: Promise<{ tenantId: string; token: string }>;
}) {
  noStore();
  const { tenantId, token } = await params;
  const tid = tenantId?.trim();
  const inviteToken = token?.trim();
  if (!tid || !inviteToken) notFound();

  const model = await loadOnboardingInviteByToken(tid, inviteToken);
  if (!model) notFound();

  return <OnboardingInviteClient model={model} inviteToken={inviteToken} />;
}
