import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiEventEnvelope, FiEventType, FiSourceSystem } from "@/src/types/fi-events";
import { linkEventToEntities } from "./mapping";

export type FiEventStatus = "received" | "processing" | "processed" | "ignored" | "failed";

export type FiEventRow = {
  id: string;
  tenant_id: string;
  event_type: FiEventType | string;
  source_system: FiSourceSystem | string;
  source_event_id: string;
  occurred_at: string;
  payload_json: Record<string, unknown>;
  status: FiEventStatus | string;
  error_text: string | null;
  created_at: string;
  updated_at: string;
};

export type FiEventLogRow = {
  id: string;
  status: string;
  fi_case_id: string | null;
  global_case_id: string | null;
  global_patient_id: string | null;
  error: string | null;
};

type SourceKeyParams = {
  tenantId: string;
  sourceSystem: FiSourceSystem | string;
  sourceEventId: string;
};

type CreateFiEventParams = {
  tenantId: string;
  eventType: FiEventType | string;
  sourceSystem: FiSourceSystem | string;
  sourceEventId: string;
  occurredAt?: string;
  payloadJson: Record<string, unknown>;
};

type MarkFiEventStatusParams = {
  eventId: string;
  status: FiEventStatus;
  errorText?: string | null;
};

function eventColumns() {
  return "id, tenant_id, event_type, source_system, source_event_id, occurred_at, payload_json, status, error_text, created_at, updated_at";
}

async function getExistingFiEventBySourceKeyWithClient(
  supabase: SupabaseClient,
  params: SourceKeyParams
): Promise<FiEventRow | null> {
  const result = await supabase
    .from("fi_events")
    .select(eventColumns())
    .eq("tenant_id", params.tenantId)
    .eq("source_system", params.sourceSystem)
    .eq("source_event_id", params.sourceEventId)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return (result.data as FiEventRow | null) ?? null;
}

async function getLatestFiEventLink(
  supabase: SupabaseClient,
  eventId: string
): Promise<{
  fi_case_id: string | null;
  global_case_id: string | null;
  global_patient_id: string | null;
}> {
  const link = await supabase
    .from("fi_event_links")
    .select("fi_case_id, global_case_id, global_patient_id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (link.error || !link.data) {
    return {
      fi_case_id: null,
      global_case_id: null,
      global_patient_id: null,
    };
  }

  return {
    fi_case_id: link.data.fi_case_id ?? null,
    global_case_id: link.data.global_case_id ?? null,
    global_patient_id: link.data.global_patient_id ?? null,
  };
}

async function loadEventLogRow(
  supabase: SupabaseClient,
  eventId: string
): Promise<FiEventLogRow | null> {
  const event = await supabase
    .from("fi_events")
    .select("id, status, error_text")
    .eq("id", eventId)
    .maybeSingle();

  if (event.error || !event.data) return null;
  const links = await getLatestFiEventLink(supabase, eventId);

  return {
    id: event.data.id,
    status: event.data.status,
    fi_case_id: links.fi_case_id,
    global_case_id: links.global_case_id,
    global_patient_id: links.global_patient_id,
    error: event.data.error_text ?? null,
  };
}

export async function getExistingFiEventBySourceKey(params: SourceKeyParams): Promise<FiEventRow | null> {
  return getExistingFiEventBySourceKeyWithClient(supabaseAdmin(), params);
}

export async function createFiEventIfNotExists(
  params: CreateFiEventParams
): Promise<{ created: true; row: FiEventRow } | { created: false; row: FiEventRow }> {
  const supabase = supabaseAdmin();
  const insert = await supabase
    .from("fi_events")
    .insert({
      tenant_id: params.tenantId,
      event_type: params.eventType,
      source_system: params.sourceSystem,
      source_event_id: params.sourceEventId,
      occurred_at: params.occurredAt ?? new Date().toISOString(),
      payload_json: params.payloadJson,
      status: "received",
    })
    .select(eventColumns())
    .single();

  if (!insert.error && insert.data) {
    return { created: true, row: insert.data as unknown as FiEventRow };
  }

  if (insert.error?.code !== "23505") {
    throw new Error(insert.error?.message ?? "Failed to create fi_events row.");
  }

  const existing = await getExistingFiEventBySourceKeyWithClient(supabase, {
    tenantId: params.tenantId,
    sourceSystem: params.sourceSystem,
    sourceEventId: params.sourceEventId,
  });
  if (!existing) {
    throw new Error("Duplicate fi_events row detected but existing row could not be loaded.");
  }

  return { created: false, row: existing };
}

export async function markFiEventStatus(params: MarkFiEventStatusParams): Promise<FiEventRow> {
  const payload: {
    status: FiEventStatus;
    updated_at: string;
    error_text?: string | null;
  } = {
    status: params.status,
    updated_at: new Date().toISOString(),
  };

  if (params.errorText !== undefined) {
    payload.error_text = params.errorText;
  } else if (params.status !== "failed") {
    payload.error_text = null;
  }

  const result = await supabaseAdmin()
    .from("fi_events")
    .update(payload)
    .eq("id", params.eventId)
    .select(eventColumns())
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Failed to update fi_events status.");
  }

  return result.data as unknown as FiEventRow;
}

export async function attachFiEventError(params: {
  eventId: string;
  errorText: string;
}): Promise<FiEventRow> {
  return markFiEventStatus({
    eventId: params.eventId,
    status: "failed",
    errorText: params.errorText,
  });
}

export async function createOrLoadEventLog(
  supabase: SupabaseClient,
  event: FiEventEnvelope
): Promise<
  | { ok: true; duplicate: false; row: FiEventLogRow }
  | { ok: true; duplicate: true; row: FiEventLogRow }
  | { ok: false; error: string }
> {
  try {
    const insert = await supabase
      .from("fi_events")
      .insert({
        tenant_id: event.tenant_id,
        event_type: event.event_type,
        source_system: event.source_system,
        source_event_id: event.source_event_id,
        occurred_at: event.occurred_at ?? new Date().toISOString(),
        payload_json: event.payload,
        status: "received",
      })
      .select("id")
      .single();

    if (!insert.error && insert.data) {
      const row = await loadEventLogRow(supabase, insert.data.id);
      if (!row) return { ok: false, error: "Failed to load created fi_events row." };
      return { ok: true, duplicate: false, row };
    }

    if (insert.error?.code !== "23505") {
      return { ok: false, error: insert.error?.message ?? "Failed to create fi_events row." };
    }

    const existing = await getExistingFiEventBySourceKeyWithClient(supabase, {
      tenantId: event.tenant_id,
      sourceSystem: event.source_system,
      sourceEventId: event.source_event_id,
    });
    if (!existing) {
      return { ok: false, error: "Duplicate fi_events row detected but existing row could not be loaded." };
    }

    const row = await loadEventLogRow(supabase, existing.id);
    if (!row) return { ok: false, error: "Failed to load duplicate fi_events row." };
    return { ok: true, duplicate: true, row };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unexpected fi_events idempotency error.",
    };
  }
}

export async function markEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
  links: {
    fi_case_id?: string | null;
    global_case_id?: string | null;
    global_patient_id?: string | null;
  }
): Promise<void> {
  await supabase
    .from("fi_events")
    .update({
      status: "processed",
      updated_at: new Date().toISOString(),
      error_text: null,
    })
    .eq("id", eventId);

  if (links.fi_case_id || links.global_case_id || links.global_patient_id) {
    await linkEventToEntities({
      eventId,
      fiCaseId: links.fi_case_id ?? null,
      globalCaseId: links.global_case_id ?? null,
      globalPatientId: links.global_patient_id ?? null,
    });
  }
}

export async function markEventFailed(
  supabase: SupabaseClient,
  eventId: string,
  error: string
): Promise<void> {
  await supabase
    .from("fi_events")
    .update({
      status: "failed",
      error_text: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}
