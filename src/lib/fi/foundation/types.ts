import type { SupabaseClient } from "@supabase/supabase-js";

/** All helpers accept an admin Supabase client; callers must use service role only. */
export type FoundationSupabase = SupabaseClient;

export type OrganisationType =
  | "clinical_network"
  | "commercial_partner"
  | "standards_program"
  | "internal"
  | "other";

export type FiOrganisationRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string | null;
  organisation_type: OrganisationType;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ResolveOrganisationInput = {
  tenant_id: string;
  source_system: string;
  source_organisation_id?: string | null;
  name?: string | null;
  type?: OrganisationType | null;
  metadata?: Record<string, unknown> | null;
};

export type ResolveOrganisationResult = {
  organisation: FiOrganisationRow;
  created: boolean;
  mapping_created: boolean;
};

export type FiClinicRow = {
  id: string;
  tenant_id: string;
  organisation_id: string | null;
  display_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ResolveClinicInput = {
  tenant_id: string;
  organisation_id?: string | null;
  source_system: string;
  source_clinic_id?: string | null;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ResolveClinicResult = {
  clinic: FiClinicRow;
  created: boolean;
  mapping_created: boolean;
};

export type FiPersonRow = {
  id: string;
  tenant_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ResolvePersonInput = {
  tenant_id: string;
  source_system: string;
  source_person_id?: string | null;
  source_patient_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ResolvePersonResult = {
  person: FiPersonRow;
  created: boolean;
  mapping_created: boolean;
};

export type FiPatientRow = {
  id: string;
  tenant_id: string;
  person_id: string;
  primary_clinic_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Stage 4A — present when columns exist on `fi_patients`. */
  admin_note?: string | null;
  patient_status?: string;
};

export type ResolvePatientInput = {
  tenant_id: string;
  person_id: string;
  source_system: string;
  source_patient_id?: string | null;
  global_patient_id?: string | null;
  primary_clinic_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ResolvePatientResult = {
  patient: FiPatientRow;
  created: boolean;
  mapping_created: boolean;
};

export type FiCaseRowMinimal = {
  id: string;
  tenant_id: string;
  status: string;
  external_id: string | null;
  foundation_patient_id: string | null;
  clinic_id: string | null;
  organisation_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ResolveCaseFoundationInput = {
  tenant_id: string;
  existing_case_id?: string | null;
  foundation_patient_id?: string | null;
  clinic_id?: string | null;
  organisation_id?: string | null;
  source_system: string;
  source_case_id?: string | null;
  case_type?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ResolveCaseFoundationResult = {
  case: FiCaseRowMinimal;
  created: boolean;
  updated: boolean;
};

export type CreateTimelineEventInput = {
  tenant_id: string;
  /** Required: fi_timeline_events.case_id is NOT NULL in schema. */
  case_id: string;
  patient_id?: string | null;
  foundation_patient_id?: string | null;
  person_id?: string | null;
  clinic_id?: string | null;
  organisation_id?: string | null;
  source_system?: string | null;
  fi_event_id?: string | null;
  /** Stored as fi_timeline_events.event_kind. */
  event_type: string;
  title: string | null;
  description?: string | null;
  occurred_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateTimelineEventResult = {
  id: string;
  created: boolean;
};

export type CreateMediaAssetInput = {
  tenant_id: string;
  case_id?: string | null;
  foundation_patient_id?: string | null;
  person_id?: string | null;
  clinic_id?: string | null;
  organisation_id?: string | null;
  source_system?: string | null;
  source_asset_id?: string | null;
  asset_type: string;
  storage_path: string;
  file_name?: string | null;
  mime_type?: string | null;
  /** Optional file size in bytes (mirrors fi_media_assets.size_bytes). */
  size_bytes?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateMediaAssetResult = {
  id: string;
  created: boolean;
};
