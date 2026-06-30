import type {
  FiFinancialTransactionDirection,
  FiFinancialTransactionKind,
} from "@/src/lib/financialOs/financialTransactionCore";

export type LedgerInvariantViolationCode =
  | "tenant_id_required"
  | "amount_not_finite"
  | "negative_amount_not_allowed"
  | "debit_only_refund_processed"
  | "cross_tenant_anchor"
  | "idempotency_key_empty"
  | "idempotency_key_cross_tenant";

export type LedgerAppendValidationInput = {
  tenantId: string;
  amountCents: number;
  direction?: FiFinancialTransactionDirection;
  transactionKind: FiFinancialTransactionKind;
  idempotencyKey?: string | null;
  /** When set, must equal tenantId (invoice/payment anchor isolation). */
  anchorTenantId?: string | null;
};

export type LedgerAppendValidationResult =
  | { ok: true; normalizedAmountCents: number; direction: FiFinancialTransactionDirection }
  | { ok: false; code: LedgerInvariantViolationCode; message: string };

/** Ledger rows are append-only at the application layer; DB revokes UPDATE/DELETE on service_role. */
export const FI_FINANCIAL_LEDGER_APPEND_ONLY = true as const;

const DEBIT_ALLOWED_KINDS: ReadonlySet<FiFinancialTransactionKind> = new Set(["refund_processed"]);

export function validateLedgerAppendInput(
  input: LedgerAppendValidationInput
): LedgerAppendValidationResult {
  const tid = input.tenantId?.trim();
  if (!tid) {
    return { ok: false, code: "tenant_id_required", message: "tenantId is required." };
  }

  if (!Number.isFinite(input.amountCents)) {
    return {
      ok: false,
      code: "amount_not_finite",
      message: "amountCents must be a finite number.",
    };
  }

  const direction: FiFinancialTransactionDirection = input.direction ?? "credit";
  const rawAmount = Math.floor(input.amountCents);

  if (rawAmount < 0) {
    return {
      ok: false,
      code: "negative_amount_not_allowed",
      message: "Negative amount_cents is not allowed on the ledger.",
    };
  }

  if (direction === "debit" && !DEBIT_ALLOWED_KINDS.has(input.transactionKind)) {
    return {
      ok: false,
      code: "debit_only_refund_processed",
      message: `Debit direction is only permitted for refund_processed transactions (got ${input.transactionKind}).`,
    };
  }

  const anchorTid = input.anchorTenantId?.trim();
  if (anchorTid && anchorTid !== tid) {
    return {
      ok: false,
      code: "cross_tenant_anchor",
      message: "Cross-tenant ledger anchor is not permitted.",
    };
  }

  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey !== null && idempotencyKey.length === 0) {
    return {
      ok: false,
      code: "idempotency_key_empty",
      message: "idempotencyKey cannot be empty when provided.",
    };
  }

  if (idempotencyKey?.includes(":")) {
    const prefix = idempotencyKey.split(":")[0];
    if (prefix === "tenant" && !idempotencyKey.startsWith(`tenant:${tid}:`)) {
      return {
        ok: false,
        code: "idempotency_key_cross_tenant",
        message: "Idempotency key tenant prefix does not match tenantId.",
      };
    }
  }

  return { ok: true, normalizedAmountCents: Math.max(0, rawAmount), direction };
}

export function assertLedgerRowsTenantScoped(
  rows: Array<{ tenant_id: string }>,
  expectedTenantId: string
): boolean {
  const tid = expectedTenantId.trim();
  return rows.every((r) => String(r.tenant_id) === tid);
}

export function ledgerAuditRequiredForAppend(): true {
  return true;
}
