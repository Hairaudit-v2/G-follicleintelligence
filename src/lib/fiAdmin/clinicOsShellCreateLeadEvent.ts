/** Dispatched on `window` to open the lightweight Create Lead modal from the FI OS shell. */
export const CLINIC_OS_OPEN_CREATE_LEAD_EVENT = "fi-clinic-os:open-create-lead";

export function dispatchOpenCreateLeadModal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLINIC_OS_OPEN_CREATE_LEAD_EVENT));
}
