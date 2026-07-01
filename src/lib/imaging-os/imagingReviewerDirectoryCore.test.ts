import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImagingReviewerDisplayName,
  isEligibleImagingReviewerStaffRole,
  isEligibleImagingReviewerUserRole,
  mergeImagingReviewerDirectoryRows,
  resolveReviewerLabelFromDirectory,
} from "./imagingReviewerDirectoryCore";

describe("imagingReviewerDirectoryCore", () => {
  it("accepts eligible staff and user roles", () => {
    assert.equal(isEligibleImagingReviewerStaffRole("surgeon"), true);
    assert.equal(isEligibleImagingReviewerStaffRole("reception"), false);
    assert.equal(isEligibleImagingReviewerUserRole("fi_admin"), true);
    assert.equal(isEligibleImagingReviewerUserRole("viewer"), false);
  });

  it("builds display name from staff name and email", () => {
    const label = buildImagingReviewerDisplayName({
      fiUserId: "user-1",
      fullName: "Dr Smith",
      email: "smith@clinic.test",
    });
    assert.ok(label.includes("Dr Smith"));
    assert.ok(label.includes("smith@clinic.test"));
  });

  it("merges staff-linked and user-only rows without duplicate user ids", () => {
    const merged = mergeImagingReviewerDirectoryRows(
      [
        {
          fi_user_id: "u-1",
          email: "a@test.com",
          user_role: null,
          staff_id: "s-1",
          staff_role: "surgeon",
          display_name: "Surgeon A",
        },
      ],
      [
        {
          fi_user_id: "u-1",
          email: "a@test.com",
          user_role: "fi_admin",
          staff_id: null,
          staff_role: null,
          display_name: "Admin A",
        },
        {
          fi_user_id: "u-2",
          email: "b@test.com",
          user_role: "doctor",
          staff_id: null,
          staff_role: null,
          display_name: "Doctor B",
        },
      ]
    );
    assert.equal(merged.length, 2);
    assert.ok(merged.some((r) => r.fi_user_id === "u-1"));
    assert.ok(merged.some((r) => r.fi_user_id === "u-2"));
  });

  it("resolves reviewer label from directory", () => {
    const directory = [
      {
        fi_user_id: "u-1",
        email: null,
        user_role: null,
        staff_id: "s-1",
        staff_role: "surgeon",
        display_name: "Surgeon A",
      },
    ];
    assert.equal(resolveReviewerLabelFromDirectory(directory, "u-1"), "Surgeon A");
    assert.equal(resolveReviewerLabelFromDirectory(directory, "missing"), null);
  });
});