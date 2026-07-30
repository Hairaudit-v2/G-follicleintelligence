/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — role-sensitive register columns (pure).
 */

import type { PilotControlRoleKey } from "../pilotControlContracts";

export type PilotRegisterColumnId =
  | "patient"
  | "pilotStatus"
  | "milestone"
  | "overallReadiness"
  | "clinical"
  | "financial"
  | "patientDim"
  | "operational"
  | "technical"
  | "primaryBlocker"
  | "blockerSeverity"
  | "nextPatientAction"
  | "nextClinicAction"
  | "appActivation"
  | "operationalOwner"
  | "lastActivity"
  | "evaluatedAt"
  | "documents"
  | "appointment"
  | "consent"
  | "pathology"
  | "images"
  | "procedureReadiness"
  | "quoteState"
  | "depositState"
  | "paymentPlanState"
  | "reconciliation"
  | "financialBlocker"
  | "escalation"
  | "pilotPause";

export type PilotRegisterColumnDef = {
  id: PilotRegisterColumnId;
  label: string;
  /** Desktop / tablet / mobile visibility hints. */
  priority: "critical" | "high" | "normal" | "low";
};

const ALL_COLUMNS: Record<PilotRegisterColumnId, PilotRegisterColumnDef> = {
  patient: { id: "patient", label: "Patient", priority: "critical" },
  pilotStatus: { id: "pilotStatus", label: "Pilot status", priority: "high" },
  milestone: { id: "milestone", label: "Milestone", priority: "high" },
  overallReadiness: { id: "overallReadiness", label: "Overall readiness", priority: "critical" },
  clinical: { id: "clinical", label: "Clinical", priority: "normal" },
  financial: { id: "financial", label: "Financial", priority: "normal" },
  patientDim: { id: "patientDim", label: "Patient", priority: "normal" },
  operational: { id: "operational", label: "Operational", priority: "normal" },
  technical: { id: "technical", label: "Technical", priority: "normal" },
  primaryBlocker: { id: "primaryBlocker", label: "Primary blocker", priority: "critical" },
  blockerSeverity: { id: "blockerSeverity", label: "Blocker severity", priority: "critical" },
  nextPatientAction: { id: "nextPatientAction", label: "Next patient action", priority: "high" },
  nextClinicAction: { id: "nextClinicAction", label: "Next clinic action", priority: "high" },
  appActivation: { id: "appActivation", label: "App activation", priority: "high" },
  operationalOwner: { id: "operationalOwner", label: "Operational owner", priority: "normal" },
  lastActivity: { id: "lastActivity", label: "Last activity", priority: "normal" },
  evaluatedAt: { id: "evaluatedAt", label: "Evaluated at", priority: "low" },
  documents: { id: "documents", label: "Documents", priority: "normal" },
  appointment: { id: "appointment", label: "Appointment", priority: "normal" },
  consent: { id: "consent", label: "Consent", priority: "normal" },
  pathology: { id: "pathology", label: "Pathology", priority: "normal" },
  images: { id: "images", label: "Images", priority: "normal" },
  procedureReadiness: { id: "procedureReadiness", label: "Procedure readiness", priority: "normal" },
  quoteState: { id: "quoteState", label: "Quote state", priority: "normal" },
  depositState: { id: "depositState", label: "Deposit state", priority: "normal" },
  paymentPlanState: { id: "paymentPlanState", label: "Payment-plan state", priority: "normal" },
  reconciliation: { id: "reconciliation", label: "Reconciliation", priority: "normal" },
  financialBlocker: { id: "financialBlocker", label: "Financial blocker", priority: "high" },
  escalation: { id: "escalation", label: "Escalation", priority: "high" },
  pilotPause: { id: "pilotPause", label: "Pilot pause", priority: "critical" },
};

const ROLE_DEFAULTS: Record<PilotControlRoleKey, PilotRegisterColumnId[]> = {
  reception: [
    "patient",
    "pilotStatus",
    "milestone",
    "overallReadiness",
    "appActivation",
    "documents",
    "appointment",
    "primaryBlocker",
    "nextPatientAction",
    "nextClinicAction",
    "lastActivity",
  ],
  clinical: [
    "patient",
    "milestone",
    "overallReadiness",
    "clinical",
    "consent",
    "pathology",
    "images",
    "primaryBlocker",
    "procedureReadiness",
  ],
  finance: [
    "patient",
    "milestone",
    "overallReadiness",
    "financial",
    "quoteState",
    "depositState",
    "paymentPlanState",
    "reconciliation",
    "financialBlocker",
  ],
  director: [
    "patient",
    "pilotStatus",
    "milestone",
    "overallReadiness",
    "clinical",
    "financial",
    "patientDim",
    "operational",
    "technical",
    "primaryBlocker",
    "operationalOwner",
    "escalation",
    "pilotPause",
    "lastActivity",
  ],
  administrator: [
    "patient",
    "pilotStatus",
    "milestone",
    "overallReadiness",
    "clinical",
    "financial",
    "patientDim",
    "operational",
    "technical",
    "primaryBlocker",
    "blockerSeverity",
    "operationalOwner",
    "escalation",
    "pilotPause",
    "evaluatedAt",
  ],
  clinic_manager: [
    "patient",
    "pilotStatus",
    "milestone",
    "overallReadiness",
    "operational",
    "primaryBlocker",
    "blockerSeverity",
    "nextPatientAction",
    "nextClinicAction",
    "operationalOwner",
    "lastActivity",
  ],
  consultant: [
    "patient",
    "milestone",
    "overallReadiness",
    "clinical",
    "financial",
    "primaryBlocker",
    "nextPatientAction",
    "nextClinicAction",
  ],
  technical: [
    "patient",
    "pilotStatus",
    "overallReadiness",
    "technical",
    "primaryBlocker",
    "blockerSeverity",
    "appActivation",
    "evaluatedAt",
  ],
};

/** Columns that must remain visible on mobile / tablet. */
export const MOBILE_REQUIRED_COLUMNS: PilotRegisterColumnId[] = [
  "patient",
  "primaryBlocker",
  "blockerSeverity",
  "overallReadiness",
  "operationalOwner",
  "pilotPause",
];

export function defaultRegisterColumnsForRole(
  role: PilotControlRoleKey | null | undefined
): PilotRegisterColumnDef[] {
  const ids = (role && ROLE_DEFAULTS[role]) || ROLE_DEFAULTS.clinic_manager;
  return ids.map((id) => ALL_COLUMNS[id]);
}

export function columnsForViewport(
  columns: PilotRegisterColumnDef[],
  viewport: "desktop" | "tablet" | "mobile"
): PilotRegisterColumnDef[] {
  if (viewport === "desktop") return columns;
  if (viewport === "tablet") {
    return columns.filter((c) => c.priority !== "low");
  }
  const required = new Set(MOBILE_REQUIRED_COLUMNS);
  const kept = columns.filter((c) => required.has(c.id) || c.priority === "critical");
  // Ensure severity / owner preserved even if role defaults omitted them
  for (const id of MOBILE_REQUIRED_COLUMNS) {
    if (!kept.some((c) => c.id === id) && ALL_COLUMNS[id]) {
      // Only add if present in full role set or critical
      if (columns.some((c) => c.id === id) || id === "blockerSeverity" || id === "patient") {
        if (!kept.some((c) => c.id === id)) kept.push(ALL_COLUMNS[id]);
      }
    }
  }
  return kept;
}

export function registerColumnLabel(id: PilotRegisterColumnId): string {
  return ALL_COLUMNS[id]?.label ?? id;
}
