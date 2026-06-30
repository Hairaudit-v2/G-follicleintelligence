import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicaliseWorkforceSourceSystem,
  isWorkforceIdentitySourceSystem,
  WORKFORCE_IDENTITY_SOURCE_SYSTEMS,
} from "./workforceIdentitySources";

test("canonicaliseWorkforceSourceSystem maps legacy aliases", () => {
  assert.equal(canonicaliseWorkforceSourceSystem("hr"), WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR);
  assert.equal(
    canonicaliseWorkforceSourceSystem("iiohr"),
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR
  );
  assert.equal(
    canonicaliseWorkforceSourceSystem("academy"),
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY
  );
  assert.equal(
    canonicaliseWorkforceSourceSystem("nexus"),
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS
  );
  assert.equal(
    canonicaliseWorkforceSourceSystem("IIOHR_HR"),
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR
  );
});

test("canonical values pass type guard", () => {
  for (const v of Object.values(WORKFORCE_IDENTITY_SOURCE_SYSTEMS)) {
    assert.ok(isWorkforceIdentitySourceSystem(v));
  }
  assert.equal(isWorkforceIdentitySourceSystem("unknown_vendor"), false);
});
