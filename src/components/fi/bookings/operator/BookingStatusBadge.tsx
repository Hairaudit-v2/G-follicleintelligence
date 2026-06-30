import { bookingStatusLabel } from "@/src/lib/bookings/operatorBookingLabels";

const tone: Record<string, string> = {
  scheduled: "bg-white/[0.06] text-slate-200 border-white/[0.08]",
  confirmed: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  arrived: "bg-amber-400/10 text-amber-200 border-amber-400/20",
  completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  cancelled: "bg-white/[0.06] text-slate-300 border-white/[0.08]",
  no_show: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = status.trim();
  const cls = tone[s] ?? "bg-white/[0.03] text-slate-200 border-white/[0.08]";
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {bookingStatusLabel(s)}
    </span>
  );
}
