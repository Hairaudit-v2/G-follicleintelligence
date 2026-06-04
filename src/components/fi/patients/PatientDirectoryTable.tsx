import type { PatientDirectoryRow as PatientDirectoryRowModel } from "@/src/lib/patients/patientDirectoryLoader";
import { PatientDirectoryRow } from "./PatientDirectoryRow";

export function PatientDirectoryTable({ tenantId, rows }: { tenantId: string; rows: PatientDirectoryRowModel[] }) {
  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2">Patient</th>
            <th className="hidden px-3 py-2 md:table-cell">Email</th>
            <th className="hidden px-3 py-2 lg:table-cell">Phone</th>
            <th className="px-3 py-2">Status</th>
            <th className="hidden px-3 py-2 sm:table-cell">Created</th>
            <th className="hidden px-3 py-2 xl:table-cell">Latest booking</th>
            <th className="px-3 py-2 text-center">Active cases</th>
            <th className="px-3 py-2 text-center">Leads</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <PatientDirectoryRow key={row.patientId} tenantId={tenantId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
