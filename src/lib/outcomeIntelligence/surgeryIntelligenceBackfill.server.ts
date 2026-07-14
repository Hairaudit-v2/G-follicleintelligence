import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AnalyticsEventCoreOptions } from "@/src/lib/analytics-os/analyticsEventCore";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { assertSurgeryOsTenantRowScope } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import { isMissingDatabaseRelationError } from "@/src/lib/surgeryOs/surgeryOsLoaderResilience";

import { loadAndBuildSurgeryCaseIntelligenceFactsForPublish } from "./surgeryCaseFactsPublishContext.server";
import {
  decideSurgeryCaseIntelligencePublishAction,
  resolveSurgeryCaseIntelligencePublishEntityId,
  SurgeryCaseFactsPublishValidationError,
  validateSurgeryCaseIntelligenceFactsForPublish,
} from "./surgeryCaseFactsPublisherCore";
import {
  publishSurgeryCaseIntelligenceFacts,
  type PublishSurgeryCaseIntelligenceFactsResult,
} from "./surgeryCaseFactsPublisher.server";
import {
  aggregateSurgeryIntelligenceBackfillSummary,
  classifyDryRunPublishDecision,
  classifyWritePublishResult,
  filterSurgeriesForBackfillScope,
  resolveSurgeryIntelligenceBackfillDateRange,
  type SurgeryIntelligenceBackfillInput,
  type SurgeryIntelligenceBackfillItemOutcome,
  type SurgeryIntelligenceBackfillSummary,
  type SurgeryIntelligenceBackfillSurgeryRow,
} from "./surgeryIntelligenceBackfillCore";

const BACKFILL_SURGERY_SCAN_LIMIT = 500;

type ExistingFactsEventRow = {
  id: string;
  factsVersion: string | null;
};

function resolveClient(client?: SupabaseClient): SupabaseClient {
  return client ?? supabaseAdmin();
}

function readFactsVersionFromMetadata(metadata: Record<string, unknown>): string | null {
  const value = metadata.facts_version;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function loadExistingFactsEventRows(
  input: { tenantId: string; entityId: string },
  client: SupabaseClient
): Promise<ExistingFactsEventRow[]> {
  const { data, error } = await client
    .from("fi_analytics_events")
    .select("id, event_metadata")
    .eq("tenant_id", input.tenantId)
    .eq("module_name", "surgery_os")
    .eq("event_type", "surgery_case_intelligence_facts")
    .eq("entity_id", input.entityId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) => {
    const row = raw as { id: string; event_metadata?: Record<string, unknown> };
    const metadata =
      row.event_metadata &&
      typeof row.event_metadata === "object" &&
      !Array.isArray(row.event_metadata)
        ? row.event_metadata
        : {};
    return {
      id: String(row.id),
      factsVersion: readFactsVersionFromMetadata(metadata),
    };
  });
}

export async function loadSurgeriesForIntelligenceBackfill(input: {
  tenantId: string;
  scope: SurgeryIntelligenceBackfillInput;
  client?: SupabaseClient;
}): Promise<SurgeryIntelligenceBackfillSurgeryRow[]> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const client = resolveClient(input.client);

  if (input.scope.surgeryId?.trim()) {
    const sid = input.scope.surgeryId.trim();
    const { data, error } = await client
      .from("fi_surgeries")
      .select("id, tenant_id, case_id, scheduled_date")
      .eq("tenant_id", tid)
      .eq("id", sid)
      .maybeSingle();
    if (error) {
      if (isMissingDatabaseRelationError(error)) return [];
      throw new Error(error.message);
    }
    if (!data) return [];
    const row = data as SurgeryIntelligenceBackfillSurgeryRow;
    assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgeries");
    return [row];
  }

  let query = client
    .from("fi_surgeries")
    .select("id, tenant_id, case_id, scheduled_date")
    .eq("tenant_id", tid)
    .order("scheduled_date", { ascending: true })
    .limit(BACKFILL_SURGERY_SCAN_LIMIT);

  const range = resolveSurgeryIntelligenceBackfillDateRange({
    procedureDateFrom: input.scope.procedureDateFrom,
    procedureDateTo: input.scope.procedureDateTo,
  });
  if ("from" in range) {
    query = query.gte("scheduled_date", range.from).lte("scheduled_date", range.to);
  }

  if (input.scope.caseId?.trim()) {
    query = query.eq("case_id", input.scope.caseId.trim());
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SurgeryIntelligenceBackfillSurgeryRow[];
  for (const row of rows) {
    assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgeries");
  }
  return filterSurgeriesForBackfillScope(rows, input.scope);
}

export type SurgeryIntelligenceBackfillDeps = {
  loadFacts?: typeof loadAndBuildSurgeryCaseIntelligenceFactsForPublish;
  publishFacts?: typeof publishSurgeryCaseIntelligenceFacts;
  loadExistingRows?: (
    input: { tenantId: string; entityId: string },
    client: SupabaseClient
  ) => Promise<ExistingFactsEventRow[]>;
};

export async function processSurgeryCaseIntelligenceBackfillItem(
  input: {
    tenantId: string;
    surgeryId: string;
    caseId?: string | null;
    dryRun: boolean;
    force?: boolean;
    client?: SupabaseClient;
    options?: AnalyticsEventCoreOptions;
  },
  deps?: SurgeryIntelligenceBackfillDeps
): Promise<SurgeryIntelligenceBackfillItemOutcome> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const sid = assertNonEmptyUuid(input.surgeryId.trim(), "surgeryId");
  const client = resolveClient(input.client);

  try {
    const loadFacts = deps?.loadFacts ?? loadAndBuildSurgeryCaseIntelligenceFactsForPublish;
    const { facts, clinicId } = await loadFacts({
      tenantId: tid,
      surgeryId: sid,
      client,
    });

    if (!facts) {
      return {
        kind: "skipped_missing_context",
        surgeryId: sid,
        caseId: input.caseId ?? null,
      };
    }

    if (!facts.has_final_graft_count) {
      return {
        kind: "skipped_no_final_count",
        surgeryId: sid,
        caseId: facts.case_id ?? input.caseId ?? null,
      };
    }

    const validated = validateSurgeryCaseIntelligenceFactsForPublish(facts);
    const { entityId } = resolveSurgeryCaseIntelligencePublishEntityId(validated);

    if (input.dryRun) {
      const loadExisting = deps?.loadExistingRows ?? loadExistingFactsEventRows;
      const existingRows = await loadExisting({ tenantId: tid, entityId }, client);
      const decision = decideSurgeryCaseIntelligencePublishAction({
        incomingVersion: validated.facts_version,
        existingRows,
        force: input.force,
      });
      return classifyDryRunPublishDecision({
        surgeryId: sid,
        caseId: validated.case_id,
        decision,
      });
    }

    const publishFacts = deps?.publishFacts ?? publishSurgeryCaseIntelligenceFacts;
    const result = await publishFacts(
      {
        tenantId: tid,
        clinicId,
        facts: validated,
        force: input.force,
      },
      input.options
    );

    return classifyWritePublishResult({
      surgeryId: sid,
      caseId: validated.case_id,
      result,
    });
  } catch (error) {
    const reason =
      error instanceof SurgeryCaseFactsPublishValidationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Backfill item failed.";
    return {
      kind: "failed",
      surgeryId: sid,
      caseId: input.caseId ?? null,
      reason,
    };
  }
}

export type SurgeryIntelligenceBackfillRunResult = {
  summary: SurgeryIntelligenceBackfillSummary;
  outcomes: SurgeryIntelligenceBackfillItemOutcome[];
};

export async function runSurgeryIntelligenceBackfill(
  input: {
    tenantId: string;
    scope: SurgeryIntelligenceBackfillInput;
    client?: SupabaseClient;
    options?: AnalyticsEventCoreOptions;
  },
  deps?: SurgeryIntelligenceBackfillDeps
): Promise<SurgeryIntelligenceBackfillRunResult> {
  const surgeries = await loadSurgeriesForIntelligenceBackfill({
    tenantId: input.tenantId,
    scope: input.scope,
    client: input.client,
  });

  const outcomes: SurgeryIntelligenceBackfillItemOutcome[] = [];
  for (const surgery of surgeries) {
    const outcome = await processSurgeryCaseIntelligenceBackfillItem(
      {
        tenantId: input.tenantId,
        surgeryId: surgery.id,
        caseId: surgery.case_id,
        dryRun: input.scope.dryRun,
        force: input.scope.force,
        client: input.client,
        options: input.options,
      },
      deps
    );
    outcomes.push(outcome);
  }

  return {
    outcomes,
    summary: aggregateSurgeryIntelligenceBackfillSummary({
      dryRun: input.scope.dryRun,
      scanned: surgeries.length,
      outcomes,
    }),
  };
}

export type { PublishSurgeryCaseIntelligenceFactsResult };
