import type { FiInvoiceStatus } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { normalizeInvoiceStatusValue } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type InvoiceTransitionOptions = {
  /** Allows cancelled → paid (manual admin settlement). */
  adminOverride?: boolean;
  /** Allows unpaid → partially_paid / paid when recording payment allocation. */
  paymentSettlement?: boolean;
};

export type InvoiceTransitionViolationCode =
  | "transition_blocked"
  | "terminal_state"
  | "same_status";

const UNPAID_STATUSES: ReadonlySet<FiInvoiceStatus> = new Set([
  "draft",
  "sent",
  "awaiting_payment",
  "partially_paid",
  "overdue",
]);

const ALLOWED: ReadonlyMap<FiInvoiceStatus, ReadonlySet<FiInvoiceStatus>> = new Map([
  ["draft", new Set(["sent", "awaiting_payment", "cancelled"])],
  ["sent", new Set(["awaiting_payment", "partially_paid", "paid", "overdue", "cancelled"])],
  ["awaiting_payment", new Set(["partially_paid", "paid", "overdue", "cancelled"])],
  ["partially_paid", new Set(["paid", "overdue", "cancelled"])],
  ["overdue", new Set(["partially_paid", "paid", "cancelled"])],
  ["paid", new Set(["refunded"])],
  ["cancelled", new Set()],
  ["refunded", new Set()],
]);

const BLOCKED_EXPLICIT: ReadonlyArray<[FiInvoiceStatus, FiInvoiceStatus]> = [
  ["paid", "awaiting_payment"],
  ["paid", "sent"],
  ["paid", "draft"],
  ["paid", "partially_paid"],
  ["paid", "overdue"],
  ["refunded", "paid"],
  ["cancelled", "paid"],
];

export function normalizeTransitionStatus(status: string): FiInvoiceStatus {
  return normalizeInvoiceStatusValue(status);
}

export function isInvoiceUnpaidStatus(status: FiInvoiceStatus | string): boolean {
  return UNPAID_STATUSES.has(normalizeTransitionStatus(String(status)));
}

export function isInvoiceTransitionAllowed(
  fromStatus: FiInvoiceStatus | string,
  toStatus: FiInvoiceStatus | string,
  opts?: InvoiceTransitionOptions
): boolean {
  const from = normalizeTransitionStatus(String(fromStatus));
  const to = normalizeTransitionStatus(String(toStatus));

  if (from === to) return true;

  if (
    opts?.paymentSettlement &&
    UNPAID_STATUSES.has(from) &&
    (to === "partially_paid" || to === "paid")
  ) {
    return true;
  }

  if (opts?.adminOverride && from === "cancelled" && to === "paid") {
    return true;
  }

  for (const [blockedFrom, blockedTo] of BLOCKED_EXPLICIT) {
    if (from === blockedFrom && to === blockedTo) return false;
  }

  const allowedTargets = ALLOWED.get(from);
  if (!allowedTargets) return false;
  return allowedTargets.has(to);
}

export function assertInvoiceTransitionAllowed(
  fromStatus: FiInvoiceStatus | string,
  toStatus: FiInvoiceStatus | string,
  opts?: InvoiceTransitionOptions
): void {
  const from = normalizeTransitionStatus(String(fromStatus));
  const to = normalizeTransitionStatus(String(toStatus));
  if (from === to) return;
  if (!isInvoiceTransitionAllowed(from, to, opts)) {
    throw new Error(`Invoice status transition not allowed: ${from} → ${to}.`);
  }
}

export function assertInvoiceTransitionAllowedOrSame(
  fromStatus: FiInvoiceStatus | string,
  toStatus: FiInvoiceStatus | string,
  opts?: InvoiceTransitionOptions
): void {
  assertInvoiceTransitionAllowed(fromStatus, toStatus, opts);
}
