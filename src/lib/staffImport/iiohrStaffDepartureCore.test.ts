import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isAlreadyOffboardedEmploymentStatus,
  isIiohrFullOffboardHrStatus,
  mapHrEmploymentToFiDepartureStatus,
  resolveIiohrDepartureAlignmentKind,
} from "@/src/lib/staffImport/iiohrStaffDepartureCore";

test("mapHrEmploymentToFiDepartureStatus", () => {
  assert.equal(mapHrEmploymentToFiDepartureStatus("terminated"), "terminated");
  assert.equal(mapHrEmploymentToFiDepartureStatus("Resigned"), "resigned");
  assert.equal(mapHrEmploymentToFiDepartureStatus("contract_ended"), "contract_ended");
  assert.equal(mapHrEmploymentToFiDepartureStatus("inactive"), "inactive");
  assert.equal(mapHrEmploymentToFiDepartureStatus("active"), null);
});

test("resolveIiohrDepartureAlignmentKind", () => {
  assert.equal(resolveIiohrDepartureAlignmentKind("terminated"), "full_offboard");
  assert.equal(resolveIiohrDepartureAlignmentKind("resigned"), "full_offboard");
  assert.equal(resolveIiohrDepartureAlignmentKind("contract_ended"), "full_offboard");
  assert.equal(resolveIiohrDepartureAlignmentKind("inactive"), "deactivate_only");
  assert.equal(resolveIiohrDepartureAlignmentKind("active"), "none");
});

test("isIiohrFullOffboardHrStatus", () => {
  assert.equal(isIiohrFullOffboardHrStatus("terminated"), true);
  assert.equal(isIiohrFullOffboardHrStatus("inactive"), false);
});

test("isAlreadyOffboardedEmploymentStatus is idempotent guard", () => {
  assert.equal(isAlreadyOffboardedEmploymentStatus("terminated"), true);
  assert.equal(isAlreadyOffboardedEmploymentStatus("resigned"), true);
  assert.equal(isAlreadyOffboardedEmploymentStatus("contract_ended"), true);
  assert.equal(isAlreadyOffboardedEmploymentStatus("active"), false);
});
