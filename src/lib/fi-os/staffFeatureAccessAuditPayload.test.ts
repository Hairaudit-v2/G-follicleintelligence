import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFeatureOverrideChangedAuditInsert,
  buildTenantOperatingModeChangedAuditInsert,
} from "@/src/lib/fi-os/staffFeatureAccessAuditPayload";

test("audit payload: feature override includes changed keys", () => {
  const row = buildFeatureOverrideChangedAuditInsert({
    tenantId: "t1",
    staffId: "s1",
    actorUserId: "a1",
    actorFiUserId: "f1",
    oldOverrides: { calendar: false },
    newPatch: { calendar: true, crm: false },
  });
  assert.equal(row.event_type, "feature_override_changed");
  assert.deepEqual(row.metadata.changedKeys, ["calendar", "crm"]);
});

test("audit payload: tenant operating mode merge keys", () => {
  const row = buildTenantOperatingModeChangedAuditInsert({
    tenantId: "t1",
    actorUserId: null,
    actorFiUserId: null,
    oldModeKey: "full_fi_os",
    newModeKey: "audit_partner",
  });
  assert.equal(row.target_type, "tenant");
  assert.deepEqual(row.old_value, { fi_os_operating_mode_key: "full_fi_os" });
  assert.deepEqual(row.new_value, { fi_os_operating_mode_key: "audit_partner" });
});
