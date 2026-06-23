"use client";

import { dispatchOpenCreateLeadModal } from "@/src/lib/fiAdmin/clinicOsShellCreateLeadEvent";
import { leadFlowLinkButtonClass } from "@/src/lib/fiAdmin/leadFlowPresentation";

export function LeadFlowNewLeadButton() {
  return (
    <button type="button" onClick={() => dispatchOpenCreateLeadModal()} className={leadFlowLinkButtonClass}>
      New lead
    </button>
  );
}
