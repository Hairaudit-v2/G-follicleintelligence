# DoctorOS Stage 1D — Patient medication reorder portal

## Purpose

Let **patients** request refills for medications that appear on **previous, eligible prescriptions**, with server-side enforcement of repeat rules, date windows, limits, and optional **doctor review** instead of an automatic path.

## Auth & routing

- **Patient UI:** `/patient/[tenantId]/medications`
- **Portal link:** set `fi_patients.portal_auth_user_id` to the patient’s Supabase `auth.users.id` for the tenant row. Without this, the medications page shows a short “not linked” notice.

## Prescription configuration (staff)

On the prescription editor (draft), **Patient reorder programme**:

- `repeats_allowed`, `repeat_limit` (≥ 1 when repeats allowed), optional `reorder_valid_from` / `reorder_valid_until`, `reorder_review_required`, optional `patient_reorder_fee_pence`, `reorder_fee_payment_required`.

`reorders_used` increments when clinic **approves** a reorder request (not on patient submit).

## Rules (enforced in `validatePatientReorderEligibility` + actions)

- Prescription status must be one of: `signed`, `sent_to_pharmacy`, `dispensed`, `posted`.
- `repeats_allowed` and `repeat_limit >= 1`.
- `reorders_used < repeat_limit`.
- Current time within `reorder_valid_from` / `reorder_valid_until` when set.
- If `reorder_review_required`, new requests start in `doctor_review_required` and a **CRM task** is created when a lead exists for the patient.

## Reorder request statuses

`requested` → `doctor_review_required` (optional) → `approved` → `sent_to_pharmacy` → `posted` → `completed`, or `rejected`.

## Staff UI

- **Queue:** `/fi-admin/[tenantId]/medication-reorders` — approve / reject / advance fulfilment.
- **Dashboard:** Control centre **Clinic pulse** tile “Refill reviews” (count of `requested` + `doctor_review_required`).

## Payments (MVP)

If `reorder_fee_payment_required` and fee &gt; 0, the patient must tick a **payment acknowledgement** before submit; the row is stored with `payment_status = paid` as a **stub** (replace with real PSP integration later).

## Deferred

- Auto pharmacy transmission on approved reorder (clone Rx / transmission pipeline).
- Patient-only auth layout separate from FI Admin branding.
- Stripe / hosted checkout.
