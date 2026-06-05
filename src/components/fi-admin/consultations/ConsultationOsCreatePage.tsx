"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";

export function ConsultationOsCreatePage({ tenantId }: { tenantId: string }) {
  return <ConsultationOsWorkspace tenantId={tenantId} mode="create" />;
}
