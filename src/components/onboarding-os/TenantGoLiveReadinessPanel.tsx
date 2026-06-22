"use client";

import { useEffect, useState } from "react";

import { loadTenantGoLiveReadinessAction } from "@/lib/actions/fi-onboarding-os-go-live-readiness-actions";
import { GoLiveReadinessPanel } from "@/src/components/onboarding-os/GoLiveReadinessPanel";
import type { GoLiveReadinessSnapshot } from "@/src/lib/onboarding-os/goLiveReadinessTypes";

export function TenantGoLiveReadinessPanel({ tenantId }: { tenantId: string }) {
  const [snapshot, setSnapshot] = useState<GoLiveReadinessSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTenantGoLiveReadinessAction(tenantId).then((res) => {
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
    return <p className="text-sm text-slate-400">Loading go-live readiness…</p>;
  }

  return <GoLiveReadinessPanel snapshot={snapshot} mode="tenant" />;
}
