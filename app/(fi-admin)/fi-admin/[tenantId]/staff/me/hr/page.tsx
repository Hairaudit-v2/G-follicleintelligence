import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ExternalLink } from "lucide-react";

import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { loadMyHrSelfServicePage } from "@/src/lib/staff/myHrSelfServiceLoader.server";

export const metadata = {
  title: "My HR Portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyHrSelfServicePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const base = `/fi-admin/${tenantId.trim()}`;
  const data = await loadMyHrSelfServicePage(tenantId.trim());
  const { state } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">Staff</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">My HR Portal</h1>
        <p className="mt-2 text-sm text-[#94A3B8]">
          Read-only link to your employer HR workspace. HR data is not edited in Follicle Intelligence.
        </p>
      </div>

      {state.kind === "unauthenticated" ? (
        <InfoNotice variant="warning" title="Sign in required">
          <p>You need to be signed in to open your HR portal.</p>
          <p className="mt-2">
            <Link href={`/follicle-intelligence/login?next=${encodeURIComponent(`${base}/staff/me/hr`)}`} className="font-medium text-[#22C1FF] underline-offset-2 hover:underline">
              Go to sign in
            </Link>
          </p>
        </InfoNotice>
      ) : null}

      {state.kind === "no_tenant_membership" ? (
        <InfoNotice variant="info" title="Tenant access">
          <p>Your account is not a member of this tenant in Follicle Intelligence, so personal HR self-service is not available here.</p>
        </InfoNotice>
      ) : null}

      {state.kind === "no_staff_profile" ? (
        <InfoNotice variant="info" title="No staff profile">
          <p>
            Your login is not linked to a staff profile for this clinic. Ask an administrator to link your user in the
            staff directory if you should appear on the schedule.
          </p>
        </InfoNotice>
      ) : null}

      {state.kind === "hr_not_linked" ? (
        <InfoNotice variant="warning" title="HR portal not linked">
          <p>Your HR portal has not been linked yet. Please contact administration.</p>
        </InfoNotice>
      ) : null}

      {state.kind === "ready" ? (
        <DashboardCard className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">My HR Portal</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            Access onboarding, employment documents, training records and staff information.
          </p>
          <div className="mt-6">
            <a
              href={state.hrPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#22C1FF]/35 bg-[#22C1FF]/12 px-5 py-3 text-sm font-semibold text-[#22C1FF] transition hover:border-[#22C1FF]/55 hover:bg-[#22C1FF]/18"
            >
              Open HR Portal
              <ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
            </a>
          </div>
          <p className="mt-4 text-xs text-[#64748B]">Opens in a new tab on your organisation&apos;s HR system.</p>
        </DashboardCard>
      ) : null}

      <p className="text-center text-sm text-[#64748B]">
        <Link href={base} className="text-[#94A3B8] underline-offset-2 hover:text-[#CBD5E1] hover:underline">
          Back to tenant home
        </Link>
      </p>
    </div>
  );
}
