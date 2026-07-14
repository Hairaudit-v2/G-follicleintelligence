import { z } from "zod";

import {
  FI_EXPENSE_IMPORT_LINE_STATUSES,
  FI_EXPENSE_IMPORT_SOURCE_TYPES,
  FI_EXPENSE_PAYMENT_METHODS,
  FI_EXPENSE_STATUSES,
} from "@/src/lib/financialOs/expenses/expenseTypes";

export const optionalAdminKeySchema = z.object({
  adminKey: z.string().optional(),
});

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const optionalUuid = z.string().uuid().nullable().optional();

export const createManualExpenseSchema = optionalAdminKeySchema.extend({
  expense_date: ymd,
  amount_cents: z.number().int().nonnegative(),
  currency: z.string().trim().min(1).max(8).optional(),
  vendor_name: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  category_id: optionalUuid,
  payment_method: z.enum(FI_EXPENSE_PAYMENT_METHODS).optional().nullable(),
  clinic_id: optionalUuid,
  lead_id: optionalUuid,
  case_id: optionalUuid,
  patient_id: optionalUuid,
  campaign_key: z.string().trim().max(200).optional().nullable(),
  procedure_type: z.string().trim().max(100).optional().nullable(),
  status: z.enum(["draft", "reviewed"]).optional(),
  idempotency_key: z.string().trim().min(1).max(200).optional().nullable(),
});

export const updateExpenseSchema = optionalAdminKeySchema.extend({
  expense_id: z.string().uuid(),
  expense_date: ymd.optional(),
  amount_cents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  vendor_name: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  category_id: optionalUuid,
  payment_method: z.enum(FI_EXPENSE_PAYMENT_METHODS).optional().nullable(),
  clinic_id: optionalUuid,
  lead_id: optionalUuid,
  case_id: optionalUuid,
  patient_id: optionalUuid,
  campaign_key: z.string().trim().max(200).optional().nullable(),
  procedure_type: z.string().trim().max(100).optional().nullable(),
  status: z.enum(FI_EXPENSE_STATUSES).optional(),
});

export const postExpenseSchema = optionalAdminKeySchema.extend({
  expense_id: z.string().uuid(),
});

export const voidExpenseSchema = optionalAdminKeySchema.extend({
  expense_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const createExpenseImportSchema = optionalAdminKeySchema.extend({
  source_type: z.enum(FI_EXPENSE_IMPORT_SOURCE_TYPES),
  original_filename: z.string().trim().max(500).optional().nullable(),
  clinic_id: optionalUuid,
  csv_text: z.string().min(1).max(2_000_000).optional(),
});

export const updateImportLineSchema = optionalAdminKeySchema.extend({
  line_id: z.string().uuid(),
  status: z.enum(FI_EXPENSE_IMPORT_LINE_STATUSES).optional(),
  category_id: optionalUuid,
  vendor_name: z.string().trim().max(200).optional().nullable(),
  description_raw: z.string().trim().max(2000).optional().nullable(),
  amount_cents: z.number().int().nonnegative().optional(),
  transaction_date: ymd.optional().nullable(),
  campaign_key: z.string().trim().max(200).optional().nullable(),
  lead_id: optionalUuid,
  case_id: optionalUuid,
});

export const commitImportLinesSchema = optionalAdminKeySchema.extend({
  import_id: z.string().uuid(),
  line_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
  /** When true, commit all accepted lines for the import. */
  commit_all_accepted: z.boolean().optional(),
});

export type CreateManualExpenseInput = z.infer<typeof createManualExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateExpenseImportInput = z.infer<typeof createExpenseImportSchema>;
