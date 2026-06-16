# Consultation → Quote → Booking → Payment (FI OS) — pipeline audit

**Date:** 2026-06-16  
**Scope:** FI OS staff surfaces only (no public patient portal work).  
**Code changes in this sprint:** see git diff for `ConsultationFormRunner`, `consultationHandoffMutations`, `revenueInvoiceMutations`, `consultationInvoiceAmountResolve`, `crmQuoteLoaders`, `crmQuoteMutations`, `fi-crm-quote-actions`, `CaseCrmQuotesPipelineCard`, case detail route, payments inbox, `ConsultationOsHubRoutingActions`.

---

## A. Pipeline map (current)

| Step | Works | Partial | Missing / weak |
|------|--------|---------|------------------|
| **1–2 Consultation complete** | Locking instance, `completion_summary`, consultation `status` → completed, `recommendation_notes` backfill, optional `fi_timeline_events` when patient+case linked. | Hub “intelligence summary” depends on structured data parse. | No auto handoffs on complete (by design today). |
| **3 Summary dispatch** | Twin/timeline when case+patient on consultation. CRM tasks/quotes via **Guided hand-offs** panel. | — | No outbound email from FI OS for quote. |
| **4–5 Quote (CRM)** | `Create quote draft` → `fi_crm_quotes` with `tenant_id`, `lead_id`/`case_id`, `consultation_id`, line snapshot + metadata; **subtotal/total** set when `price_quoted` exists on consultation. | `quote_builder` form field is still a **placeholder** (`ConsultationFormFieldRenderer`). | No dedicated “quote editor” UI on `fi_crm_quotes` (JSON snapshot only via DB). |
| **6 Quote accepted** | **New:** case card **Mark accepted** → `fi_crm_quotes.status=accepted`, CRM activity `quote.accepted`, optional lead move `quote_sent` → `deposit_or_booked`, case timeline `crm.quote.accepted` when foundation patient on case. | Lead stage move only for that slug pair. | Patient-facing accept flow not built. |
| **7 Booking from quote** | **New:** after accept, **Schedule surgery** opens appointment create with `bookingType: surgery`, title from quote, case/patient/lead/clinic prefill. | Duration/day count, surgeon, quoted amount are **not** auto-filled (prefill type limits). | No hard link `fi_bookings.quote_id` (schema unchanged). |
| **8 Payment request** | `CaseRevenuePaymentsCard`, `createPaymentRequestForInvoice`, Stripe checkout when enabled. `createInvoiceFromConsultationQuote` ties invoice to `consultation_id`, `case_id`, `patient_id`. | Deposit invoice from case + deposit rules already exist. | Invoice metadata does not store `fi_crm_quotes.id` (trace via consultation + case). |
| **9 Visibility** | Case: readiness, revenue card, manual payment records, **new** quotes card. Calendar: bookings by case merge. **New:** payments inbox rows link to case / patient / consultation. | Payment inbox does not show `fi_crm_quote` id (invoice-level links only). | “Stuck” pipeline dashboard not unified (conversion board is separate). |
| **10 Permissions** | CRM gate on consultation actions; finance gate on revenue actions; quote accept uses **same CRM write gate** as other CRM mutations (service role + gate). | — | RLS on `fi_crm_quotes` remains select-only for authenticated (mutations via server admin pattern — pre-existing). |

---

## B. Gap list

### Critical (addressed in this sprint where marked ✓)

1. ✓ **Post-complete navigation** hid hand-offs: completing jumped away from hand-off CTAs. **Fixed:** stay on form, `router.refresh()`, scroll to `#consultation-guided-handoffs`.
2. ✓ **No case-level quote accept / booking bridge.** **Fixed:** `CaseCrmQuotesPipelineCard` + `markCrmQuoteAcceptedAction`.
3. ✓ **Invoice amount only from consultation `quote_data`, ignoring CRM draft.** **Fixed:** `resolveConsultationQuoteInvoiceAmountCents` + CRM quote rows query in `createInvoiceFromConsultationQuote`.
4. ✓ **Payments inbox traceability.** **Fixed:** deep links on invoice rows.
5. ✓ **Hub “RevenueOS” tile pointed at generic payments.** **Adjusted:** route to case when linked, else consultation form path.

### Important (still partial)

- **Quote editing / line items UI** for `fi_crm_quotes` (still operational via consultation hub fields + DB).
- **Booking prefill** for multi-day surgery, surgeon assignment, quoted amount on booking record.
- **Automatic** lead stage to `quote_sent` when quote is “sent” (only accept path advances stage today).
- **Unified “where is this patient stuck?”** view across consultation, CRM, case, payments.

### Later

- Public pay portal polish, quote PDF, e-sign, HubSpot-style quote object sync.
- `fi_bookings.quote_id` FK if product wants hard trace without inference.

---

## C. Critical patches applied (summary)

1. `ConsultationFormRunner` — completion flow keeps user on pathway; refresh + scroll to guided hand-offs.  
2. `createConsultationQuoteDraftFromSummary` — persists `subtotal_amount` / `total_amount` and `price_quoted_hint` in metadata when consultation panel has a price.  
3. `createInvoiceFromConsultationQuote` — resolves cents from panel **or** CRM quotes.  
4. `loadCrmQuotesForCase` + `CaseCrmQuotesPipelineCard` on case detail.  
5. `markCrmQuoteAcceptedForTenant` + `markCrmQuoteAcceptedAction` — accept + CRM/timeline side effects.  
6. Payments inbox — case / patient / consultation links.  
7. `ConsultationOsHubRoutingActions` — clearer routing to case vs form.  
8. Unit tests: `consultationInvoiceAmountResolve.test.ts`.

**Manual QA:** follow your checklist; **`npm run typecheck`** passes; run **`npm run test:unit`** to include the new test file in the full suite.
