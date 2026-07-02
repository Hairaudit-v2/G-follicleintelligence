"use client";

import type { ReactNode } from "react";

import type { ClinicFloorSession } from "@/src/lib/staffPin/clinicFloorAccess";
import type { CrmShellSession } from "@/src/lib/crm/crmShellAccess";

import { WorkspaceShellProvider } from "./WorkspaceShellProvider";

type WorkspaceShellMountClientProps = {
  tenantId: string;
  session: CrmShellSession | ClinicFloorSession;
  canCapturePatientPhotos?: boolean;
  children: ReactNode;
};

/** Client boundary for the D1 workspace shell (session resolved server-side). */
export function WorkspaceShellMountClient({
  tenantId,
  session,
  canCapturePatientPhotos = false,
  children,
}: WorkspaceShellMountClientProps) {
  return (
    <WorkspaceShellProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
      canCapturePatientPhotos={canCapturePatientPhotos}
    >
      {children}
    </WorkspaceShellProvider>
  );
}
