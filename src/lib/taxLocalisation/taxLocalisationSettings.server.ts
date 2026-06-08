import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  applyClinicCountryHintToDocument,
  buildDefaultTaxLocalisationDocument,
  parseFiTaxCountryRegionFromMetadata,
} from "@/src/lib/taxLocalisation/taxLocalisationDefaults";
import { mergeTaxLocalisationFromStorage, taxLocalisationDocumentToRowPayload } from "@/src/lib/taxLocalisation/taxLocalisationMerge";
import type { FiClinicOption, FiTaxCountryRegion, FiTaxLocalisationDocument } from "@/src/lib/taxLocalisation/taxLocalisationTypes";

export async function loadClinicsForTenant(tenantId: string): Promise<FiClinicOption[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tid)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    displayName: String((r as { display_name: string }).display_name ?? ""),
  }));
}

export async function loadTaxLocalisationDocumentForScope(opts: {
  tenantId: string;
  clinicId: string | null;
}): Promise<FiTaxLocalisationDocument | null> {
  const tid = opts.tenantId.trim();
  const cid = opts.clinicId?.trim() || null;
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_tax_localisation_settings")
    .select("country_region, currency, effective_from, tax_profile, invoice_settings, receipt_settings")
    .eq("tenant_id", tid);
  q = cid ? q.eq("clinic_id", cid) : q.is("clinic_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as {
    country_region: string;
    currency: string;
    effective_from: string;
    tax_profile: unknown;
    invoice_settings: unknown;
    receipt_settings: unknown;
  };
  return mergeTaxLocalisationFromStorage({
    countryRegion: r.country_region,
    currency: r.currency,
    effectiveFrom: r.effective_from,
    taxProfile: r.tax_profile,
    invoiceSettings: r.invoice_settings,
    receiptSettings: r.receipt_settings,
  });
}

/**
 * Optional country hint for a clinic (`fi_clinic_settings.metadata` then `fi_clinics.metadata`).
 * Keys: `tax_country_region` or `country_region` (e.g. `NZ`, `AU`).
 */
export async function loadClinicCountryRegionHint(tenantId: string, clinicId: string): Promise<FiTaxCountryRegion | null> {
  const tid = tenantId.trim();
  const cid = clinicId.trim();
  if (!tid || !cid) return null;
  const supabase = supabaseAdmin();

  const { data: cs } = await supabase
    .from("fi_clinic_settings")
    .select("metadata")
    .eq("tenant_id", tid)
    .eq("clinic_id", cid)
    .maybeSingle();
  const m1 = cs?.metadata as Record<string, unknown> | undefined;
  const fromSettings = parseFiTaxCountryRegionFromMetadata(m1?.tax_country_region ?? m1?.country_region);
  if (fromSettings) return fromSettings;

  const { data: cl } = await supabase.from("fi_clinics").select("metadata").eq("tenant_id", tid).eq("id", cid).maybeSingle();
  const m2 = cl?.metadata as Record<string, unknown> | undefined;
  return parseFiTaxCountryRegionFromMetadata(m2?.tax_country_region ?? m2?.country_region);
}

/**
 * Effective document for quotes/invoices/receipts: clinic row, else tenant row with optional
 * clinic country metadata overlay, else defaults.
 */
export async function resolveTaxLocalisationDocumentOrDefault(opts: {
  tenantId: string;
  clinicId: string | null;
}): Promise<FiTaxLocalisationDocument> {
  const tid = opts.tenantId.trim();
  const cid = opts.clinicId?.trim() || null;

  const tenantDoc = await loadTaxLocalisationDocumentForScope({ tenantId: tid, clinicId: null });

  if (!cid) {
    if (tenantDoc) return tenantDoc;
    return buildDefaultTaxLocalisationDocument("AU");
  }

  const clinicDoc = await loadTaxLocalisationDocumentForScope({ tenantId: tid, clinicId: cid });
  if (clinicDoc) return clinicDoc;

  const hint = await loadClinicCountryRegionHint(tid, cid);
  if (tenantDoc) {
    return applyClinicCountryHintToDocument(tenantDoc, hint);
  }
  return buildDefaultTaxLocalisationDocument(hint ?? "AU");
}

export async function upsertTaxLocalisationDocument(opts: {
  tenantId: string;
  clinicId: string | null;
  document: FiTaxLocalisationDocument;
}): Promise<void> {
  const tid = opts.tenantId.trim();
  const cid = opts.clinicId?.trim() || null;
  const payload = taxLocalisationDocumentToRowPayload(opts.document);
  const supabase = supabaseAdmin();

  let existing = supabase.from("fi_tax_localisation_settings").select("id").eq("tenant_id", tid);
  existing = cid ? existing.eq("clinic_id", cid) : existing.is("clinic_id", null);
  const { data: row, error: findErr } = await existing.maybeSingle();
  if (findErr) throw new Error(findErr.message);

  const rowPayload = {
    tenant_id: tid,
    clinic_id: cid,
    country_region: payload.country_region,
    currency: payload.currency,
    effective_from: payload.effective_from,
    tax_profile: payload.tax_profile,
    invoice_settings: payload.invoice_settings,
    receipt_settings: payload.receipt_settings,
    updated_at: new Date().toISOString(),
  };

  if (row) {
    const { error: upErr } = await supabase
      .from("fi_tax_localisation_settings")
      .update(rowPayload)
      .eq("id", String((row as { id: string }).id));
    if (upErr) throw new Error(upErr.message);
    return;
  }

  const { error: insErr } = await supabase.from("fi_tax_localisation_settings").insert({
    ...rowPayload,
    created_at: new Date().toISOString(),
  });
  if (insErr) throw new Error(insErr.message);
}
