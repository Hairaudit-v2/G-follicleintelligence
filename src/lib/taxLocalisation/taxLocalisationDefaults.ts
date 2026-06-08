import type {
  FiInvoiceSettings,
  FiReceiptSettings,
  FiTaxCountryRegion,
  FiTaxCurrency,
  FiTaxLocalisationDocument,
  FiTaxProfile,
} from "./taxLocalisationTypes";
import { FI_TAX_COUNTRY_REGIONS } from "./taxLocalisationTypes";

/** Suggested currency for a country (user may override). */
export function inferDefaultCurrencyForCountry(country: FiTaxCountryRegion): FiTaxCurrency {
  switch (country) {
    case "AU":
      return "AUD";
    case "IN":
      return "INR";
    case "NZ":
      return "NZD";
    case "GB":
      return "GBP";
    case "US":
      return "USD";
    default:
      return "USD";
  }
}

export function defaultTaxProfileForCountry(country: FiTaxCountryRegion): FiTaxProfile {
  switch (country) {
    case "AU":
      return {
        country: "AU",
        abn: "",
        businessName: "",
        gstRegistered: true,
        gstRatePercent: 10,
      };
    case "IN":
      return {
        country: "IN",
        gstin: "",
        state: "",
        placeOfSupply: "",
        gstHandling: "cgst_sgst",
        defaultCgstPercent: 9,
        defaultSgstPercent: 9,
        defaultIgstPercent: 18,
      };
    case "NZ":
      return {
        country: "NZ",
        gstNumber: "",
        gstRegistered: true,
        gstRatePercent: 15,
      };
    default:
      return { country };
  }
}

export function defaultInvoiceSettings(): FiInvoiceSettings {
  return {
    invoicePrefix: "INV-",
    startingInvoiceNumber: 1000,
    paymentTerms: "Net 14 days",
    showTaxBreakdown: true,
    showBusinessRegistrationNumber: true,
  };
}

export function defaultReceiptSettings(): FiReceiptSettings {
  return {
    legalEntityName: "",
    tradingName: "",
    registeredAddress: "",
    taxFooterText: "",
    refundPolicyUrl: "",
  };
}

export function buildDefaultTaxLocalisationDocument(country: FiTaxCountryRegion = "AU"): FiTaxLocalisationDocument {
  const currency = inferDefaultCurrencyForCountry(country);
  const now = new Date().toISOString();
  return {
    countryRegion: country,
    currency,
    effectiveFrom: now,
    taxProfile: defaultTaxProfileForCountry(country),
    invoiceSettings: defaultInvoiceSettings(),
    receiptSettings: defaultReceiptSettings(),
  };
}

/** Reads optional `tax_country_region` or `country_region` from clinic metadata (string enum). */
export function parseFiTaxCountryRegionFromMetadata(value: unknown): FiTaxCountryRegion | null {
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  if ((FI_TAX_COUNTRY_REGIONS as readonly string[]).includes(s)) {
    return s as FiTaxCountryRegion;
  }
  return null;
}

/**
 * When a clinic has no saved tax row, inherit tenant invoice/receipt/numbering but align
 * consumption-tax fields with the clinic's configured country hint (from metadata).
 */
export function applyClinicCountryHintToDocument(
  baseDoc: FiTaxLocalisationDocument,
  countryHint: FiTaxCountryRegion | null
): FiTaxLocalisationDocument {
  if (!countryHint || countryHint === baseDoc.countryRegion) return baseDoc;
  return {
    ...baseDoc,
    countryRegion: countryHint,
    currency: inferDefaultCurrencyForCountry(countryHint),
    taxProfile: defaultTaxProfileForCountry(countryHint),
  };
}
