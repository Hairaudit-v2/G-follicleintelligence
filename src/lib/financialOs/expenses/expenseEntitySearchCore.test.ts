import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterCampaignKeys,
  formatExpenseLinkSummary,
} from "@/src/lib/financialOs/expenses/expenseEntitySearchCore";

describe("expenseEntitySearchCore", () => {
  it("formats link summary", () => {
    assert.equal(formatExpenseLinkSummary({}), "—");
    assert.match(
      formatExpenseLinkSummary({
        campaignKey: "meta_q3",
        leadId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
      /campaign:meta_q3/
    );
  });

  it("filters campaign keys", () => {
    const keys = ["meta_q3", "google_brand", "meta_retarget"];
    assert.deepEqual(filterCampaignKeys(keys, "meta"), ["meta_q3", "meta_retarget"]);
    assert.deepEqual(filterCampaignKeys(keys, ""), ["meta_q3", "google_brand", "meta_retarget"]);
  });
});
