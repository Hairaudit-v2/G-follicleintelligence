import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  receptionCloseoutCloseDayAllowed,
  receptionCloseoutViewAllowed,
} from "@/src/lib/receptionOs/receptionCloseoutPolicy";

describe("receptionCloseoutPolicy", () => {
  it("allows managers and admins to close the day", () => {
    assert.equal(receptionCloseoutCloseDayAllowed("admin"), true);
    assert.equal(receptionCloseoutCloseDayAllowed("clinic_manager"), true);
    assert.equal(receptionCloseoutCloseDayAllowed("receptionist"), false);
    assert.equal(receptionCloseoutCloseDayAllowed("consultant"), false);
  });

  it("allows all reception roles to view closeout", () => {
    assert.equal(receptionCloseoutViewAllowed("receptionist"), true);
    assert.equal(receptionCloseoutViewAllowed("consultant"), true);
  });
});
