import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingSessionDetailClient } from "@/src/components/fi-admin/platform/OnboardingSessionDetailClient";
import { DeploymentIntelligencePanel } from "@/src/components/onboarding-os/DeploymentIntelligencePanel";
import { GoLiveReadinessPanel } from "@/src/components/onboarding-os/GoLiveReadinessPanel";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { loadDeploymentIntelligenceSnapshot } from "@/src/lib/onboarding-os/deploymentIntelligence.server";
import { loadGoLiveReadinessSnapshot } from "@/src/lib/onboarding-os/goLiveReadiness.server";
import { loadTenantProvisioningSessionDetail } from "@/src/lib/onboarding-os/tenantProvisioning.server";
import type { ProvisioningSessionStatus } from "@/src/lib/onboarding-os/tenantProvisioningTypes";

export const dynamic = "force-dynamic";

export default async function OnboardingSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const loaded = await loadTenantProvisioningSessionDetail(sessionId);
  if (!loaded.ok) {
    if (loaded.error === "Provisioning session not found.") notFound();
    return <p className="text-sm text-red-400">{loaded.error}</p>;
  }

  const { session, steps, progress, deploymentPlan, templateReadiness, sandboxSeedPreview, sandboxSeedHistory } =
    loaded.detail;

  const readinessLoaded = await loadGoLiveReadinessSnapshot(sessionId);
  const intelligenceLoaded = await loadDeploymentIntelligenceSnapshot(sessionId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/fi-admin/platform/onboarding" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← All sessions
        </Link>
        <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Session</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Provisioning detail</h1>
      </div>

      {intelligenceLoaded.ok ? (
        <DeploymentIntelligencePanel snapshot={intelligenceLoaded.snapshot} mode="platform" />
      ) : (
        <p className="text-sm text-slate-500">{intelligenceLoaded.error}</p>
      )}

      {readinessLoaded.ok ? (
        <GoLiveReadinessPanel snapshot={readinessLoaded.snapshot} mode="platform" />
      ) : (
        <p className="text-sm text-slate-500">{readinessLoaded.error}</p>
      )}

      <OnboardingSessionDetailClient
        sessionId={session.id}
        tenantName={session.tenant_name}
        tenantSlug={session.tenant_slug}
        tenantId={session.tenant_id}
        sessionStatus={session.status as ProvisioningSessionStatus}
        progressPercent={progress.percent}
        errorMessage={session.error_message}
        steps={steps}
        deploymentPlan={deploymentPlan}
        templateReadiness={templateReadiness}
        sandboxSeedPreview={sandboxSeedPreview}
        sandboxSeedHistory={sandboxSeedHistory}
      />
    </div>
  );
}
