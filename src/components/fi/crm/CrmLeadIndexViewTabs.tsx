import Link from "next/link";
import {
  buildCrmLeadListHref,
  parsedCrmLeadListToHrefQuery,
  type ParsedCrmLeadListQuery,
} from "@/src/lib/crm/crmLeadListQuery";

export function CrmLeadIndexViewTabs({
  tenantId,
  query,
}: {
  tenantId: string;
  query: ParsedCrmLeadListQuery;
}) {
  const hrefQuery = parsedCrmLeadListToHrefQuery(query);
  const listHref = buildCrmLeadListHref(tenantId, { ...hrefQuery, view: undefined });
  const boardHref = buildCrmLeadListHref(tenantId, { ...hrefQuery, view: "board" });
  const isBoard = query.view === "board";

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm shadow-sm">
      <Link
        href={listHref}
        className={`rounded-md px-3 py-1.5 font-medium ${
          !isBoard ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        List
      </Link>
      <Link
        href={boardHref}
        className={`rounded-md px-3 py-1.5 font-medium ${
          isBoard ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        Board
      </Link>
    </div>
  );
}
