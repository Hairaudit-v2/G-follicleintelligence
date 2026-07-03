import { unstable_noStore as noStore } from "next/cache";

import { OnboardingInviteClient } from "@/src/components/fi-admin/hr/OnboardingInviteClient";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
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
  if (!tid || !inviteToken) {
    return <OnboardingInviteUnavailable message="This invite link is not valid. Ask your clinic administrator for a new invite." />;
  }

  const model = await loadOnboardingInviteByToken(tid, inviteToken);
  if (!model) {
    return (
      <OnboardingInviteUnavailable message="This invite link is not valid or has already been revoked. Ask your clinic administrator for a new invite." />
    );
  }

  return <OnboardingInviteClient model={model} inviteToken={inviteToken} />;
}

function OnboardingInviteUnavailable({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold text-slate-50">Staff onboarding</h1>
        <p className="mt-2 text-sm text-slate-400">Follicle Intelligence OS</p>
      </header>
      <DashboardCard className="mt-8 p-6" elevated>
        <p className="text-sm text-rose-300">{message}</p>
      </DashboardCard>
    </div>
  );
}
