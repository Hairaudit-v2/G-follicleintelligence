import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  computePatientConsentStatusSummary,
  planOutstandingConsentCreates,
  planOutstandingVersionSync,
  resolveRequiredConsentFormKeys,
  type ConsentResolverBookingSignal,
} from "./consentRequirementResolver";
import type {
  ConsentFormKey,
  ConsentInstanceRow,
  ConsentRequirementResolution,
  ConsentTemplateRef,
  PatientConsentStatusSummary,
  PatientRequiredConsentsPanelData,
  RequiredConsentPanelItem,
} from "./consentTypes";
import { CONSENT_FORM_KEY_TITLES, isConsentFormKey } from "./consentTypes";

function isMissingRelationError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table")
  );
}

function mapTemplate(row: Record<string, unknown>): ConsentTemplateRef | null {
  const formKey = String(row.form_key ?? "");
  if (!isConsentFormKey(formKey)) return null;
  return {
    id: String(row.id),
    form_key: formKey,
    title: String(row.title ?? CONSENT_FORM_KEY_TITLES[formKey]),
    version: String(row.version ?? ""),
    body_md: String(row.body_md ?? ""),
    required_for: Array.isArray(row.required_for)
      ? (row.required_for as unknown[]).map((x) => String(x))
      : [],
    is_active: row.is_active !== false,
  };
}

function mapInstance(row: Record<string, unknown>): ConsentInstanceRow | null {
  const formKey = String(row.form_key ?? "");
  if (!isConsentFormKey(formKey)) return null;
  const status = String(row.status ?? "");
  if (!["outstanding", "signed", "void", "declined"].includes(status)) return null;
  const channelRaw = row.channel == null ? null : String(row.channel);
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: String(row.patient_id),
    template_id: row.template_id == null ? null : String(row.template_id),
    form_key: formKey,
    form_version: String(row.form_version ?? ""),
    status: status as ConsentInstanceRow["status"],
    channel: channelRaw as ConsentInstanceRow["channel"],
    signed_at: row.signed_at == null ? null : String(row.signed_at),
    signed_name: row.signed_name == null ? null : String(row.signed_name),
    recorded_by_fi_user_id:
      row.recorded_by_fi_user_id == null ? null : String(row.recorded_by_fi_user_id),
    evidence_document_id:
      row.evidence_document_id == null ? null : String(row.evidence_document_id),
    related_booking_id:
      row.related_booking_id == null ? null : String(row.related_booking_id),
    related_case_id: row.related_case_id == null ? null : String(row.related_case_id),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function loadPatientStatusAndBookings(
  tenantId: string,
  patientId: string,
  client: SupabaseClient
): Promise<{
  patientStatus: string;
  bookings: ConsentResolverBookingSignal[];
  hasImaging: boolean;
}> {
  const [patientRes, bookingsRes, imagesRes] = await Promise.all([
    client
      .from("fi_patients")
      .select("patient_status")
      .eq("tenant_id", tenantId)
      .eq("id", patientId)
      .maybeSingle(),
    client
      .from("fi_bookings")
      .select("booking_type, title, booking_status")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .limit(200),
    client
      .from("fi_patient_images")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId),
  ]);

  if (patientRes.error) throw new Error(patientRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);

  const patientStatus = String(
    (patientRes.data as { patient_status?: string } | null)?.patient_status ?? "active"
  );

  const bookings: ConsentResolverBookingSignal[] = (bookingsRes.data ?? []).map((r) => {
    const row = r as {
      booking_type?: string;
      title?: string | null;
      booking_status?: string;
    };
    return {
      booking_type: row.booking_type,
      title: row.title,
      booking_status: row.booking_status,
    };
  });

  const hasImaging =
    !imagesRes.error && (imagesRes.count ?? 0) > 0;

  return { patientStatus, bookings, hasImaging };
}

export async function loadActiveConsentTemplates(
  tenantId: string,
  client?: SupabaseClient
): Promise<ConsentTemplateRef[]> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_consent_templates")
    .select("id, form_key, title, version, body_md, required_for, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) {
    if (isMissingRelationError(error.message)) return [];
    throw new Error(error.message);
  }

  const byKey = new Map<ConsentFormKey, ConsentTemplateRef>();
  for (const raw of data ?? []) {
    const t = mapTemplate(raw as Record<string, unknown>);
    if (!t) continue;
    // Prefer lexicographically latest version if multiple active for same key.
    const prev = byKey.get(t.form_key);
    if (!prev || t.version > prev.version) byKey.set(t.form_key, t);
  }
  return Array.from(byKey.values());
}

export async function loadPatientConsentInstances(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<ConsentInstanceRow[]> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_consent_instances")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingRelationError(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((r) => mapInstance(r as Record<string, unknown>))
    .filter((x): x is ConsentInstanceRow => x != null);
}

/**
 * Resolve required form_keys from patient context (status, bookings, imaging).
 */
export async function resolvePatientConsentRequirements(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<ConsentRequirementResolution> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const supabase = client ?? supabaseAdmin();
  const ctx = await loadPatientStatusAndBookings(tid, pid, supabase);
  return resolveRequiredConsentFormKeys({
    patientStatus: ctx.patientStatus,
    bookings: ctx.bookings,
    hasImaging: ctx.hasImaging,
  });
}

/**
 * Ensure outstanding instances exist for each required form_key + active template version.
 * Idempotent; does not void signed rows; does not duplicate outstanding rows.
 */
export async function ensureOutstandingConsentInstances(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<{ created: number; requiredFormKeys: ConsentFormKey[] }> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return { created: 0, requiredFormKeys: [] };

  const supabase = client ?? supabaseAdmin();

  let requirements: ConsentRequirementResolution;
  try {
    requirements = await resolvePatientConsentRequirements(tid, pid, supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingRelationError(msg)) return { created: 0, requiredFormKeys: [] };
    throw e;
  }

  const [templates, instances] = await Promise.all([
    loadActiveConsentTemplates(tid, supabase),
    loadPatientConsentInstances(tid, pid, supabase),
  ]);

  if (templates.length === 0 && instances.length === 0) {
    // Tables empty or missing seed — nothing to create.
    return { created: 0, requiredFormKeys: requirements.requiredFormKeys };
  }

  const activeTemplatesByKey: Partial<
    Record<ConsentFormKey, { version: string; templateId: string }>
  > = {};
  for (const t of templates) {
    activeTemplatesByKey[t.form_key] = { version: t.version, templateId: t.id };
  }

  const existingLite = instances.map((i) => ({
    form_key: i.form_key,
    form_version: i.form_version,
    status: i.status,
  }));

  const plan = planOutstandingConsentCreates({
    requiredFormKeys: requirements.requiredFormKeys,
    activeTemplatesByKey,
    existingInstances: existingLite,
  });

  const versionSync = planOutstandingVersionSync({
    requiredFormKeys: requirements.requiredFormKeys,
    activeTemplatesByKey,
    existingInstances: existingLite,
  });

  const now = new Date().toISOString();
  let created = 0;

  if (versionSync.length > 0) {
    for (const p of versionSync) {
      const { error: syncErr } = await supabase
        .from("fi_patient_consent_instances")
        .update({
          form_version: p.formVersion,
          template_id: p.templateId,
          updated_at: now,
        })
        .eq("tenant_id", tid)
        .eq("patient_id", pid)
        .eq("form_key", p.formKey)
        .eq("status", "outstanding");
      if (syncErr && !isMissingRelationError(syncErr.message)) {
        throw new Error(syncErr.message);
      }
    }
  }

  if (plan.length === 0) {
    return { created: 0, requiredFormKeys: requirements.requiredFormKeys };
  }

  const rows = plan.map((p) => ({
    tenant_id: tid,
    patient_id: pid,
    template_id: p.templateId,
    form_key: p.formKey,
    form_version: p.formVersion,
    status: "outstanding" as const,
    channel: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  }));

  const { error } = await supabase.from("fi_patient_consent_instances").insert(rows);
  if (error) {
    // Unique partial index race / concurrent ensure — treat as idempotent success.
    if (
      error.message?.toLowerCase().includes("duplicate") ||
      error.code === "23505"
    ) {
      return { created: 0, requiredFormKeys: requirements.requiredFormKeys };
    }
    if (isMissingRelationError(error.message)) {
      return { created: 0, requiredFormKeys: requirements.requiredFormKeys };
    }
    throw new Error(error.message);
  }

  created = rows.length;
  return { created, requiredFormKeys: requirements.requiredFormKeys };
}

/**
 * Summary helper for readiness / photo wiring (Sprint A export).
 */
export async function getPatientConsentStatusSummary(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientConsentStatusSummary> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const supabase = client ?? supabaseAdmin();

  try {
    await ensureOutstandingConsentInstances(tid, pid, supabase);
    const requirements = await resolvePatientConsentRequirements(tid, pid, supabase);
    const instances = await loadPatientConsentInstances(tid, pid, supabase);
    return computePatientConsentStatusSummary({
      requiredFormKeys: requirements.requiredFormKeys,
      instances: instances.map((i) => ({ form_key: i.form_key, status: i.status })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingRelationError(msg)) {
      return {
        required: [],
        signed: [],
        outstanding: [],
        allRequiredSigned: false,
      };
    }
    throw e;
  }
}

/**
 * Staff panel payload: ensure instances, then list required forms with status.
 * Fail-soft when tables are missing.
 */
export async function loadPatientRequiredConsentsPanelData(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientRequiredConsentsPanelData> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const supabase = client ?? supabaseAdmin();

  try {
    await ensureOutstandingConsentInstances(tid, pid, supabase);
    const [requirements, templates, instances] = await Promise.all([
      resolvePatientConsentRequirements(tid, pid, supabase),
      loadActiveConsentTemplates(tid, supabase),
      loadPatientConsentInstances(tid, pid, supabase),
    ]);

    const templateByKey = new Map(templates.map((t) => [t.form_key, t]));
    const summary = computePatientConsentStatusSummary({
      requiredFormKeys: requirements.requiredFormKeys,
      instances: instances.map((i) => ({ form_key: i.form_key, status: i.status })),
    });

    const items: RequiredConsentPanelItem[] = requirements.requiredFormKeys.map((formKey) => {
      const template = templateByKey.get(formKey);
      const signed = instances.find((i) => i.form_key === formKey && i.status === "signed");
      const outstanding = instances.find(
        (i) => i.form_key === formKey && i.status === "outstanding"
      );

      if (signed) {
        return {
          formKey,
          title: template?.title ?? CONSENT_FORM_KEY_TITLES[formKey],
          version: signed.form_version,
          status: "signed" as const,
          reasons: requirements.reasons[formKey] ?? [],
          instanceId: signed.id,
          signedAt: signed.signed_at,
          signedName: signed.signed_name,
          templateId: signed.template_id ?? template?.id ?? null,
          bodyPreview: template?.body_md?.slice(0, 280) ?? null,
        };
      }

      if (!template) {
        return {
          formKey,
          title: CONSENT_FORM_KEY_TITLES[formKey],
          version: "—",
          status: "missing_template" as const,
          reasons: requirements.reasons[formKey] ?? [],
          instanceId: outstanding?.id ?? null,
          signedAt: null,
          signedName: null,
          templateId: null,
          bodyPreview: null,
        };
      }

      return {
        formKey,
        title: template.title,
        version: template.version,
        status: "outstanding" as const,
        reasons: requirements.reasons[formKey] ?? [],
        instanceId: outstanding?.id ?? null,
        signedAt: null,
        signedName: null,
        templateId: template.id,
        bodyPreview: template.body_md.slice(0, 280),
      };
    });

    return {
      ok: true,
      items,
      allRequiredSigned: summary.allRequiredSigned,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingRelationError(msg)) {
      return {
        ok: false,
        unavailable: true,
        message:
          "Consent framework tables are not available yet. Apply the Sprint A migration, then refresh.",
        items: [],
        allRequiredSigned: false,
      };
    }
    return {
      ok: false,
      unavailable: true,
      message: "Could not load required consents. Try again shortly.",
      items: [],
      allRequiredSigned: false,
    };
  }
}

/**
 * Mark an outstanding instance as staff-assisted signed (Sprint A interim until patient link).
 */
export async function recordStaffAssistedConsentSignature(input: {
  tenantId: string;
  patientId: string;
  instanceId: string;
  recordedByFiUserId: string | null;
  signedName?: string | null;
  client?: SupabaseClient;
}): Promise<ConsentInstanceRow> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.instanceId.trim();
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const signedName =
    input.signedName?.trim() || "Staff-assisted record";

  const { data, error } = await supabase
    .from("fi_patient_consent_instances")
    .update({
      status: "signed",
      channel: "staff_assisted",
      signed_at: now,
      signed_name: signedName,
      recorded_by_fi_user_id: input.recordedByFiUserId,
      updated_at: now,
      metadata: {
        sprint_a_interim: true,
        recorded_channel: "staff_assisted",
      },
    })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", iid)
    .eq("status", "outstanding")
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) {
      throw new Error("Consent framework is not migrated on this environment.");
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Outstanding consent instance not found or already signed.");
  }

  const mapped = mapInstance(data as Record<string, unknown>);
  if (!mapped) throw new Error("Consent instance mapping failed.");
  return mapped;
}
