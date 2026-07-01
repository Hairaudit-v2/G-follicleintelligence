import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  credentialTypeToKey,
  evaluateCredentialExpiry,
} from "@/src/lib/workforce/credentialExpiryCore";
import type { StaffCredentialRecord } from "@/src/lib/workforce/workforceClinicalTypes";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

function mapCredentialRow(raw: Record<string, unknown>): StaffCredentialRecord {
  const credentialType = String(raw.credential_type);
  const displayName = String(raw.display_name ?? credentialType);
  return {
    id: String(raw.id),
    staffMemberId: String(raw.staff_member_id),
    credentialType,
    credentialKey: String(raw.credential_key),
    displayName,
    issuingBody:
      raw.issuing_body != null
        ? String(raw.issuing_body)
        : raw.issuing_authority != null
          ? String(raw.issuing_authority)
          : null,
    credentialNumber:
      raw.credential_number != null
        ? String(raw.credential_number)
        : raw.license_number != null
          ? String(raw.license_number)
          : null,
    issuedAt: raw.issued_at != null ? String(raw.issued_at) : null,
    expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
    status: String(raw.status) as StaffCredentialRecord["status"],
    reminderSent: Boolean(raw.reminder_sent ?? false),
    blocksClinicalWork: Boolean(raw.blocks_clinical_work ?? true),
  };
}

async function insertCredentialAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    event_type: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: row.event_type,
    source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function loadStaffCredentials(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<StaffCredentialRecord[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_credentials")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .is("archived_at", null)
    .order("expires_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCredentialRow);
}

/** @deprecated Use loadStaffCredentials */
export const loadStaffCredentialsForMember = loadStaffCredentials;

export async function createStaffCredential(
  input: {
    tenantId: string;
    staffMemberId: string;
    fiStaffId?: string | null;
    credentialType: string;
    issuingBody?: string | null;
    credentialNumber?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    blocksClinicalWork?: boolean;
    createdBy?: string | null;
  },
  client?: SupabaseClient
): Promise<StaffCredentialRecord> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const credentialKey = credentialTypeToKey(input.credentialType);
  const displayName = input.credentialType.trim();

  const evaluation = evaluateCredentialExpiry({
    expiresAt: input.expiresAt ?? null,
    blocksClinicalWork: input.blocksClinicalWork ?? true,
  });

  const row = {
    tenant_id: tid,
    staff_member_id: sid,
    fi_staff_id: input.fiStaffId ?? null,
    credential_type: displayName,
    credential_key: credentialKey,
    display_name: displayName,
    issuing_body: input.issuingBody?.trim() || null,
    issuing_authority: input.issuingBody?.trim() || null,
    credential_number: input.credentialNumber?.trim() || null,
    license_number: input.credentialNumber?.trim() || null,
    issued_at: input.issuedAt ?? null,
    expires_at: input.expiresAt ?? null,
    status: evaluation.status,
    blocks_clinical_work: input.blocksClinicalWork ?? true,
    reminder_sent: false,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("fi_staff_credentials")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertCredentialAudit(supabase, {
    tenant_id: tid,
    staff_member_id: sid,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.CREDENTIAL_UPSERTED,
    metadata: { credential_id: String((data as { id: string }).id), action: "create" },
  });

  return mapCredentialRow(data as Record<string, unknown>);
}

export async function updateStaffCredential(
  input: {
    tenantId: string;
    credentialId: string;
    issuingBody?: string | null;
    credentialNumber?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    status?: string | null;
    reminderSent?: boolean;
    updatedBy?: string | null;
  },
  client?: SupabaseClient
): Promise<StaffCredentialRecord> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.credentialId, "credentialId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: loadErr } = await supabase
    .from("fi_staff_credentials")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .is("archived_at", null)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error("Credential not found.");

  const raw = existing as Record<string, unknown>;
  const revoked = String(raw.status) === "revoked";
  const suspended = String(raw.status) === "suspended";
  const expiresAt =
    input.expiresAt !== undefined ? input.expiresAt : raw.expires_at != null ? String(raw.expires_at) : null;

  const evaluation = evaluateCredentialExpiry({
    expiresAt,
    revoked,
    suspended,
    blocksClinicalWork: Boolean(raw.blocks_clinical_work ?? true),
  });

  const patch: Record<string, unknown> = {
    updated_at: now,
    status: input.status?.trim() || evaluation.status,
  };
  if (input.issuingBody !== undefined) {
    patch.issuing_body = input.issuingBody?.trim() || null;
    patch.issuing_authority = input.issuingBody?.trim() || null;
  }
  if (input.credentialNumber !== undefined) {
    patch.credential_number = input.credentialNumber?.trim() || null;
    patch.license_number = input.credentialNumber?.trim() || null;
  }
  if (input.issuedAt !== undefined) patch.issued_at = input.issuedAt;
  if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt;
  if (input.reminderSent !== undefined) patch.reminder_sent = input.reminderSent;

  const { data, error } = await supabase
    .from("fi_staff_credentials")
    .update(patch)
    .eq("id", cid)
    .eq("tenant_id", tid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertCredentialAudit(supabase, {
    tenant_id: tid,
    staff_member_id: String((data as { staff_member_id: string }).staff_member_id),
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.CREDENTIAL_UPSERTED,
    metadata: { credential_id: cid, action: "update" },
  });

  return mapCredentialRow(data as Record<string, unknown>);
}

export async function checkExpiringCredentials(
  tenantId: string,
  client?: SupabaseClient
): Promise<{ updated: number; expiringSoon: number; expired: number }> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_staff_credentials")
    .select("*")
    .eq("tenant_id", tid)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  let updated = 0;
  let expiringSoon = 0;
  let expired = 0;

  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const evaluation = evaluateCredentialExpiry({
      expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
      revoked: String(raw.status) === "revoked",
      suspended: String(raw.status) === "suspended",
      blocksClinicalWork: Boolean(raw.blocks_clinical_work ?? true),
    });

    if (evaluation.status === "expiring_soon") expiringSoon += 1;
    if (evaluation.status === "expired") expired += 1;

    const preserved =
      String(raw.status) === "revoked" || String(raw.status) === "suspended"
        ? String(raw.status)
        : evaluation.status;

    if (preserved !== String(raw.status)) {
      const { error: upErr } = await supabase
        .from("fi_staff_credentials")
        .update({ status: preserved, updated_at: now })
        .eq("tenant_id", tid)
        .eq("id", String(raw.id));
      if (upErr) throw new Error(upErr.message);
      updated += 1;
    }
  }

  return { updated, expiringSoon, expired };
}

export async function syncStaffCredentialStatusesForMember(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<number> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_staff_credentials")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const evaluation = evaluateCredentialExpiry({
      expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
      revoked: String(raw.status) === "revoked",
      suspended: String(raw.status) === "suspended",
      blocksClinicalWork: Boolean(raw.blocks_clinical_work ?? true),
    });
    const nextStatus =
      String(raw.status) === "revoked" || String(raw.status) === "suspended"
        ? String(raw.status)
        : evaluation.status;

    if (nextStatus !== String(raw.status)) {
      const { error: upErr } = await supabase
        .from("fi_staff_credentials")
        .update({ status: nextStatus, updated_at: now })
        .eq("tenant_id", tid)
        .eq("id", String(raw.id));
      if (upErr) throw new Error(upErr.message);
      updated += 1;
    }
  }
  return updated;
}