import type { FiTaxCountryRegion, FiTaxProfile } from "./taxLocalisationTypes";

/** Consumer-facing label for the primary consumption tax (not legal advice). */
export function primaryConsumptionTaxLabel(country: FiTaxCountryRegion): string {
  if (country === "AU" || country === "NZ") return "GST";
  if (country === "IN") return "GST";
  if (country === "GB") return "VAT";
  if (country === "US") return "Sales tax";
  return "Tax";
}

/** Best-effort registration number label for invoices/receipts. */
export function businessRegistrationLabel(country: FiTaxCountryRegion, profile: FiTaxProfile): string {
  if (country === "AU") return "ABN";
  if (country === "IN") return "GSTIN";
  if (country === "NZ") return "GST number";
  if (country === "GB") return "VAT number";
  if (country === "US") return "EIN / Tax ID";
  return "Business registration";
}
