import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  financialOsModuleHref,
  resolveFinancialOsActiveModule,
} from "@/src/lib/financialOs/financialOsModuleNav";

describe("financialOsModuleNav", () => {
  const base = "/fi-admin/tenant-a/financial";

  it("builds module hrefs under the tenant financial base", () => {
    assert.equal(financialOsModuleHref(base, "payments"), "/fi-admin/tenant-a/financial/payments");
  });

  it("resolves active module from pathname", () => {
    assert.equal(resolveFinancialOsActiveModule(`${base}/super-release`, base)?.id, "super-release");
    assert.equal(resolveFinancialOsActiveModule(`${base}/pathway-inbox`, base)?.id, "pathway-inbox");
    assert.equal(resolveFinancialOsActiveModule(base, base)?.id, "dashboard");
  });
});
