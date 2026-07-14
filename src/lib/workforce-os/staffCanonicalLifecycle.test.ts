import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalStaffLifecycleLabel,
  isCanonicalStaffLifecycleActive,
  resolveCanonicalStaffLifecycleStatus,
  resolveStaffDuplicateGroups,
  resolveStaffLifecycleIsActive,
} from "@/src/lib/workforce-os/staffCanonicalLifecycle";

test("terminated employment status never resolves active, even when is_active drifted true", () => {
  const status = resolveCanonicalStaffLifecycleStatus({
    isActive: true,
    employmentStatus: "terminated",
    archivedAt: "2026-07-03T09:55:19.575Z",
  });
  assert.equal(status, "terminated");
  assert.equal(isCanonicalStaffLifecycleActive(status), false);
  assert.equal(canonicalStaffLifecycleLabel(status), "Terminated");
});

test("resigned / contract_ended / contract_expired resolve to the terminated bucket", () => {
  for (const employmentStatus of ["resigned", "contract_ended", "contract_expired"]) {
    assert.equal(
      resolveCanonicalStaffLifecycleStatus({ isActive: true, employmentStatus }),
      "terminated",
      employmentStatus
    );
  }
});

test("archived HR record resolves archived even when employment_status is stale 'active'", () => {
  const status = resolveCanonicalStaffLifecycleStatus({
    isActive: false,
    employmentStatus: "active",
    archivedAt: "2026-07-03T09:58:21.854Z",
  });
  assert.equal(status, "archived");
  assert.equal(isCanonicalStaffLifecycleActive(status), false);
});

test("suspended, on_leave, and pending_onboarding are surfaced and not active", () => {
  assert.equal(
    resolveCanonicalStaffLifecycleStatus({ isActive: true, employmentStatus: "suspended" }),
    "suspended"
  );
  assert.equal(
    resolveCanonicalStaffLifecycleStatus({ isActive: true, employmentStatus: "on_leave" }),
    "on_leave"
  );
  assert.equal(
    resolveCanonicalStaffLifecycleStatus({
      isActive: true,
      employmentStatus: "pending_onboarding",
    }),
    "pending_onboarding"
  );
  assert.equal(
    resolveStaffLifecycleIsActive({ isActive: true, employmentStatus: "on_leave" }),
    false
  );
});

test("without an HR lifecycle row, is_active alone decides", () => {
  assert.equal(resolveCanonicalStaffLifecycleStatus({ isActive: true }), "active");
  assert.equal(resolveCanonicalStaffLifecycleStatus({ isActive: false }), "inactive");
  assert.equal(
    resolveCanonicalStaffLifecycleStatus({ isActive: true, employmentStatus: "  " }),
    "active"
  );
});

test("fi_staff.is_active=false wins over a stale 'active' employment status", () => {
  assert.equal(
    resolveCanonicalStaffLifecycleStatus({ isActive: false, employmentStatus: "active" }),
    "inactive"
  );
});

test("merged records resolve inactive", () => {
  assert.equal(
    resolveCanonicalStaffLifecycleStatus({ isActive: true, employmentStatus: "merged" }),
    "inactive"
  );
});

// --- Duplicate handling (Dr Seetal scenario: same name, one active contractor + one archived surgeon) ---

test("duplicate staff by name: active HR-linked record is canonical; the inactive twin is flagged", () => {
  const resolution = resolveStaffDuplicateGroups([
    {
      id: "old-surgeon",
      fullName: "Dr Seetal",
      email: null,
      createdAt: "2026-06-16T03:26:26.866Z",
      lifecycleStatus: "archived",
      hrLinked: false,
    },
    {
      id: "canonical-contractor",
      fullName: "Dr Seetal",
      email: "seetskd@gmail.com",
      createdAt: "2026-07-01T04:59:28.064Z",
      lifecycleStatus: "active",
      hrLinked: true,
    },
  ]);

  assert.equal(resolution.duplicateStaffIds.has("old-surgeon"), true);
  assert.equal(resolution.duplicateStaffIds.has("canonical-contractor"), false);
  assert.equal(resolution.canonicalIdByDuplicateId.get("old-surgeon"), "canonical-contractor");
  assert.deepEqual(resolution.groups, [
    { canonicalId: "canonical-contractor", duplicateIds: ["old-surgeon"] },
  ]);
});

test("duplicate staff by case-insensitive name (Paul Green / PAUL GREEN)", () => {
  const resolution = resolveStaffDuplicateGroups([
    {
      id: "owner-row",
      fullName: "Paul Green",
      email: "paul@example.com",
      createdAt: "2026-05-01T00:00:00.000Z",
      lifecycleStatus: "pending_onboarding",
    },
    {
      id: "manager-row",
      fullName: "PAUL GREEN",
      email: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      lifecycleStatus: "archived",
    },
  ]);

  // Neither is active — the non-archived/pending record still wins by rank order,
  // and exactly one record is flagged duplicate.
  assert.equal(resolution.duplicateStaffIds.size, 1);
  const flagged = [...resolution.duplicateStaffIds][0]!;
  const canonical = resolution.canonicalIdByDuplicateId.get(flagged);
  assert.ok(canonical && canonical !== flagged);
});

test("duplicates matched by shared email even when display names differ", () => {
  const resolution = resolveStaffDuplicateGroups([
    {
      id: "a",
      fullName: "S. Kaur",
      email: "seetskd@gmail.com",
      createdAt: "2026-06-01T00:00:00.000Z",
      lifecycleStatus: "inactive",
    },
    {
      id: "b",
      fullName: "Dr Seetal",
      email: "seetskd@gmail.com",
      createdAt: "2026-07-01T00:00:00.000Z",
      lifecycleStatus: "active",
    },
  ]);
  assert.equal(resolution.duplicateStaffIds.has("a"), true);
  assert.equal(resolution.canonicalIdByDuplicateId.get("a"), "b");
});

test("distinct staff are never flagged as duplicates", () => {
  const resolution = resolveStaffDuplicateGroups([
    {
      id: "a",
      fullName: "Danica Miloseski",
      email: "danica@example.com",
      lifecycleStatus: "active",
    },
    {
      id: "b",
      fullName: "Evie Shackleton",
      email: "evie@example.com",
      lifecycleStatus: "active",
    },
  ]);
  assert.equal(resolution.duplicateStaffIds.size, 0);
  assert.equal(resolution.groups.length, 0);
});
