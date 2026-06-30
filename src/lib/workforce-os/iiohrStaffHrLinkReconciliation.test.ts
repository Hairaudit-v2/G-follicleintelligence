import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normaliseStaffEmail,
  planIiohrStaffHrLinkReconciliation,
} from "./iiohrStaffHrLinkReconciliationCore";
import { reconcileExistingStaffWithIiohrHrLinks } from "./iiohrStaffHrLinkReconciliation.server";
import type { EvolvedStaffRecord } from "./iiohrStaffHrLinkReconciliationTypes";
import {
  IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
  STAFF_SYNCED_FROM_IIOHR_EVENT,
} from "./iiohrStaffHrLinkReconciliationTypes";

const TENANT = "00000000-0000-4000-8000-000000000001";

function staff(
  id: string,
  email: string | null,
  opts?: { iiohr_staff_record_id?: string | null; full_name?: string }
) {
  return {
    id,
    tenant_id: TENANT,
    email,
    full_name: opts?.full_name ?? "Staff Member",
    iiohr_staff_record_id: opts?.iiohr_staff_record_id ?? null,
    archived_at: null,
  };
}

function evolved(
  id: string,
  email: string | null,
  opts?: Partial<EvolvedStaffRecord>
): EvolvedStaffRecord {
  return {
    id,
    external_staff_id: opts?.external_staff_id ?? `ext-${id}`,
    iiohr_user_id: opts?.iiohr_user_id ?? null,
    full_name: opts?.full_name ?? "Evolved Staff",
    email,
    ...opts,
  };
}

test("normaliseStaffEmail is case-insensitive", () => {
  assert.equal(normaliseStaffEmail("  Ana@Example.COM "), "ana@example.com");
  assert.equal(normaliseStaffEmail(""), null);
  assert.equal(normaliseStaffEmail(null), null);
});

test("exact email link is planned", () => {
  const result = planIiohrStaffHrLinkReconciliation({
    staffMembers: [staff("s-1", "ana@example.com")],
    evolvedStaffRecords: [evolved("iiohr-1", "ana@example.com", { iiohr_user_id: "user-1" })],
  });

  assert.equal(result.summary.matched, 1);
  assert.equal(result.summary.skipped_blank_email, 0);
  assert.equal(result.summary.skipped_no_match, 0);
  assert.equal(result.summary.already_linked, 0);
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0]?.staffMemberId, "s-1");
  assert.equal(result.links[0]?.evolvedRecord.id, "iiohr-1");
});

test("case-insensitive email link is planned", () => {
  const result = planIiohrStaffHrLinkReconciliation({
    staffMembers: [staff("s-1", "Ana@Example.COM")],
    evolvedStaffRecords: [evolved("iiohr-1", "ana@example.com")],
  });

  assert.equal(result.summary.matched, 1);
  assert.equal(result.links[0]?.evolvedRecord.id, "iiohr-1");
});

test("blank email staff is skipped", () => {
  const result = planIiohrStaffHrLinkReconciliation({
    staffMembers: [staff("s-1", null), staff("s-2", "   ")],
    evolvedStaffRecords: [evolved("iiohr-1", "someone@example.com", { full_name: "Someone" })],
  });

  assert.equal(result.summary.skipped_blank_email, 2);
  assert.equal(result.summary.matched, 0);
  assert.equal(result.links.length, 0);
});

test("name-only match is skipped", () => {
  const result = planIiohrStaffHrLinkReconciliation({
    staffMembers: [staff("s-1", "fi-only@example.com", { full_name: "Jane Doe" })],
    evolvedStaffRecords: [
      evolved("iiohr-1", "hr-only@example.com", { full_name: "Jane Doe" }),
    ],
  });

  assert.equal(result.summary.skipped_no_match, 1);
  assert.equal(result.summary.matched, 0);
});

test("already linked staff is skipped", () => {
  const result = planIiohrStaffHrLinkReconciliation({
    staffMembers: [
      staff("s-1", "linked@example.com", { iiohr_staff_record_id: "existing-iiohr" }),
      staff("s-2", "new@example.com"),
    ],
    evolvedStaffRecords: [
      evolved("iiohr-new", "new@example.com"),
      evolved("iiohr-linked", "linked@example.com"),
    ],
  });

  assert.equal(result.summary.already_linked, 1);
  assert.equal(result.summary.matched, 1);
  assert.equal(result.links[0]?.staffMemberId, "s-2");
});

test("reconcileExistingStaffWithIiohrHrLinks writes audit event and updates staff row", async () => {
  const updates: Record<string, unknown>[] = [];
  const auditInserts: Record<string, unknown>[] = [];

  const mockSupabase = {
    from(table: string) {
      if (table === "fi_staff_members") {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  id: "s-1",
                  tenant_id: TENANT,
                  email: "ana@example.com",
                  full_name: "Ana",
                  iiohr_staff_record_id: null,
                  archived_at: null,
                },
              ],
              error: null,
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: () => ({
              eq: () => ({
                is: async () => {
                  updates.push(payload);
                  return { error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === "fi_staff_member_audit_events") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            auditInserts.push(payload);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  const summary = await reconcileExistingStaffWithIiohrHrLinks({
    tenantId: TENANT,
    evolvedStaffRecords: [
      evolved("iiohr-1", "ana@example.com", {
        iiohr_user_id: "user-abc",
        staff_role: "Nurse",
      }),
    ],
    client: mockSupabase,
    syncedAt: "2026-07-01T12:00:00.000Z",
  });

  assert.equal(summary.matched, 1);
  assert.equal(summary.linked, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.iiohr_staff_record_id, "iiohr-1");
  assert.equal(updates[0]?.iiohr_user_id, "user-abc");
  assert.equal(updates[0]?.source_system, IIOHR_EVOLVED_HR_SOURCE_SYSTEM);
  assert.equal(updates[0]?.source_synced_at, "2026-07-01T12:00:00.000Z");
  assert.deepEqual(updates[0]?.source_snapshot, {
    id: "iiohr-1",
    external_staff_id: "ext-iiohr-1",
    iiohr_user_id: "user-abc",
    full_name: "Evolved Staff",
    email: "ana@example.com",
    staff_role: "Nurse",
  });

  assert.equal(auditInserts.length, 1);
  assert.equal(auditInserts[0]?.staff_member_id, "s-1");
  assert.equal(auditInserts[0]?.event_type, STAFF_SYNCED_FROM_IIOHR_EVENT);
  assert.deepEqual(auditInserts[0]?.metadata, {
    iiohr_staff_record_id: "iiohr-1",
    iiohr_user_id: "user-abc",
    source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
    source_synced_at: "2026-07-01T12:00:00.000Z",
  });
});
