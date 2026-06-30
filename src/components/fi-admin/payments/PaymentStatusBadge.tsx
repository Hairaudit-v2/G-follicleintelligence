"use client";

import { cn } from "@/lib/utils";
import type { EffectivePaymentStatus, PaymentStatus } from "@/src/lib/payments/paymentRecordModel";
import { computeEffectivePaymentStatus } from "@/src/lib/payments/paymentRecordModel";

const STATUS_TONE: Record<EffectivePaymentStatus | "neutral", string> = {
  not_required: "border-white/[0.08] bg-white/[0.03] text-slate-300",
  pending: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  partially_paid: "border-amber-300 bg-amber-400/10 text-amber-200",
  paid: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  waived: "border-white/[0.08] bg-white/[0.06] text-slate-300",
  refunded: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  overdue: "border-rose-300 bg-rose-500/10 text-rose-200",
  overdue_derived: "border-rose-300 bg-rose-500/10 text-rose-200",
  neutral: "border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md text-slate-300",
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
  const eff = computeEffectivePaymentStatus(
    { status: props.status, due_date: props.dueDate },
    props.todayYmd
  );
  const tone = STATUS_TONE[eff] ?? STATUS_TONE.neutral;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold capitalize",
        tone,
        props.className
      )}
      title="Recorded payment status (manual tracking — not integrated billing)."
    >
      {labelFor(eff)}
    </span>
  );
}
