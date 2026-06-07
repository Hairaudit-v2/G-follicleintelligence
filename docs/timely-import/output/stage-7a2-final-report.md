# Stage 7A.2 — Timely service seed (final review)

- **Generated:** 2026-06-07T22:37:04.240Z
- **Source review:** docs/timely-import/output/fi-services-seed-review.json
- **Timely input note:** docs/timely-import/input/ServiceSales.csv (real Timely export)

## Counts
| Metric | Count |
|--------|------:|
| **Approved for FI import** (`is_active: true`) | 6 |
| **Inactive / deferred** (manual follow-up) | 3 |
| **Removed (non-bookable)** | 0 |
| **Uncertain mappings deferred** | 3 |

## Recommended defaults
- One **`booking_type`** value per tenant in `fi_services` when linked; duplicates in Timely are merged by keeping the highest-gross row for that type.
- **Diagnostics / other** services without a confident `booking_type` stay in **inactive_deferred** until mapped (often `other` or left unlinked).
- **Retail** lines are excluded from the bookable clinical catalogue.

## Services ready for FI import
- **Follow Up Consultations** — Follow-up; `booking_type`: follow_up; 30 min; AUD 0; colour #f97316
  - *Note:* Timely window showed no unit revenue; base_price left at 0 — confirm before go-live.
- **Hair Transplant** — Surgery; `booking_type`: surgery; 480 min; AUD 0; colour #a855f7
  - *Note:* Timely window showed no unit revenue; base_price left at 0 — confirm before go-live.
- **Specialist/Doctors Consultations (Face to Face)** — Other; `booking_type`: consultation; 45 min; AUD 0; colour #64748b
  - *Note:* Timely window showed no unit revenue; base_price left at 0 — confirm before go-live.
- **Facial PRP** — Treatment; `booking_type`: prp; 60 min; AUD 0; colour #22c55e
  - *Note:* Timely window showed no unit revenue; base_price left at 0 — confirm before go-live.
- **Virtual Consultation** — Consultation; `booking_type`: —; 45 min; AUD 0; colour #0ea5e9
  - *Note:* booking_type cleared: duplicate "consultation" in import batch — canonical row kept by highest gross in Timely window. Timely window showed no unit revenue; base_price left at 0 — confirm before go-live.
- **Phone Consults** — Other; `booking_type`: —; 45 min; AUD 0; colour #64748b
  - *Note:* booking_type cleared: duplicate "consultation" in import batch — canonical row kept by highest gross in Timely window. Timely window showed no unit revenue; base_price left at 0 — confirm before go-live.

## Inactive / deferred
- **Hair Treatment** — Uncertain FI category or booking_type mapping — resolve manually before import.
- **Ungrouped** — Uncertain FI category or booking_type mapping — resolve manually before import.
- **LED Therapy** — Uncertain FI category or booking_type mapping — resolve manually before import.

## Removed (non-bookable)
_None._

## Next step
Use a guarded import job (separate task) to upsert `fi_services` from `fi-services-seed-approved.json` — **no Supabase insert in Stage 7A.2.**