/**
 * ReceptionOS Phase 7 — usage event kinds and validation (pure).
 */

import { RECEPTION_OS_OPERATING_MODES, type ReceptionOsOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";

export const RECEPTION_USAGE_EVENT_KINDS = [
  "dashboard_viewed",
  "widget_viewed",
  "task_created",
  "task_actioned",
  "communication_previewed",
  "communication_dry_run_sent",
  "closeout_previewed",
  "day_closed",
  "refresh_failed",
] as const;

export type ReceptionUsageEventKind = (typeof RECEPTION_USAGE_EVENT_KINDS)[number];

export type ReceptionUsageEventContext = {
  operatingMode?: ReceptionOsOperatingMode | null;
  widgetKey?: string | null;
  taskId?: string | null;
  alertKind?: string | null;
  sourceRefId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ReceptionUsageEventRow = {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  event_kind: ReceptionUsageEventKind;
  operating_mode: ReceptionOsOperatingMode | null;
  widget_key: string | null;
  task_id: string | null;
  alert_kind: string | null;
  source_ref_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const OPERATING_MODE_SET = new Set<string>(RECEPTION_OS_OPERATING_MODES);
const EVENT_KIND_SET = new Set<string>(RECEPTION_USAGE_EVENT_KINDS);

export function isReceptionUsageEventKind(v: unknown): v is ReceptionUsageEventKind {
  return typeof v === "string" && EVENT_KIND_SET.has(v);
}

export function sanitizeReceptionUsageEventContext(
  ctx: ReceptionUsageEventContext | undefined,
): Omit<ReceptionUsageEventContext, "metadata"> & { metadata: Record<string, unknown> } {
  const operatingMode =
    ctx?.operatingMode && OPERATING_MODE_SET.has(ctx.operatingMode) ? ctx.operatingMode : null;
  const widgetKey = typeof ctx?.widgetKey === "string" ? ctx.widgetKey.trim().slice(0, 64) || null : null;
  const taskId = typeof ctx?.taskId === "string" ? ctx.taskId.trim() || null : null;
  const alertKind = typeof ctx?.alertKind === "string" ? ctx.alertKind.trim().slice(0, 64) || null : null;
  const sourceRefId = typeof ctx?.sourceRefId === "string" ? ctx.sourceRefId.trim().slice(0, 128) || null : null;
  const metadata =
    ctx?.metadata && typeof ctx.metadata === "object" && !Array.isArray(ctx.metadata)
      ? sanitizeOperationalMetadata(ctx.metadata)
      : {};
  return { operatingMode, widgetKey, taskId, alertKind, sourceRefId, metadata };
}

/** Strip keys that could carry sensitive patient or message content. */
export function sanitizeOperationalMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    "body",
    "message",
    "messageBody",
    "emailBody",
    "smsBody",
    "note",
    "preview",
    "subject",
    "patientName",
    "patientLabel",
    "toAddress",
    "phone",
    "email",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (blocked.has(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 256);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (value === null) out[key] = null;
  }
  return out;
}

export function assertReceptionUsageEventTenantScope(expectedTenantId: string, rowTenantId: string): void {
  if (expectedTenantId.trim() !== rowTenantId.trim()) {
    throw new Error("ReceptionOS usage event tenant scope violation.");
  }
}
