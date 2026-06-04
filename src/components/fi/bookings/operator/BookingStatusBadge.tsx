import { bookingStatusLabel } from "@/src/lib/bookings/operatorBookingLabels";

const tone: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-800 border-slate-200",
  confirmed: "bg-blue-50 text-blue-900 border-blue-200",
  arrived: "bg-amber-50 text-amber-900 border-amber-200",
  completed: "bg-emerald-50 text-emerald-900 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  no_show: "bg-red-50 text-red-900 border-red-200",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = status.trim();
  const cls = tone[s] ?? "bg-gray-50 text-gray-800 border-gray-200";
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {bookingStatusLabel(s)}
    </span>
  );
}
