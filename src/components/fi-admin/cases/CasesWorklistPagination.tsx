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
  const activeLink = `${btnClass} border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-100 hover:bg-white/[0.03]`;
  const disabled = `${btnClass} cursor-not-allowed border-white/[0.08] bg-white/[0.03] text-gray-400`;

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">
          Page <span className="font-medium text-slate-100">{page}</span> of{" "}
          <span className="font-medium text-slate-100">{totalPages}</span>
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
        <span className="text-xs text-slate-400">Rows per page</span>
        <div className="flex gap-1">
          {CASES_INDEX_PAGE_SIZE_OPTIONS.map((ps) => {
            const active = ps === pageSize;
            return (
              <Link
                key={ps}
                href={casesWorklistHref(tenantId, query, { pageSize: ps, page: 1 })}
                className={`rounded border px-2.5 py-1 text-xs font-medium ${
                  active ? "border-gray-900 bg-gray-900 text-white" : "border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-200 hover:bg-white/[0.03]"
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
