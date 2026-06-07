# Stage 7A.1 — Timely ServiceSales → FI catalogue seed (review)

- **Generated:** 2026-06-07T22:25:19.412Z
- **Input:** docs/timely-import/fixtures/ServiceSales.sample.csv
- **Seed rows:** 9
- **Excluded rows:** 5

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
| 1 | Initial hair consultation | Consultation | consultation | 45 | 165 | true | true | — |
| 2 | FUE planning session | Surgery | surgery | 480 | 220 | true | true | — |
| 3 | PRP scalp session | Treatment | prp | 60 | 395.5 | true | true | — |
| 4 | Exosome therapy | Treatment | exosomes | 60 | 520 | true | true | — |
| 5 | Mesotherapy maintenance | Treatment | mesotherapy | 60 | 180 | true | true | — |
| 6 | FUE day surgery block | Surgery | surgery | 480 | 8500 | true | true | — |
| 7 | Post-op review (week 1) | Follow-up | follow_up | 30 | 0 | true | true | price_unknown_default_zero |
| 8 | Trichoscopy / scalp scope | Diagnostics | — | 30 | 95 | true | true | booking_type_uncertain |
| 9 | Shampoo retail (bundle) | Other | — | 45 | 35 | true | false | booking_type_uncertain, fi_category_other_review |

## Excluded / suppressed
| line | summary | reason |
|------|---------|--------|
| 11 | ServiceCategory1 — ServiceName5 | Summary / header / pivot stub row |
| 12 | Grand Total —  | Summary / header / pivot stub row |
| 13 | Other — Package redemption — membership credits | Package / gift / membership redemption or similar (deduped import) |
| 14 | Other — Gift card redemption | Package / gift / membership redemption or similar (deduped import) |
| 15 | Adjustments — Invoice credit note (batch) | Negative adjustment / refund aggregate — excluded from active seed list |

## Next steps
1. Human-review rows with `review_flags`.
2. Align `booking_type` with Evolved clinical naming (max one row per type per tenant in `fi_services`).
3. When approved, add a guarded import path (separate task) — **this stage does not insert into the database.**