import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  FiPatientPrescriptionRow,
  FiPrescriptionItemRow,
} from "@/src/lib/prescribing/fiPrescribingTypes";

export type FiCompoundPharmacyRow = {
  id: string;
  tenant_id: string;
  pharmacy_name: string;
  contact_email: string;
  api_endpoint: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type PharmacyTransmissionMethod = "email" | "api" | "manual_export";
export type PharmacyTransmissionStatus = "pending" | "sent" | "failed" | "acknowledged";

export type FiPharmacyTransmissionRow = {
  id: string;
  tenant_id: string;
  prescription_id: string;
  pharmacy_id: string;
  method: PharmacyTransmissionMethod;
  status: PharmacyTransmissionStatus;
  payload_snapshot: Record<string, unknown>;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function asPharmacyRow(raw: Record<string, unknown>): FiCompoundPharmacyRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    pharmacy_name: String(raw.pharmacy_name ?? ""),
    contact_email: String(raw.contact_email ?? ""),
    api_endpoint: raw.api_endpoint != null ? String(raw.api_endpoint) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    address: raw.address != null ? String(raw.address) : null,
    active: Boolean(raw.active),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

function asTransmissionRow(raw: Record<string, unknown>): FiPharmacyTransmissionRow {
  const snap = raw.payload_snapshot;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    prescription_id: String(raw.prescription_id),
    pharmacy_id: String(raw.pharmacy_id),
    method: raw.method as PharmacyTransmissionMethod,
    status: raw.status as PharmacyTransmissionStatus,
    payload_snapshot:
      snap && typeof snap === "object" && !Array.isArray(snap)
        ? (snap as Record<string, unknown>)
        : {},
    sent_at: raw.sent_at != null ? String(raw.sent_at) : null,
    error_message: raw.error_message != null ? String(raw.error_message) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export async function loadActiveCompoundPharmaciesForTenant(
  tenantId: string
): Promise<FiCompoundPharmacyRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_compound_pharmacies")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("active", true)
    .order("pharmacy_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asPharmacyRow(r as Record<string, unknown>));
}

export async function loadPharmacyTransmissionsForPrescription(
  tenantId: string,
  prescriptionId: string
): Promise<FiPharmacyTransmissionRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pharmacy_transmissions")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("prescription_id", prescriptionId.trim())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asTransmissionRow(r as Record<string, unknown>));
}

export async function loadPharmacyTransmissionById(
  tenantId: string,
  transmissionId: string
): Promise<FiPharmacyTransmissionRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pharmacy_transmissions")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("id", transmissionId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return asTransmissionRow(data as Record<string, unknown>);
}

export async function loadCompoundPharmacyById(
  tenantId: string,
  pharmacyId: string
): Promise<FiCompoundPharmacyRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_compound_pharmacies")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("id", pharmacyId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return asPharmacyRow(data as Record<string, unknown>);
}

export type LatestTransmissionOutcome = "none" | "sent" | "failed" | "pending";

export function classifyLatestTransmissionOutcome(
  rows: FiPharmacyTransmissionRow[]
): LatestTransmissionOutcome {
  if (rows.length === 0) return "none";
  const latest = rows[0]!;
  if (latest.status === "pending") return "pending";
  if (latest.status === "failed") return "failed";
  if (latest.status === "sent" || latest.status === "acknowledged") return "sent";
  return "none";
}

export type PharmacyOrderPayloadSnapshotV1 = {
  version: 1;
  generated_at: string;
  prescription: Pick<
    FiPatientPrescriptionRow,
    | "id"
    | "patient_id"
    | "doctor_id"
    | "case_id"
    | "delivery_type"
    | "patient_shipping_address"
    | "clinical_notes"
    | "signed_at"
  >;
  items: FiPrescriptionItemRow[];
  patient: { display_name: string; email: string | null };
  prescriber: { full_name: string; staff_role: string };
  pharmacy: Pick<
    FiCompoundPharmacyRow,
    "id" | "pharmacy_name" | "contact_email" | "phone" | "address"
  >;
};
