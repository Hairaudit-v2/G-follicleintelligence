import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { runHairAuditLinkBackfill } from "./hairAuditLinkBackfill.server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CASE = "33333333-3333-4333-8333-333333333333";
const SURGERY = "22222222-2222-4222-8222-222222222222";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";

function createMockSupabase(input: {
  caseMetadata: Record<string, unknown>;
  updatedMetadata?: Record<string, unknown>;
}): SupabaseClient {
  return {
    from(table: string) {
      if (table === "fi_surgeries") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: SURGERY, case_id: CASE },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "fi_cases") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { metadata: input.caseMetadata },
                  error: null,
                }),
              }),
            }),
          }),
          update: (payload: { metadata: Record<string, unknown> }) => {
            if (input.updatedMetadata) {
              Object.assign(input.updatedMetadata, payload.metadata);
            } else {
              input.updatedMetadata = { ...payload.metadata };
            }
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("hairAuditLinkBackfill.server", () => {
  it("dry-run does not write fi_cases metadata", async () => {
    const supabase = createMockSupabase({
      caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
    });
    const result = await runHairAuditLinkBackfill(
      { tenantId: TENANT, surgeryId: SURGERY, dryRun: true },
      { supabase }
    );
    assert.equal(result.summary.dryRun, true);
    assert.equal(result.summary.wouldCopy, 1);
    assert.equal(result.summary.copied, 0);
  });

  it("write path copies legacy linkage additively", async () => {
    const updated: Record<string, unknown> = {};
    const supabase = createMockSupabase({
      caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
    });
    const result = await runHairAuditLinkBackfill(
      { tenantId: TENANT, surgeryId: SURGERY, dryRun: false },
      { supabase }
    );
    assert.equal(result.summary.copied, 1);
    assert.equal(
      (result.outcomes[0] as { kind: string }).kind,
      "copied_legacy"
    );
  });
});