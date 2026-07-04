import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  recordAnalyticsEvent,
  type AnalyticsEventCoreOptions,
  type FiAnalyticsEventRow,
} from "@/src/lib/analytics-os/analyticsEventCore";

import type { SurgeryCaseIntelligenceFacts } from "./surgeryCaseFactsCore";
import { loadAndBuildSurgeryCaseIntelligenceFactsForPublish } from "./surgeryCaseFactsPublishContext.server";
import {
  buildSurgeryCaseIntelligenceFactsEventMetadata,
  decideSurgeryCaseIntelligencePublishAction,
  resolveSurgeryCaseIntelligenceEventValue,
  resolveSurgeryCaseIntelligencePublishEntityId,
  SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
  SurgeryCaseFactsPublishValidationError,
  validateSurgeryCaseIntelligenceFactsForPublish,
} from "./surgeryCaseFactsPublisherCore";

export type PublishSurgeryCaseIntelligenceFactsInput = {
  tenantId: string;
  clinicId?: string | null;
  facts: SurgeryCaseIntelligenceFacts;
  force?: boolean;
  occurredAt?: string;
};

import type { PublishSurgeryCaseIntelligenceFactsResult } from "./surgeryCaseFactsPublisherCore";

export type { PublishSurgeryCaseIntelligenceFactsResult } from "./surgeryCaseFactsPublisherCore";

type ExistingFactsEventRow = {
  id: string;
  factsVersion: string | null;
};

function resolveClient(options?: AnalyticsEventCoreOptions): SupabaseClient {
  return options?.supabaseClientForTests ?? supabaseAdmin();
}

function readFactsVersionFromMetadata(metadata: Record<string, unknown>): string | null {
  const value = metadata.facts_version;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function loadExistingSurgeryCaseIntelligenceFactsEvents(
  input: {
    tenantId: string;
    entityId: string;
  },
  options?: AnalyticsEventCoreOptions
): Promise<ExistingFactsEventRow[]> {
  const supabase = resolveClient(options);
  const { data, error } = await supabase
    .from("fi_analytics_events")
    .select("id, event_metadata")
    .eq("tenant_id", input.tenantId)
    .eq("module_name", "surgery_os")
    .eq("event_type", SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE)
    .eq("entity_id", input.entityId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) => {
    const row = raw as { id: string; event_metadata?: Record<string, unknown> };
    const metadata =
      row.event_metadata && typeof row.event_metadata === "object" && !Array.isArray(row.event_metadata)
        ? row.event_metadata
        : {};
    return {
      id: String(row.id),
      factsVersion: readFactsVersionFromMetadata(metadata),
    };
  });
}

async function updateSurgeryCaseIntelligenceFactsEvent(
  input: {
    eventId: string;
    tenantId: string;
    clinicId: string | null;
    entityId: string;
    entityType: "case" | "surgery";
    eventValue: number | null;
    eventMetadata: Record<string, unknown>;
    occurredAt: string;
  },
  options?: AnalyticsEventCoreOptions
): Promise<FiAnalyticsEventRow> {
  const supabase = resolveClient(options);
  const { data, error } = await supabase
    .from("fi_analytics_events")
    .update({
      clinic_id: input.clinicId,
      entity_id: input.entityId,
      entity_type: input.entityType,
      event_value: input.eventValue,
      event_metadata: input.eventMetadata,
      occurred_at: input.occurredAt,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.eventId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update surgery case intelligence facts event.");
  }

  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    clinic_id: data.clinic_id != null ? String(data.clinic_id) : null,
    module_name: "surgery_os",
    event_type: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
    entity_id: data.entity_id != null ? String(data.entity_id) : null,
    entity_type: data.entity_type != null ? String(data.entity_type) : null,
    event_value: data.event_value != null ? Number(data.event_value) : null,
    event_metadata:
      data.event_metadata && typeof data.event_metadata === "object" && !Array.isArray(data.event_metadata)
        ? (data.event_metadata as Record<string, unknown>)
        : {},
    occurred_at: String(data.occurred_at),
    created_at: String(data.created_at),
  };
}

/**
 * Idempotent publisher keyed by tenant_id + entity_id + facts_version.
 */
export async function publishSurgeryCaseIntelligenceFacts(
  input: PublishSurgeryCaseIntelligenceFactsInput,
  options?: AnalyticsEventCoreOptions
): Promise<PublishSurgeryCaseIntelligenceFactsResult> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const facts = validateSurgeryCaseIntelligenceFactsForPublish(input.facts);
  const lastPublishedAt = input.occurredAt?.trim() || new Date().toISOString();
  const { entityId, entityType } = resolveSurgeryCaseIntelligencePublishEntityId(facts);
  const payloadJson = facts;
  const eventMetadata = buildSurgeryCaseIntelligenceFactsEventMetadata({
    facts,
    lastPublishedAt,
    payloadJson,
  });
  const eventValue = resolveSurgeryCaseIntelligenceEventValue(facts);
  const clinicId = input.clinicId?.trim() || null;

  const existingRows = await loadExistingSurgeryCaseIntelligenceFactsEvents(
    { tenantId: tid, entityId },
    options
  );
  const decision = decideSurgeryCaseIntelligencePublishAction({
    incomingVersion: facts.facts_version,
    existingRows,
    force: input.force,
  });

  if (decision.action === "skip") {
    return {
      action: "skipped",
      reason: decision.reason,
      factsVersion: facts.facts_version,
      lastPublishedAt,
    };
  }

  if (decision.action === "update" && decision.existingEventId) {
    const row = await updateSurgeryCaseIntelligenceFactsEvent(
      {
        eventId: decision.existingEventId,
        tenantId: tid,
        clinicId,
        entityId,
        entityType,
        eventValue,
        eventMetadata,
        occurredAt: lastPublishedAt,
      },
      options
    );
    return {
      action: "updated",
      eventId: row.id,
      factsVersion: facts.facts_version,
      lastPublishedAt,
    };
  }

  const row = await recordAnalyticsEvent(
    {
      tenantId: tid,
      clinicId,
      moduleName: "surgery_os",
      eventType: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
      entityId,
      entityType,
      eventValue,
      eventMetadata,
      occurredAt: lastPublishedAt,
    },
    options
  );

  return {
    action: "inserted",
    eventId: row.id,
    factsVersion: facts.facts_version,
    lastPublishedAt,
  };
}

export async function tryPublishSurgeryCaseIntelligenceFactsForSurgery(input: {
  tenantId: string;
  surgeryId: string;
  force?: boolean;
  client?: SupabaseClient;
}): Promise<PublishSurgeryCaseIntelligenceFactsResult | null> {
  try {
    const { facts, clinicId } = await loadAndBuildSurgeryCaseIntelligenceFactsForPublish({
      tenantId: input.tenantId,
      surgeryId: input.surgeryId,
      client: input.client,
    });
    if (!facts) return null;
    return await publishSurgeryCaseIntelligenceFacts({
      tenantId: input.tenantId,
      clinicId,
      facts,
      force: input.force,
    });
  } catch (error) {
    if (error instanceof SurgeryCaseFactsPublishValidationError) return null;
    return null;
  }
}

export {
  SurgeryCaseFactsPublishValidationError,
  validateSurgeryCaseIntelligenceFactsForPublish,
} from "./surgeryCaseFactsPublisherCore";