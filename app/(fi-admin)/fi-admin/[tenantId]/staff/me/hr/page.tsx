import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { StaffHrNotificationDetailCard } from "@/src/components/fi/staff/StaffHrNotificationBadge";
import { MyHrTrainingComplianceCompactCard } from "@/src/components/staff/staffComplianceReadOnly";
import { loadMyHrPortalPage } from "@/src/lib/staff/myHrPortalLoader.server";

export const metadata = {
  title: "My HR Portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyHrPortalPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const base = `/fi-admin/${tenantId.trim()}`;
  const data = await loadMyHrPortalPage(tenantId.trim());
  const { state } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">Staff</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">My HR Portal</h1>
        <p className="mt-2 text-sm text-[#94A3B8]">
          Read-only access to your employer HR workspace. HR data is not edited in Follicle Intelligence.
        </p>
      </div>

      {state.kind === "unauthenticated" ? (
        <InfoNotice variant="warning" title="Sign in required">
          <p>You need to be signed in to open your HR portal.</p>
          <p className="mt-2">
            <Link
              href={`/follicle-intelligence/login?next=${encodeURIComponent(`${base}/staff/me/hr`)}`}
              className="font-medium text-[#22C1FF] underline-offset-2 hover:underline"
            >
              Go to sign in
            </Link>
          </p>
        </InfoNotice>
      ) : null}

      {state.kind === "no_tenant_membership" ? (
        <InfoNotice variant="info" title="Tenant access">
          <p>
            Your account is not a member of this tenant in Follicle Intelligence, so personal HR self-service is not
            available here.
          </p>
        </InfoNotice>
      ) : null}

      {state.kind === "no_staff_profile" ? (
        <DashboardCard className="p-8 sm:p-10">
          <p className="text-center text-base leading-relaxed text-[#94A3B8]">
            Your FI login is not linked to a staff profile yet.
          </p>
          <p className="mt-6 text-center">
            <Button variant="outline" asChild className="border-white/15 bg-white/[0.04] text-[#E2E8F0] hover:bg-white/[0.08]">
              <Link href={base}>Back to dashboard</Link>
            </Button>
          </p>
        </DashboardCard>
      ) : null}

      {state.kind === "ready" && !state.hasHrLink ? (
        <DashboardCard className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">My HR Portal</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            Access your onboarding, employment documents, training records, and staff information.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-6">
            <div>
              <p className="text-sm font-medium text-[#F8FAFC]">{state.staffName}</p>
              <p className="text-xs text-[#94A3B8]">
                {state.staffRole}
                <span className="mx-2 text-[#475569]">·</span>
                <span className={state.isActive ? "text-emerald-300/90" : "text-amber-200/90"}>
                  {state.isActive ? "Active" : "Inactive"}
                </span>
              </p>
            </div>
          </div>
          <InfoNotice variant="warning" title="HR portal not linked" className="mt-6">
            <p>Your HR portal has not been linked yet. Please contact administration.</p>
          </InfoNotice>
          <div className="mt-6 border-t border-white/[0.08] pt-6">
            <StaffHrNotificationDetailCard summary={state.hrNotification} variant="dark" />
          </div>
          <MyHrTrainingComplianceCompactCard summary={state.complianceSummary} />
          <p className="mt-6 text-center">
            <Button variant="outline" asChild className="border-white/15 bg-white/[0.04] text-[#E2E8F0] hover:bg-white/[0.08]">
              <Link href={base}>Back to dashboard</Link>
            </Button>
          </p>
        </DashboardCard>
      ) : null}

      {state.kind === "ready" && state.hasHrLink && state.hrPortalUrl ? (
        <DashboardCard className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">My HR Portal</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            Access your onboarding, employment documents, training records, and staff information.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-6">
            <div>
              <p className="text-sm font-medium text-[#F8FAFC]">{state.staffName}</p>
              <p className="text-xs text-[#94A3B8]">
                {state.staffRole}
                <span className="mx-2 text-[#475569]">·</span>
                <span className={state.isActive ? "text-emerald-300/90" : "text-amber-200/90"}>
                  {state.isActive ? "Active" : "Inactive"}
                </span>
              </p>
            </div>
          </div>
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
          <p className="mt-4 text-xs text-[#64748B]">Opens in a new tab on your organisation&apos;s HR system (not embedded).</p>
          <div className="mt-6 border-t border-white/[0.08] pt-6">
            <StaffHrNotificationDetailCard summary={state.hrNotification} variant="dark" />
          </div>
          <MyHrTrainingComplianceCompactCard summary={state.complianceSummary} />
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
