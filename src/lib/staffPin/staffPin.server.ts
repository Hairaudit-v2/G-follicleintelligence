import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { insertFiStaffPinAuditEvent } from "./staffPinAudit.server";
import { hashStaffPin, verifyStaffPinHash } from "./staffPinCrypto";
import {
  STAFF_PIN_LOGIN_FAILURE_MESSAGE,
  nextFailedPinAttemptState,
  resolveStaffPinPublicStatus,
  type StaffPinPublicStatus,
} from "./staffPinPolicy";
import { assertStaffPinFormat } from "./staffPinValidation";

export type StaffPinMetadata = {
  staffId: string;
  status: StaffPinPublicStatus;
  isActive: boolean;
  failedAttemptCount: number;
  lockedUntil: string | null;
  lastUsedAt: string | null;
  updatedAt: string | null;
};

type PinRow = {
  id: string;
  tenant_id: string;
  staff_id: string;
  pin_hash: string;
  pin_salt: string;
  is_active: boolean;
  failed_attempt_count: number;
  locked_until: string | null;
  last_used_at: string | null;
  updated_at: string | null;
};

async function loadPinRow(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<PinRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_pins")
    .select(
      "id, tenant_id, staff_id, pin_hash, pin_salt, is_active, failed_attempt_count, locked_until, last_used_at, updated_at"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("staff_id", staffId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as PinRow;
}

async function assertActiveStaffMember(
  tenantId: string,
  staffId: string
): Promise<{ full_name: string; staff_role: string }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("full_name, staff_role, is_active")
    .eq("tenant_id", tenantId.trim())
    .eq("id", staffId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Staff member not found.");
  const row = data as { full_name: string; staff_role: string; is_active: boolean };
  if (!row.is_active) throw new Error("Staff member is inactive.");
  return { full_name: String(row.full_name), staff_role: String(row.staff_role) };
}

export async function loadStaffPinMetadataForStaff(
  tenantId: string,
  staffId: string
): Promise<StaffPinMetadata> {
  const row = await loadPinRow(tenantId, staffId);
  const status = resolveStaffPinPublicStatus({
    hasPinRow: Boolean(row),
    isActive: row?.is_active ?? false,
    lockedUntil: row?.locked_until ?? null,
  });
  return {
    staffId: staffId.trim(),
    status,
    isActive: row?.is_active ?? false,
    failedAttemptCount: row?.failed_attempt_count ?? 0,
    lockedUntil: row?.locked_until ?? null,
    lastUsedAt: row?.last_used_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function loadStaffPinMetadataMap(
  tenantId: string,
  staffIds: string[]
): Promise<Map<string, StaffPinMetadata>> {
  const map = new Map<string, StaffPinMetadata>();
  const ids = staffIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return map;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_pins")
    .select("staff_id, is_active, failed_attempt_count, locked_until, last_used_at, updated_at")
    .eq("tenant_id", tenantId.trim())
    .in("staff_id", ids);
  if (error) throw new Error(error.message);

  const byStaff = new Map(
    (
      (data ?? []) as {
        staff_id: string;
        is_active: boolean;
        failed_attempt_count: number;
        locked_until: string | null;
        last_used_at: string | null;
        updated_at: string | null;
      }[]
    ).map((r) => [String(r.staff_id), r])
  );

  for (const staffId of ids) {
    const row = byStaff.get(staffId);
    map.set(staffId, {
      staffId,
      status: resolveStaffPinPublicStatus({
        hasPinRow: Boolean(row),
        isActive: row?.is_active ?? false,
        lockedUntil: row?.locked_until ?? null,
      }),
      isActive: row?.is_active ?? false,
      failedAttemptCount: row?.failed_attempt_count ?? 0,
      lockedUntil: row?.locked_until ?? null,
      lastUsedAt: row?.last_used_at ?? null,
      updatedAt: row?.updated_at ?? null,
    });
  }
  return map;
}

export async function setStaffPinForTenant(opts: {
  tenantId: string;
  staffId: string;
  pin: string;
  actorFiUserId: string | null;
  reset?: boolean;
}): Promise<void> {
  assertStaffPinFormat(opts.pin);
  await assertActiveStaffMember(opts.tenantId, opts.staffId);

  const { hash, salt } = hashStaffPin(opts.pin);
  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_staff_pins").upsert(
    {
      tenant_id: opts.tenantId.trim(),
      staff_id: opts.staffId.trim(),
      pin_hash: hash,
      pin_salt: salt,
      is_active: true,
      failed_attempt_count: 0,
      locked_until: null,
      updated_at: now,
      updated_by_user_id: opts.actorFiUserId?.trim() || null,
      created_by_user_id: opts.actorFiUserId?.trim() || null,
    },
    { onConflict: "tenant_id,staff_id" }
  );
  if (error) throw new Error(error.message);

  await insertFiStaffPinAuditEvent({
    tenantId: opts.tenantId,
    eventKind: opts.reset ? "staff_pin.reset" : "staff_pin.set",
    staffId: opts.staffId,
    actorFiUserId: opts.actorFiUserId,
  });
}

export async function disableStaffPinForTenant(opts: {
  tenantId: string;
  staffId: string;
  actorFiUserId: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = opts.client ?? supabaseAdmin();
  const row = await loadPinRow(opts.tenantId, opts.staffId, supabase);
  if (!row) return;
  const { error } = await supabase
    .from("fi_staff_pins")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      updated_by_user_id: opts.actorFiUserId?.trim() || null,
    })
    .eq("tenant_id", opts.tenantId.trim())
    .eq("staff_id", opts.staffId.trim());
  if (error) throw new Error(error.message);

  await insertFiStaffPinAuditEvent({
    tenantId: opts.tenantId,
    eventKind: "staff_pin.disabled",
    staffId: opts.staffId,
    actorFiUserId: opts.actorFiUserId,
    client: supabase,
  });
}

export type StaffPinVerifyResult =
  | { ok: true; staffId: string; staffName: string; staffRole: string }
  | { ok: false; error: string; locked?: boolean };

export async function verifyStaffPinLogin(opts: {
  tenantId: string;
  staffId: string;
  pin: string;
}): Promise<StaffPinVerifyResult> {
  assertStaffPinFormat(opts.pin);
  const staff = await assertActiveStaffMember(opts.tenantId, opts.staffId).catch(() => null);
  const row = await loadPinRow(opts.tenantId, opts.staffId);
  const now = new Date();

  if (!staff || !row || !row.is_active) {
    await insertFiStaffPinAuditEvent({
      tenantId: opts.tenantId,
      eventKind: "staff_pin.login_failed",
      staffId: opts.staffId,
      detail: { reason: "invalid_credentials" },
    });
    return { ok: false, error: STAFF_PIN_LOGIN_FAILURE_MESSAGE };
  }

  if (row.locked_until && new Date(row.locked_until).getTime() > now.getTime()) {
    return { ok: false, error: STAFF_PIN_LOGIN_FAILURE_MESSAGE, locked: true };
  }

  const valid = verifyStaffPinHash(opts.pin, row.pin_hash, row.pin_salt);
  const supabase = supabaseAdmin();

  if (!valid) {
    const attempt = nextFailedPinAttemptState(row.failed_attempt_count ?? 0, now);
    const patch: Record<string, unknown> = {
      failed_attempt_count: attempt.failedAttemptCount,
      locked_until: attempt.lockedUntil,
      updated_at: now.toISOString(),
    };
    const locked = attempt.shouldLock;
    if (locked && attempt.lockedUntil) {
      await insertFiStaffPinAuditEvent({
        tenantId: opts.tenantId,
        eventKind: "staff_pin.locked",
        staffId: opts.staffId,
        detail: { locked_until: attempt.lockedUntil },
      });
    }
    await supabase.from("fi_staff_pins").update(patch).eq("id", row.id);
    await insertFiStaffPinAuditEvent({
      tenantId: opts.tenantId,
      eventKind: "staff_pin.login_failed",
      staffId: opts.staffId,
      detail: { locked },
    });
    return { ok: false, error: STAFF_PIN_LOGIN_FAILURE_MESSAGE, locked };
  }

  await supabase
    .from("fi_staff_pins")
    .update({
      failed_attempt_count: 0,
      locked_until: null,
      last_used_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", row.id);

  return {
    ok: true,
    staffId: opts.staffId.trim(),
    staffName: staff.full_name,
    staffRole: staff.staff_role,
  };
}
