/** Default wall-clock zone for Evolved Hair / Perth front-desk call-in booking. */
export const QUICK_CALL_IN_DEFAULT_TIMEZONE = "Australia/Perth";

/** Browser event: CRM Kanban board listens to refresh after call-in creates a lead. */
export const FI_CRM_KANBAN_REFRESH_EVENT = "fi-crm-kanban-refresh";

export function dispatchCrmKanbanRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FI_CRM_KANBAN_REFRESH_EVENT));
}
