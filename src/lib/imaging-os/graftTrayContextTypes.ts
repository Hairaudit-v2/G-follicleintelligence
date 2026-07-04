/**
 * Discriminated graft tray link context (FI-IMAGING-GRAFT-TRAY-CONTEXT-1).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GraftTraySlotVariant } from "./imagingGraftTrayBridgeCore";

export type { GraftTraySlotVariant };

export type GraftTrayCaptureBase = {
  tenant_id: string;
  patient_id: string;
  image_id: string;
};

export type GraftTraySurgeryLinkage = {
  surgery_id?: string | null;
  case_id?: string | null;
  booking_id?: string | null;
  procedure_day_id?: string | null;
};

export type GraftTrayProtocolLinkage = {
  protocol_session_id?: string | null;
  protocol_slot_slug: string;
  protocol_template_slug?: string | null;
  capture_source: string;
};

/** Legacy flat input from capture routes (compatibility — camelCase). */
export type FlatGraftTrayLinkInput = {
  tenantId: string;
  patientId: string;
  imageId: string;
  protocolSessionId?: string | null;
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  anatomicalRegion?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  surgeryId?: string | null;
  capturedByStaffId?: string | null;
  captureSource?: string | null;
  metadata?: Record<string, unknown>;
  qualityNeedsReview?: boolean;
  client?: SupabaseClient;
};

export type GraftTrayCaptureContext = GraftTrayCaptureBase & {
  kind: "graft_tray_capture";
  slot_variant: GraftTraySlotVariant;
  surgery: GraftTraySurgeryLinkage;
  protocol: GraftTrayProtocolLinkage;
  image_category?: string | null;
  anatomical_region?: string | null;
  captured_by_staff_id?: string | null;
  metadata?: Record<string, unknown>;
  quality_needs_review?: boolean;
};

export type GraftTrayContextValidationIssue = {
  field: string;
  message: string;
};

export type GraftTrayContextValidationResult = {
  valid: boolean;
  issues: GraftTrayContextValidationIssue[];
};