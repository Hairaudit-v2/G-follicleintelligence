/**
 * ReceptionOS — optional module availability (Phase 6–8 resilience).
 */

export const RECEPTION_OS_MODULE_KEYS = [
  "board_sections",
  "tasks",
  "revenue_activity",
  "closeout",
  "system_status",
  "pilot_metrics",
  "pilot_review",
  "owner_value",
  "demo_mode",
  "export",
] as const;

export type ReceptionOsModuleKey = (typeof RECEPTION_OS_MODULE_KEYS)[number];

export type ReceptionOsModuleHealthItem = {
  module: ReceptionOsModuleKey;
  label: string;
  message: string;
};

export type ReceptionOsModuleHealth = {
  coreBoardLoaded: boolean;
  unavailableModules: ReceptionOsModuleHealthItem[];
};

export const RECEPTION_OS_MODULE_LABELS: Record<ReceptionOsModuleKey, string> = {
  board_sections: "Board sections",
  tasks: "Task inbox",
  revenue_activity: "Revenue activity",
  closeout: "End-of-day closeout",
  system_status: "System status",
  pilot_metrics: "Pilot metrics",
  pilot_review: "Pilot review",
  owner_value: "Owner value dashboard",
  demo_mode: "Demo mode",
  export: "Pilot export",
};

export function createEmptyReceptionOsModuleHealth(
  coreBoardLoaded = false
): ReceptionOsModuleHealth {
  return { coreBoardLoaded, unavailableModules: [] };
}

export function markReceptionOsModuleUnavailable(
  health: ReceptionOsModuleHealth,
  module: ReceptionOsModuleKey,
  message: string
): ReceptionOsModuleHealth {
  const label = RECEPTION_OS_MODULE_LABELS[module];
  const filtered = health.unavailableModules.filter((item) => item.module !== module);
  return {
    ...health,
    unavailableModules: [...filtered, { module, label, message }],
  };
}

export function receptionOsHasModuleWarnings(health: ReceptionOsModuleHealth): boolean {
  return health.unavailableModules.length > 0;
}
