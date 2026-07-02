import type { ReactNode } from "react";

import { getPatientImagingCaptureCapability } from "@/src/lib/patientImages/patientImagingCaptureAccess.server";
import { resolveWorkspaceShellOperatorSession } from "@/src/lib/fiOs/workspaceShell/resolveWorkspaceShellOperatorSession.server";
import { isWorkspaceSignalSyncEnabledForTenant } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalSyncRollout.server";

import { WorkspaceShellMountClient } from "./WorkspaceShellMountClient";

type WorkspaceShellMountProps = {
  tenantId: string;
  children: ReactNode;
};

/**
 * FI-UX-REBUILD D1 — mounts the universal workspace shell when rollout is enabled.
 * Requires an operator session that can load workspace bundles (CRM, bookings, or clinic floor).
 */
export async function WorkspaceShellMount({ tenantId, children }: WorkspaceShellMountProps) {
  const session = await resolveWorkspaceShellOperatorSession(tenantId);
  if (!session) return <>{children}</>;

  const imagingCaptureCap = await getPatientImagingCaptureCapability(tenantId);
  const workspaceSignalSyncEnabled = isWorkspaceSignalSyncEnabledForTenant(tenantId);

  return (
    <WorkspaceShellMountClient
      tenantId={tenantId}
      session={session}
      canCapturePatientPhotos={imagingCaptureCap.canCapture}
      workspaceSignalSyncEnabled={workspaceSignalSyncEnabled}
      workspaceRevisionPollEnabled={workspaceSignalSyncEnabled}
    >
      {children}
    </WorkspaceShellMountClient>
  );
}
