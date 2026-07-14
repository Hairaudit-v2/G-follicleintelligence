import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

const backfillSchema = z
  .object({
    adminKey: z.string().optional(),
    dryRun: z.boolean(),
    force: z.boolean().optional(),
    surgery_id: z.string().uuid().optional(),
    case_id: z.string().uuid().optional(),
    procedure_date_from: z.string().optional(),
    procedure_date_to: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSurgery = Boolean(value.surgery_id?.trim());
    const hasCase = Boolean(value.case_id?.trim());
    const hasRange = Boolean(value.procedure_date_from?.trim() || value.procedure_date_to?.trim());
    if (!hasSurgery && !hasCase && !hasRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a surgery_id, case_id, or procedure date range.",
      });
    }
    if (hasRange && (!value.procedure_date_from?.trim() || !value.procedure_date_to?.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both procedure_date_from and procedure_date_to are required for a date range.",
      });
    }
    if (value.force && !value.adminKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Force rebuild requires an admin key.",
      });
    }
  });

const SURGERY = "44444444-4444-4444-8444-444444444444";

describe("surgery intelligence backfill action input", () => {
  it("requires scope and enforces force admin key", () => {
    assert.throws(() => backfillSchema.parse({ dryRun: true }));
    assert.throws(() =>
      backfillSchema.parse({
        dryRun: true,
        surgery_id: SURGERY,
        force: true,
      })
    );
    assert.doesNotThrow(() =>
      backfillSchema.parse({
        dryRun: true,
        surgery_id: SURGERY,
        force: true,
        adminKey: "secret",
      })
    );
  });
});
