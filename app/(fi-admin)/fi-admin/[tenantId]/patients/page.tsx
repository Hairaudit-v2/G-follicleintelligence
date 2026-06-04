import { PatientDirectoryPage } from "@/src/components/fi/patients/PatientDirectoryPage";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";
import { loadPatientDirectoryPage } from "@/src/lib/patients/patientDirectoryLoader";
import { parsePatientDirectoryQuery } from "@/src/lib/patients/patientDirectoryQuery";

export const metadata = {
  title: "Patients",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PatientsDirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { tenantId } = await params;
  await assertCrmShellPageAccess(tenantId);
  const q = parsePatientDirectoryQuery(searchParams);
  const data = await loadPatientDirectoryPage(tenantId, q);
  return <PatientDirectoryPage tenantId={tenantId} data={data} />;
}
