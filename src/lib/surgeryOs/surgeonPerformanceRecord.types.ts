/**
 * SurgeryOS Sprint 3 — shared surgeon performance record shape.
 */

export type SurgeonProcedurePerformanceRecord = {
  surgeryId: string;
  surgeonId: string;
  surgeonName: string;
  completedAt: string | null;
  procedureDurationMinutes: number | null;
  extractionVelocityPerHour: number | null;
  implantationSpeedPerHour: number | null;
  transectionRate: number | null;
  hairsPerGraft: number | null;
};
