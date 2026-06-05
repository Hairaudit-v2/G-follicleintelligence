"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";

export function ConsultationOsEditPage({
  tenantId,
  consultationId,
  initialRow,
}: {
  tenantId: string;
  consultationId: string;
  initialRow: ConsultationRow;
}) {
  return (
    <ConsultationOsWorkspace
      key={consultationId}
      tenantId={tenantId}
      mode="edit"
      consultationId={consultationId}
      initialRow={initialRow}
    />
  );
}
