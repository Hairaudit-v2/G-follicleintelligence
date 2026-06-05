"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";
import type { ConsultationWorkspaceDisplay } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";

export function ConsultationOsEditPage({
  tenantId,
  consultationId,
  initialRow,
  initialWorkspaceDisplay,
  showCrmNav,
}: {
  tenantId: string;
  consultationId: string;
  initialRow: ConsultationRow;
  initialWorkspaceDisplay: ConsultationWorkspaceDisplay;
  showCrmNav: boolean;
}) {
  return (
    <ConsultationOsWorkspace
      key={consultationId}
      tenantId={tenantId}
      mode="edit"
      consultationId={consultationId}
      initialRow={initialRow}
      initialWorkspaceDisplay={initialWorkspaceDisplay}
      showCrmNav={showCrmNav}
    />
  );
}
