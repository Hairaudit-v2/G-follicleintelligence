import { redirect } from "next/navigation";

export default async function PatientPortalIndexPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/patient/${tenantId.trim()}/medications`);
}
