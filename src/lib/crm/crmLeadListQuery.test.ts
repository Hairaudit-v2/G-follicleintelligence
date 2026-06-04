import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCrmLeadListHref,
  crmLeadListHasActiveFilters,
  parseCrmLeadListQuery,
  parsedCrmLeadListToHrefQuery,
} from "./crmLeadListQuery";

describe("crmLeadListQuery", () => {
  it("defaults sort and pagination", () => {
    const q = parseCrmLeadListQuery({});
    assert.equal(q.sort, "updated_at_desc");
    assert.equal(q.page, 1);
    assert.equal(q.pageSize, 25);
    assert.equal(q.stageId, null);
  });

  it("parses filters and coerces invalid stage uuid", () => {
    const q = parseCrmLeadListQuery({
      stage: "not-uuid",
      status: "open",
      priority: "high",
      owner: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      search: "  Jane  ",
      sort: "priority_asc",
      page: "2",
      pageSize: "50",
    });
    assert.equal(q.stageId, null);
    assert.equal(q.status, "open");
    assert.equal(q.priority, "high");
    assert.equal(q.ownerUserId, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    assert.equal(q.searchRaw, "Jane");
    assert.equal(q.sort, "priority_asc");
    assert.equal(q.page, 2);
    assert.equal(q.pageSize, 50);
  });

  it("crmLeadListHasActiveFilters", () => {
    assert.equal(crmLeadListHasActiveFilters(parseCrmLeadListQuery({})), false);
    assert.equal(crmLeadListHasActiveFilters(parseCrmLeadListQuery({ search: "x" })), true);
  });

  it("buildCrmLeadListHref roundtrip", () => {
    const q = parseCrmLeadListQuery({ stage: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", page: "3" });
    const href = buildCrmLeadListHref("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", parsedCrmLeadListToHrefQuery(q));
    assert.ok(href.includes("stage="));
    assert.ok(href.includes("page=3"));
  });
});
