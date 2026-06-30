import Link from "next/link";

export function PatientDetailBreadcrumbs({
  tenantId,
  patientName,
}: {
  tenantId: string;
  patientName: string;
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
          <Link href={`/fi-admin/${tenantId}/patients`} className="text-blue-300 hover:underline">
            Patients
          </Link>
        </li>
        <li aria-hidden className="text-gray-400">
          /
        </li>
        <li className="font-medium text-slate-100" aria-current="page">
          {patientName}
        </li>
      </ol>
    </nav>
  );
}
