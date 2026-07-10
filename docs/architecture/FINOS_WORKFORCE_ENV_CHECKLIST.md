# FinOS + Workforce — Environment Variable Checklist

**Last audited:** 2026-07-10  
**Source of truth:** local `.env.local` presence only (no secret values recorded)  
**Related:** [FINOS_EXPENSES_UPDATE_LOG.md](./FINOS_EXPENSES_UPDATE_LOG.md), [financial-os-expenses-change-log.md](./financial-os-expenses-change-log.md), [ROSTER_COMMAND_CENTRE_CHANGE_LOG.md](./ROSTER_COMMAND_CENTRE_CHANGE_LOG.md), `.env.example`

This checklist records **which environment variables matter for FinancialOS (FinOS) and Workforce/HR sync**, whether they appear set or commented in local `.env.local`, and what they do. **Do not put live secret values in this document.**

---

## Legend

| Status | Meaning |
|--------|---------|
| **SET** | Uncommented key present in local `.env.local` at audit time |
| **COMMENTED** | Key exists only as a commented line (`# KEY=…`) |
| **MISSING** | Not present in local `.env.local` (may still be required in Vercel for prod) |
| **Optional** | Feature works without it; enables extras when set |
| **Required (core)** | Needed for FinOS UI / data plane against Supabase |
| **Required (feature)** | Needed only when that feature is turned on |

---

## 1. Core platform (shared)

| Variable | Local status | Role | Notes |
|----------|--------------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | SET | Supabase project URL | Required for all FinOS pages |
| `SUPABASE_SERVICE_ROLE_KEY` | SET | Server-side admin client | Required for loaders/actions; never expose client-side |
| `CRON_SECRET` | SET | Shared Vercel cron Bearer | Preferred single auth for scheduled GETs |

---

## 2. FinancialOS — payments & RevenueOS

| Variable | Local status | Role | Notes |
|----------|--------------|------|--------|
| `FI_PAYMENTS_ENABLED` | SET | Master switch for live payment checkout | Read by `fiPaymentEnv.server.ts` |
| `FI_PAYMENT_PROVIDER` | SET | `manual` (default) or `stripe` | Stripe Checkout only when provider is stripe |
| `STRIPE_SECRET_KEY` | COMMENTED | Stripe API secret | Required only if Stripe live/checkout is used |
| `STRIPE_WEBHOOK_SECRET` | COMMENTED | Webhook signature for `/api/fi-payments/stripe/webhook` | Pair with Stripe dashboard |
| `FI_PAYMENT_SUCCESS_URL` | SET | Post-checkout success redirect | Patient-facing |
| `FI_PAYMENT_CANCEL_URL` | SET | Cancel redirect | Patient-facing |
| `FI_PAYMENT_REQUEST_EXPIRY_DAYS` | SET | Default payment-link expiry window (1–365) | Default 14 if unset |
| `FI_PAYMENTS_CRON_SECRET` | SET | Optional scoped Bearer for payment/FinancialOS crons | Also accepts `CRON_SECRET` / `FINANCIAL_OS_CRON_SECRET` |
| `FINANCIAL_OS_CRON_SECRET` | SET | Optional scoped Bearer for FinancialOS automation crons | deposit overdue, balance reminders, pathway escalation, clearance, etc. |

**Ops note:** Keep Stripe keys commented until you intentionally enable `FI_PAYMENT_PROVIDER=stripe` and `FI_PAYMENTS_ENABLED=true` in that environment.

---

## 3. FinancialOS — Expenses (opex Stages 1–8)

| Variable | Local status | Role | Notes |
|----------|--------------|------|--------|
| `FI_EXPENSE_OCR_PROVIDER` | SET | `stub` (default) or `openai_vision` | Receipt/invoice OCR path |
| `OPENAI_API_KEY` | SET | OpenAI key for vision OCR | Required when provider is `openai_vision` |
| `OPENAI_EXPENSE_OCR_MODEL` | SET | Optional model override | Falls back to a default mini model if unset |
| `FI_EXPENSE_OCR_MIN_CONFIDENCE` | SET | OCR confidence threshold | Default ~0.55 |
| `FI_ACCOUNTING_LIVE_PUSH` | SET | Must be `1` to allow live accounting API push | UI: **QB live push** / **Xero live push** |
| `FI_QUICKBOOKS_ACCESS_TOKEN` | COMMENTED | Bearer for QuickBooks Online Purchase API | Or connector config `api_key`; also needs `realm_id` + `environment` on QuickBooks connector |

**Cron:** Expense OCR job at `/api/cron/financial-os/expense-ocr` accepts FinancialOS cron auth (`CRON_SECRET` / `FINANCIAL_OS_CRON_SECRET` / `FI_PAYMENTS_CRON_SECRET` via `validateCronAuth`).

**Export always works offline:** **FI CSV**, **QuickBooks CSV**, **QuickBooks JSON**, **Xero CSV** do not need live push env. Live push is opt-in and audited.

**QuickBooks connector (OnboardingOS external integrations):** `realm_id`, `environment` (`sandbox` \| `production`). Live Xero bank-transaction POST is not wired; Xero dry-run / CSV only.

---

## 4. Workforce / HR sync

| Variable | Local status | Role | Notes |
|----------|--------------|------|--------|
| `WORKFORCE_COMPLIANCE_CRON_SECRET` | SET | Bearer for workforce compliance audit cron | Route exists; not necessarily in `vercel.json` by default |
| `FI_HR_SYNC_CRON_SECRET` | SET | Optional alias Bearer for HR Perth staff sync cron | Also accepts `CRON_SECRET` |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | SET | Upstream staff feed URL | HR → FI identity sync |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | SET | Feed auth key | Server-only |
| `IIOHR_HR_SYNC_SECRET` | SET | Additional HR sync shared secret | Used by sync pipeline |

**Routes (examples):**

- `GET /api/cron/workforce-compliance-audit` — `WORKFORCE_COMPLIANCE_CRON_SECRET` (or shared pattern as implemented)
- `GET /api/cron/iiohr-hr-perth-staff-sync` — `CRON_SECRET` or `FI_HR_SYNC_CRON_SECRET`
- `GET /api/health/iiohr-hr-staff-sync` — same Bearer family as HR cron

**UI surfaces:** WorkforceOS, HR-OS (onboarding, offboarding, compliance, credentials, certifications, roster, staff reconciliation, sync health), Team (training, compliance, roster).

---

## 5. Recommended production matrix

| Environment | Minimum for FinOS read UI | Payments live | Expense OCR (real) | QB live push | Workforce cron |
|-------------|---------------------------|---------------|--------------------|--------------|----------------|
| Local dev | Supabase URL + service role | Optional | Optional (`stub` OK) | Off | Optional |
| Staging | Same + `CRON_SECRET` | Usually off / test Stripe | Optional OpenAI | Off unless testing | Set if scheduling |
| Production | Same + cron secrets | Only if go-live | Prefer `openai_vision` if capturing receipts | Only with connector + token + `FI_ACCOUNTING_LIVE_PUSH=1` | Set if schedules live |

---

## 6. Safety rules

1. **Never commit** `.env.local` or paste secret values into git, tickets, or this checklist.
2. **Stripe / QuickBooks tokens** stay commented or unset until go-live for that env.
3. **`FI_ACCOUNTING_LIVE_PUSH`** must remain non-`1` unless intentionally enabling live accounting writes.
4. Prefer **`CRON_SECRET`** as the single Vercel cron Bearer; keep module-specific secrets only for rotation or manual ops.
5. Hosted migrations for expenses must be applied through Stage 8 for full Expenses UI (see update log).

---

## 7. Quick verification commands (no secrets printed)

```bash
# Names present (PowerShell) — does not print values
Select-String -Path .env.local -Pattern '^(FI_|STRIPE_|WORKFORCE_|FINANCIAL_OS_|OPENAI_|IIOHR_|CRON_)' |
  ForEach-Object { if ($_.Line -match '^(#\s*)?([A-Z0-9_]+)=') { $matches[2] } }

# Health (with secret only in Authorization header, not logged)
# curl -s -H "Authorization: Bearer $env:CRON_SECRET" "$BASE/api/health/iiohr-hr-staff-sync"
```

---

## 8. Audit snapshot (2026-07-10 local)

| Area | Ready? | Gaps |
|------|--------|------|
| Supabase core | Yes | — |
| FinOS payments automation crons | Secrets SET | Stripe keys COMMENTED (manual provider OK) |
| Expense OCR | Provider + OpenAI SET | Confirm provider value is `openai_vision` if you want live OCR (not `stub`) |
| Accounting live push | Flag SET | `FI_QUICKBOOKS_ACCESS_TOKEN` COMMENTED → live QB push blocked until token + connector |
| Workforce / HR sync | Secrets + feed SET | Confirm Vercel schedules if production cron is required |

**End of checklist.**
