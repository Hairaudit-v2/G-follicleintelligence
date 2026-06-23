import { DoctorWorkspaceDashboard } from "@/src/components/fi-admin/doctor-workspace/DoctorWorkspaceDashboard";
import type { DoctorWorkspaceBundle } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import type { FiPatientPrescriptionRow } from "@/src/lib/prescribing/fiPrescribingTypes";

/** @deprecated Use DoctorWorkspaceDashboard — kept for route import stability. */
export function DoctorWorkspaceHome(props: {
  bundle: DoctorWorkspaceBundle;
  base: string;
  recentPrescriptions?: readonly FiPatientPrescriptionRow[];
  patientLabels?: ReadonlyMap<string, string>;
  showDiagnosticsExpanded?: boolean;
}) {
  const { bundle, recentPrescriptions = [], patientLabels = new Map(), showDiagnosticsExpanded = false } = props;
  return (
    <DoctorWorkspaceDashboard
      bundle={bundle}
      recentPrescriptions={recentPrescriptions}
      patientLabels={patientLabels}
      showDiagnosticsExpanded={showDiagnosticsExpanded}
    />
  );
}

export { DoctorWorkspaceDashboard };
