import Link from "next/link";
import type { PatientDirectoryPageResult } from "@/src/lib/patients/patientDirectoryLoader";
import { buildPatientDirectoryHref } from "@/src/lib/patients/patientDirectoryQuery";
import { PatientDirectoryFilters } from "./PatientDirectoryFilters";
import { PatientDirectoryTable } from "./PatientDirectoryTable";

export function PatientDirectoryPage({ tenantId, data }: { tenantId: string; data: PatientDirectoryPageResult }) {
  const { rows, total, query } = data;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const prev =
    query.page > 1 ? buildPatientDirectoryHref(tenantId, { ...query, page: query.page - 1 }) : null;
  const next =
    query.page < totalPages ? buildPatientDirectoryHref(tenantId, { ...query, page: query.page + 1 }) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-gray-900">Patients</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Searchable patient directory — foundation layer for future clinical modules, imaging, HLI, HairAudit, and
          SurgeryOS.
        </p>
        <p className="text-sm text-gray-600">
          <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-600 hover:underline">
            ← CRM
          </Link>
          <span className="mx-2 text-gray-300">·</span>
          <Link href={`/fi-admin/${tenantId}/bookings`} className="text-blue-600 hover:underline">
            Bookings
          </Link>
        </p>
      </header>

      <PatientDirectoryFilters tenantId={tenantId} query={query} />

      <section className="space-y-3">
        <p className="text-xs text-gray-500">
          Showing {rows.length} of {total} patients (page {query.page} / {totalPages}).
        </p>
        {rows.length === 0 ? (
          <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 shadow-sm">
            No patients match these filters.
          </div>
        ) : (
          <PatientDirectoryTable tenantId={tenantId} rows={rows} />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            {prev ? (
              <Link href={prev} className="text-blue-600 hover:underline">
                ← Previous
              </Link>
            ) : (
              <span className="text-gray-400">← Previous</span>
            )}
          </div>
          <div>
            {next ? (
              <Link href={next} className="text-blue-600 hover:underline">
                Next →
              </Link>
            ) : (
              <span className="text-gray-400">Next →</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
