/** Dark FI OS badge tones for FinancialOS command-centre surfaces. */
export const financialOsStatusBadgeBase =
  "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export type FinancialOsStatusBadgeTone = keyof typeof financialOsStatusBadgeTones;

export const financialOsStatusBadgeTones = {
  neutral: "border-white/12 bg-white/[0.05] text-slate-200",
  info: "border-sky-500/30 bg-sky-500/[0.12] text-sky-100",
  pending: "border-amber-500/30 bg-amber-500/[0.12] text-amber-100",
  review: "border-indigo-500/30 bg-indigo-500/[0.12] text-indigo-100",
  success: "border-emerald-500/30 bg-emerald-500/[0.14] text-emerald-100",
  danger: "border-rose-500/35 bg-rose-500/[0.14] text-rose-100",
  warning: "border-orange-500/30 bg-orange-500/[0.12] text-orange-100",
  violet: "border-violet-500/30 bg-violet-500/[0.12] text-violet-100",
  purple: "border-purple-500/30 bg-purple-500/[0.12] text-purple-100",
  cancelled: "border-white/12 bg-white/[0.04] text-slate-400",
} as const;

const EXACT_STATUS_TONES: Record<string, FinancialOsStatusBadgeTone> = {
  succeeded: "success",
  paid: "success",
  settled: "success",
  completed: "success",
  approved: "success",
  active: "success",
  funds_released: "success",
  sent: "info",
  issued: "info",
  open: "info",
  submitted: "info",
  partial: "review",
  in_progress: "review",
  under_review: "review",
  pending: "pending",
  processing: "pending",
  draft: "pending",
  waiting_patient: "pending",
  waiting_provider: "pending",
  overdue: "danger",
  failed: "danger",
  rejected: "danger",
  expired: "danger",
  cancelled: "cancelled",
  canceled: "cancelled",
  inactive: "cancelled",
};

/** Maps raw record status strings to dark-surface badge tones (ReceptionOS-aligned semantics). */
export function resolveFinancialOsRecordStatusTone(status: string): FinancialOsStatusBadgeTone {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "neutral";
  if (EXACT_STATUS_TONES[normalized]) return EXACT_STATUS_TONES[normalized];
  if (normalized.includes("cancel")) return "cancelled";
  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("overdue")
  )
    return "danger";
  if (normalized.includes("pending") || normalized.includes("wait") || normalized.includes("draft"))
    return "pending";
  if (
    normalized.includes("approv") ||
    normalized.includes("success") ||
    normalized.includes("paid") ||
    normalized.includes("settl")
  ) {
    return "success";
  }
  if (
    normalized.includes("review") ||
    normalized.includes("progress") ||
    normalized.includes("partial")
  )
    return "review";
  return "neutral";
}
