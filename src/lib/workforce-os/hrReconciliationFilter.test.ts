import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildHrReconciliationMetrics,
  isStaffArchived,
  isStaffHrLinkedForReconciliation,
  needsHrReconciliation,
} from "./hrReconciliationEligibleCore";
import {
  countExactNormalizedEmailMatches,
  mapIiohrPortalStaffToEvolvedStaffRecords,
} from "./hrReconciliationCandidateCore";
import {
  buildHrReconciliationDiagnostics,
  buildHrReconciliationPageData,
} from "./hrReconciliationFilterCore";
import type { HrReconciliationDiagnostics, StaffMemberLifecycleRow } from "./staffLifecycleTypes";
import { IIOHR_EVOLVED_HR_SOURCE_SYSTEM } from "./iiohrStaffHrLinkReconciliationTypes";

function lifecycleRow(
  overrides: Partial<StaffMemberLifecycleRow> = {}
): StaffMemberLifecycleRow {
  return {
    id: "sm-1",
    tenant_id: "tenant-1",
    fi_staff_id: "fs-1",
    first_name: "Danica",
    last_name: "Miloseski",
    full_name: "Danica Miloseski",
    email: "danica@example.com",
    professional_title: null,
    phone: null,
    role_code: "nurse",
    employment_type: null,
    employment_status: "active",
    timezone: null,
    clinic_id: null,
    notes: null,
    identity_source: "local",
    internal_tags: [],
    iiohr_staff_record_id: null,
    iiohr_user_id: null,
    source_system: null,
    source_synced_at: null,
    source_snapshot: {},
    archived_at: null,
    employment_status_reason: null,
    employment_status_changed_at: null,
    employment_status_changed_by: null,
    last_manual_profile_update: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function baseDiagnostics(
  overrides: Partial<HrReconciliationDiagnostics> = {}
): HrReconciliationDiagnostics {
  return {
    fiStaffCount: 0,
    iiohrRawFeedRowCount: 0,
    iiohrCandidateCount: 0,
    iiohrCandidatesSkippedNonUuid: 0,
    exactNormalizedEmailMatchCount: 0,
    staffIdentityLinksCount: 0,
    lastSuccessfulIiohrSyncAt: null,
    fiStaffSourceSystemCounts: {},
    feedStatus: "not_configured",
    feedLoadError: null,
    feedBlockedMessage: "No IIOHR staff feed URL configured.",
    feedUrlConfigured: false,
    feedUrlSource: null,
    feedKeyConfigured: false,
    cronSecretConfigured: false,
    evolvedPerthTenantIdConfigured: false,
    legacyFeedUrlConfigured: false,
    ...overrides,
  };
}

const archivedDemoStaff = lifecycleRow({
  id: "demo-archived-1",
  fi_staff_id: "fs-demo-1",
  full_name: "Demo Nurse",
  email: "demo.nurse@demo.iiohr.local",
  archived_at: "2024-01-01T00:00:00.000Z",
});

const activeLinkedIiohrStaff = lifecycleRow({
  id: "iiohr-linked-1",
  fi_staff_id: "fs-real-1",
  full_name: "Real IIOHR Staff",
  email: "real.staff@clinic.com",
  iiohr_staff_record_id: "00000000-0000-4000-8000-000000000101",
  iiohr_user_id: "00000000-0000-4000-8000-000000000201",
  source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
  source_synced_at: "2025-06-01T12:00:00.000Z",
  identity_source: "iiohr_evolved_hr",
});

const activeUnlinkedRealStaff = lifecycleRow({
  id: "unlinked-real-1",
  fi_staff_id: "fs-real-2",
  full_name: "Unlinked Real Staff",
  email: "unlinked@clinic.com",
});

const drSeetal = lifecycleRow({
  id: "seetal-1",
  fi_staff_id: "fs-seetal",
  full_name: "Dr Seetal",
  email: "seetskd@gmail.com",
});

test("archived unlinked demo staff are excluded from reconciliation queue", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [archivedDemoStaff, activeUnlinkedRealStaff],
    evolvedStaffRecords: [],
    diagnostics: baseDiagnostics({ feedStatus: "ok", feedBlockedMessage: null }),
  });

  assert.equal(
    pageData.suggestions.some((s) => s.staffMemberId === archivedDemoStaff.id),
    false
  );
  assert.equal(pageData.suggestions.length, 1);
  assert.equal(pageData.suggestions[0]?.matchType, "none");
});

test("empty feed does not emit false no-match suggestions", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [activeUnlinkedRealStaff, drSeetal],
    evolvedStaffRecords: [],
    diagnostics: baseDiagnostics({
      feedStatus: "not_configured",
      feedBlockedMessage: "No IIOHR staff feed URL configured.",
    }),
  });

  assert.equal(pageData.suggestions.length, 0);
  assert.equal(pageData.metrics.needsReconciliation, 2);
});

test("active linked IIOHR staff do not generate no-match suggestions", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [activeLinkedIiohrStaff, activeUnlinkedRealStaff],
    evolvedStaffRecords: [],
    diagnostics: baseDiagnostics({ feedStatus: "ok", feedBlockedMessage: null }),
  });

  assert.equal(
    pageData.suggestions.some((s) => s.staffMemberId === activeLinkedIiohrStaff.id),
    false
  );
  assert.equal(pageData.metrics.alreadyLinked, 1);
});

test("Dr Seetal exact email matches IIOHR feed row", () => {
  const feedRecords = mapIiohrPortalStaffToEvolvedStaffRecords([
    {
      external_staff_id: "00000000-0000-4000-8000-000000000301",
      iiohr_user_id: "00000000-0000-4000-8000-000000000301",
      full_name: "Dr Seetal",
      email: "seetskd@gmail.com",
    },
  ]).records;

  const pageData = buildHrReconciliationPageData({
    staffMembers: [drSeetal],
    evolvedStaffRecords: feedRecords,
    diagnostics: baseDiagnostics({
      feedStatus: "ok",
      feedBlockedMessage: null,
      iiohrCandidateCount: 1,
      exactNormalizedEmailMatchCount: 1,
    }),
  });

  assert.equal(pageData.suggestions.length, 1);
  assert.equal(pageData.suggestions[0]?.matchType, "exact_email");
  assert.equal(pageData.suggestions[0]?.confidenceScore, 100);
  assert.equal(pageData.suggestions[0]?.canAutoApprove, true);
});

test("active unlinked real staff may generate reconciliation suggestions", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [activeUnlinkedRealStaff],
    evolvedStaffRecords: [
      {
        id: "00000000-0000-4000-8000-000000000401",
        email: "unlinked@clinic.com",
        full_name: "Unlinked Real Staff",
      },
    ],
    diagnostics: baseDiagnostics({ feedStatus: "ok", feedBlockedMessage: null }),
  });

  assert.equal(pageData.suggestions.length, 1);
  assert.equal(pageData.suggestions[0]?.matchType, "exact_email");
});

test("totals do not count archived staff as unresolved", () => {
  const metrics = buildHrReconciliationMetrics([
    archivedDemoStaff,
    activeLinkedIiohrStaff,
    activeUnlinkedRealStaff,
  ]);

  assert.equal(metrics.activeStaff, 2);
  assert.equal(metrics.alreadyLinked, 1);
  assert.equal(metrics.needsReconciliation, 1);
  assert.equal(metrics.archivedExcluded, 1);
});

test("countExactNormalizedEmailMatches is case-insensitive", () => {
  const matches = countExactNormalizedEmailMatches({
    staffMembers: [drSeetal],
    evolvedStaffRecords: [
      {
        id: "00000000-0000-4000-8000-000000000301",
        email: "Seetskd@Gmail.COM",
        full_name: "Dr Seetal",
      },
    ],
  });
  assert.equal(matches, 1);
});

test("buildHrReconciliationDiagnostics marks empty configured feed", () => {
  const diagnostics = buildHrReconciliationDiagnostics({
    staffMembers: [drSeetal],
    evolvedStaffRecords: [],
    rawFeedRowCount: 0,
    skippedNonUuidCount: 0,
    staffIdentityLinksCount: 0,
    lastSuccessfulIiohrSyncAt: null,
    feedUrlConfigured: true,
    feedUrlSource: "IIOHR_HR_PERTH_STAFF_FEED_URL",
    feedKeyConfigured: false,
    cronSecretConfigured: true,
    evolvedPerthTenantIdConfigured: true,
    legacyFeedUrlConfigured: false,
    feedLoadError: null,
  });

  assert.equal(diagnostics.feedStatus, "empty");
  assert.ok(diagnostics.feedBlockedMessage?.includes("No IIOHR staff feed rows found"));
});

test("needsHrReconciliation excludes archived and linked staff", () => {
  assert.equal(needsHrReconciliation(archivedDemoStaff), false);
  assert.equal(needsHrReconciliation(activeLinkedIiohrStaff), false);
  assert.equal(needsHrReconciliation(activeUnlinkedRealStaff), true);
});

test("isStaffArchived treats empty archived_at as active", () => {
  assert.equal(isStaffArchived({ archived_at: null }), false);
  assert.equal(isStaffArchived({ archived_at: "" }), false);
});

test("isStaffHrLinkedForReconciliation accepts iiohr_user_id without staff record id", () => {
  assert.equal(
    isStaffHrLinkedForReconciliation({
      iiohr_staff_record_id: null,
      iiohr_user_id: "user-only-link",
      source_system: null,
      source_synced_at: null,
    }),
    true
  );
});
