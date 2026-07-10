"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { readExpenseReceiptUploadFormData } from "@/src/lib/financialOs/expenses/expenseDocumentStorageCore";
import {
  createExpenseDocumentSignedUrl,
  processExpenseDocumentOcr,
  uploadExpenseDocument,
} from "@/src/lib/financialOs/expenses/expenseDocumentMutations.server";
import {
  confirmBankReconMatch,
  rejectBankReconMatch,
  suggestBankReconMatches,
} from "@/src/lib/financialOs/expenses/expenseBankRecon.server";
import {
  buildExpensePeriodExports,
  dryRunAccountingExpensePush,
} from "@/src/lib/financialOs/expenses/expenseStage6.server";
import {
  commitImportLinesSchema,
  createExpenseImportSchema,
  createManualExpenseSchema,
  postExpenseSchema,
  updateExpenseSchema,
  updateImportLineSchema,
  voidExpenseSchema,
} from "@/src/lib/financialOs/expenses/expenseSchemas";
import {
  commitExpenseImportLines,
  createExpenseImportFromCsv,
  createManualExpense,
  postExpense,
  updateExpense,
  updateExpenseImportLine,
  voidExpense,
} from "@/src/lib/financialOs/expenses/expenseMutations.server";

const reprocessOcrSchema = z.object({
  adminKey: z.string().optional(),
  document_id: z.string().uuid(),
});

const periodExportSchema = z.object({
  adminKey: z.string().optional(),
  period_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  period_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  format: z
    .enum(["fi_csv", "quickbooks_csv", "quickbooks_json", "xero_csv"])
    .default("fi_csv"),
});

const reconSuggestSchema = z.object({
  adminKey: z.string().optional(),
  period_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  period_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

const reconMatchIdSchema = z.object({
  adminKey: z.string().optional(),
  match_id: z.string().uuid(),
});

const accountingDryRunSchema = z.object({
  adminKey: z.string().optional(),
  provider: z.enum(["quickbooks", "xero"]),
  period_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  period_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateExpensePaths(tenantId: string, importId?: string | null) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/financial`;
  revalidatePath(`${base}/expenses`);
  revalidatePath(base);
  if (importId?.trim()) {
    revalidatePath(`${base}/expenses/imports/${importId.trim()}`);
  }
}

export async function createManualExpenseAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; expense_id: string } | { ok: false; error: string }> {
  try {
    const parsed = createManualExpenseSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const row = await createManualExpense({
      tenantId: tenantId.trim(),
      body: parsed,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true, expense_id: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateExpenseAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; expense_id: string } | { ok: false; error: string }> {
  try {
    const parsed = updateExpenseSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const row = await updateExpense({
      tenantId: tenantId.trim(),
      body: parsed,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true, expense_id: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function postExpenseAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; expense_id: string } | { ok: false; error: string }> {
  try {
    const parsed = postExpenseSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const row = await postExpense({
      tenantId: tenantId.trim(),
      expenseId: parsed.expense_id,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true, expense_id: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function voidExpenseAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; expense_id: string } | { ok: false; error: string }> {
  try {
    const parsed = voidExpenseSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const row = await voidExpense({
      tenantId: tenantId.trim(),
      expenseId: parsed.expense_id,
      reason: parsed.reason,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true, expense_id: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createExpenseImportFromCsvAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; import_id: string; line_count: number; parse_errors: string[] }
  | { ok: false; error: string }
> {
  try {
    const parsed = createExpenseImportSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const result = await createExpenseImportFromCsv({
      tenantId: tenantId.trim(),
      body: parsed,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId, result.importRow.id);
    if (result.importRow.status === "failed") {
      return {
        ok: false,
        error: result.parseErrors.join(" ") || result.importRow.error_summary || "Import failed.",
      };
    }
    return {
      ok: true,
      import_id: result.importRow.id,
      line_count: result.lineCount,
      parse_errors: result.parseErrors,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateExpenseImportLineAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateImportLineSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateExpenseImportLine({
      tenantId: tenantId.trim(),
      lineId: parsed.line_id,
      patch: {
        status: parsed.status,
        category_id: parsed.category_id,
        vendor_name: parsed.vendor_name,
        description_raw: parsed.description_raw,
        amount_cents: parsed.amount_cents,
        transaction_date: parsed.transaction_date,
        lead_id: parsed.lead_id,
        case_id: parsed.case_id,
      },
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function commitExpenseImportLinesAction(
  tenantId: string,
  body: unknown
): Promise<
  { ok: true; committed: number; expense_ids: string[] } | { ok: false; error: string }
> {
  try {
    const parsed = commitImportLinesSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const result = await commitExpenseImportLines({
      tenantId: tenantId.trim(),
      importId: parsed.import_id,
      lineIds: parsed.line_ids,
      commitAllAccepted: parsed.commit_all_accepted,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId, parsed.import_id);
    return {
      ok: true,
      committed: result.committed,
      expense_ids: result.expenseIds,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Receipt / invoice upload via FormData (File must be top-level FormData field).
 * Creates a draft expense by default and runs OCR inline (stub or OpenAI when configured).
 */
export async function uploadExpenseReceiptAction(formData: FormData): Promise<
  | {
      ok: true;
      document_id: string;
      expense_id: string | null;
      ocr_status: string;
      ocr_applied: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const fields = readExpenseReceiptUploadFormData(formData);
    if (!fields.ok) return { ok: false, error: fields.error };

    const access = await assertPaymentRecordWriteAllowed(fields.tenantId, fields.adminKey);
    const result = await uploadExpenseDocument({
      tenantId: fields.tenantId,
      file: fields.file,
      contentType: fields.contentType,
      originalFilename: fields.file.name || "receipt",
      docKind: fields.docKind,
      expenseId: fields.expenseId,
      createDraftExpense: fields.createDraftExpense || !fields.expenseId,
      runOcrInline: true,
      actorFiUserId: access.actorFiUserId,
    });

    revalidateExpensePaths(fields.tenantId);
    return {
      ok: true,
      document_id: result.document.id,
      expense_id: result.expense?.id ?? result.document.expense_id,
      ocr_status: result.document.ocr_status,
      ocr_applied: result.ocr_applied,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function reprocessExpenseDocumentOcrAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; document_id: string; ocr_status: string; expense_id: string | null }
  | { ok: false; error: string }
> {
  try {
    const parsed = reprocessOcrSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const result = await processExpenseDocumentOcr({
      tenantId: tenantId.trim(),
      documentId: parsed.document_id,
      actorFiUserId: access.actorFiUserId,
      applyToExpense: true,
    });
    revalidateExpensePaths(tenantId);
    return {
      ok: true,
      document_id: result.document.id,
      ocr_status: result.document.ocr_status,
      expense_id: result.document.expense_id,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const signedUrlSchema = z.object({
  adminKey: z.string().optional(),
  document_id: z.string().uuid(),
  ttl_sec: z.number().int().min(60).max(3600).optional(),
});

/**
 * Short-lived signed URL for receipt/invoice preview.
 * Stage 4: portal members with financial_os read access may preview (not write-only).
 * Admin key still accepted for automation/tooling.
 */
export async function getExpenseDocumentSignedUrlAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const parsed = signedUrlSchema.parse(body);
    const tid = tenantId.trim();
    if (parsed.adminKey) {
      await assertPaymentRecordWriteAllowed(tid, parsed.adminKey);
    } else {
      await assertFiTenantPortalAccess(tid);
      await assertStaffModuleAccess(tid, "financial_os", "read");
    }
    const url = await createExpenseDocumentSignedUrl({
      tenantId: tid,
      documentId: parsed.document_id,
      ttlSec: parsed.ttl_sec ?? 300,
    });
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Stage 6: export period expenses as FI CSV, QuickBooks CSV, or QuickBooks purchase JSON drafts.
 * Read-capable (financial_os read) — does not mutate data.
 */
export async function exportExpensesPeriodAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      format: "fi_csv" | "quickbooks_csv" | "quickbooks_json" | "xero_csv";
      filename: string;
      content: string;
      period_start: string;
      period_end: string;
      row_count: number;
      posted_count: number;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = periodExportSchema.parse(body ?? {});
    const tid = tenantId.trim();
    if (parsed.adminKey) {
      await assertPaymentRecordWriteAllowed(tid, parsed.adminKey);
    } else {
      await assertFiTenantPortalAccess(tid);
      await assertStaffModuleAccess(tid, "financial_os", "read");
    }

    const bundle = await buildExpensePeriodExports(tid, {
      periodStart: parsed.period_start,
      periodEnd: parsed.period_end,
    });

    if (parsed.format === "quickbooks_json") {
      return {
        ok: true,
        format: "quickbooks_json",
        filename: `fi-expenses-quickbooks-${bundle.period_start}_${bundle.period_end}.json`,
        content: JSON.stringify(
          {
            provider: "quickbooks",
            period_start: bundle.period_start,
            period_end: bundle.period_end,
            purchases: bundle.quickbooks_drafts,
            note: "Scaffold for QBO Purchase API; import CSV or run OAuth push later.",
          },
          null,
          2
        ),
        period_start: bundle.period_start,
        period_end: bundle.period_end,
        row_count: bundle.row_count,
        posted_count: bundle.posted_count,
      };
    }

    if (parsed.format === "quickbooks_csv") {
      return {
        ok: true,
        format: "quickbooks_csv",
        filename: `fi-expenses-quickbooks-${bundle.period_start}_${bundle.period_end}.csv`,
        content: bundle.quickbooks_csv,
        period_start: bundle.period_start,
        period_end: bundle.period_end,
        row_count: bundle.row_count,
        posted_count: bundle.posted_count,
      };
    }

    if (parsed.format === "xero_csv") {
      return {
        ok: true,
        format: "xero_csv",
        filename: `fi-expenses-xero-${bundle.period_start}_${bundle.period_end}.csv`,
        content: bundle.xero_csv,
        period_start: bundle.period_start,
        period_end: bundle.period_end,
        row_count: bundle.row_count,
        posted_count: bundle.posted_count,
      };
    }

    return {
      ok: true,
      format: "fi_csv",
      filename: `fi-expenses-${bundle.period_start}_${bundle.period_end}.csv`,
      content: bundle.fi_csv,
      period_start: bundle.period_start,
      period_end: bundle.period_end,
      row_count: bundle.row_count,
      posted_count: bundle.posted_count,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function suggestBankReconMatchesAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; suggested: number; period_start: string; period_end: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = reconSuggestSchema.parse(body ?? {});
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const result = await suggestBankReconMatches({
      tenantId: tenantId.trim(),
      periodStart: parsed.period_start,
      periodEnd: parsed.period_end,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function confirmBankReconMatchAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = reconMatchIdSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await confirmBankReconMatch({
      tenantId: tenantId.trim(),
      matchId: parsed.match_id,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function rejectBankReconMatchAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = reconMatchIdSchema.parse(body);
    const access = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await rejectBankReconMatch({
      tenantId: tenantId.trim(),
      matchId: parsed.match_id,
      actorFiUserId: access.actorFiUserId,
    });
    revalidateExpensePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function dryRunAccountingPushAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      provider: "quickbooks" | "xero";
      ready: boolean;
      reason: string;
      payload_count: number;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = accountingDryRunSchema.parse(body);
    const tid = tenantId.trim();
    if (parsed.adminKey) {
      await assertPaymentRecordWriteAllowed(tid, parsed.adminKey);
    } else {
      await assertFiTenantPortalAccess(tid);
      await assertStaffModuleAccess(tid, "financial_os", "read");
    }
    const result = await dryRunAccountingExpensePush(tid, parsed.provider, {
      periodStart: parsed.period_start,
      periodEnd: parsed.period_end,
    });
    return {
      ok: true,
      provider: result.provider,
      ready: result.ready,
      reason: result.reason,
      payload_count: result.payload_count,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
