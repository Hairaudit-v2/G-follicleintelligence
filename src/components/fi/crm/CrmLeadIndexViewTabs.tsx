import Link from "next/link";
import {
  buildCrmLeadListHref,
  parsedCrmLeadListToHrefQuery,
  type ParsedCrmLeadListQuery,
} from "@/src/lib/crm/crmLeadListQuery";

const tabClass = (active: boolean, dark: boolean) => {
  if (dark) {
    return active
      ? "bg-[#22C1FF]/15 text-[#F8FAFC] ring-1 ring-[#22C1FF]/35"
      : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#E2E8F0]";
  }
  return active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50";
};

export function CrmLeadIndexViewTabs({
  tenantId,
  query,
  variant = "light",
}: {
  tenantId: string;
  query: ParsedCrmLeadListQuery;
  variant?: "light" | "dark";
}) {
  const hrefQuery = parsedCrmLeadListToHrefQuery(query);
  const workspaceHref = buildCrmLeadListHref(tenantId, { ...hrefQuery, view: undefined });
  const listHref = buildCrmLeadListHref(tenantId, { ...hrefQuery, view: "list" });
  const boardHref = buildCrmLeadListHref(tenantId, { ...hrefQuery, view: "board" });
  const isWorkspace = query.view === "workspace";
  const isBoard = query.view === "board";
  const isList = query.view === "list";
  const dark = variant === "dark";

  return (
    <div
      className={
        dark
          ? "inline-flex rounded-lg border border-white/[0.1] bg-[#0c1220]/60 p-0.5 text-sm backdrop-blur-sm"
          : "inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm shadow-sm"
      }
    >
      <Link href={workspaceHref} className={`rounded-md px-3 py-1.5 font-medium ${tabClass(isWorkspace, dark)}`}>
        Workspace
      </Link>
      <Link href={listHref} className={`rounded-md px-3 py-1.5 font-medium ${tabClass(isList, dark)}`}>
        List
      </Link>
      <Link href={boardHref} className={`rounded-md px-3 py-1.5 font-medium ${tabClass(isBoard, dark)}`}>
        Board
      </Link>
    </div>
  );
}
