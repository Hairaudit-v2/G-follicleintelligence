"use client";

import { useEffect, useState } from "react";

import { loadTenantExternalConnectorsAction } from "@/lib/actions/fi-onboarding-os-external-connector-actions";
import { ConnectExistingSystemsPanel } from "@/src/components/onboarding-os/ConnectExistingSystemsPanel";
import type { TenantExternalConnectorsSnapshot } from "@/src/lib/onboarding-os/externalConnectorTypes";

export function TenantConnectExistingSystemsPanel({ tenantId }: { tenantId: string }) {
  const [snapshot, setSnapshot] = useState<TenantExternalConnectorsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTenantExternalConnectorsAction(tenantId).then((res) => {
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
    return <p className="text-sm text-slate-400">Loading external connectors…</p>;
  }

  return <ConnectExistingSystemsPanel snapshot={snapshot} mode="tenant" />;
}
