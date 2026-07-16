# Forms inventory reconciliation — run `66f72f09`

**Status: GREEN**  
**Date:** 2026-07-16  
**Machine-readable:** `evidence-fi-hubspot-forms-reconciliation.json`  
**Export IDs:** `evidence-fi-hubspot-export-form-ids.json`  
**Backup IDs:** `evidence-fi-hubspot-backup-form-ids.json`

No form names, URLs, field labels, or submission content included.

---

## Source workbook

| Field | Value |
|-------|-------|
| Located path (operator) | `FI-HUBSPOT-BACKUP-1/record-exports/hubspot-listing-lib-exports-all-forms-2026-07-15.xlsx` |
| Ignored working copy | `.local/hubspot-audit-inputs/forms-inventory.xlsx` (`git check-ignore` OK) |
| SHA-256 | `321fc5c887dd6d2e78e06b8480069ea41d89dd0b4f7c1d248d1bd9e4f8b28c72` (matches manifest) |
| Size | 10,594 bytes (matches manifest) |
| Sheet | `All forms` |
| ID column | `Form ID` |
| Unique export IDs | **48** |

Raw XLSX is **not** committed.

---

## Canonical ID compare

| Metric | Count |
|--------|------:|
| Export unique | **48** |
| Backup unique | **46** |
| Intersection | **46** |
| Only in export | **2** |
| Only in backup | **0** |
| Duplicates (export) | **0** |
| Duplicates (backup) | **0** |

### Export-only form IDs

| Canonical form ID | formType (v3) | In default list APIs | Direct GET | Archived | Backed-up submissions | Classification |
|-------------------|---------------|----------------------|------------|----------|----------------------:|----------------|
| `440386a7-7498-4245-890c-ab785d3c6f77` | `captured` | No (list=46) | 200 | false | 0 | System/nonstandard type excluded from default Forms list |
| `6e136ca0-40f7-48af-9216-64df6c9122ac` | `blog_comment` | No (list=46) | 200 | false | 0 | System/nonstandard type excluded from default Forms list |

Observed: `/marketing/v3/forms/` list count **46**; `/forms/v2/forms` list count **46**; neither list contains the two export-only IDs. Direct GET by ID succeeds on both endpoints.

---

## Parent-form integrity (5,311/5,311)

Unchanged and consistent: every staged submission associates to a parent among the **46** listable definitions. The two export-only forms have **zero** staged submissions, so they are not restore parents for the submission set.

---

## Verdict

**Forms inventory: GREEN**

- Backup captured the full default Forms list universe (46/46).
- Export workbook’s extra two rows are non-listable HubSpot form types (`captured`, `blog_comment`) included by the listing-lib export but omitted from the list endpoints used by the engagement backup.
- Not a pagination defect; not tenant leakage; not missing active hubspot-form definitions with submissions.
- **Forms-only rerun not required** for Phase O. Optional future enhancement: request additional `formTypes` if those definitions must be staged.

## CLI partial contribution

The two-form delta is **explained** and does **not** require keeping forms inventory AMBER. Remaining CLI `partial` drivers (e.g. engine `unexplained` vs selected submission baseline 4220; files listing UNSUPPORTED) are separate — see closeout decomposition.
