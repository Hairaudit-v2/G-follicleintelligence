import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy path — templates hub supersedes standalone reminders settings. */
export default async function TenantReminderSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) redirect("/fi-admin");
  redirect(`/fi-admin/${tenantId.trim()}/settings/templates?tab=booking`);
}
