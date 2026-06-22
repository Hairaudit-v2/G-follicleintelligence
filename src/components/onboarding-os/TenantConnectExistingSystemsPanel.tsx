"use client";

import { useEffect, useState } from "react";

import { loadTenantExternalConnectorsAction } from "@/lib/actions/fi-onboarding-os-external-connector-actions";
import { loadConnectorAuthSummaryAction } from "@/lib/actions/fi-onboarding-os-external-connector-auth-actions";
import { ConnectExistingSystemsPanel } from "@/src/components/onboarding-os/ConnectExistingSystemsPanel";
import type { TenantConnectorAuthSnapshot } from "@/src/lib/onboarding-os/externalConnectorAuthTypes";
import type { TenantExternalConnectorsSnapshot } from "@/src/lib/onboarding-os/externalConnectorTypes";

export function TenantConnectExistingSystemsPanel({ tenantId }: { tenantId: string }) {
  const [snapshot, setSnapshot] = useState<TenantExternalConnectorsSnapshot | null>(null);
  const [authSnapshot, setAuthSnapshot] = useState<TenantConnectorAuthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadTenantExternalConnectorsAction(tenantId),
      loadConnectorAuthSummaryAction(tenantId),
    ]).then(([connectorsRes, authRes]) => {
      if (cancelled) return;
      if (!connectorsRes.ok) {
        setError(connectorsRes.error);
        return;
      }
      if (connectorsRes.snapshot) setSnapshot(connectorsRes.snapshot);
      if (authRes.ok && authRes.authSnapshot) setAuthSnapshot(authRes.authSnapshot);
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

  return (
    <ConnectExistingSystemsPanel snapshot={snapshot} authSnapshot={authSnapshot} mode="tenant" />
  );
}
