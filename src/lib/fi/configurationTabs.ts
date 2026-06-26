export const CONFIGURATION_TABS = ["branding", "calendar"] as const;

export type ConfigurationTabId = (typeof CONFIGURATION_TABS)[number];

const TAB_SET = new Set<string>(CONFIGURATION_TABS);

export const CONFIGURATION_TAB_LABELS: Record<ConfigurationTabId, string> = {
  branding: "Branding",
  calendar: "Calendar",
};

export function parseConfigurationTab(raw: string | string[] | undefined): ConfigurationTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim().toLowerCase();
  if (t && TAB_SET.has(t)) return t as ConfigurationTabId;
  return "branding";
}
