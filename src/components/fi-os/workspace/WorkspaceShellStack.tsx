"use client";

import { LeadSlideOverPanel } from "@/src/components/fi/crm/LeadSlideOverPanel";
import { AppointmentSlideOverPanel } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { PatientSlideOverPanel } from "@/src/components/fi/patients/PatientSlideOver";

import type { WorkspaceShellOperatorContext } from "./WorkspaceShellContext";
import { useWorkspaceShell } from "./WorkspaceShellContext";
import { ConsultationWorkspacePanel } from "./panels/ConsultationWorkspacePanel";
import { PathologyResultWorkspacePanel } from "./panels/PathologyResultWorkspacePanel";
import { PaymentWorkspacePanel } from "./panels/PaymentWorkspacePanel";
import { StaffWorkspacePanel } from "./panels/StaffWorkspacePanel";
import { SurgeryCaseWorkspacePanel } from "./panels/SurgeryCaseWorkspacePanel";

type WorkspaceShellStackProps = WorkspaceShellOperatorContext;

/** Renders the topmost workspace using existing slide-over / D4 lightweight panels. */
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

  if (active.kind === "appointment") {
    return (
      <AppointmentSlideOverPanel
        {...panelProps}
        appointmentId={active.id}
        canUseClinicFeatures={props.canUseClinicFeatures}
      />
    );
  }

  if (active.kind === "payment") {
    return <PaymentWorkspacePanel tenantId={props.tenantId} paymentId={active.id} open onClose={onClose} />;
  }

  if (active.kind === "pathology_result") {
    return (
      <PathologyResultWorkspacePanel
        tenantId={props.tenantId}
        resultId={active.id}
        open
        onClose={onClose}
      />
    );
  }

  if (active.kind === "surgery_case") {
    return (
      <SurgeryCaseWorkspacePanel tenantId={props.tenantId} caseId={active.id} open onClose={onClose} />
    );
  }

  if (active.kind === "consultation") {
    return (
      <ConsultationWorkspacePanel
        tenantId={props.tenantId}
        consultationId={active.id}
        open
        onClose={onClose}
      />
    );
  }

  return <StaffWorkspacePanel tenantId={props.tenantId} staffId={active.id} open onClose={onClose} />;
}
