/** Canonical `source_system` for Evolved payroll exports in `fi_staff_source_ids`. */
export const EVOLVED_PAYROLL_SOURCE_SYSTEM = "evolved_payroll";

/** Stored in source-id metadata — not a separate table. */
export const PAYROLL_IMPORT_SOURCE = "payroll_export";

/** Default `fi_staff.staff_role` until Paul assigns a clinical role in FI OS. */
export const PAYROLL_DEFAULT_STAFF_ROLE = "needs_review";

export const EVOLVED_PERTH_CLINIC_DISPLAY_NAME = "Evolved Hair Restoration Perth";

/**
 * Payroll export columns that must never be imported or shown in FI OS UI.
 * Values are stripped at parse time; only field names appear in preview summaries.
 */
export const PAYROLL_SENSITIVE_EXPORT_FIELDS = [
  "TaxFileNumber",
  "DateOfBirth",
  "ResidentialStreetAddress",
  "ResidentialAddressLine2",
  "ResidentialSuburb",
  "ResidentialState",
  "ResidentialPostCode",
  "ResidentialCountry",
  "PostalStreetAddress",
  "PostalAddressLine2",
  "PostalSuburb",
  "PostalState",
  "PostalPostCode",
  "PostalCountry",
  "BankAccount1_BSB",
  "BankAccount1_AccountNumber",
  "BankAccount1_AccountName",
  "BankAccount2_BSB",
  "BankAccount2_AccountNumber",
  "BankAccount2_AccountName",
  "BankAccount3_BSB",
  "BankAccount3_AccountNumber",
  "BankAccount3_AccountName",
  "Rate",
  "RateUnit",
  "PrimaryPayCategory",
  "PayRateTemplate",
  "AustralianResident",
  "ClaimTaxFreeThreshold",
  "SeniorsTaxOffset",
  "OtherTaxOffset",
  "StslDebt",
  "TaxCategory",
  "MedicareLevyExemption",
  "TaxVariation",
  "SuperFund1_FundName",
  "SuperFund1_MemberNumber",
  "SuperFund1_AllocatedPercentage",
  "SuperFund2_FundName",
  "SuperFund2_MemberNumber",
] as const;

export type PayrollSensitiveExportField = (typeof PAYROLL_SENSITIVE_EXPORT_FIELDS)[number];
