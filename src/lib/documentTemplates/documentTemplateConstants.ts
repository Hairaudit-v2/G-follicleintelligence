/** Categories for `fi_document_templates`. */
export const DOCUMENT_TEMPLATE_CATEGORIES = [
  "sales_terms",
  "invoice_terms",
  "invoice_footer",
  "booking_policy",
  "payment_policy",
  "consent_summary",
  "custom",
] as const;

export type DocumentTemplateCategory = (typeof DOCUMENT_TEMPLATE_CATEGORIES)[number];

export const DOCUMENT_TEMPLATE_CATEGORY_LABELS: Record<DocumentTemplateCategory, string> = {
  sales_terms: "Sales terms & conditions",
  invoice_terms: "Invoice terms",
  invoice_footer: "Invoice footer / legal block",
  booking_policy: "Booking policy",
  payment_policy: "Payment policy",
  consent_summary: "Consent summary",
  custom: "Custom document",
};

export type DocumentTemplateSeed = {
  category: DocumentTemplateCategory;
  slug: string;
  name: string;
  body: string;
  is_default?: boolean;
};

/** Built-in starter documents seeded per tenant on first open (idempotent upsert by slug). */
export const DOCUMENT_TEMPLATE_DEFAULTS: readonly DocumentTemplateSeed[] = [
  {
    category: "sales_terms",
    slug: "standard-sales-terms",
    name: "Standard sales terms & conditions",
    is_default: true,
    body: `SALES TERMS & CONDITIONS

1. Quotes
Quotes are valid for 30 days unless otherwise stated. Prices may change if treatment plans are revised after clinical assessment.

2. Deposits
A deposit may be required to reserve a surgery or treatment date. Deposits are applied to the final balance.

3. Cancellations & rescheduling
Please provide at least 48 hours' notice to reschedule consultations. Surgery cancellations may attract a fee as advised in your quote pack.

4. Payment
Outstanding balances must be settled before the procedure date unless a written payment plan is agreed.

5. Outcomes
Hair restoration results vary. Clinical advice given during consultation is personalised and does not guarantee a specific aesthetic outcome.

6. Privacy
Patient information is handled in accordance with applicable privacy laws and clinic policy.

By confirming a booking or paying a deposit, you acknowledge these terms. Contact the clinic with any questions before proceeding.`,
  },
  {
    category: "invoice_terms",
    slug: "standard-invoice-terms",
    name: "Standard invoice payment terms",
    is_default: true,
    body: `INVOICE PAYMENT TERMS

Payment is due by the date shown on this invoice (or within Net 14 days if no date is specified).

Accepted methods: bank transfer, card, or clinic-issued payment link.

Late payments may incur reminder notices and may delay scheduled treatment.

Please quote the invoice number on all remittances. Contact accounts if you require a receipt or payment plan.`,
  },
  {
    category: "invoice_footer",
    slug: "standard-invoice-footer",
    name: "Standard invoice footer",
    is_default: true,
    body: `Thank you for choosing our clinic.
This invoice is a request for payment for professional services.
For questions about this invoice, reply to the issuing clinic or contact reception.`,
  },
  {
    category: "booking_policy",
    slug: "standard-booking-policy",
    name: "Standard booking policy",
    is_default: true,
    body: `BOOKING POLICY

Please arrive 10 minutes before your appointment.
Bring photo ID and any requested medical history or photos.
Late arrivals may need to be rescheduled.
To cancel or reschedule, contact the clinic as soon as possible (minimum 24–48 hours' notice preferred).`,
  },
  {
    category: "payment_policy",
    slug: "standard-payment-policy",
    name: "Standard payment & deposit policy",
    is_default: true,
    body: `PAYMENT & DEPOSIT POLICY

Deposits secure your treatment date and are non-transferable between patients.
Balances are due before the procedure unless otherwise agreed in writing.
Refunds, if applicable, are assessed against the clinic cancellation schedule provided with your quote.
Failed or incomplete payments may release your reserved date.`,
  },
  {
    category: "consent_summary",
    slug: "standard-consent-summary",
    name: "Treatment consent summary (patient-facing)",
    is_default: true,
    body: `CONSENT SUMMARY

You will be asked to complete full clinical consent forms before treatment.
This summary does not replace medical consent:
- You understand the proposed procedure or therapy and alternatives discussed.
- You have had the opportunity to ask questions.
- You accept that results vary and follow-up care may be required.

Full consent is captured in the clinical pathway documentation.`,
  },
];
