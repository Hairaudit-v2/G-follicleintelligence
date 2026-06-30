import Link from "next/link";
import {
  buildCrmLeadListHref,
  parsedCrmLeadListToHrefQuery,
  type ParsedCrmLeadListQuery,
} from "@/src/lib/crm/crmLeadListQuery";

export function CrmLeadListPagination({
  tenantId,
  query,
  total,
}: {
  tenantId: string;
  query: ParsedCrmLeadListQuery;
  total: number;
}) {
  const pageSize = query.pageSize;
  const pageCount = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const current = total === 0 ? 1 : Math.min(Math.max(1, query.page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(current * pageSize, total);
  const base = parsedCrmLeadListToHrefQuery(query);

  const prevHref =
    current > 1 ? buildCrmLeadListHref(tenantId, { ...base, page: current - 1 }) : null;
  const nextHref =
    current < pageCount ? buildCrmLeadListHref(tenantId, { ...base, page: current + 1 }) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
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
