import Link from "next/link";
import type { PatientDirectoryRow as PatientDirectoryRowModel } from "@/src/lib/patients/patientDirectoryLoader";
import { PatientStatusBadge } from "./PatientStatusBadge";

export function PatientDirectoryRow({ tenantId, row }: { tenantId: string; row: PatientDirectoryRowModel }) {
  const href = `/fi-admin/${tenantId}/patients/${row.patientId}`;
  return (
    <tr className="border-t border-white/[0.06] hover:bg-white/[0.03]">
      <td className="px-3 py-2 text-sm">
        <Link href={href} className="font-medium text-blue-700 hover:underline">
          {row.displayName}
        </Link>
      </td>
      <td className="hidden px-3 py-2 text-xs text-slate-400 md:table-cell">{row.email ?? "—"}</td>
      <td className="hidden px-3 py-2 text-xs text-slate-400 lg:table-cell">{row.phone ?? "—"}</td>
      <td className="px-3 py-2">
        <PatientStatusBadge status={row.patientStatus} />
      </td>
      <td className="hidden px-3 py-2 text-xs text-slate-400 sm:table-cell">{row.createdAt.slice(0, 10)}</td>
      <td className="hidden px-3 py-2 text-xs text-slate-400 xl:table-cell">
        {row.lastVisitAt?.slice(0, 10) ?? "—"}
      </td>
      <td className="px-3 py-2 text-center text-xs tabular-nums text-slate-300">{row.activeCaseCount}</td>
      <td className="px-3 py-2 text-center text-xs tabular-nums text-slate-300">{row.linkedLeadCount}</td>
    </tr>
  );
}
