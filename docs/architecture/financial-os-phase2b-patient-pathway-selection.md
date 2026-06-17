# FinancialOS Phase 2B — Patient pathway selection from public payment link

## Purpose

Phase 2B lets patients record **payment pathway intent** from the secure `/pay/[paymentRequestToken]` page after quote or invoice acceptance. The clinic sees the choice immediately in FinancialOS (Payment Pathways, case FinancialOS summary, and surgery boards via Phase 2 attention rules).

This records intent only. It does **not** integrate external finance providers, change Stripe checkout behaviour, or mutate ConsultationOS, Clinical Intelligence, or SurgeryOS business logic.

## Public token security model

- Patients access payment links using `fi_payment_requests.public_token` (opaque hex, server-generated).
- Pathway selection actions accept **only** the public token and pathway type from the client.
- Server actions derive `tenant_id`, `invoice_id`, `patient_id`, `case_id`, and `booking_id` from the loaded payment request and linked invoice — never from client-supplied UUIDs.
- Invalid, expired, cancelled, or already-paid links reject selection.
- Responses are patient-safe: no internal UUIDs, no PII beyond what the existing pay page already shows (clinic name, invoice title, amount due).

## Patient-safe UX

When the invoice has balance due and the payment request is usable, the pay page shows **Choose your payment option** with seven choices:

| Option | Patient copy | Pathway type | Initial status |
|--------|--------------|--------------|----------------|
| Pay in full now | Complete your payment securely now. | `pay_in_full` | `selected` |
| Pay deposit now, balance later | Secure your booking now and pay the remaining balance before your procedure. | `deposit_balance` | `selected` |
| Request installment plan | Ask the clinic to review a staged payment option. | `installment_plan` | `pending_clinic_action` |
| Medical finance | Ask the clinic to guide you through finance options. | `medical_finance` | `pending_clinic_action` |
| Superannuation release | Request guidance for eligible medical superannuation release pathways. | `super_release` | `pending_patient_action` |
| International transfer | Request international transfer details. | `international_transfer` | `pending_clinic_action` |
| Other / speak to clinic | Ask the clinic to contact you about payment options. | `manual` | `pending_clinic_action` |

Checkout (`Pay now`) appears when the patient selects **Pay in full** or **Deposit + balance** on a deposit payment request, using the existing Stripe checkout URL. All other options show a confirmation message only.

Repeated selections for the same payment link update the existing patient pathway row (`source_payment_request_id`) instead of creating duplicates.

## Supported pathway behaviours

- **Pay in full / deposit + balance:** Records `selected` pathway; checkout remains available when Stripe is enabled.
- **Clinic-action pathways:** Sets `pending_clinic_action` and shows clinic follow-up confirmation.
- **Super release:** Sets `pending_patient_action` (Phase 2 attention rules apply within 14 days of surgery).
- **Provider integrations:** Out of scope. No external URLs or provider APIs are called.

## Data model (additive)

Migration `20260912120001_fi_financial_os_phase2b_patient_pathway_source.sql` adds:

- `fi_payment_pathways.source` — `staff` (default) | `patient_public_token` | `system`
- `fi_payment_pathways.source_payment_request_id` — FK to `fi_payment_requests` when selected via pay link

## Server modules

| Module | Role |
|--------|------|
| `src/lib/financialOs/publicPaymentPathwaySelectionCore.ts` | Pure eligibility, status mapping, upsert resolution (unit tested) |
| `src/lib/financialOs/publicPaymentPathwaySelection.server.ts` | `loadPublicPaymentPathwaySelectionByToken`, `selectPublicPaymentPathwayForToken` |
| `lib/actions/public-payment-pathway-actions.ts` | `selectPublicPaymentPathwayAction` (no admin auth) |

## Admin visibility after selection

- **Payment Pathways** timeline shows `Source = Patient (pay link)` when `source = patient_public_token`.
- **Case FinancialOS · Surgery pipeline** inherits the active pathway via existing Phase 2 loaders and `FinancialPaymentPathwayBadge`.
- **Surgery boards** (Tomorrow, Procedure Day, Surgery Readiness) use the same attention summary — no SurgeryOS changes.
- **FinancialOS dashboard** includes optional metric: patient-selected pathway count (last 30 days).

## Related docs

- [FinancialOS Phase 2 payment pathway engine](./financial-os-phase2-payment-pathway-engine.md)
- [FI OS Stage 7 revenue / payments runbook](../runbooks/fi-os-stage7-revenue-payments.md)
