import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildFiPublicAppUrl } from "@/src/lib/fiOs/fiPublicAppUrlCore";

import {
  buildConsentAccessPath,
  channelFromDeviceFlag,
  classifyConsentTokenAccess,
  consentAccessTokenExpiresAt,
  patientSafeMessageForTokenOutcome,
  validateConsentSignInput,
  type ConsentTokenResolveOutcome,
} from "./consentAccessTokenCore";
import {
  generateConsentAccessToken,
  hashConsentAccessToken,
} from "./consentAccessTokenCrypto";
import type {
  ConsentChannel,
  ConsentFormKey,
  ConsentInstanceRow,
  ConsentTemplateRef,
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

function logConsentEvent(payload: {
  event: string;
  tenantId?: string;
  instanceId?: string;
  outcome?: string;
}): void {
  // Structured, no PHI (no names, no raw tokens).
  console.info(
    JSON.stringify({
      scope: "fi_consent",
      ...payload,
      ts: new Date().toISOString(),
    })
  );
}

export type IssueConsentLinkResult = {
  url: string;
  expiresAt: string;
  tokenId: string;
  path: string;
};

/**
 * Issue a patient e-sign link for an outstanding consent instance.
 * Raw token only returned in URL; DB stores SHA-256 hash.
 */
export async function issueConsentLink(input: {
  tenantId: string;
  patientId: string;
  instanceId: string;
  actorFiUserId?: string | null;
  clinicDevice?: boolean;
  client?: SupabaseClient;
}): Promise<IssueConsentLinkResult> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.instanceId.trim();
  const supabase = input.client ?? supabaseAdmin();

  const { data: instanceRow, error: instErr } = await supabase
    .from("fi_patient_consent_instances")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", iid)
    .maybeSingle();

  if (instErr) {
    if (isMissingRelationError(instErr.message)) {
      throw new Error("Consent framework is not migrated on this environment.");
    }
    throw new Error(instErr.message);
  }
  const instance = instanceRow ? mapInstance(instanceRow as Record<string, unknown>) : null;
  if (!instance) throw new Error("Consent instance not found.");
  if (instance.status !== "outstanding") {
    throw new Error("Only outstanding consents can receive a patient link.");
  }

  const rawToken = generateConsentAccessToken();
  const tokenHash = hashConsentAccessToken(rawToken);
  const expiresAt = consentAccessTokenExpiresAt();
  const expiresAtIso = expiresAt.toISOString();

  const { data: tokenRow, error: tokErr } = await supabase
    .from("fi_consent_access_tokens")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      instance_id: iid,
      token_hash: tokenHash,
      expires_at: expiresAtIso,
      created_by_fi_user_id: input.actorFiUserId ?? null,
      metadata: {
        clinic_device_default: Boolean(input.clinicDevice),
      },
    })
    .select("id")
    .maybeSingle();

  if (tokErr) {
    if (isMissingRelationError(tokErr.message)) {
      throw new Error("Consent access tokens are not migrated on this environment.");
    }
    throw new Error(tokErr.message);
  }

  const path = buildConsentAccessPath(rawToken, { clinicDevice: input.clinicDevice });
  const url = buildFiPublicAppUrl(path);

  logConsentEvent({
    event: "consent_link_issued",
    tenantId: tid,
    instanceId: iid,
    outcome: "ok",
  });

  return {
    url,
    expiresAt: expiresAtIso,
    tokenId: String((tokenRow as { id?: string } | null)?.id ?? ""),
    path,
  };
}

export type ResolveConsentTokenSuccess = {
  ok: true;
  outcome: "valid";
  tenantId: string;
  patientId: string;
  tokenId: string;
  instance: ConsentInstanceRow;
  template: ConsentTemplateRef | null;
  formTitle: string;
  formVersion: string;
  bodyMd: string;
};

export type ResolveConsentTokenFailure = {
  ok: false;
  outcome: Exclude<ConsentTokenResolveOutcome, "valid">;
  message: string;
};

export type ResolveConsentTokenResult = ResolveConsentTokenSuccess | ResolveConsentTokenFailure;

export async function resolveConsentToken(
  rawToken: string,
  client?: SupabaseClient
): Promise<ResolveConsentTokenResult> {
  const raw = rawToken?.trim() ?? "";
  if (!raw || raw.length < 16 || raw.length > 200) {
    return {
      ok: false,
      outcome: "not_found",
      message: patientSafeMessageForTokenOutcome("not_found"),
    };
  }

  const supabase = client ?? supabaseAdmin();
  const tokenHash = hashConsentAccessToken(raw);

  const { data: tokenRow, error: tokErr } = await supabase
    .from("fi_consent_access_tokens")
    .select("id, tenant_id, patient_id, instance_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokErr) {
    if (isMissingRelationError(tokErr.message)) {
      return {
        ok: false,
        outcome: "not_found",
        message: patientSafeMessageForTokenOutcome("not_found"),
      };
    }
    throw new Error(tokErr.message);
  }

  if (!tokenRow) {
    logConsentEvent({ event: "consent_token_resolve", outcome: "not_found" });
    return {
      ok: false,
      outcome: "not_found",
      message: patientSafeMessageForTokenOutcome("not_found"),
    };
  }

  const row = tokenRow as {
    id: string;
    tenant_id: string;
    patient_id: string;
    instance_id: string;
    expires_at: string;
    used_at: string | null;
  };

  const { data: instanceRow, error: instErr } = await supabase
    .from("fi_patient_consent_instances")
    .select("*")
    .eq("tenant_id", row.tenant_id)
    .eq("id", row.instance_id)
    .maybeSingle();

  if (instErr) throw new Error(instErr.message);
  const instance = instanceRow ? mapInstance(instanceRow as Record<string, unknown>) : null;

  const outcome = classifyConsentTokenAccess({
    tokenFound: true,
    expiresAt: row.expires_at,
    instanceStatus: instance?.status ?? null,
  });

  if (outcome !== "valid" || !instance) {
    logConsentEvent({
      event: "consent_token_resolve",
      tenantId: row.tenant_id,
      instanceId: row.instance_id,
      outcome,
    });
    return {
      ok: false,
      outcome: outcome === "valid" ? "not_found" : outcome,
      message: patientSafeMessageForTokenOutcome(outcome === "valid" ? "not_found" : outcome),
    };
  }

  let template: ConsentTemplateRef | null = null;
  if (instance.template_id) {
    const { data: tplRow } = await supabase
      .from("fi_consent_templates")
      .select("id, form_key, title, version, body_md, required_for, is_active")
      .eq("tenant_id", row.tenant_id)
      .eq("id", instance.template_id)
      .maybeSingle();
    if (tplRow) template = mapTemplate(tplRow as Record<string, unknown>);
  }

  if (!template) {
    const { data: activeTpl } = await supabase
      .from("fi_consent_templates")
      .select("id, form_key, title, version, body_md, required_for, is_active")
      .eq("tenant_id", row.tenant_id)
      .eq("form_key", instance.form_key)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeTpl) template = mapTemplate(activeTpl as Record<string, unknown>);
  }

  const formTitle = template?.title ?? CONSENT_FORM_KEY_TITLES[instance.form_key];
  const formVersion = instance.form_version || template?.version || "—";
  const bodyMd =
    template?.body_md ||
    `**DRAFT — not legal-final.**\n\nConsent form (${instance.form_key}). Contact the clinic if the full text is missing.`;

  return {
    ok: true,
    outcome: "valid",
    tenantId: row.tenant_id,
    patientId: row.patient_id,
    tokenId: row.id,
    instance,
    template,
    formTitle,
    formVersion,
    bodyMd,
  };
}

export type SignConsentViaTokenResult =
  | { ok: true; channel: ConsentChannel; tenantId: string; patientId: string; instanceId: string }
  | { ok: false; error: string; outcome?: ConsentTokenResolveOutcome };

/**
 * Patient signs via token. Marks instance signed + token used_at.
 */
export async function signConsentViaToken(input: {
  rawToken: string;
  signedName: string;
  agreed: boolean;
  clinicDevice?: boolean;
  client?: SupabaseClient;
}): Promise<SignConsentViaTokenResult> {
  const nameCheck = validateConsentSignInput({
    signedName: input.signedName,
    agreed: input.agreed,
  });
  if (!nameCheck.ok) {
    return { ok: false, error: nameCheck.error };
  }

  const resolved = await resolveConsentToken(input.rawToken, input.client);
  if (!resolved.ok) {
    return { ok: false, error: resolved.message, outcome: resolved.outcome };
  }

  const supabase = input.client ?? supabaseAdmin();
  const channel = channelFromDeviceFlag(Boolean(input.clinicDevice));
  const now = new Date().toISOString();
  const tid = resolved.tenantId;
  const pid = resolved.patientId;
  const iid = resolved.instance.id;

  const { data: updated, error: updErr } = await supabase
    .from("fi_patient_consent_instances")
    .update({
      status: "signed",
      channel,
      signed_at: now,
      signed_name: nameCheck.signedName,
      recorded_by_fi_user_id: null,
      updated_at: now,
      metadata: {
        ...(resolved.instance.metadata ?? {}),
        signed_via: "access_token",
        channel,
      },
    })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", iid)
    .eq("status", "outstanding")
    .select("id")
    .maybeSingle();

  if (updErr) {
    logConsentEvent({
      event: "consent_sign",
      tenantId: tid,
      instanceId: iid,
      outcome: "error",
    });
    return { ok: false, error: "We could not record this consent. Try again or contact the clinic." };
  }

  if (!updated) {
    // Race: already signed
    logConsentEvent({
      event: "consent_sign",
      tenantId: tid,
      instanceId: iid,
      outcome: "already_signed",
    });
    return {
      ok: false,
      error: patientSafeMessageForTokenOutcome("already_signed"),
      outcome: "already_signed",
    };
  }

  await supabase
    .from("fi_consent_access_tokens")
    .update({ used_at: now })
    .eq("id", resolved.tokenId)
    .eq("tenant_id", tid)
    .is("used_at", null);

  logConsentEvent({
    event: "consent_sign",
    tenantId: tid,
    instanceId: iid,
    outcome: "signed",
  });

  return { ok: true, channel, tenantId: tid, patientId: pid, instanceId: iid };
}

/**
 * True when patient has a signed instance for form_key (framework tables).
 * Fail-soft false if tables missing.
 */
export async function patientHasSignedConsentFormKey(
  tenantId: string,
  patientId: string,
  formKey: ConsentFormKey,
  client?: SupabaseClient
): Promise<boolean> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return false;
  const supabase = client ?? supabaseAdmin();

  const { count, error } = await supabase
    .from("fi_patient_consent_instances")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("form_key", formKey)
    .eq("status", "signed");

  if (error) {
    if (isMissingRelationError(error.message)) return false;
    throw new Error(error.message);
  }
  return (count ?? 0) > 0;
}
