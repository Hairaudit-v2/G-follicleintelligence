"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertSurgeryOsMutationAllowed } from "@/src/lib/surgeryOs/surgeryOsMutationAccess.server";
import { runSurgeryIntelligenceBackfill } from "@/src/lib/outcomeIntelligence/surgeryIntelligenceBackfill.server";
import type { SurgeryIntelligenceBackfillRunResult } from "@/src/lib/outcomeIntelligence/surgeryIntelligenceBackfill.server";

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

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateSurgeryIntelligencePaths(tenantId: string) {
  const base = `/fi-admin/${tenantId.trim()}/surgery-os`;
  revalidatePath(`${base}/intelligence`);
  revalidatePath(base);
}

export async function runSurgeryIntelligenceBackfillAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; data: SurgeryIntelligenceBackfillRunResult; message: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = backfillSchema.parse(body);
    await assertSurgeryOsMutationAllowed(tenantId, "log_event", parsed.adminKey);

    const result = await runSurgeryIntelligenceBackfill({
      tenantId,
      scope: {
        dryRun: parsed.dryRun,
        force: parsed.force,
        surgeryId: parsed.surgery_id,
        caseId: parsed.case_id,
        procedureDateFrom: parsed.procedure_date_from,
        procedureDateTo: parsed.procedure_date_to,
      },
    });

    if (!parsed.dryRun) {
      revalidateSurgeryIntelligencePaths(tenantId);
    }

    const { summary } = result;
    const message = parsed.dryRun
      ? `Dry run complete: ${summary.published} would publish, ${summary.updated} would update, ${summary.skippedNoFinalCount} skipped (no final count).`
      : `Backfill complete: ${summary.published} published, ${summary.updated} updated.`;

    return { ok: true, data: result, message };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
