import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  isAnalyticsModuleName,
  isEventTypeAllowedForModule,
  type AnalyticsModuleName,
} from "./analyticsEventTypes";

export type FiAnalyticsEventRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  module_name: AnalyticsModuleName;
  event_type: string;
  entity_id: string | null;
  entity_type: string | null;
  event_value: number | null;
  event_metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

export type PublishAnalyticsEventInput = {
  tenantId: string;
  clinicId?: string | null;
  moduleName: AnalyticsModuleName;
  eventType: string;
  entityId?: string | null;
  entityType?: string | null;
  eventValue?: number | null;
  eventMetadata?: Record<string, unknown>;
  occurredAt?: string;
};

export type GetAnalyticsEventsFilters = {
  tenantId: string;
  clinicId?: string | null;
  moduleName?: AnalyticsModuleName;
  eventType?: string;
  entityId?: string | null;
  entityType?: string | null;
  occurredAfter?: string;
  occurredBefore?: string;
  limit?: number;
};

export type AggregateAnalyticsEventsInput = {
  tenantId: string;
  clinicId?: string | null;
  moduleName?: AnalyticsModuleName;
  eventType?: string;
  occurredAfter?: string;
  occurredBefore?: string;
  groupBy?: "module_name" | "event_type" | "module_name,event_type";
};

export type AnalyticsEventAggregateRow = {
  module_name: string | null;
  event_type: string | null;
  event_count: number;
  event_value_sum: number | null;
};

export type AnalyticsEventCoreOptions = {
  /** Unit tests only: bypass {@link supabaseAdmin} singleton. */
  supabaseClientForTests?: SupabaseClient;
  /** When true (default), validate event_type against module contract. */
  validateEventType?: boolean;
};

export class AnalyticsEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsEventValidationError";
  }
}

function mapRow(raw: Record<string, unknown>): FiAnalyticsEventRow {
  const metadata =
    raw.event_metadata &&
    typeof raw.event_metadata === "object" &&
    !Array.isArray(raw.event_metadata)
      ? (raw.event_metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    module_name: String(raw.module_name) as AnalyticsModuleName,
    event_type: String(raw.event_type),
    entity_id: raw.entity_id != null ? String(raw.entity_id) : null,
    entity_type: raw.entity_type != null ? String(raw.entity_type) : null,
    event_value: raw.event_value != null ? Number(raw.event_value) : null,
    event_metadata: metadata,
    occurred_at: String(raw.occurred_at),
    created_at: String(raw.created_at),
  };
}

export function validateAnalyticsEventMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata == null) return {};
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new AnalyticsEventValidationError("event_metadata must be a plain object.");
  }
  try {
    JSON.stringify(metadata);
  } catch {
    throw new AnalyticsEventValidationError("event_metadata must be JSON-serializable.");
  }
  return metadata as Record<string, unknown>;
}

export function validateAnalyticsEventInput(
  input: PublishAnalyticsEventInput,
  options?: Pick<AnalyticsEventCoreOptions, "validateEventType">
): void {
  const tid = input.tenantId?.trim();
  if (!tid) throw new AnalyticsEventValidationError("tenantId is required.");

  const moduleName = input.moduleName?.trim();
  if (!moduleName || !isAnalyticsModuleName(moduleName)) {
    throw new AnalyticsEventValidationError(`Invalid module_name "${input.moduleName ?? ""}".`);
  }

  const eventType = input.eventType?.trim();
  if (!eventType) throw new AnalyticsEventValidationError("event_type is required.");

  const validateType = options?.validateEventType !== false;
  if (validateType && !isEventTypeAllowedForModule(moduleName, eventType)) {
    throw new AnalyticsEventValidationError(
      `event_type "${eventType}" is not allowed for module "${moduleName}".`
    );
  }

  validateAnalyticsEventMetadata(input.eventMetadata);

  if (input.eventValue != null && !Number.isFinite(input.eventValue)) {
    throw new AnalyticsEventValidationError("event_value must be a finite number when provided.");
  }

  if (input.occurredAt?.trim()) {
    const ms = new Date(input.occurredAt).getTime();
    if (!Number.isFinite(ms)) {
      throw new AnalyticsEventValidationError("occurredAt must be a valid ISO timestamp.");
    }
  }
}

function resolveClient(options?: AnalyticsEventCoreOptions): SupabaseClient {
  return options?.supabaseClientForTests ?? supabaseAdmin();
}

function buildInsertRow(input: PublishAnalyticsEventInput, tenantId: string) {
  const metadata = validateAnalyticsEventMetadata(input.eventMetadata);
  const clinicId = input.clinicId?.trim() || null;
  const entityId = input.entityId?.trim() || null;
  const entityType = input.entityType?.trim() || null;
  const occurredAt = input.occurredAt?.trim() || new Date().toISOString();

  return {
    tenant_id: tenantId,
    clinic_id: clinicId,
    module_name: input.moduleName,
    event_type: input.eventType.trim(),
    entity_id: entityId,
    entity_type: entityType,
    event_value: input.eventValue ?? null,
    event_metadata: metadata,
    occurred_at: occurredAt,
  };
}

/**
 * Validates and inserts one row into `fi_analytics_events` via the Supabase service role.
 */
export async function recordAnalyticsEvent(
  input: PublishAnalyticsEventInput,
  options?: AnalyticsEventCoreOptions
): Promise<FiAnalyticsEventRow> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  validateAnalyticsEventInput(input, options);

  const supabase = resolveClient(options);
  const { data, error } = await supabase
    .from("fi_analytics_events")
    .insert(buildInsertRow(input, tid))
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not record analytics event.");
  }

  return mapRow(data as Record<string, unknown>);
}

/**
 * Fire-and-forget publisher: records the event and swallows errors so module flows are not blocked.
 */
export async function publishAnalyticsEvent(
  input: PublishAnalyticsEventInput,
  options?: AnalyticsEventCoreOptions
): Promise<FiAnalyticsEventRow | null> {
  try {
    return await recordAnalyticsEvent(input, options);
  } catch {
    return null;
  }
}

function applyEventFilters<
  T extends {
    eq: (col: string, val: unknown) => T;
    gte: (col: string, val: string) => T;
    lte: (col: string, val: string) => T;
  },
>(query: T, filters: GetAnalyticsEventsFilters): T {
  let q = query.eq("tenant_id", filters.tenantId);
  if (filters.clinicId?.trim()) q = q.eq("clinic_id", filters.clinicId.trim());
  if (filters.moduleName) q = q.eq("module_name", filters.moduleName);
  if (filters.eventType?.trim()) q = q.eq("event_type", filters.eventType.trim());
  if (filters.entityId?.trim()) q = q.eq("entity_id", filters.entityId.trim());
  if (filters.entityType?.trim()) q = q.eq("entity_type", filters.entityType.trim());
  if (filters.occurredAfter?.trim()) q = q.gte("occurred_at", filters.occurredAfter.trim());
  if (filters.occurredBefore?.trim()) q = q.lte("occurred_at", filters.occurredBefore.trim());
  return q;
}

export async function getAnalyticsEvents(
  filters: GetAnalyticsEventsFilters,
  options?: AnalyticsEventCoreOptions
): Promise<FiAnalyticsEventRow[]> {
  const tid = assertNonEmptyUuid(filters.tenantId.trim(), "tenantId");
  const supabase = resolveClient(options);
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

  let query = supabase.from("fi_analytics_events").select("*");
  query = applyEventFilters(query, { ...filters, tenantId: tid });
  const { data, error } = await query.order("occurred_at", { ascending: false }).limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getAnalyticsEventsByModule(
  tenantId: string,
  moduleName: AnalyticsModuleName,
  options?: AnalyticsEventCoreOptions & {
    limit?: number;
    occurredAfter?: string;
    occurredBefore?: string;
  }
): Promise<FiAnalyticsEventRow[]> {
  return getAnalyticsEvents(
    {
      tenantId,
      moduleName,
      limit: options?.limit,
      occurredAfter: options?.occurredAfter,
      occurredBefore: options?.occurredBefore,
    },
    options
  );
}

export async function getAnalyticsEventsByEntity(
  tenantId: string,
  entityId: string,
  options?: AnalyticsEventCoreOptions & { entityType?: string; limit?: number }
): Promise<FiAnalyticsEventRow[]> {
  return getAnalyticsEvents(
    {
      tenantId,
      entityId,
      entityType: options?.entityType,
      limit: options?.limit,
    },
    options
  );
}

export async function aggregateAnalyticsEvents(
  input: AggregateAnalyticsEventsInput,
  options?: AnalyticsEventCoreOptions
): Promise<AnalyticsEventAggregateRow[]> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const supabase = resolveClient(options);

  let query = supabase.from("fi_analytics_events").select("module_name, event_type, event_value");
  query = applyEventFilters(query, {
    tenantId: tid,
    clinicId: input.clinicId,
    moduleName: input.moduleName,
    eventType: input.eventType,
    occurredAfter: input.occurredAfter,
    occurredBefore: input.occurredBefore,
  });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    module_name: string;
    event_type: string;
    event_value: number | null;
  }>;

  const groupBy = input.groupBy ?? "module_name,event_type";
  const buckets = new Map<string, AnalyticsEventAggregateRow>();

  for (const row of rows) {
    const key =
      groupBy === "module_name"
        ? row.module_name
        : groupBy === "event_type"
          ? row.event_type
          : `${row.module_name}\0${row.event_type}`;

    const existing = buckets.get(key) ?? {
      module_name: groupBy === "event_type" ? null : row.module_name,
      event_type: groupBy === "module_name" ? null : row.event_type,
      event_count: 0,
      event_value_sum: 0,
    };

    existing.event_count += 1;
    if (row.event_value != null && Number.isFinite(Number(row.event_value))) {
      existing.event_value_sum = (existing.event_value_sum ?? 0) + Number(row.event_value);
    }
    buckets.set(key, existing);
  }

  return [...buckets.values()];
}

export function assertAnalyticsEventsTenantScoped(
  tenantId: string,
  events: FiAnalyticsEventRow[]
): void {
  const tid = tenantId.trim();
  for (const event of events) {
    if (event.tenant_id !== tid) {
      throw new Error(
        `Analytics event ${event.id} belongs to tenant ${event.tenant_id}, not ${tid}.`
      );
    }
  }
}
