import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTenantBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { isVieProtocolSlug } from "./vieProtocolCatalog";
import {
  parseVieCapturePolicyFromTenantMetadata,
  type VieCapturePolicy,
  VIE_CAPTURE_POLICY_DEFAULTS,
} from "./vieCapturePolicy";

/** Capture sources that must use an active VIE protocol session (no generic upload). */
export const VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES = [
  "patient_profile",
  "patient_slide_over",
  "profile_upload_form",
  "vie_capture_wizard",
  "surgery_os",
  "appointment_procedure",
] as const;

export type VieProtocolRequiredCaptureSource =
  (typeof VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES)[number];

export function normalizeCaptureSource(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export function isVieProtocolRequiredSource(source: string): boolean {
  return (VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES as readonly string[]).includes(source);
}

export type VieCapturePolicyInput = {
  captureSource: unknown;
  protocolSessionId: string | null;
  protocolTemplateSlug: string | null;
  protocolSlotSlug: string | null;
};

/**
 * Enforces protocol-driven capture for patient-facing upload paths.
 * ImagingOS wizard paths already require session preconditions via guided fields.
 */
export function assertVieProtocolCapturePolicy(input: VieCapturePolicyInput): void {
  const source = normalizeCaptureSource(input.captureSource);

  if (source === "imaging_os_wizard") return;

  if (!isVieProtocolRequiredSource(source)) return;

  const sessionId = input.protocolSessionId?.trim() ?? "";
  const templateSlug = input.protocolTemplateSlug?.trim() ?? "";
  const slotSlug = input.protocolSlotSlug?.trim() ?? "";

  if (!sessionId) {
    throw new Error(
      "Clinical photography requires an active capture protocol. Use Start Capture Protocol to begin."
    );
  }
  if (!templateSlug || !isVieProtocolSlug(templateSlug)) {
    throw new Error("Invalid or missing VIE protocol template for this capture.");
  }
  if (!slotSlug) {
    throw new Error("Protocol slot is required for each capture.");
  }
}

export async function loadVieCapturePolicyForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<VieCapturePolicy> {
  try {
    const settings = await loadTenantBranding(tenantId.trim(), client);
    if (!settings?.metadata) return { ...VIE_CAPTURE_POLICY_DEFAULTS };
    return parseVieCapturePolicyFromTenantMetadata(settings.metadata);
  } catch {
    return { ...VIE_CAPTURE_POLICY_DEFAULTS };
  }
}
