"use client";

import { LeadSlideOverPanel } from "@/src/components/fi/crm/LeadSlideOverPanel";
import { AppointmentSlideOverPanel } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { PatientSlideOverPanel } from "@/src/components/fi/patients/PatientSlideOver";

import type { WorkspaceShellOperatorContext } from "./WorkspaceShellContext";
import { useWorkspaceShell } from "./WorkspaceShellContext";

type WorkspaceShellStackProps = WorkspaceShellOperatorContext;

/** Renders the topmost workspace using existing slide-over panels (D1). */
export function WorkspaceShellStack(props: WorkspaceShellStackProps) {
  const { openWorkspaces, popWorkspace, closeAll } = useWorkspaceShell();
  const active = openWorkspaces[openWorkspaces.length - 1] ?? null;
  const depth = openWorkspaces.length;

  if (!active) return null;

  const onClose = depth > 1 ? popWorkspace : closeAll;
  const panelProps = {
    tenantId: props.tenantId,
    open: true,
    onClose,
    operatorFiUserId: props.operatorFiUserId,
    userRole: props.userRole,
  };

  if (active.kind === "patient") {
    return (
      <PatientSlideOverPanel
        {...panelProps}
        patientId={active.id}
        canCapturePatientPhotos={props.canCapturePatientPhotos ?? false}
      />
    );
  }

  if (active.kind === "lead") {
    return (
      <LeadSlideOverPanel
        {...panelProps}
        leadId={active.id}
        canUseClinicFeatures={props.canUseClinicFeatures}
      />
    );
  }

  return (
    <AppointmentSlideOverPanel
      {...panelProps}
      appointmentId={active.id}
      canUseClinicFeatures={props.canUseClinicFeatures}
    />
  );
}
