import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiSourceSystem } from "@/src/types/fi-events";

export type IntakeUpsertInput = {
  full_name: string;
  email: string;
  dob: string;
  sex: string;
  country?: string | null;
  primary_concern?: string | null;
  selections?: Record<string, unknown>;
  notes?: string | null;
};

export type FiGlobalPatientRow = {
  id: string;
  tenant_id: string;
  source_system: FiSourceSystem | string;
  source_patient_id: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiGlobalCaseRow = {
  id: string;
  tenant_id: string;
  source_system: FiSourceSystem | string;
  source_case_id: string;
  global_patient_id: string | null;
  fi_case_id: string | null;
  status: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiEventLinkRow = {
  id: string;
  event_id: string;
  global_case_id: string | null;
  fi_case_id: string | null;
  global_patient_id: string | null;
  created_at: string;
};

function buildCaseExternalId(sourceSystem: FiSourceSystem | string, sourceCaseId: string): string {
  return `${sourceSystem}:${sourceCaseId}`;
}

function normalizeSparseText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isPlaceholderIntakeValue(
  field: keyof IntakeUpsertInput,
  value: string | null | undefined
): boolean {
  if (!value) return false;
  if (field === "email") return value.endsWith("@local.invalid");
  if (field === "dob") return value === "1900-01-01";
  if (field === "sex") return value === "unknown";
  if (field === "full_name") return /\bCase\b/.test(value);
  return false;
}

function normalizeSourceId(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function shallowAdditiveMerge(
  existing: Record<string, unknown>,
  incoming?: Record<string, unknown>
): Record<string, unknown> {
  if (!incoming || Object.keys(incoming).length === 0) return existing;
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (!(key in merged) && value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

function globalPatientColumns() {
  return "id, tenant_id, source_system, source_patient_id, metadata_json, created_at, updated_at";
}

function globalCaseColumns() {
  return "id, tenant_id, source_system, source_case_id, global_patient_id, fi_case_id, status, metadata_json, created_at, updated_at";
}

function eventLinkColumns() {
  return "id, event_id, global_case_id, fi_case_id, global_patient_id, created_at";
}

export function buildPlaceholderIntake(
  sourceSystem: FiSourceSystem | string,
  sourceCaseId: string,
  seed?: Partial<IntakeUpsertInput>
): IntakeUpsertInput {
  const safeCaseId = sourceCaseId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "case";
  return {
    full_name: normalizeSparseText(seed?.full_name) ?? `${String(sourceSystem).toUpperCase()} Case ${sourceCaseId}`,
    email: normalizeSparseText(seed?.email) ?? `${sourceSystem}-${safeCaseId}@local.invalid`,
    dob: normalizeSparseText(seed?.dob) ?? "1900-01-01",
    sex: normalizeSparseText(seed?.sex) ?? "unknown",
    country: normalizeSparseText(seed?.country) ?? null,
    primary_concern: normalizeSparseText(seed?.primary_concern) ?? null,
    selections: seed?.selections ?? {},
    notes: normalizeSparseText(seed?.notes) ?? null,
  };
}

export async function resolveOrCreateGlobalPatient(params: {
  tenantId: string;
  sourceSystem: FiSourceSystem | string;
  sourcePatientId?: string | null;
  metadataJson?: Record<string, unknown>;
}): Promise<FiGlobalPatientRow | null> {
  const supabase = supabaseAdmin();
  const sourcePatientId = normalizeSourceId(params.sourcePatientId);
  if (!sourcePatientId) return null;

  const existing = await supabase
    .from("fi_global_patients")
    .select(globalPatientColumns())
    .eq("tenant_id", params.tenantId)
    .eq("source_system", params.sourceSystem)
    .eq("source_patient_id", sourcePatientId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    const existingRow = existing.data as unknown as FiGlobalPatientRow;
    const mergedMetadata = shallowAdditiveMerge(existingRow.metadata_json ?? {}, params.metadataJson);
    if (JSON.stringify(mergedMetadata) !== JSON.stringify(existingRow.metadata_json ?? {})) {
      const updated = await supabase
        .from("fi_global_patients")
        .update({
          metadata_json: mergedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRow.id)
        .select(globalPatientColumns())
        .single();

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message ?? "Failed to update global patient metadata.");
      }

      return updated.data as unknown as FiGlobalPatientRow;
    }

    return existingRow;
  }

  const inserted = await supabase
    .from("fi_global_patients")
    .insert({
      tenant_id: params.tenantId,
      source_system: params.sourceSystem,
      source_patient_id: sourcePatientId,
      metadata_json: params.metadataJson ?? {},
    })
    .select(globalPatientColumns())
    .single();

  if (!inserted.error && inserted.data) {
    return inserted.data as unknown as FiGlobalPatientRow;
  }

  if (inserted.error?.code !== "23505") {
    throw new Error(inserted.error?.message ?? "Failed to create global patient.");
  }

  const raced = await supabase
    .from("fi_global_patients")
    .select(globalPatientColumns())
    .eq("tenant_id", params.tenantId)
    .eq("source_system", params.sourceSystem)
    .eq("source_patient_id", sourcePatientId)
    .single();

  if (raced.error || !raced.data) {
    throw new Error(raced.error?.message ?? "Failed to load raced global patient.");
  }

  return raced.data as unknown as FiGlobalPatientRow;
}

export async function resolveOrCreateGlobalCase(params: {
  tenantId: string;
  sourceSystem: FiSourceSystem | string;
  sourceCaseId?: string | null;
  globalPatientId?: string | null;
  fiCaseId?: string | null;
  metadataJson?: Record<string, unknown>;
}): Promise<FiGlobalCaseRow> {
  const supabase = supabaseAdmin();
  const sourceCaseId = normalizeSourceId(params.sourceCaseId);
  if (!sourceCaseId) throw new Error("sourceCaseId is required to resolve or create a global case.");

  const existing = await supabase
    .from("fi_global_cases")
    .select(globalCaseColumns())
    .eq("tenant_id", params.tenantId)
    .eq("source_system", params.sourceSystem)
    .eq("source_case_id", sourceCaseId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    const existingRow = existing.data as unknown as FiGlobalCaseRow;
    const updates: Record<string, unknown> = {};

    if (!existingRow.global_patient_id && params.globalPatientId) {
      updates.global_patient_id = params.globalPatientId;
    }
    if (!existingRow.fi_case_id && params.fiCaseId) {
      updates.fi_case_id = params.fiCaseId;
    }

    const mergedMetadata = shallowAdditiveMerge(existingRow.metadata_json ?? {}, params.metadataJson);
    if (JSON.stringify(mergedMetadata) !== JSON.stringify(existingRow.metadata_json ?? {})) {
      updates.metadata_json = mergedMetadata;
    }

    if (Object.keys(updates).length === 0) {
      return existingRow;
    }

    updates.updated_at = new Date().toISOString();
    const updated = await supabase
      .from("fi_global_cases")
      .update(updates)
      .eq("id", existingRow.id)
      .select(globalCaseColumns())
      .single();

    if (updated.error || !updated.data) {
      throw new Error(updated.error?.message ?? "Failed to update global case.");
    }

    return updated.data as unknown as FiGlobalCaseRow;
  }

  const inserted = await supabase
    .from("fi_global_cases")
    .insert({
      tenant_id: params.tenantId,
      source_system: params.sourceSystem,
      source_case_id: sourceCaseId,
      global_patient_id: params.globalPatientId ?? null,
      fi_case_id: params.fiCaseId ?? null,
      metadata_json: params.metadataJson ?? {},
    })
    .select(globalCaseColumns())
    .single();

  if (!inserted.error && inserted.data) {
    return inserted.data as unknown as FiGlobalCaseRow;
  }

  if (inserted.error?.code !== "23505") {
    throw new Error(inserted.error?.message ?? "Failed to create global case.");
  }

  const raced = await supabase
    .from("fi_global_cases")
    .select(globalCaseColumns())
    .eq("tenant_id", params.tenantId)
    .eq("source_system", params.sourceSystem)
    .eq("source_case_id", sourceCaseId)
    .single();

  if (raced.error || !raced.data) {
    throw new Error(raced.error?.message ?? "Failed to load raced global case.");
  }

  const racedRow = raced.data as unknown as FiGlobalCaseRow;
  if ((!racedRow.global_patient_id && params.globalPatientId) || (!racedRow.fi_case_id && params.fiCaseId)) {
    const updates: Record<string, unknown> = {};
    if (!racedRow.global_patient_id && params.globalPatientId) {
      updates.global_patient_id = params.globalPatientId;
    }
    if (!racedRow.fi_case_id && params.fiCaseId) {
      updates.fi_case_id = params.fiCaseId;
    }
    const mergedMetadata = shallowAdditiveMerge(racedRow.metadata_json ?? {}, params.metadataJson);
    if (JSON.stringify(mergedMetadata) !== JSON.stringify(racedRow.metadata_json ?? {})) {
      updates.metadata_json = mergedMetadata;
    }
    updates.updated_at = new Date().toISOString();

    const updated = await supabase
      .from("fi_global_cases")
      .update(updates)
      .eq("id", racedRow.id)
      .select(globalCaseColumns())
      .single();

    if (updated.error || !updated.data) {
      throw new Error(updated.error?.message ?? "Failed to enrich raced global case.");
    }

    return updated.data as unknown as FiGlobalCaseRow;
  }

  return racedRow;
}

export async function attachFiCaseIdToGlobalCase(params: {
  globalCaseId: string;
  fiCaseId: string;
}): Promise<FiGlobalCaseRow> {
  const supabase = supabaseAdmin();
  const existing = await supabase
    .from("fi_global_cases")
    .select(globalCaseColumns())
    .eq("id", params.globalCaseId)
    .single();

  if (existing.error || !existing.data) {
    throw new Error(existing.error?.message ?? "Global case not found.");
  }

  const row = existing.data as unknown as FiGlobalCaseRow;
  if (row.fi_case_id === params.fiCaseId) return row;
  if (row.fi_case_id && row.fi_case_id !== params.fiCaseId) {
    throw new Error(`Global case ${params.globalCaseId} is already linked to a different fi_case_id.`);
  }

  const updated = await supabase
    .from("fi_global_cases")
    .update({
      fi_case_id: params.fiCaseId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.globalCaseId)
    .select(globalCaseColumns())
    .single();

  if (updated.error || !updated.data) {
    throw new Error(updated.error?.message ?? "Failed to attach fi_case_id to global case.");
  }

  return updated.data as unknown as FiGlobalCaseRow;
}

export async function linkEventToEntities(params: {
  eventId: string;
  globalCaseId?: string | null;
  fiCaseId?: string | null;
  globalPatientId?: string | null;
}): Promise<FiEventLinkRow> {
  const supabase = supabaseAdmin();
  const globalCaseId = normalizeSourceId(params.globalCaseId);
  const fiCaseId = normalizeSourceId(params.fiCaseId);
  const globalPatientId = normalizeSourceId(params.globalPatientId);

  const existingLinks = await supabase
    .from("fi_event_links")
    .select(eventLinkColumns())
    .eq("event_id", params.eventId);

  if (existingLinks.error) throw new Error(existingLinks.error.message);

  const exact = ((existingLinks.data ?? []) as unknown as FiEventLinkRow[]).find(
    (row) =>
      (row.global_case_id ?? null) === globalCaseId &&
      (row.fi_case_id ?? null) === fiCaseId &&
      (row.global_patient_id ?? null) === globalPatientId
  );
  if (exact) return exact;

  const inserted = await supabase
    .from("fi_event_links")
    .insert({
      event_id: params.eventId,
      global_case_id: globalCaseId,
      fi_case_id: fiCaseId,
      global_patient_id: globalPatientId,
    })
    .select(eventLinkColumns())
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? "Failed to insert fi_event_links row.");
  }

  return inserted.data as unknown as FiEventLinkRow;
}

export async function ensureFiCase(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    sourceSystem: FiSourceSystem | string;
    sourceCaseId: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ id: string; status: string }> {
  const externalId = buildCaseExternalId(input.sourceSystem, input.sourceCaseId);

  const existing = await supabase
    .from("fi_cases")
    .select("id, status")
    .eq("tenant_id", input.tenantId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing.data) {
    return { id: existing.data.id, status: existing.data.status };
  }

  const inserted = await supabase
    .from("fi_cases")
    .insert({
      tenant_id: input.tenantId,
      external_id: externalId,
      status: input.status ?? "draft",
      metadata: {
        source_system: input.sourceSystem,
        source_case_id: input.sourceCaseId,
        ...(input.metadata ?? {}),
      },
    })
    .select("id, status")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? "Failed to create FI case.");
  }

  return { id: inserted.data.id, status: inserted.data.status };
}

export async function ensureFiIntake(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    caseId: string;
    intake: IntakeUpsertInput;
  }
): Promise<void> {
  const existing = await supabase
    .from("fi_intakes")
    .select(
      "full_name, email, dob, sex, country, primary_concern, selections, notes"
    )
    .eq("tenant_id", input.tenantId)
    .eq("case_id", input.caseId)
    .maybeSingle();

  const existingSelections =
    existing.data?.selections &&
    typeof existing.data.selections === "object" &&
    !Array.isArray(existing.data.selections)
      ? (existing.data.selections as Record<string, unknown>)
      : {};

  const resolvedFullName =
    existing.data?.full_name && isPlaceholderIntakeValue("full_name", input.intake.full_name)
      ? existing.data.full_name
      : input.intake.full_name || existing.data?.full_name || "";
  const resolvedEmail =
    existing.data?.email && isPlaceholderIntakeValue("email", input.intake.email)
      ? existing.data.email
      : input.intake.email || existing.data?.email || "";
  const resolvedDob =
    existing.data?.dob && isPlaceholderIntakeValue("dob", input.intake.dob)
      ? existing.data.dob
      : input.intake.dob || existing.data?.dob || "";
  const resolvedSex =
    existing.data?.sex && isPlaceholderIntakeValue("sex", input.intake.sex)
      ? existing.data.sex
      : input.intake.sex || existing.data?.sex || "";

  const row = {
    tenant_id: input.tenantId,
    case_id: input.caseId,
    full_name: resolvedFullName,
    email: resolvedEmail,
    dob: resolvedDob,
    sex: resolvedSex,
    country: input.intake.country ?? existing.data?.country ?? null,
    primary_concern:
      input.intake.primary_concern ?? existing.data?.primary_concern ?? null,
    selections: {
      ...existingSelections,
      ...(input.intake.selections ?? {}),
    },
    notes: input.intake.notes ?? existing.data?.notes ?? null,
  };

  const { error } = await supabase.from("fi_intakes").upsert(row, {
    onConflict: "case_id",
    ignoreDuplicates: false,
  });

  if (error) throw new Error(error.message);
}

export async function ensureGlobalPatient(
  _supabase: SupabaseClient,
  input: {
    tenantId: string;
    sourceSystem: FiSourceSystem | string;
    sourcePatientId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  const row = await resolveOrCreateGlobalPatient({
    tenantId: input.tenantId,
    sourceSystem: input.sourceSystem,
    sourcePatientId: input.sourcePatientId,
    metadataJson: input.metadata,
  });
  return row?.id ?? null;
}

export async function ensureGlobalCase(
  _supabase: SupabaseClient,
  input: {
    tenantId: string;
    sourceSystem: FiSourceSystem | string;
    sourceCaseId: string;
    fiCaseId: string;
    globalPatientId?: string | null;
    status?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const row = await resolveOrCreateGlobalCase({
    tenantId: input.tenantId,
    sourceSystem: input.sourceSystem,
    sourceCaseId: input.sourceCaseId,
    fiCaseId: input.fiCaseId,
    globalPatientId: input.globalPatientId,
    metadataJson: {
      ...(input.metadata ?? {}),
      ...(input.status ? { status_hint: input.status } : {}),
    },
  });
  return row.id;
}

export async function ensureUploadRecord(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    caseId: string;
    type: string;
    filename: string;
    storagePath: string;
    mimeType?: string;
    sizeBytes?: number;
  }
): Promise<{ id: string; created: boolean }> {
  const existing = await supabase
    .from("fi_uploads")
    .select("id, type")
    .eq("tenant_id", input.tenantId)
    .eq("case_id", input.caseId)
    .eq("storage_path", input.storagePath)
    .maybeSingle();

  if (existing.data?.id) {
    return { id: existing.data.id, created: false };
  }

  const inserted = await supabase
    .from("fi_uploads")
    .insert({
      tenant_id: input.tenantId,
      case_id: input.caseId,
      type: input.type,
      filename: input.filename,
      storage_path: input.storagePath,
      mime_type: input.mimeType ?? "application/octet-stream",
      size_bytes: input.sizeBytes ?? null,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Failed to insert upload.");
  return { id: inserted.data.id, created: true };
}
