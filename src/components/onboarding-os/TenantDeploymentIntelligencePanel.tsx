"use client";

import { useEffect, useState } from "react";

import { loadTenantDeploymentIntelligenceAction } from "@/lib/actions/fi-onboarding-os-deployment-intelligence-actions";
import { DeploymentIntelligencePanel } from "@/src/components/onboarding-os/DeploymentIntelligencePanel";
import type { DeploymentIntelligenceSnapshot } from "@/src/lib/onboarding-os/deploymentIntelligenceTypes";

export function TenantDeploymentIntelligencePanel({ tenantId }: { tenantId: string }) {
  const [snapshot, setSnapshot] = useState<DeploymentIntelligenceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTenantDeploymentIntelligenceAction(tenantId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) setSnapshot(res.snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (error) {
    return <p className="text-sm text-slate-400">{error}</p>;
  }

  if (!snapshot) {
    return <p className="text-sm text-slate-400">Loading deployment intelligence…</p>;
  }

  return <DeploymentIntelligencePanel snapshot={snapshot} mode="tenant" />;
}
