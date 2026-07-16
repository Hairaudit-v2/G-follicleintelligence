# Forms inventory reconciliation — run `66f72f09`

**Status: BLOCKED**  
**Date:** 2026-07-16  

Canonical ID comparison of export inventory (48) vs backup definitions (46) cannot proceed until the source workbook is located.

See: `evidence-fi-hubspot-forms-inventory-source-blocked.md`

## Counts available today

| Side | Unique form IDs | Source |
|------|----------------:|--------|
| Export inventory | **unknown** (workbook missing) | Manifest claims 48 |
| Backup | **46** | `evidence-fi-hubspot-backup-form-ids.json` |
| Only in export | **blocked** | Requires workbook |
| Only in backup | **blocked** | Requires workbook |
| Duplicates (backup) | **0** | Staging query |

## Parent-form integrity vs 46 definitions

Prior result stands: **5,311 / 5,311** submissions have a parent form association to a form ID present in the 46-row definition staging set (0 orphans).

This does **not** classify the two missing export forms. It only shows no staged submission currently depends on a definition outside the 46.

## Resume when unblocked

1. Copy `hubspot-listing-lib-exports-all-forms-2026-07-15.xlsx` → `.local/hubspot-audit-inputs/forms-inventory.xlsx`
2. Confirm `git check-ignore` on that path
3. Run `npx tsx scripts/audits/extract-hubspot-export-form-ids.ts --input .local/hubspot-audit-inputs/forms-inventory.xlsx`
4. Diff against `evidence-fi-hubspot-backup-form-ids.json`
5. Classify each `onlyInExport` ID via read-only HubSpot API (archived/deleted/inaccessible)
6. Update this file + `evidence-fi-hubspot-forms-reconciliation.json` and closeout matrix
