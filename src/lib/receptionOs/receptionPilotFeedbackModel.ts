/**
 * ReceptionOS Phase 7 — pilot feedback kinds and validation (pure).
 */

import {
  RECEPTION_OS_OPERATING_MODES,
  type ReceptionOsOperatingMode,
} from "@/src/lib/receptionOs/receptionOperatingMode";
import { sanitizeOperationalMetadata } from "@/src/lib/receptionOs/receptionUsageEventModel";

export const RECEPTION_PILOT_FEEDBACK_KINDS = [
  "useful",
  "missing_information",
  "wrong_alert",
  "workflow_friction",
] as const;

export type ReceptionPilotFeedbackKind = (typeof RECEPTION_PILOT_FEEDBACK_KINDS)[number];

export const RECEPTION_PILOT_FEEDBACK_LABELS: Record<ReceptionPilotFeedbackKind, string> = {
  useful: "Was this useful?",
  missing_information: "Missing information?",
  wrong_alert: "Wrong alert?",
  workflow_friction: "Workflow friction?",
};

export type ReceptionPilotFeedbackContext = {
  operatingMode?: ReceptionOsOperatingMode | null;
  widgetKey?: string | null;
  taskId?: string | null;
  alertKind?: string | null;
  sourceRefId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

export type ReceptionPilotFeedbackRow = {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  feedback_kind: ReceptionPilotFeedbackKind;
  operating_mode: ReceptionOsOperatingMode | null;
  widget_key: string | null;
  task_id: string | null;
  alert_kind: string | null;
  source_ref_id: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const OPERATING_MODE_SET = new Set<string>(RECEPTION_OS_OPERATING_MODES);
const FEEDBACK_KIND_SET = new Set<string>(RECEPTION_PILOT_FEEDBACK_KINDS);

export function isReceptionPilotFeedbackKind(v: unknown): v is ReceptionPilotFeedbackKind {
  return typeof v === "string" && FEEDBACK_KIND_SET.has(v);
}

export function sanitizeReceptionPilotFeedbackContext(
  ctx: ReceptionPilotFeedbackContext | undefined
): Required<
  Pick<
    ReceptionPilotFeedbackContext,
    "operatingMode" | "widgetKey" | "taskId" | "alertKind" | "sourceRefId" | "note"
  >
> & {
  metadata: Record<string, unknown>;
} {
  const operatingMode =
    ctx?.operatingMode && OPERATING_MODE_SET.has(ctx.operatingMode) ? ctx.operatingMode : null;
  const widgetKey =
    typeof ctx?.widgetKey === "string" ? ctx.widgetKey.trim().slice(0, 64) || null : null;
  const taskId = typeof ctx?.taskId === "string" ? ctx.taskId.trim() || null : null;
  const alertKind =
    typeof ctx?.alertKind === "string" ? ctx.alertKind.trim().slice(0, 64) || null : null;
  const sourceRefId =
    typeof ctx?.sourceRefId === "string" ? ctx.sourceRefId.trim().slice(0, 128) || null : null;
  const note = typeof ctx?.note === "string" ? ctx.note.trim().slice(0, 500) || null : null;
  const metadata =
    ctx?.metadata && typeof ctx.metadata === "object" && !Array.isArray(ctx.metadata)
      ? sanitizeOperationalMetadata(ctx.metadata)
      : {};
  return { operatingMode, widgetKey, taskId, alertKind, sourceRefId, note, metadata };
}

export function assertReceptionPilotFeedbackTenantScope(
  expectedTenantId: string,
  rowTenantId: string
): void {
  if (expectedTenantId.trim() !== rowTenantId.trim()) {
    throw new Error("ReceptionOS pilot feedback tenant scope violation.");
  }
}
