import { z } from "zod";

import type { PaymentContext, PaymentStatus } from "@/src/lib/payments/paymentRecordModel";

const uuid = z.string().uuid();

const PAYMENT_CONTEXT_Z = z.enum(["consultation", "surgery", "medication_reorder", "other"] as unknown as [
  PaymentContext,
  ...PaymentContext[],
]);

const PAYMENT_STATUS_Z = z.enum([
  "not_required",
  "pending",
  "partially_paid",
  "paid",
  "waived",
  "refunded",
  "overdue",
] as unknown as [PaymentStatus, ...PaymentStatus[]]);

export const createPaymentRecordBodySchema = z.object({
  adminKey: z.string().optional().nullable(),
  payment_context: PAYMENT_CONTEXT_Z,
  patient_id: uuid.nullable().optional(),
  lead_id: uuid.nullable().optional(),
  consultation_id: uuid.nullable().optional(),
  case_id: uuid.nullable().optional(),
  booking_id: uuid.nullable().optional(),
  amount_expected: z.coerce.number().finite().min(0).max(99_999_999),
  amount_paid: z.coerce.number().finite().min(0).max(99_999_999).optional().default(0),
  currency: z.string().trim().min(3).max(3).optional().default("AUD"),
  status: PAYMENT_STATUS_Z.optional().default("pending"),
  due_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export type CreatePaymentRecordBody = z.infer<typeof createPaymentRecordBodySchema>;

export const updatePaymentRecordStatusBodySchema = z.object({
  adminKey: z.string().optional().nullable(),
  payment_record_id: uuid,
  status: PAYMENT_STATUS_Z,
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const recordManualPaymentBodySchema = z.object({
  adminKey: z.string().optional().nullable(),
  payment_record_id: uuid,
  /** Additional amount received (added to `amount_paid`). */
  payment_amount: z.coerce.number().finite().positive().max(99_999_999),
  notes: z.string().trim().max(4000).nullable().optional(),
});
