import Link from "next/link";
import type { PatientDirectoryRow as PatientDirectoryRowModel } from "@/src/lib/patients/patientDirectoryLoader";
import { PatientStatusBadge } from "./PatientStatusBadge";

export function PatientDirectoryRow({ tenantId, row }: { tenantId: string; row: PatientDirectoryRowModel }) {
  const href = `/fi-admin/${tenantId}/patients/${row.patientId}`;
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/80">
      <td className="px-3 py-2 text-sm">
        <Link href={href} className="font-medium text-blue-700 hover:underline">
          {row.displayName}
        </Link>
      </td>
      <td className="hidden px-3 py-2 text-xs text-gray-600 md:table-cell">{row.email ?? "—"}</td>
      <td className="hidden px-3 py-2 text-xs text-gray-600 lg:table-cell">{row.phone ?? "—"}</td>
      <td className="px-3 py-2">
        <PatientStatusBadge status={row.patientStatus} />
      </td>
      <td className="hidden px-3 py-2 text-xs text-gray-600 sm:table-cell">{row.createdAt.slice(0, 10)}</td>
      <td className="hidden px-3 py-2 text-xs text-gray-600 xl:table-cell">{row.latestBookingAt?.slice(0, 10) ?? "—"}</td>
      <td className="px-3 py-2 text-center text-xs tabular-nums text-gray-700">{row.activeCaseCount}</td>
      <td className="px-3 py-2 text-center text-xs tabular-nums text-gray-700">{row.linkedLeadCount}</td>
    </tr>
  );
}
