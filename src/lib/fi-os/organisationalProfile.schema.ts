/** Shared row shapes for FI OS Stage 3.5 organisational tables (no server imports). */

export type FiStaffPositionTypeRow = {
  id: string;
  tenant_id: string | null;
  code: string;
  title: string;
  department: string;
  description: string | null;
  default_workspace_profile: string | null;
  default_feature_template_key: string | null;
  clinical_access_level: string | null;
  is_system: boolean;
  is_active: boolean;
};

export type FiStaffFeatureTemplateRow = {
  id: string;
  tenant_id: string | null;
  template_key: string;
  label: string;
  description: string | null;
  feature_access: unknown;
  workspace_profile: string | null;
  is_system: boolean;
  is_active: boolean;
};

export type FiTenantOperatingModeRow = {
  id: string;
  tenant_id: string | null;
  mode_key: string;
  label: string;
  description: string | null;
  default_features: unknown;
  default_workspace_profiles: unknown;
  is_system: boolean;
  is_active: boolean;
};
