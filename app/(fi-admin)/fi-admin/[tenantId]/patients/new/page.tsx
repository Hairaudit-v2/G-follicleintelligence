import { notFound } from "next/navigation";

import { NewPatientEntryPage } from "@/src/components/fi-admin/patients/NewPatientEntryPage";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Add new patient",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPatientEntryRoutePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await getClinicFloorPageSession(tenantId);

  return <NewPatientEntryPage tenantId={tenantId} />;
}
