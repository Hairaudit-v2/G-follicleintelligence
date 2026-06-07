import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PatientDirectoryPage } from "@/src/components/fi/patients/PatientDirectoryPage";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadPatientDirectoryPage } from "@/src/lib/patients/patientDirectoryLoader";
import {
  buildPatientOsOverviewFallback,
  loadPatientOsOverview,
} from "@/src/lib/patients/patientOsDashboardLoader.server";
import { parsePatientDirectoryQuery } from "@/src/lib/patients/patientDirectoryQuery";

export const metadata = {
  title: "PatientOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PatientsHomeRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const sp = (await searchParams) ?? {};
  const query = parsePatientDirectoryQuery(sp);
  const [data, showCrmNav, showBookingsBoard] = await Promise.all([
    loadPatientDirectoryPage(tenantId.trim(), query),
    getCrmShellNavAllowed(tenantId),
    getBookingsBoardNavAllowed(tenantId),
  ]);

  let patientOs;
  try {
    patientOs = await loadPatientOsOverview(tenantId.trim(), { summary: data.summary });
  } catch {
    patientOs = buildPatientOsOverviewFallback(data.summary);
  }

  return (
    <PatientDirectoryPage
      tenantId={tenantId.trim()}
      data={data}
      patientOs={patientOs}
      showCrmNav={showCrmNav}
      showBookingsBoard={showBookingsBoard}
    />
  );
}
