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

---

## Stage 7A.2 — Curated approved seed (no DB insert)

After the real Timely file is saved to `input/ServiceSales.csv` and reviewed:

```bash
npm run timely:7a2
```

This runs **`timely:import-preview`** then **`timely:build-approved`**, producing:

| Output | Purpose |
|--------|---------|
| `output/fi-services-seed-approved.json` | Curated rows for a future import (`approved_for_import`, `inactive_deferred`, `removed_non_bookable`, `summary`). |
| `output/stage-7a2-final-report.md` | Short counts, uncertain/deferred list, and “ready for FI import” checklist. |

Curation rules live in `src/lib/timelyImport/buildApprovedFiSeed.ts` (unit-tested): non-bookable retail removed, uncertain `booking_type` / category flags deferred, duplicate **Consultation** names deferred to the highest-gross row, at most one row per **`booking_type`** for active import (losers keep catalogue fields but `booking_type` cleared).

If `input/ServiceSales.csv` is missing, the pipeline still runs against the **fixture** so CI and local workflows stay green — **replace the input file and re-run before production sign-off.**

---

## Stage 7A.4 — Curated Excel catalogue → same `fi-services-seed-approved.json` (no DB insert)

Use this when the **source of truth** is the manually curated Evolved workbook (sheet **`Services Catalogue`**) instead of the Timely Service Sales pipeline.

Default input: `input/evolved-fi-services-catalogue-draft (1).xlsx` (override with `--excel=`).

```bash
npm run timely:7a4
```

Or:

```bash
npx tsx scripts/excel-catalogue-to-approved-seed.ts --excel=docs/timely-import/input/your-catalogue.xlsx
```

| Output | Purpose |
|--------|---------|
| `output/fi-services-seed-approved.json` | Same payload shape as 7A.2 (`meta.stage: "7a4"`, `approved_for_import`, …) for **Stage 7A.3** dry-run/import. |
| `output/stage-7a4-review-report.md` | Counts, duplicate `booking_type` warnings, rejected rows, removed non-bookable lines. |

Rules live in `src/lib/timelyImport/excelCatalogueToApprovedSeed.ts` (unit-tested): validates FI category, duration, price, hex colour, active flag; maps Excel aliases (`facial_prp`→`prp`, `led`→`other`); **clears duplicate `booking_type`** on non-canonical rows (schema allows only one non-null type per tenant); rows with `Import?` ≠ `Yes` are skipped from `approved_for_import` (financial/retail “Review” lines go to `removed_non_bookable` when flagged in notes/name).

**Note:** `npm run timely:7a2` and `npm run timely:7a4` both write `output/fi-services-seed-approved.json` — run the pipeline you intend to be canonical before Stage 7A.3.

---

## Stage 7A.3 — Import approved rows into `fi_services`

Requires **`FI_ADMIN_API_KEY`** in the environment (same value passed with **`--admin-key=`** or **`FI_IMPORT_ADMIN_KEY`**). Uses **`SUPABASE_SERVICE_ROLE_KEY`** for DML (same as other maintenance scripts).

```bash
# Dry-run (default): plan only, no writes
npx tsx scripts/import-approved-fi-services.ts --tenant-id=<uuid> --admin-key=<your FI_ADMIN_API_KEY>

# Apply
npx tsx scripts/import-approved-fi-services.ts --tenant-id=<uuid> --admin-key=<your FI_ADMIN_API_KEY> --commit
```

Optional: `--file=path/to/fi-services-seed-approved.json` (defaults to `docs/timely-import/output/fi-services-seed-approved.json`).

Uses **`approved_for_import` only**. Upsert rules and dry-run behaviour are implemented in `src/lib/timelyImport/approvedFiServicesImportPlan.ts` (unit-tested) and `scripts/import-approved-fi-services.ts`.
