import Link from "next/link";
import { buildPatientDirectoryHref, type PatientDirectoryQuery } from "@/src/lib/patients/patientDirectoryQuery";

export function PatientDirectoryPagination({
  tenantId,
  query,
  total,
}: {
  tenantId: string;
  query: PatientDirectoryQuery;
  total: number;
}) {
  const pageSize = query.pageSize;
  const pageCount = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const current = total === 0 ? 1 : Math.min(Math.max(1, query.page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(current * pageSize, total);
  const prevHref = current > 1 ? buildPatientDirectoryHref(tenantId, { ...query, page: current - 1 }) : null;
  const nextHref =
    current < pageCount ? buildPatientDirectoryHref(tenantId, { ...query, page: current + 1 }) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
      <p>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
        {total > pageSize ? ` (page ${current} of ${pageCount})` : null}
      </p>
      <div className="flex gap-3">
        {prevHref ? (
          <Link href={prevHref} className="text-blue-600 hover:underline">
            Previous
          </Link>
        ) : (
          <span className="text-gray-400">Previous</span>
        )}
        {nextHref ? (
          <Link href={nextHref} className="text-blue-600 hover:underline">
            Next
          </Link>
        ) : (
          <span className="text-gray-400">Next</span>
        )}
      </div>
    </div>
  );
}
