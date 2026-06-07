# Stage 7A.1 — Timely ServiceSales → FI catalogue seed (review)

- **Generated:** 2026-06-07T22:37:03.499Z
- **Input:** docs/timely-import/input/ServiceSales.csv
- **Seed rows:** 9
- **Excluded rows:** 9

## Rules applied
- Dropped stub/pivot labels (e.g. ServiceCategory1, ServiceName5, totals).
- Dropped package / gift / membership redemption style rows.
- Excluded negative adjustment / refund aggregates from the **active** seed list.
- Merged duplicate Timely category+service keys by summing quantity and gross.
- **`base_price`:** prefers average when consistent with gross÷qty; otherwise gross÷qty; else 0 with flag.
- **`booking_type`:** only set when mapping is confident; otherwise `null` + `review_flags`.
- **`is_bookable` / `source` / `notes`:** review metadata — **not** columns on current `fi_services` (Stage 7A.1 is pre-DB).

## FI category mapping (Timely → FI)
| FI category | Heuristic |
|-------------|-----------|
| Consultation | consult / assessment / first visit |
| Treatment | PRP/PRF/meso/exosome/injection/laser/therapy |
| Surgery | FUE / follicular / transplant / strip / day surgery (name wins over Timely "Consultation" label) |
| Follow-up | follow-up/post-op/review |
| Diagnostics | trichoscopy/diagnostic/lab |
| Other | fallback / retail product |

## Seed list (preview)
| # | name | category | booking_type | duration_min | base_price | is_active | is_bookable | flags |
|---|------|----------|----------------|--------------|------------|-----------|---------------|-------|
| 1 | Hair Treatment | Treatment | — | 60 | 0 | true | true | booking_type_uncertain, price_unknown_default_zero |
| 2 | Follow Up Consultations | Follow-up | follow_up | 30 | 0 | true | true | price_unknown_default_zero |
| 3 | Ungrouped | Other | — | 45 | 0 | true | true | booking_type_uncertain, price_unknown_default_zero, fi_category_other_review |
| 4 | Hair Transplant | Surgery | surgery | 480 | 0 | true | true | price_unknown_default_zero |
| 5 | Specialist/Doctors Consultations (Face to Face) | Other | consultation | 45 | 0 | true | true | price_unknown_default_zero |
| 6 | Facial PRP | Treatment | prp | 60 | 0 | true | true | price_unknown_default_zero |
| 7 | Virtual Consultation | Consultation | consultation | 45 | 0 | true | true | price_unknown_default_zero |
| 8 | LED Therapy | Treatment | — | 60 | 0 | true | true | booking_type_uncertain, price_unknown_default_zero |
| 9 | Phone Consults | Other | consultation | 45 | 0 | true | true | price_unknown_default_zero |

## Excluded / suppressed
| line | summary | reason |
|------|---------|--------|
| 11 | ServiceCategory1 — ServiceCategory1 | Summary / header / pivot stub row |
| 12 |  —  | Summary / header / pivot stub row |
| 13 |  —  | Summary / header / pivot stub row |
| 14 |  —  | Summary / header / pivot stub row |
| 15 |  —  | Summary / header / pivot stub row |
| 51 | ServiceCategory2 — ServiceCategory2 | Summary / header / pivot stub row |
| 54 | ServiceName5 — ServiceName5 | Summary / header / pivot stub row |
| 55 | ServiceCategory3 — ServiceCategory3 | Summary / header / pivot stub row |
| 57 | ServiceCategory4 — ServiceCategory4 | Summary / header / pivot stub row |

## Next steps
1. Human-review rows with `review_flags`.
2. Align `booking_type` with Evolved clinical naming (max one row per type per tenant in `fi_services`).
3. When approved, add a guarded import path (separate task) — **this stage does not insert into the database.**