"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";

export function ConsultationOsCreatePage({ tenantId, showCrmNav }: { tenantId: string; showCrmNav: boolean }) {
  return <ConsultationOsWorkspace tenantId={tenantId} mode="create" showCrmNav={showCrmNav} />;
}
