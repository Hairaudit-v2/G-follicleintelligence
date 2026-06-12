import assert from "node:assert/strict";
import { test } from "node:test";

import { buildStaffRoleReviewEditableRow } from "./staffRoleReviewApply";
import type { FiStaffRow } from "./staff.server";
import {
  buildStaffHrNotificationNoLinkSummary,
  buildStaffHrNotificationSummary,
  extractSafeHrNotificationMetadata,
  pickStaffHrNotificationFromSourceRows,
  staffHrNotificationSummaryHasSensitiveKeys,
  STAFF_HR_SYNC_STALE_DAYS,
} from "./staffHrNotificationSummary";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function staff(p: Partial<FiStaffRow> & Pick<FiStaffRow, "id" | "full_name">): FiStaffRow {
  return {
    tenant_id: "t1",
    fi_user_id: null,
    staff_role: "needs_review",
    position_type_id: null,
    email: null,
    mobile: null,
    default_timezone: null,
    working_hours: {},
    staff_metadata: {},
    is_active: true,
    calendar_color: null,
    created_at: "",
    updated_at: "",
    ...p,
  };
}

test("no HR link shows No HR link badge", () => {
  const s = buildStaffHrNotificationNoLinkSummary();
  assert.equal(s.variant, "no_link");
  assert.equal(s.badgeLabel, "No HR link");
  const picked = pickStaffHrNotificationFromSourceRows([
    { source_system: "evolved_payroll", metadata: { training_required_count: 2 } },
  ]);
  assert.equal(picked.hasHrLink, false);
  assert.equal(picked.badgeLabel, "No HR link");
});

test("outstanding counts show amber outstanding notification", () => {
  const s = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      source_url: "https://hr.example/staff/1",
      metadata: {
        required_documents_missing_count: 2,
        training_required_count: 1,
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );
  assert.equal(s.variant, "outstanding");
  assert.equal(s.outstandingTaskCount, 3);
  assert.ok(s.badgeLabel.includes("3 HR tasks outstanding"));
  assert.ok(s.alerts.includes("HR information required"));
  assert.ok(s.alerts.includes("Training required"));
});

test("training-only outstanding shows Training incomplete label", () => {
  const s = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr",
      metadata: { training_required_count: 2, last_synced_at: NOW.toISOString() },
    },
    NOW
  );
  assert.equal(s.badgeLabel, "Training incomplete");
});

test("complete onboarding shows complete badge", () => {
  const s = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      metadata: {
        onboarding_status: "complete",
        onboarding_completed_at: "2026-05-01T00:00:00.000Z",
        required_documents_missing_count: 0,
        training_required_count: 0,
        certificates_outstanding_count: 0,
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );
  assert.equal(s.variant, "complete");
  assert.equal(s.badgeLabel, "Onboarding complete");
  assert.equal(s.outstandingTaskCount, 0);
});

test("sensitive fields are never rendered in safe metadata or summary", () => {
  const safe = extractSafeHrNotificationMetadata({
    onboarding_status: "pending",
    bank_details: { account: "secret" },
    TFN: "123",
    pay_rate: 90000,
    training_required_count: 1,
    last_synced_at: NOW.toISOString(),
  });
  assert.equal((safe as Record<string, unknown>).bank_details, undefined);
  assert.equal((safe as Record<string, unknown>).TFN, undefined);
  assert.equal((safe as Record<string, unknown>).pay_rate, undefined);

  const s = buildStaffHrNotificationSummary(
    {
      source_system: "hr",
      metadata: {
        onboarding_status: "pending",
        bank: "hidden",
        tax_information: "hidden",
        training_required_count: 1,
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );
  assert.equal(staffHrNotificationSummaryHasSensitiveKeys(s), false);
  assert.equal(JSON.stringify(s).includes("hidden"), false);
});

test("stale sync warning when last_synced_at is old", () => {
  const staleAt = new Date(NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000).toISOString();
  const s = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      metadata: {
        onboarding_status: "complete",
        last_synced_at: staleAt,
      },
    },
    NOW
  );
  assert.equal(s.isSyncStale, true);
  assert.equal(s.variant, "complete");
});

test("role-review row carries HR notification summary", () => {
  const hr = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      metadata: {
        certificates_outstanding_count: 1,
        onboarding_status: "incomplete",
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );
  const row = buildStaffRoleReviewEditableRow(staff({ id: "1", full_name: "A" }), null, {
    position_title: null,
    primary_clinic_id: null,
  }, hr);
  assert.equal(row.hrNotification.outstandingTaskCount, 2);
  assert.ok(row.hrNotification.alerts.includes("Certificates outstanding"));
  assert.ok(row.hrNotification.alerts.includes("Contract/onboarding incomplete"));
});

test("hr portal url prefers metadata hr_profile_url then source_url", () => {
  const s = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      source_url: "https://hr.example/fallback",
      metadata: {
        hr_profile_url: "https://hr.example/profile/9",
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );
  assert.equal(s.hr_portal_url, "https://hr.example/profile/9");
});
