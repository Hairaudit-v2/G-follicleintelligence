import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import { inferWorkspaceFromHref } from "@/src/lib/fiOs/workspaceShell/workspaceHref";
import type { WorkspaceRef, WorkspaceShellKind } from "@/src/lib/fiOs/workspaceShell/types";
import { workspaceRefKey } from "@/src/lib/fiOs/workspaceShell/types";
import {
  inferTodaySignalKind,
  type TodaySignalKind,
} from "@/src/lib/fiOs/todaySignal/todaySignalPriority";

/**
 * FI-UX-REBUILD D6D — cross-workspace signal sync registry.
 * Maps Today operational signals to workspace kinds that should revalidate.
 * Privacy-safe: no PHI, names, amounts, or free text in payloads.
 */

export type WorkspaceKind = WorkspaceShellKind;

export type WorkspaceSignalKind =
  | "arrival_intent"
  | "reception_check_in"
  | "appointment_phase_change"
  | "payment_blocker"
  | "payment_received"
  | "pathology_review_pending"
  | "pathology_reviewed"
  | "surgery_readiness_blocker"
  | "surgery_readiness_cleared"
  | "lead_stale"
  | "lead_follow_up_due"
  | "consultation_completed"
  | "staff_compliance_alert"
  | "staff_presence_change";

export type WorkspaceSignalPayload = {
  signalType: WorkspaceSignalKind;
  entityKind?: string;
  entityId?: string;
  /** Non-PHI workspace targets that should revalidate when this signal is active. */
  targetRefs: readonly WorkspaceRef[];
  timestamp: string;
  reasonLabel: string;
};

const WORKSPACE_SIGNAL_TO_KINDS: Readonly<Record<WorkspaceSignalKind, readonly WorkspaceShellKind[]>> =
  {
    arrival_intent: ["appointment", "patient", "consultation"],
    reception_check_in: ["appointment", "patient", "consultation"],
    appointment_phase_change: ["appointment", "patient"],
    payment_blocker: ["payment", "patient", "surgery_case"],
    payment_received: ["payment", "patient", "surgery_case"],
    pathology_review_pending: ["pathology_result", "patient", "consultation"],
    pathology_reviewed: ["pathology_result", "patient", "consultation"],
    surgery_readiness_blocker: ["surgery_case", "patient", "appointment"],
    surgery_readiness_cleared: ["surgery_case", "patient", "appointment"],
    lead_stale: ["lead"],
    lead_follow_up_due: ["lead"],
    consultation_completed: ["consultation", "patient", "lead", "payment"],
    staff_compliance_alert: ["staff", "surgery_case"],
    staff_presence_change: ["staff"],
  };

const WORKSPACE_SIGNAL_REASONS: Readonly<
  Record<WorkspaceSignalKind, Partial<Record<WorkspaceShellKind, string>>>
> = {
  arrival_intent: {
    appointment: "Arrival status changed",
    patient: "Arrival status changed",
    consultation: "Arrival status changed",
  },
  reception_check_in: {
    appointment: "Arrival status changed",
    patient: "Arrival status changed",
    consultation: "Arrival status changed",
  },
  appointment_phase_change: {
    appointment: "Appointment status changed",
    patient: "Appointment status changed",
  },
  payment_blocker: {
    payment: "Payment status changed",
    patient: "Payment status changed",
    surgery_case: "Payment status changed",
  },
  payment_received: {
    payment: "Payment status changed",
    patient: "Payment status changed",
    surgery_case: "Payment status changed",
  },
  pathology_review_pending: {
    pathology_result: "Pathology review state changed",
    patient: "Pathology review state changed",
    consultation: "Pathology review state changed",
  },
  pathology_reviewed: {
    pathology_result: "Pathology review state changed",
    patient: "Pathology review state changed",
    consultation: "Pathology review state changed",
  },
  surgery_readiness_blocker: {
    surgery_case: "Readiness state changed",
    patient: "Readiness state changed",
    appointment: "Readiness state changed",
  },
  surgery_readiness_cleared: {
    surgery_case: "Readiness state changed",
    patient: "Readiness state changed",
    appointment: "Readiness state changed",
  },
  lead_stale: {
    lead: "Lead follow-up state changed",
  },
  lead_follow_up_due: {
    lead: "Lead follow-up state changed",
  },
  consultation_completed: {
    consultation: "Consultation state changed",
    patient: "Consultation state changed",
    lead: "Consultation state changed",
    payment: "Consultation state changed",
  },
  staff_compliance_alert: {
    staff: "Staff compliance state changed",
    surgery_case: "Readiness state changed",
  },
  staff_presence_change: {
    staff: "Staff presence changed",
  },
};

const ENTITY_KIND_TO_WORKSPACE: Readonly<Record<string, WorkspaceShellKind>> = {
  booking: "appointment",
  lead: "lead",
  pathology: "pathology_result",
  payment: "payment",
  surgery_readiness: "surgery_case",
  surgery_payment: "surgery_case",
  financial_clearance: "payment",
  staff: "staff",
  consultation: "consultation",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function extractEntityFromFeedItemId(
  id: string
): { entityKind?: string; entityId?: string } {
  const prefixes: Array<[string, string]> = [
    ["reception-", "booking"],
    ["stale-lead-", "lead"],
    ["entity-pathology-", "pathology"],
    ["entity-surgery-readiness-", "surgery_readiness"],
    ["entity-surgery-payment-", "surgery_payment"],
    ["entity-payment-overdue-", "payment"],
    ["entity-financial-clearance-", "financial_clearance"],
    ["entity-staff-", "staff"],
    ["entity-consultation-", "consultation"],
  ];

  for (const [prefix, kind] of prefixes) {
    if (id.startsWith(prefix)) {
      return { entityKind: kind, entityId: id.slice(prefix.length) || id };
    }
  }

  return { entityKind: "signal", entityId: id };
}

function dedupeWorkspaceRefs(refs: readonly WorkspaceRef[]): WorkspaceRef[] {
  const seen = new Set<string>();
  const out: WorkspaceRef[] = [];
  for (const ref of refs) {
    const key = workspaceRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function patientIdFromPathologyHref(href: string): string | null {
  const path = href.split("?")[0]?.split("#")[0]?.trim() ?? "";
  const match = path.match(
    new RegExp(`/fi-admin/[^/]+/patients/(${UUID})/blood-results/`, "i")
  );
  return match?.[1] ?? null;
}

export function buildWorkspaceSignalTargetRefs(input: {
  href?: string;
  entityKind?: string;
  entityId?: string;
  patientId?: string | null;
  consultationId?: string | null;
  caseId?: string | null;
}): WorkspaceRef[] {
  const refs: WorkspaceRef[] = [];
  const { href, entityKind, entityId, patientId, consultationId, caseId } = input;

  if (href) {
    const inferred = inferWorkspaceFromHref(href);
    if (inferred) refs.push(inferred);

    const pathologyPatientId = patientIdFromPathologyHref(href);
    if (pathologyPatientId) {
      refs.push({ kind: "patient", id: pathologyPatientId });
    }
  }

  if (entityKind && entityId) {
    const mapped = ENTITY_KIND_TO_WORKSPACE[entityKind];
    if (mapped) refs.push({ kind: mapped, id: entityId });
  }

  if (patientId?.trim()) {
    refs.push({ kind: "patient", id: patientId.trim() });
  }
  if (consultationId?.trim()) {
    refs.push({ kind: "consultation", id: consultationId.trim() });
  }
  if (caseId?.trim()) {
    refs.push({ kind: "surgery_case", id: caseId.trim() });
  }

  return dedupeWorkspaceRefs(refs);
}

export function mapTodaySignalKindToWorkspaceSignalKind(
  kind: TodaySignalKind
): WorkspaceSignalKind | null {
  switch (kind) {
    case "arrival_intent":
      return "arrival_intent";
    case "reception_waiting":
    case "reception_arriving_soon":
    case "reception_in_clinic":
      return "reception_check_in";
    case "payment_blocker":
      return "payment_blocker";
    case "financial_clearance":
      return "payment_received";
    case "pathology_review":
      return "pathology_review_pending";
    case "surgery_readiness":
      return "surgery_readiness_blocker";
    case "stale_lead":
      return "lead_stale";
    case "staff_compliance":
      return "staff_compliance_alert";
    case "consultation":
      return "consultation_completed";
    case "task_due":
    case "reminder":
    case "aggregate":
    default:
      return null;
  }
}

export function getWorkspaceKindsForSignal(
  signalType: WorkspaceSignalKind
): readonly WorkspaceShellKind[] {
  return WORKSPACE_SIGNAL_TO_KINDS[signalType] ?? [];
}

export function getWorkspaceSignalReason(
  signalType: WorkspaceSignalKind,
  workspaceKind: WorkspaceShellKind
): string {
  return (
    WORKSPACE_SIGNAL_REASONS[signalType]?.[workspaceKind] ??
    WORKSPACE_SIGNAL_REASONS[signalType]?.[getWorkspaceKindsForSignal(signalType)[0]!] ??
    "Operational signal updated"
  );
}

export function shouldWorkspaceRevalidateForSignal(
  workspace: WorkspaceRef,
  signal: WorkspaceSignalPayload
): boolean {
  const affectedKinds = getWorkspaceKindsForSignal(signal.signalType);
  if (!affectedKinds.includes(workspace.kind)) return false;
  if (signal.targetRefs.length === 0) return false;

  return signal.targetRefs.some(
    (target) => target.kind === workspace.kind && target.id === workspace.id
  );
}

export function normalizeTodayFeedItemToWorkspaceSignal(
  item: TodayFeedItem,
  timestamp: string = new Date().toISOString()
): WorkspaceSignalPayload | null {
  const todayKind = inferTodaySignalKind(item);
  const signalType = mapTodaySignalKindToWorkspaceSignalKind(todayKind);
  if (!signalType) return null;

  const { entityKind, entityId } = extractEntityFromFeedItemId(item.id);
  const targetRefs = buildWorkspaceSignalTargetRefs({ href: item.href, entityKind, entityId });

  return {
    signalType,
    entityKind,
    entityId,
    targetRefs,
    timestamp,
    reasonLabel: getWorkspaceSignalReason(signalType, targetRefs[0]?.kind ?? "patient"),
  };
}

export function deriveWorkspaceSignalsFromTodayFeedItems(
  items: readonly TodayFeedItem[],
  timestamp: string = new Date().toISOString()
): WorkspaceSignalPayload[] {
  const out: WorkspaceSignalPayload[] = [];
  for (const item of items) {
    const signal = normalizeTodayFeedItemToWorkspaceSignal(item, timestamp);
    if (signal) out.push(signal);
  }
  return out;
}

/** Ensures registry never maps to calendar or unsupported future kinds. */
export function assertWorkspaceSignalRegistryPrivacy(): void {
  for (const kinds of Object.values(WORKSPACE_SIGNAL_TO_KINDS)) {
    for (const kind of kinds) {
      if (kind === ("calendar" as WorkspaceShellKind)) {
        throw new Error("Workspace signal registry must not map to calendar");
      }
    }
  }
}
