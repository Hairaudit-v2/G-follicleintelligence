# Timely ServiceSales → FI catalogue (Stage 7A.1)

This folder supports **review-only** preparation of `fi_services` seed data from a Timely **Service Sales** CSV export.

## What to place where

| Path | Purpose |
|------|---------|
| `input/ServiceSales.csv` | Your real Timely export (optional; gitignored — see repo `.gitignore`). |
| `fixtures/ServiceSales.sample.csv` | Small synthetic file used when no input CSV is present. |
| `output/*` | Regenerated review artefacts (`fi-services-seed-review.json`, `.csv`, `stage-7a1-report.md`). |

## Run

```bash
npm run timely:import-preview
```

Or with an explicit file:

```bash
npx tsx scripts/timely-service-sales-to-fi-seed.ts "C:\path\to\ServiceSales.csv"
```

## Behaviour (summary)

- Parses CSV with quoted fields (single-line rows).
- Ignores stub / pivot / total rows (e.g. `ServiceCategory1`, `ServiceName5`, `Grand Total`).
- Excludes package / gift / membership **redemption** style rows.
- Excludes **negative adjustment** aggregates from the seed list.
- Maps Timely text into FI categories: Consultation, Treatment, Surgery, Follow-up, Diagnostics, Other (strong **FUE / transplant** cues in the service name override a Timely **Consultation** category label).
- Suggests `booking_type` only when confident (otherwise `null` + `review_flags`).
- Suggests `base_price` from average vs gross÷quantity consistency (never blindly uses report totals as unit price without a check).
- **Does not** insert into Supabase — outputs are for human review only.

Pure logic lives in `src/lib/timelyImport/serviceSalesToFiSeed.ts` (unit-tested).

## `fi_services` vs review record

Current `fi_services` columns: `name`, `duration_minutes`, `base_price`, `color`, `category`, `is_active`, `booking_type` (optional).

Review JSON also includes **`is_bookable`**, **`source`**, **`notes`**, **`review_flags`**, and embedded **`timely`** metrics for audit — trim or map these when you implement a future DB import.
