# Form submissions reconciliation — run `66f72f09`

**Frozen:** 2026-07-16  
**Machine-readable:** `evidence-fi-hubspot-form-submissions-id-reconciliation.json`  
**Canonical ID:** baseline CSV `Conversion ID` ↔ staging `hubspot_submission_id`  
**No patient names, emails, answers, or clinical field values included.**

---

## Recommended closeout wording

Live engagement backup completed with exit code 0 and partial status. Messages, forms, submissions and files completed. Canonical-ID reconciliation shows **zero baseline Conversion IDs missing** from destination and **zero duplicate** `hubspot_submission_id` groups. The **1,091** destination-only IDs are **not** post-export live growth: all have `hubspot_created_at` on or before the FI-HUBSPOT-BACKUP-1 download cutoff (`2026-07-15T08:42Z`). They match the documented gap between the **selected-form CSV baseline (4,220)** and the **portal forms-inventory total (5,310)**; destination now holds **5,311** (inventory +1). Parent-form and tenant integrity pass. **Phase O for the +1,091 count discrepancy: GREEN.** Residual **AMBER** remains for (a) forms inventory 48 vs staged definitions 46, and (b) contact linkage not populated from the Forms Submissions API payload shape (`contactId` absent on all 5,311 raw payloads; 0 contact association edges). No production restore PASS is claimed until those residual items are accepted or fixed. Current staging data and run evidence must be retained. **Do not rerun form_submissions** for the +1,091 alone — no repeatable pagination/duplication defect found.

---

## 3. Unique identifier compare

| Metric | Count |
|--------|------:|
| Baseline unique IDs (`Conversion ID`) | **4220** |
| Backup unique IDs (`hubspot_submission_id`) | **5311** |
| IDs only in baseline | **0** |
| IDs only in backup | **1091** |
| Duplicate canonical ID groups in backup (`HAVING COUNT(*) > 1`) | **0** |

Duplicate assessment: no true duplicates and no versioned multi-row collisions. Upsert key is `(tenant_id, integration_id, hubspot_form_id, hubspot_submission_id)`. Source ID → destination UUID is 1:1 (0 multi-map cases).

Selected-form subset spot-check (staging vs CSV rows): all 13 selected forms present; appointment booking **1585** vs CSV **1584**; contact-us **10** vs CSV **9**; other listed selected forms match CSV row counts. Net **+2** on the selected set; remaining backup-only IDs are on **19 other form IDs** not included in the selected CSV package.

---

## 4. Privacy-safe breakdown of the 1,091 backup-only IDs

**First check — post-cutoff growth?**  
**No.** `created_after_export_cutoff = 0`; `created_on_or_before_export_cutoff = 1091`.

| Attribute | Result |
|-----------|--------|
| Creation date | Spread **2021-12-17 → 2026-07-14** (pre-cutoff). Year totals: 2021:9, 2022:215, 2023:268, 2024:280, 2025:225, 2026:94 |
| Updated date | Column always null (engine does not set `hubspot_updated_at` for submissions) |
| Form ID | **21** form IDs; top two alone = 446 + 435 = **881** (forms never in the 13-CSV package) |
| Submission status | No discrete status column; treat as active submission events |
| Source / import origin | HubSpot Forms Submissions API (`/form-integrations/v1/submissions/forms/{formId}`); not CSV import |
| Tenant | All `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| Deleted / archive | `archived=false` for all 1091 (engine default; API path not an archived CRM search) |
| Parent form existence | **0** missing parent among backup-only; **0** among all 5311 |
| Content classification (metadata only) | standard: 1069; restricted_clinical_intake: 22 |

Equivalent rollup shape (status unavailable → use archived flag):

```text
created_on_or_before_cutoff / archived=false / records=1091
created_after_cutoff / archived=false / records=0
```

---

## 5. Relational integrity

| Check | Result |
|-------|--------|
| Tenant exists | Pass |
| Wrong-tenant rows | 0 |
| Parent form exists for every submission | Pass (0 orphans); 46 parent forms staged |
| Form association edges (`form_submission`→`form`) | 5311 (1:1 with submissions) |
| Contact association edges | **0** |
| `linked_contact_id` column populated | **0** |
| `raw_payload.contactId` present | **0 / 5311** (API returns `values` arrays; engine looks for top-level `contactId`) |
| Duplicate source → multiple destination UUIDs | 0 |
| Threads required? | N/A for form submissions |

Orphan concern for the +1091: **not orphaned** — every backup-only row has a parent form definition. Contact linkage is a **separate residual gap** (API/engine field mapping), not evidence of wrong-tenant or silent FK failure on forms.

---

## 6. Source vs destination at cutoff

| Control | Count | Notes |
|---------|------:|-------|
| Original selected-export baseline | 4220 | Documented intentional subset |
| Forms inventory “Total recorded submissions” (export day) | **5310** | Same manifest as FI-HUBSPOT-BACKUP-1 |
| Destination now (all staged unique IDs) | **5311** | Inventory +1 |
| Destination ∩ baseline IDs | **4220 / 4220** | No missing baseline records |
| Fresh live HubSpot recount this pass | **Not executed** | Avoided re-pull/rerun; inventory + destination used as cutoff authority |

Authoritative comparison for portal-wide completeness: **source inventory 5310 ≈ destination 5311**, not 4220 vs 5311.

---

## 7. Classification

### +1,091 discrepancy vs selected export → **GREEN**

- Baseline excluded a documented category (non-selected / “low-value” forms) that live backup intentionally included.
- All 1091 backup-only IDs predate export cutoff (coverage, not growth).
- Unique-ID checks pass; no missing baseline IDs; no duplicate canonical IDs; parent-form integrity passes.

### Residual items → keep overall engagement closeout **AMBER** until accepted

- Forms definitions 48 (inventory) vs 46 (staged).
- Contact linkage not captured from submissions API payloads.
- CLI run status remains `partial` for other engagement reasons (e.g. files listing capability / finalize semantics) — submissions count itself is explained.

### RED triggers checked — **none hit** for submissions

No duplicate canonical IDs, tenant leakage, orphaned submissions, missing baseline records, or evidence of wrong-form mapping for the +1091 set.

### Rerun decision

**Do not rerun** `form_submissions`. Preserve run `66f72f09` and staging. No defect-driven partial clear/rerun indicated for this discrepancy.
