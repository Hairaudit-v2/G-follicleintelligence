"use client";

import { NewEnquiryDialog } from "@/src/components/fi-admin/leadflow/NewEnquiryDialog";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

export function LeadFlowNewLeadButton({
  tenantId,
  owners,
  defaultOwnerUserId,
}: {
  tenantId: string;
  owners?: Pick<CrmShellUserPickerOption, "id" | "email" | "full_name">[];
  defaultOwnerUserId?: string;
}) {
  return (
    <NewEnquiryDialog
      tenantId={tenantId}
      owners={owners}
      defaultOwnerUserId={defaultOwnerUserId}
      triggerLabel="+ New enquiry"
    />
  );
}
