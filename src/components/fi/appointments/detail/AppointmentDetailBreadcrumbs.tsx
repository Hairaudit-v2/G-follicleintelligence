import Link from "next/link";

export function AppointmentDetailBreadcrumbs({
  tenantId,
  appointmentTitle,
  leadHref,
  patientHref,
}: {
  tenantId: string;
  appointmentTitle: string;
  leadHref: string | null;
  patientHref: string | null;
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
          <Link
            href={`/fi-admin/${tenantId}/appointments`}
            className="text-blue-300 hover:underline"
          >
            Appointments
          </Link>
        </li>
        {leadHref ? (
          <>
            <li aria-hidden className="text-gray-400">
              /
            </li>
            <li>
              <Link href={leadHref} className="text-blue-300 hover:underline">
                Lead
              </Link>
            </li>
          </>
        ) : null}
        {patientHref ? (
          <>
            <li aria-hidden className="text-gray-400">
              /
            </li>
            <li>
              <Link href={patientHref} className="text-blue-300 hover:underline">
                Patient
              </Link>
            </li>
          </>
        ) : null}
        <li aria-hidden className="text-gray-400">
          /
        </li>
        <li className="font-medium text-slate-100" aria-current="page">
          {appointmentTitle}
        </li>
      </ol>
    </nav>
  );
}
