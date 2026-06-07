import Link from "next/link";
import { buildCalendarHref } from "@/src/lib/bookings/calendarQuery";
import type { PatientProfileFoundationData, PatientProfileBookingCard } from "@/src/lib/patients/patientProfileLoader";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function BookingLine({ tenantId, b }: { tenantId: string; b: PatientProfileBookingCard }) {
  const cal = buildCalendarHref(tenantId, { date: b.start_at.slice(0, 10) });
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">{b.title?.trim() || b.booking_type}</span>
        <span className="text-xs text-gray-500">{b.booking_status}</span>
      </div>
      <p className="text-xs text-gray-600">{fmt(b.start_at)}</p>
      <p className="mt-1 text-xs">
        <Link href={cal} className="text-blue-600 hover:underline">
          Open calendar
        </Link>
        <span className="mx-1 text-gray-300">·</span>
        <Link href={`/fi-admin/${tenantId}/appointments`} className="text-blue-600 hover:underline">
          Appointments
        </Link>
      </p>
    </li>
  );
}

export function PatientBookingsCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  const { upcoming, past } = data.bookings;
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Appointments</h2>
      {upcoming.length === 0 && past.length === 0 ? (
        <div className="mt-2 space-y-2 text-sm text-gray-600">
          <p>No appointments for this patient yet.</p>
          <p className="text-xs text-gray-500">
            Open{" "}
            <Link href={`/fi-admin/${tenantId}/appointments`} className="text-blue-600 hover:underline">
              Appointments
            </Link>{" "}
            or the{" "}
            <Link href={`/fi-admin/${tenantId}/calendar`} className="text-blue-600 hover:underline">
              calendar
            </Link>{" "}
            to schedule when you have booking access.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {upcoming.length ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Upcoming</h3>
              <ul className="divide-y divide-gray-100">
                {upcoming.map((b) => (
                  <BookingLine key={b.id} tenantId={tenantId} b={b} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No upcoming appointments.</p>
          )}
          {past.length ? (
            <details className="rounded border border-gray-100 bg-gray-50/50 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-gray-700">Past appointments ({past.length})</summary>
              <ul className="mt-2 divide-y divide-gray-100">
                {past.map((b) => (
                  <BookingLine key={b.id} tenantId={tenantId} b={b} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}
