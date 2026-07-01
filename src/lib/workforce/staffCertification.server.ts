import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  certificationNameToKey,
  evaluateCertificationExpiry,
} from "@/src/lib/workforce/credentialExpiryCore";
import type { StaffCertificationRecord } from "@/src/lib/workforce/workforceClinicalTypes";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

function mapCertificationRow(raw: Record<string, unknown>): StaffCertificationRecord {
  const name = String(raw.certification_name ?? raw.display_name ?? "Certification");
  const expiresAt = raw.expires_at != null ? String(raw.expires_at) : null;
  const expiry = evaluateCertificationExpiry({ expiresAt });
  return {
    id: String(raw.id),
    staffMemberId: String(raw.staff_member_id),
    certificationName: name,
    certificationKey: String(raw.certification_key),
    certificationType: raw.certification_type != null ? String(raw.certification_type) : null,
    issuingOrganization:
      raw.issuing_organization != null ? String(raw.issuing_organization) : null,
    issuedAt: raw.issued_at != null ? String(raw.issued_at) : null,
    expiresAt,
    competencyScore:
      raw.competency_score != null && !Number.isNaN(Number(raw.competency_score))
        ? Number(raw.competency_score)
        : null,
    verified: Boolean(raw.verified ?? false),
    isExpired: expiry.isExpired,
    isExpiringSoon: expiry.isDueSoon,
  };
}

async function insertCertificationAudit(
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

export async function createCertification(
  input: {
    tenantId: string;
    staffMemberId: string;
    fiStaffId?: string | null;
    certificationName: string;
    certificationType?: string | null;
    issuingOrganization?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    competencyScore?: number | null;
  },
  client?: SupabaseClient
): Promise<StaffCertificationRecord> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const name = input.certificationName.trim();
  const key = certificationNameToKey(name);
  const expiry = evaluateCertificationExpiry({ expiresAt: input.expiresAt ?? null });

  const row = {
    tenant_id: tid,
    staff_member_id: sid,
    fi_staff_id: input.fiStaffId ?? null,
    certification_name: name,
    certification_key: key,
    display_name: name,
    certification_type: input.certificationType?.trim() || "clinical",
    issuing_organization: input.issuingOrganization?.trim() || null,
    issued_at: input.issuedAt ?? null,
    expires_at: input.expiresAt ?? null,
    competency_score: input.competencyScore ?? null,
    verified: false,
    status: expiry.isExpired ? "expired" : expiry.isDueSoon ? "due_soon" : "current",
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("fi_staff_certifications")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertCertificationAudit(supabase, {
    tenant_id: tid,
    staff_member_id: sid,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.CERTIFICATION_UPSERTED,
    metadata: { certification_id: String((data as { id: string }).id), action: "create" },
  });

  return mapCertificationRow(data as Record<string, unknown>);
}

export async function verifyCertification(
  input: {
    tenantId: string;
    certificationId: string;
    verified: boolean;
    competencyScore?: number | null;
    verifiedBy?: string | null;
  },
  client?: SupabaseClient
): Promise<StaffCertificationRecord> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.certificationId, "certificationId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    verified: input.verified,
    updated_at: now,
  };
  if (input.competencyScore !== undefined) patch.competency_score = input.competencyScore;

  const { data, error } = await supabase
    .from("fi_staff_certifications")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", cid)
    .is("archived_at", null)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertCertificationAudit(supabase, {
    tenant_id: tid,
    staff_member_id: String((data as { staff_member_id: string }).staff_member_id),
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.CERTIFICATION_UPSERTED,
    metadata: { certification_id: cid, action: "verify", verified: input.verified },
  });

  return mapCertificationRow(data as Record<string, unknown>);
}

export async function loadCertificationHistory(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<StaffCertificationRecord[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_certifications")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .is("archived_at", null)
    .order("issued_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCertificationRow);
}

export async function loadExpiringCertifications(
  tenantId: string,
  withinDays = 30,
  client?: SupabaseClient
): Promise<StaffCertificationRecord[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const cutoff = new Date(Date.now() + withinDays * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("fi_staff_certifications")
    .select("*")
    .eq("tenant_id", tid)
    .is("archived_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", cutoff)
    .order("expires_at", { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(mapCertificationRow);
}

export async function syncStaffCertificationStatusesForMember(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<number> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_staff_certifications")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const expiry = evaluateCertificationExpiry({
      expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
      revoked: String(raw.status) === "revoked",
    });
    const nextStatus = expiry.isExpired
      ? "expired"
      : expiry.isDueSoon
        ? "due_soon"
        : "current";

    if (nextStatus !== String(raw.status)) {
      const { error: upErr } = await supabase
        .from("fi_staff_certifications")
        .update({ status: nextStatus, updated_at: now })
        .eq("tenant_id", tid)
        .eq("id", String(raw.id));
      if (upErr) throw new Error(upErr.message);
      updated += 1;
    }
  }
  return updated;
}