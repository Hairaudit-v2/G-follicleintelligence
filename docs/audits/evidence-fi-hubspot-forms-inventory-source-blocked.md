# Forms inventory source — BLOCKED

**Status:** BLOCKED (Phase A) — **HISTORICAL**  
**Date:** 2026-07-16  

> **Superseded (2026-07-16):** Source workbook was later located and reconciled. Forms inventory is **GREEN** in `evidence-fi-hubspot-forms-reconciliation.md` (commit `1c4a3da1`). Authoritative Phase O closeout: `evidence-fi-hubspot-phase-o-closeout.md` — **GREEN WITH DOCUMENTED LIMITATIONS**. Preserve this file as the blocked-state evidence trail; do not treat Overall Phase O AMBER below as current.

**Reason (at time of BLOCKED):** Original HubSpot forms inventory workbook is not present on the local machine or in `FI-HUBSPOT-BACKUP-1` evidence directories. Canonical export form IDs cannot be extracted without fabricating data from the API or backup tables (explicitly forbidden).

## Manifest reference

From `FI-HUBSPOT-BACKUP-1/manifest-and-verification/backup-manifest.txt`:

| Field | Value |
|-------|-------|
| Source filename | `hubspot-listing-lib-exports-all-forms-2026-07-15.xlsx` |
| Worksheet (claimed) | All forms |
| Form count (claimed) | 48 |
| SHA-256 (claimed) | `321fc5c887dd6d2e78e06b8480069ea41d89dd0b4f7c1d248d1bd9e4f8b28c72` |
| File size (claimed) | 10,594 bytes |
| Total recorded submissions (claimed) | 5,310 |

Independent copy location noted in manifest:

`C:\Users\thelo.EVOLVEDPCHOME\OneDrive - Evolved Hair\FI back up\follicleintelligence\FI-HUBSPOT-BACKUP-1`

## Paths searched

| Root | Result |
|------|--------|
| `%USERPROFILE%\Downloads` | No matching xlsx (hubspot zips/screenshots only) |
| `%USERPROFILE%\Desktop` | Path missing |
| `%USERPROFILE%\Documents` | No match |
| `G:\follicleintelligence` (recursive `*all-forms*.xlsx`, `*hubspot*forms*.xlsx`, `*listing-lib*.xlsx`) | No match |
| `G:\follicleintelligence\FI-HUBSPOT-BACKUP-1` | No `.xlsx` files; `record-exports/forms-and-submissions/` contains submission CSVs only |
| OneDrive `FI back up` tree | No match for filename / listing-lib / all-forms xlsx |
| Exact `where /r` under user profile for filename | Not found |
| Size filter `10594` bytes under searched roots | No match |
| Windows Recent | Prior **search** for the exact filename exists; shortcut target empty (file not opened/found) |

## Filename patterns used

- `hubspot-listing-lib-exports-all-forms-2026-07-15.xlsx`
- `*all-forms*.xlsx`
- `*hubspot*forms*.xlsx`
- `*listing-lib*.xlsx`

## Missing source evidence required

Place the original workbook (matching manifest name and preferably SHA-256 `321fc5c…`) at:

```text
.local/hubspot-audit-inputs/forms-inventory.xlsx
```

Then re-run:

```text
npx tsx scripts/audits/extract-hubspot-export-form-ids.ts --input .local/hubspot-audit-inputs/forms-inventory.xlsx
```

Do **not** regenerate the 48 IDs from HubSpot API or from the 46-row backup table.

## Related prepared artifacts (do not substitute for export IDs)

| Artifact | Role |
|----------|------|
| `scripts/audits/extract-hubspot-export-form-ids.ts` | Ready extractor (exits non-zero unless 48 unique IDs) |
| `scripts/audits/hubspotExportFormIdsCore.ts` | Core + reconcile helpers |
| `scripts/audits/hubspotExportFormIdsCore.test.ts` | Fixture tests |
| `docs/audits/evidence-fi-hubspot-backup-form-ids.json` | 46 backup form IDs (destination side only) |

## Phase O impact

| Control | Verdict |
|---------|---------|
| Form submissions | GREEN (unchanged) |
| Forms inventory 48→46 | **BLOCKED** pending source workbook |
| Overall Phase O | **AMBER** (forms inventory unresolved) |
| Forms-only rerun | Not recommended until export-only IDs are classified |

## Parent-form integrity note (5311/5311)

All 5,311 staged submissions already reference parent form IDs present among the **46** backed-up definitions (0 orphans). That metric does **not** prove the two export-only forms are unnecessary — it only proves no staged submission currently points at a missing definition. Classification of the two export-only form IDs still requires the workbook.
