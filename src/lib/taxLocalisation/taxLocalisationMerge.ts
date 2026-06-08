import { buildDefaultTaxLocalisationDocument } from "./taxLocalisationDefaults";
import type { FiTaxCountryRegion, FiTaxLocalisationDocument, FiTaxProfile } from "./taxLocalisationTypes";
import { FI_TAX_COUNTRY_REGIONS, FI_TAX_CURRENCIES } from "./taxLocalisationTypes";

function isCountry(v: string): v is FiTaxCountryRegion {
  return (FI_TAX_COUNTRY_REGIONS as readonly string[]).includes(v);
}

function isCurrency(v: string): v is import("./taxLocalisationTypes").FiTaxCurrency {
  return (FI_TAX_CURRENCIES as readonly string[]).includes(v);
}

function coerceTaxProfile(country: FiTaxCountryRegion, raw: unknown): FiTaxProfile {
  const base = buildDefaultTaxLocalisationDocument(country).taxProfile;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  switch (country) {
    case "AU": {
      const b = base as Extract<FiTaxProfile, { country: "AU" }>;
      return {
        country: "AU",
        abn: typeof o.abn === "string" ? o.abn : b.abn,
        businessName: typeof o.businessName === "string" ? o.businessName : b.businessName,
        gstRegistered: typeof o.gstRegistered === "boolean" ? o.gstRegistered : b.gstRegistered,
        gstRatePercent: typeof o.gstRatePercent === "number" && Number.isFinite(o.gstRatePercent) ? o.gstRatePercent : b.gstRatePercent,
      };
    }
    case "IN": {
      const b = base as Extract<FiTaxProfile, { country: "IN" }>;
      const gh = o.gstHandling === "igst" || o.gstHandling === "mixed" || o.gstHandling === "cgst_sgst" ? o.gstHandling : b.gstHandling;
      return {
        country: "IN",
        gstin: typeof o.gstin === "string" ? o.gstin : b.gstin,
        state: typeof o.state === "string" ? o.state : b.state,
        placeOfSupply: typeof o.placeOfSupply === "string" ? o.placeOfSupply : b.placeOfSupply,
        gstHandling: gh,
        defaultCgstPercent:
          typeof o.defaultCgstPercent === "number" && Number.isFinite(o.defaultCgstPercent) ? o.defaultCgstPercent : b.defaultCgstPercent,
        defaultSgstPercent:
          typeof o.defaultSgstPercent === "number" && Number.isFinite(o.defaultSgstPercent) ? o.defaultSgstPercent : b.defaultSgstPercent,
        defaultIgstPercent:
          typeof o.defaultIgstPercent === "number" && Number.isFinite(o.defaultIgstPercent) ? o.defaultIgstPercent : b.defaultIgstPercent,
      };
    }
    case "NZ": {
      const b = base as Extract<FiTaxProfile, { country: "NZ" }>;
      return {
        country: "NZ",
        gstNumber: typeof o.gstNumber === "string" ? o.gstNumber : b.gstNumber,
        gstRegistered: typeof o.gstRegistered === "boolean" ? o.gstRegistered : b.gstRegistered,
        gstRatePercent: typeof o.gstRatePercent === "number" && Number.isFinite(o.gstRatePercent) ? o.gstRatePercent : b.gstRatePercent,
      };
    }
    default:
      return { country };
  }
}

function coerceInvoice(raw: unknown, fallback: FiTaxLocalisationDocument["invoiceSettings"]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  const n = o.startingInvoiceNumber;
  const startNum = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : fallback.startingInvoiceNumber;
  return {
    invoicePrefix: typeof o.invoicePrefix === "string" ? o.invoicePrefix : fallback.invoicePrefix,
    startingInvoiceNumber: startNum,
    paymentTerms: typeof o.paymentTerms === "string" ? o.paymentTerms : fallback.paymentTerms,
    showTaxBreakdown: typeof o.showTaxBreakdown === "boolean" ? o.showTaxBreakdown : fallback.showTaxBreakdown,
    showBusinessRegistrationNumber:
      typeof o.showBusinessRegistrationNumber === "boolean"
        ? o.showBusinessRegistrationNumber
        : fallback.showBusinessRegistrationNumber,
  };
}

function coerceReceipt(raw: unknown, fallback: FiTaxLocalisationDocument["receiptSettings"]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  return {
    legalEntityName: typeof o.legalEntityName === "string" ? o.legalEntityName : fallback.legalEntityName,
    tradingName: typeof o.tradingName === "string" ? o.tradingName : fallback.tradingName,
    registeredAddress: typeof o.registeredAddress === "string" ? o.registeredAddress : fallback.registeredAddress,
    taxFooterText: typeof o.taxFooterText === "string" ? o.taxFooterText : fallback.taxFooterText,
    refundPolicyUrl: typeof o.refundPolicyUrl === "string" ? o.refundPolicyUrl : fallback.refundPolicyUrl,
  };
}

/**
 * Merge a partial / stored DB payload into a complete {@link FiTaxLocalisationDocument}.
 */
export function mergeTaxLocalisationFromStorage(opts: {
  countryRegion: string | null | undefined;
  currency: string | null | undefined;
  effectiveFrom: string | null | undefined;
  taxProfile: unknown;
  invoiceSettings: unknown;
  receiptSettings: unknown;
}): FiTaxLocalisationDocument {
  const country: FiTaxCountryRegion = isCountry(String(opts.countryRegion ?? "")) ? (opts.countryRegion as FiTaxCountryRegion) : "AU";
  const defaults = buildDefaultTaxLocalisationDocument(country);
  const currency = isCurrency(String(opts.currency ?? "")) ? (opts.currency as FiTaxLocalisationDocument["currency"]) : defaults.currency;
  const effectiveFrom =
    typeof opts.effectiveFrom === "string" && opts.effectiveFrom.trim() ? opts.effectiveFrom : defaults.effectiveFrom;
  return {
    countryRegion: country,
    currency,
    effectiveFrom,
    taxProfile: coerceTaxProfile(country, opts.taxProfile),
    invoiceSettings: coerceInvoice(opts.invoiceSettings, defaults.invoiceSettings),
    receiptSettings: coerceReceipt(opts.receiptSettings, defaults.receiptSettings),
  };
}

/** Serialize document to DB row JSON columns + scalar fields. */
export function taxLocalisationDocumentToRowPayload(doc: FiTaxLocalisationDocument): {
  country_region: string;
  currency: string;
  effective_from: string;
  tax_profile: Record<string, unknown>;
  invoice_settings: Record<string, unknown>;
  receipt_settings: Record<string, unknown>;
} {
  const { taxProfile, invoiceSettings, receiptSettings, countryRegion, currency, effectiveFrom } = doc;
  return {
    country_region: countryRegion,
    currency,
    effective_from: effectiveFrom,
    tax_profile: { ...taxProfile },
    invoice_settings: { ...invoiceSettings },
    receipt_settings: { ...receiptSettings },
  };
}
