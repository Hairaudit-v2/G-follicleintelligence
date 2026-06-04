import Link from "next/link";
import type { CasesIndexQuery } from "@/src/lib/cases/casesIndexTypes";
import { CASES_INDEX_PAGE_SIZE_OPTIONS } from "@/src/lib/cases/casesIndexTypes";
import { casesWorklistHref } from "@/src/lib/cases/casesIndexFilters";

export function CasesWorklistPagination({
  tenantId,
  query,
  totalMatching,
}: {
  tenantId: string;
  query: CasesIndexQuery;
  totalMatching: number;
}) {
  const { page, pageSize } = query;
  const totalPages = totalMatching === 0 ? 1 : Math.ceil(totalMatching / pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const btnClass =
    "inline-flex items-center rounded border px-3 py-1.5 text-xs font-medium transition-colors";
  const activeLink = `${btnClass} border-gray-300 bg-white text-gray-900 hover:bg-gray-50`;
  const disabled = `${btnClass} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400`;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-600">
          Page <span className="font-medium text-gray-900">{page}</span> of{" "}
          <span className="font-medium text-gray-900">{totalPages}</span>
        </span>
        {canPrev ? (
          <Link href={casesWorklistHref(tenantId, query, { page: page - 1 })} className={activeLink}>
            Previous
          </Link>
        ) : (
          <span className={disabled}>Previous</span>
        )}
        {canNext ? (
          <Link href={casesWorklistHref(tenantId, query, { page: page + 1 })} className={activeLink}>
            Next
          </Link>
        ) : (
          <span className={disabled}>Next</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-600">Rows per page</span>
        <div className="flex gap-1">
          {CASES_INDEX_PAGE_SIZE_OPTIONS.map((ps) => {
            const active = ps === pageSize;
            return (
              <Link
                key={ps}
                href={casesWorklistHref(tenantId, query, { pageSize: ps, page: 1 })}
                className={`rounded border px-2.5 py-1 text-xs font-medium ${
                  active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                }`}
              >
                {ps}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
