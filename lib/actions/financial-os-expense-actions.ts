"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
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
