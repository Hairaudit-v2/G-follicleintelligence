/**
 * Tax & localisation enums and document shapes (no server imports).
 * Country codes align with `fi_tax_localisation_settings.country_region`.
 */

export const FI_TAX_COUNTRY_REGIONS = ["AU", "IN", "NZ", "GB", "US", "OTHER"] as const;
export type FiTaxCountryRegion = (typeof FI_TAX_COUNTRY_REGIONS)[number];

export const FI_TAX_CURRENCIES = ["AUD", "INR", "NZD", "GBP", "USD"] as const;
export type FiTaxCurrency = (typeof FI_TAX_CURRENCIES)[number];

export const FI_TAX_COUNTRY_LABELS: Record<FiTaxCountryRegion, string> = {
  AU: "Australia",
  IN: "India",
  NZ: "New Zealand",
  GB: "United Kingdom",
  US: "United States",
  OTHER: "Other",
};

export const FI_TAX_CURRENCY_LABELS: Record<FiTaxCurrency, string> = {
  AUD: "AUD",
  INR: "INR",
  NZD: "NZD",
  GBP: "GBP",
  USD: "USD",
};

/** India GST composition for pricing / documents (not legal advice). */
export type IndiaGstHandlingMode = "cgst_sgst" | "igst" | "mixed";

export type AustraliaTaxProfile = {
  abn: string;
  businessName: string;
  gstRegistered: boolean;
  gstRatePercent: number;
};

export type IndiaTaxProfile = {
  gstin: string;
  state: string;
  placeOfSupply: string;
  gstHandling: IndiaGstHandlingMode;
  defaultCgstPercent: number;
  defaultSgstPercent: number;
  defaultIgstPercent: number;
};

export type NewZealandTaxProfile = {
  gstNumber: string;
  gstRegistered: boolean;
  gstRatePercent: number;
};

export type FiTaxProfile =
  | ({ country: "AU" } & AustraliaTaxProfile)
  | ({ country: "IN" } & IndiaTaxProfile)
  | ({ country: "NZ" } & NewZealandTaxProfile)
  /** GB/US/OTHER: country-specific fields added later; `object` avoids the banned empty-object type. */
  | ({ country: "GB" | "US" | "OTHER" } & object);

export type FiInvoiceSettings = {
  invoicePrefix: string;
  startingInvoiceNumber: number;
  paymentTerms: string;
  showTaxBreakdown: boolean;
  showBusinessRegistrationNumber: boolean;
};

export type FiReceiptSettings = {
  legalEntityName: string;
  tradingName: string;
  registeredAddress: string;
  taxFooterText: string;
  refundPolicyUrl: string;
};

export type FiTaxLocalisationDocument = {
  countryRegion: FiTaxCountryRegion;
  currency: FiTaxCurrency;
  effectiveFrom: string;
  taxProfile: FiTaxProfile;
  invoiceSettings: FiInvoiceSettings;
  receiptSettings: FiReceiptSettings;
};

/** Clinic picker for tax scope UI (no server imports). */
export type FiClinicOption = { id: string; displayName: string };
