import Link from "next/link";
import type { PatientDirectoryPageResult } from "@/src/lib/patients/patientDirectoryLoader";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";
import { buildPatientDirectoryHref, patientDirectoryHasActiveFilters } from "@/src/lib/patients/patientDirectoryQuery";
import { PatientOsOverviewPanels } from "./PatientOsOverviewPanels";
import { PatientDirectoryFilters } from "./PatientDirectoryFilters";
import { PatientDirectoryPagination } from "./PatientDirectoryPagination";
import { PatientDirectoryTable } from "./PatientDirectoryTable";

export function PatientDirectoryPage({
  tenantId,
  data,
  patientOs,
  showCrmNav,
  showBookingsBoard,
}: {
  tenantId: string;
  data: PatientDirectoryPageResult;
  patientOs: PatientOsOverviewModel;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
}) {
  const { rows, total, query } = data;
  const filtered = patientDirectoryHasActiveFilters(query);
  const firstPageHref = buildPatientDirectoryHref(tenantId, { ...query, page: 1 });
  const base = `/fi-admin/${tenantId}`;

  return (
    <div className="mx-auto max-w-[88rem] min-w-0 space-y-6 py-6">
      <PatientOsOverviewPanels
        tenantId={tenantId}
        model={patientOs}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
      />

      <div className="space-y-6 border-t border-slate-200 pt-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">Patient directory</h2>
            <p className="max-w-3xl text-sm text-slate-600">
              Searchable directory — click a name for a quick preview, or open the full profile. Filters and pagination
              behave the same as before.
            </p>
            <p className="text-sm text-slate-600">
              {showCrmNav ? (
                <Link href={`${base}/crm`} className="font-medium text-sky-700 hover:underline">
                  LeadFlow (CRM)
                </Link>
              ) : (
                <span className="text-slate-400" title="CRM workspace is not enabled for your role">
                  LeadFlow
                </span>
              )}
              <span className="mx-2 text-slate-300">·</span>
              <Link href={`${base}/appointments`} className="font-medium text-sky-700 hover:underline">
                Appointments
              </Link>
              <span className="mx-2 text-slate-300">·</span>
              <Link href={`${base}/cases`} className="font-medium text-sky-700 hover:underline">
                SurgeryOS (cases)
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${base}/patients/new`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              New patient
            </Link>
            {showBookingsBoard ? (
              <Link
                href={`${base}/bookings/new`}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                Book appointment
              </Link>
            ) : (
              <span
                className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500"
                title="Bookings require scheduling access (admin/CRM operator or active staff link)"
              >
                Book appointment (no access)
              </span>
            )}
          </div>
        </header>

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
    </div>
  );
}
