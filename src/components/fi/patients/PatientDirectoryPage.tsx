import Link from "next/link";
import type { PatientDirectoryPageResult } from "@/src/lib/patients/patientDirectoryLoader";
import { buildPatientDirectoryHref, patientDirectoryHasActiveFilters } from "@/src/lib/patients/patientDirectoryQuery";
import { PatientDirectoryFilters } from "./PatientDirectoryFilters";
import { PatientDirectoryPagination } from "./PatientDirectoryPagination";
import { PatientDirectoryTable } from "./PatientDirectoryTable";

export function PatientDirectoryPage({
  tenantId,
  data,
  showCrmNav,
}: {
  tenantId: string;
  data: PatientDirectoryPageResult;
  showCrmNav: boolean;
}) {
  const { rows, total, query, summary } = data;
  const filtered = patientDirectoryHasActiveFilters(query);
  const firstPageHref = buildPatientDirectoryHref(tenantId, { ...query, page: 1 });
  const base = `/fi-admin/${tenantId}`;

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">Patients</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            Searchable patient directory — click a name for a quick preview, or open the full profile.
          </p>
          <p className="text-sm text-gray-600">
            <Link href={`${base}/crm`} className="text-blue-600 hover:underline">
              ← CRM
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`${base}/appointments`} className="text-blue-600 hover:underline">
              Appointments
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`${base}/cases`} className="text-blue-600 hover:underline">
              Patients
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/patients/new`}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
            title="Intake hub — direct create coming soon"
          >
            New patient
          </Link>
          {showCrmNav ? (
            <Link
              href={`${base}/bookings/new`}
              className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              Book appointment
            </Link>
          ) : (
            <span
              className="rounded border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500"
              title="Bookings require CRM workspace access"
            >
              Book appointment (CRM access)
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Patient directory summary">
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total patients</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{summary.totalPatients}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Active status</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{summary.activePatients}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">With active patient</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{summary.withActiveCase}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Upcoming appointment</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{summary.withFutureBooking}</p>
        </div>
      </section>

      <PatientDirectoryFilters tenantId={tenantId} query={query} leadSourceOptions={data.leadSourceOptions} />

      <section className="space-y-0 rounded border border-gray-200 bg-white shadow-sm">
        {total === 0 && !filtered ? (
          <div className="p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-800">No patients yet</p>
            <p className="mt-2">Convert a CRM lead or run ingest to see rows here.</p>
          </div>
        ) : total === 0 && filtered ? (
          <div className="p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-800">No patients match these filters</p>
            <p className="mt-2">Try clearing filters or widening your search.</p>
            <p className="mt-3">
              <Link href={`${base}/patients`} className="text-blue-600 hover:underline">
                Clear filters
              </Link>
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-800">No patients on this page</p>
            <p className="mt-2">Try going to the first page or loosening filters.</p>
            <p className="mt-3">
              <Link href={firstPageHref} className="text-blue-600 hover:underline">
                Go to page 1
              </Link>
            </p>
          </div>
        ) : (
          <>
            <PatientDirectoryTable tenantId={tenantId} rows={rows} />
            <PatientDirectoryPagination tenantId={tenantId} query={query} total={total} />
          </>
        )}
      </section>

      <p className="text-xs text-gray-500">
        Tip: click a patient name to open the slide-over preview; ⌘/Ctrl-click opens the full profile in a new tab.
      </p>
    </div>
  );
}
