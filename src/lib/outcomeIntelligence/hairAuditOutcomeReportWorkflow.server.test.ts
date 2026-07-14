import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { linkHairAuditOutcomeReportForSurgery } from "./hairAuditOutcomeReportWorkflow.server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const REPORT = "77777777-7777-4777-8777-777777777777";
const HAIRAUDIT = "66666666-6666-4666-8666-666666666666";

describe("linkHairAuditOutcomeReportForSurgery", () => {
  it("dry-run previews link without writing metadata", async () => {
    const updates: unknown[] = [];
    const supabase = {
      from(table: string) {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => {
            if (table === "fi_cases") {
              return {
                data: {
                  metadata: {
                    hairaudit_case_id: HAIRAUDIT,
                  },
                },
                error: null,
              };
            }
            if (table === "fi_reports") {
              return { data: { id: REPORT }, error: null };
            }
            return { data: null, error: null };
          },
          update(payload: unknown) {
            updates.push(payload);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      },
    };

    const result = await linkHairAuditOutcomeReportForSurgery(
      {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseId: CASE,
        dryRun: true,
      },
      { supabase: supabase as never }
    );

    assert.equal(result.dryRun, true);
    assert.equal(result.outcome.kind, "dry_run_would_link");
    assert.equal(updates.length, 0);
  });

  it("write path links report additively", async () => {
    const updates: Record<string, unknown>[] = [];
    const supabase = {
      from(table: string) {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => {
            if (table === "fi_cases") {
              return {
                data: {
                  metadata: {
                    hairaudit_case_id: HAIRAUDIT,
                  },
                },
                error: null,
              };
            }
            if (table === "fi_reports") {
              return { data: { id: REPORT }, error: null };
            }
            return { data: null, error: null };
          },
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      },
    };

    const result = await linkHairAuditOutcomeReportForSurgery(
      {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseId: CASE,
        dryRun: false,
      },
      { supabase: supabase as never }
    );

    assert.equal(result.outcome.kind, "linked");
    assert.equal(updates.length, 1);
    const metadata = updates[0]?.metadata as Record<string, unknown>;
    const link = metadata.hair_audit_link as Record<string, unknown>;
    assert.equal(link.fi_report_id, REPORT);
    assert.equal(metadata.hairaudit_case_id, HAIRAUDIT);
  });
});
