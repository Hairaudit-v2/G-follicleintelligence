"use client";

import { cn } from "@/lib/utils";
import type { EffectivePaymentStatus, PaymentStatus } from "@/src/lib/payments/paymentRecordModel";
import { computeEffectivePaymentStatus } from "@/src/lib/payments/paymentRecordModel";

const STATUS_TONE: Record<EffectivePaymentStatus | "neutral", string> = {
  not_required: "border-slate-200 bg-slate-50 text-slate-700",
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  partially_paid: "border-amber-300 bg-amber-50 text-amber-950",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-900",
  waived: "border-slate-200 bg-slate-100 text-slate-700",
  refunded: "border-violet-200 bg-violet-50 text-violet-900",
  overdue: "border-rose-300 bg-rose-50 text-rose-950",
  overdue_derived: "border-rose-300 bg-rose-50 text-rose-950",
  neutral: "border-slate-200 bg-white text-slate-700",
};

function labelFor(status: EffectivePaymentStatus | PaymentStatus): string {
  return status.replace(/_/g, " ");
}

export function PaymentStatusBadge(props: {
  status: PaymentStatus;
  dueDate: string | null;
  todayYmd: string;
  className?: string;
}) {
  const eff = computeEffectivePaymentStatus({ status: props.status, due_date: props.dueDate }, props.todayYmd);
  const tone = STATUS_TONE[eff] ?? STATUS_TONE.neutral;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold capitalize",
        tone,
        props.className,
      )}
      title="Recorded payment status (manual tracking — not integrated billing)."
    >
      {labelFor(eff)}
    </span>
  );
}
