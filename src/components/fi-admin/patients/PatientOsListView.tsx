import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { PatientDirectoryFilters } from "@/src/components/fi/patients/PatientDirectoryFilters";
import { PatientDirectoryPagination } from "@/src/components/fi/patients/PatientDirectoryPagination";
import { PatientDirectoryTable } from "@/src/components/fi/patients/PatientDirectoryTable";
import type { PatientDirectoryPageResult } from "@/src/lib/patients/patientDirectoryLoader";
import {
  buildPatientDirectoryHref,
  patientDirectoryHasActiveFilters,
} from "@/src/lib/patients/patientDirectoryQuery";
import { patientOsLinkButtonClass } from "@/src/lib/fiAdmin/patientPresentation";

export function PatientOsListView({
  tenantId,
  data,
  showBookingsBoard,
}: {
  tenantId: string;
  data: PatientDirectoryPageResult;
  showBookingsBoard: boolean;
}) {
  const { rows, total, query } = data;
  const filtered = patientDirectoryHasActiveFilters(query);
  const base = `/fi-admin/${tenantId}`;
  const firstPageHref = buildPatientDirectoryHref(tenantId, { ...query, page: 1 }, { view: "list" });
  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-6 pb-10 sm:space-y-8 sm:pb-14">
      <DashboardCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={`${base}/patients`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300/90 transition hover:text-cyan-200"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to workspace
            </Link>
            <SectionHeader
              kicker="Directory"
              title="All patients"
              description="Full patient list with search, filters, and pagination. Click a name for slide-over preview."
              className="mt-3"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/patients/new`} className={patientOsLinkButtonClass}>
              New patient
            </Link>
            {showBookingsBoard ? (
              <Link href={`${base}/bookings/new`} className={patientOsLinkButtonClass}>
                Book appointment
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <PatientDirectoryFilters
            tenantId={tenantId}
            query={query}
            leadSourceOptions={data.leadSourceOptions}
            listView
          />
        </div>

        <section className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c1220]/50">
          {total === 0 && !filtered ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No patients yet</p>
              <p className="mt-2">Create a patient or convert a lead to begin coordinating journeys.</p>
            </div>
          ) : total === 0 && filtered ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No patients match these filters</p>
              <p className="mt-2">Try clearing filters or widening your search.</p>
              <p className="mt-3">
                <Link href={`${base}/patients?view=list`} className="text-cyan-300 hover:underline">
                  Clear filters
                </Link>
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No patients on this page</p>
              <p className="mt-2">Try going to the first page or loosening filters.</p>
              <p className="mt-3">
                <Link href={firstPageHref} className="text-cyan-300 hover:underline">
                  Go to page 1
                </Link>
              </p>
            </div>
          ) : (
            <>
              <PatientDirectoryTable tenantId={tenantId} rows={rows} />
              <PatientDirectoryPagination tenantId={tenantId} query={query} total={total} listView />
            </>
          )}
        </section>

        <p className="mt-3 text-xs text-[#64748B]">
          Tip: click a patient name for slide-over preview; ⌘/Ctrl-click opens the full profile in a new tab.
        </p>
      </DashboardCard>
    </div>
  );
}
