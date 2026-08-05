import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStaffHrTaskMapBannerHref,
  resolveStaffHrTaskMapBanner,
} from "@/src/lib/team/access/staffHrTaskMapBannerCore";
import { buildStaffHrTaskMapHref } from "@/src/lib/workforce/staffLifecycleCopy";

const TENANT = "tenant-abc";
const STAFF = "staff-member-1";

describe("staff HR task map entry banners", () => {
  it("each surface preset includes category and optional task id", () => {
    const standardHours = resolveStaffHrTaskMapBanner("standard_hours");
    assert.equal(standardHours.category, "roster");
    assert.equal(standardHours.taskId, "set_standard_hours");

    const access = resolveStaffHrTaskMapBanner("staff_access");
    assert.equal(access.category, "access");
    assert.equal(access.taskId, "provision_staff_access");

    const onboarding = resolveStaffHrTaskMapBanner("onboarding");
    assert.equal(onboarding.category, "onboarding");
    assert.equal(onboarding.taskId, "add_new_staff");
  });

  it("banner href deep-links category and task for standard hours", () => {
    const href = buildStaffHrTaskMapBannerHref(TENANT, "standard_hours");
    // A2: the task map moved into the /team/admin diagnostics namespace.
    assert.equal(
      href,
      `/fi-admin/${TENANT}/team/admin/access-task-map?category=roster&task=set_standard_hours`
    );
  });

  it("staff profile banner includes staff member id when provided", () => {
    const href = buildStaffHrTaskMapBannerHref(TENANT, "staff_profile", STAFF);
    assert.match(href, /staffId=staff-member-1/);
    assert.match(href, /category=employment/);
  });

  it("buildStaffHrTaskMapHref supports legacy staffId string argument", () => {
    assert.equal(
      buildStaffHrTaskMapHref(TENANT, STAFF),
      `/fi-admin/${TENANT}/team/admin/access-task-map?staffId=${STAFF}`
    );
  });
});
