"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { linkHairAuditOutcomeReportForSurgery } from "@/src/lib/outcomeIntelligence/hairAuditOutcomeReportWorkflow.server";
import type { LinkHairAuditOutcomeReportResult } from "@/src/lib/outcomeIntelligence/hairAuditOutcomeReportWorkflow.server";
import { assertSurgeryOsMutationAllowed } from "@/src/lib/surgeryOs/surgeryOsMutationAccess.server";

const linkReportSchema = z
  .object({
    surgery_id: z.string().uuid(),
    case_id: z.string().uuid(),
    dryRun: z.boolean().optional(),
    sendToReview: z.boolean().optional(),
    adminKey: z.string().optional(),
  })
  .strict();

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

function formatLinkOutcomeMessage(result: LinkHairAuditOutcomeReportResult): string {
  const { outcome } = result;
  switch (outcome.kind) {
    case "dry_run_would_link":
      return `Dry run: would link outcome report ${outcome.fiReportId}.`;
    case "linked":
      return `Linked outcome report ${outcome.fiReportId}.`;
    case "skipped_legacy_report":
      return `Legacy report ${outcome.fiReportId} remains source-of-truth — no overwrite.`;
    case "skipped_already_linked":
      return `Report ${outcome.fiReportId} already linked.`;
    case "skipped_conflict":
      return "HairAudit linkage conflict — resolve before linking report.";
    case "skipped_no_report":
      return "No FI report found to link for this case.";
    case "skipped_no_case_link":
      return "HairAudit case link required before outcome report workflow.";
    default:
      return "Outcome report workflow completed.";
  }
}

export async function linkHairAuditOutcomeReportAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; data: LinkHairAuditOutcomeReportResult; message: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = linkReportSchema.parse(body);
    await assertSurgeryOsMutationAllowed(tenantId, "log_event", parsed.adminKey);

    const result = await linkHairAuditOutcomeReportForSurgery({
      tenantId,
      surgeryId: parsed.surgery_id,
      caseId: parsed.case_id,
      dryRun: parsed.dryRun ?? false,
      sendToReview: parsed.sendToReview ?? false,
    });

    if (!result.dryRun && result.outcome.kind === "linked") {
      revalidateSurgeryIntelligencePaths(tenantId);
    }

    return {
      ok: true,
      data: result,
      message: formatLinkOutcomeMessage(result),
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
