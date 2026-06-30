import Link from "next/link";

export function CrmLeadDetailBreadcrumbs({
  tenantId,
  leadTitle,
}: {
  tenantId: string;
  leadTitle: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href={`/fi-admin/${tenantId}`} className="text-blue-300 hover:underline">
            Tenant
          </Link>
        </li>
        <li aria-hidden className="text-gray-400">
          /
        </li>
        <li>
          <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-300 hover:underline">
            CRM leads
          </Link>
        </li>
        <li aria-hidden className="text-gray-400">
          /
        </li>
        <li className="font-medium text-slate-100" aria-current="page">
          {leadTitle}
        </li>
      </ol>
    </nav>
  );
}
