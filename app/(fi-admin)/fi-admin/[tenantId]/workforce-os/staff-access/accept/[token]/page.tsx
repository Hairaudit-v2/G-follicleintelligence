import { notFound } from "next/navigation";

import { StaffAccessAcceptClient } from "@/src/components/fi/workforce/StaffAccessAcceptClient";
import { loadStaffAccessInviteByToken } from "@/src/lib/workforce/staffAccessAccept.server";

export default async function StaffAccessAcceptPage({
  params,
}: {
  params: Promise<{ tenantId: string; token: string }>;
}) {
  const { tenantId, token } = await params;

  let model;
  try {
    model = await loadStaffAccessInviteByToken(tenantId, token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invitation not found.";
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-rose-200">
        {message}
      </div>
    );
  }

  if (!model) notFound();

  return <StaffAccessAcceptClient model={model} inviteToken={token} />;
}
