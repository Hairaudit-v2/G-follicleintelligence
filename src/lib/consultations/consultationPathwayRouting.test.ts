import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ConsultationPathwayLauncherPathKey } from "@/src/lib/consultations/consultationPathwayKeys";
import {
  consultationPathwayFormHref,
  PATHWAY_DEFAULT_CONSULTATION_TYPE,
  PATHWAY_FORM_RELATIVE_HREF,
} from "@/src/lib/consultations/consultationPathwayRouting";

describe("consultationPathwayRouting", () => {
  it("maps every pathway key to a form href and consultation type", () => {
    const keys = Object.keys(PATHWAY_FORM_RELATIVE_HREF) as ConsultationPathwayLauncherPathKey[];
    assert.ok(keys.length === 6);
    for (const k of keys) {
      assert.ok(PATHWAY_FORM_RELATIVE_HREF[k].startsWith("/forms"));
      assert.ok(PATHWAY_DEFAULT_CONSULTATION_TYPE[k]);
    }
  });

  it("builds encoded consultation form URLs", () => {
    const href = consultationPathwayFormHref({
      tenantId: "t1",
      consultationId: "c1",
      pathKey: "hair_loss_hli",
    });
    assert.equal(href, "/fi-admin/t1/consultations/c1/forms/hair-loss-treatment");
  });
});
