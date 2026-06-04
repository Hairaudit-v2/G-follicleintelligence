import Link from "next/link";
import type { CaseBookingListItem } from "@/src/lib/cases/caseLoaders";

export function CaseBookingsCard({ tenantId, bookings }: { tenantId: string; bookings: CaseBookingListItem[] }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Linked bookings</h2>
        <Link href={`/fi-admin/${tenantId}/bookings`} className="text-xs text-blue-600 hover:underline">
          Open bookings
        </Link>
      </div>
      {bookings.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No bookings are anchored to this case.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <span className="font-medium text-gray-900">{b.title?.trim() || b.booking_type}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {b.booking_type} · {b.booking_status}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {b.start_at ? new Date(b.start_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
