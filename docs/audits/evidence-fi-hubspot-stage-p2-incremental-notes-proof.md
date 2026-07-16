# FI-HUBSPOT-BACKUP-1 — Stage P2 controlled notes incremental-backup proof

**Evidence classification:** Privacy-safe operational metadata only  
**Date:** 2026-07-16  
**Machine-readable:** `evidence-fi-hubspot-stage-p2-incremental-notes-proof.json`

**Does not claim Stage P complete.**  
**Does not implement Stage P3.**

> **Superseded for programme status (2026-07-16):** Stages P3–P4 completed GREEN; FI-HUBSPOT-BACKUP-1 is closed **GREEN — COMPLETE** in `evidence-fi-hubspot-backup-1-final-closeout.md`. This file remains the authoritative P2 proof.

---


## 1. P2 verdict

### **GREEN**

Controlled production proof succeeded: one non-patient test note was created, captured exactly once by a fixed-cutoff incremental run, verified, watermark-advanced after verification, and identically replayed with zero duplicate destination rows.

---

## 2. Production deployment and SHA

| Field | Value |
|-------|-------|
| Alias | `follicleintelligence.ai` / `www.follicleintelligence.ai` |
| Production deployment at proof | `dpl_53PuKDdGR7N1asvrzuC8wKU1k6z2` |
| readyState | **READY** |
| Deployed SHA | `ec9341ddede134f61d66c3994768096fd6249a5a` |
| Contains `34ca0374` | **Yes** (ancestor) |
| Contains `24ece99b` / `bba82044` | **Yes** |
| Prior gate deployment | `dpl_wPdpTJAMaAEFZcRRdtUSHvS24Jnf` @ `34ca0374` (superseded by evidence-gate deploy) |

CLI proof executed against production HubSpot portal + production Supabase (`iqqvzgxoimxchhcnbzxl`) using the local incremental engine after a single-sort Search repair (`d213ad51`; see § remaining risks).

---

## 3. Tenant and integration references

| Field | Value |
|-------|-------|
| Tenant ID | `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| HubSpot integration ID | `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6` |
| Confirmed before every destination query | **Yes** |

---

## 4. Source portal reference

HubSpot portal / account: `21009770`  
Confirmed via connector config + live `/integrations/v1/me` before note create.

---

## 5. Test note label

`FI OS BACKUP TEST — STAGE P2 — 2026-07-16T03-01-30-158Z-f6e249`

Privacy-safe body only. No auditor email, no patient/staff PII, no clinical content. Standalone note (no associations).

---

## 6. Canonical HubSpot note ID

`113007728535`

---

## 7. Source createdAt and updatedAt

| Field | Value |
|-------|-------|
| createdAt | `2026-07-16T03:01:30.637Z` |
| updatedAt (direct GET) | `2026-07-16T03:01:30.637Z` |
| hs_lastmodifieddate (direct GET) | `2026-07-16T03:01:30.637Z` |
| Staging hubspot_updated_at after capture | `2026-07-16T03:01:31.691Z` |
| archived | `false` |

---

## 8. Direct source read result

| Check | Result |
|-------|--------|
| Create HTTP | **201** |
| Direct GET HTTP | **200** |
| Exact canonical ID match | **PASS** |
| Exists once | **PASS** |
| Timestamps returned | **PASS** |
| Not archived | **PASS** |

---

## 9–11. Cutoff range and boundary proof

| Field | Value |
|-------|-------|
| cutoff-from | `2026-07-16T03:00:00.000Z` |
| cutoff-to | `2026-07-16T03:20:00.000Z` |
| Semantics | lower inclusive / upper exclusive: `updatedAt >= cutoff_from AND updatedAt < cutoff_to` |
| Boundary proof | `2026-07-16T03:00:00.000Z` ≤ `2026-07-16T03:01:30.637Z` < `2026-07-16T03:20:00.000Z` |
| Frozen for replay | **Yes** (identical command) |

---

## 12. Destination pre-run count

| Check | Result |
|-------|--------|
| Staging rows for note ID | **0** |
| Duplicate groups | **0** |
| Cross-tenant rows | **0** |
| Notes watermark rows | **0** |
| Active incremental notes runs | **0** |

---

## 13–14. First successful run

| Field | Value |
|-------|--------|
| Command (secrets redacted) | `npm run hubspot:backup:incremental -- --dataset notes --cutoff-from 2026-07-16T03:00:00.000Z --cutoff-to 2026-07-16T03:20:00.000Z --tenant-id c2615b95-… --integration-id ade8a7d0-…` |
| Run ID | `df7b39ed-3429-4a0b-a3d6-37b399701ea8` |
| Started | `2026-07-16T03:03:19.152Z` |
| Completed | `2026-07-16T03:03:22.003Z` |
| Exit code | **0** |
| Engine status | `completed` |
| Verification | `passed` |
| Immutable cutoffs | match command |
| discovered | 1 |
| inRange | 1 |
| inserted | 1 |
| updated | 0 |
| unchanged | 0 |
| failed | 0 |
| Checkpoint | `phase=complete`, `pagesCompleted=1`, `lastId=113007728535` |

### Preceding failed attempt (fail-closed)

| Field | Value |
|-------|--------|
| Run ID | `51054587-08d4-457f-8079-7a3351a25589` |
| Status | `failed` |
| Cause | HubSpot Search **400** `too many sorts (count: 2, max allowed: 1)` |
| Watermark advanced | **false** |
| Destination rows after failure | **0** |

Repair applied before successful capture: Search body uses a single `hs_lastmodifieddate ASC` sort; equal-timestamp ID ordering remains local.

---

## 15–16. First destination + verification events

| Check | Result |
|-------|--------|
| Staging row count | **1** |
| Tenant / integration | exact match |
| Canonical HubSpot ID | `113007728535` |
| Duplicate group | **0** |
| Cross-tenant | **0** |
| Verification events | `run_created` → `run_started` → `page_checkpointed` → `finalisation_completed` → `verification_passed` → `watermark_advanced` |

---

## 17. Watermark before / after first successful run

| State | Value |
|-------|-------|
| Before | no notes watermark row |
| After first success | `watermark_timestamp = 2026-07-16T03:20:00.000Z` |
| last_verified_run_id (after first) | `df7b39ed-3429-4a0b-a3d6-37b399701ea8` |
| Advanced only after verification | **Yes** (event order proven) |
| Exceeds cutoff-to | **No** (equals cutoff-to) |
| Shared with other datasets | **No** (notes only) |

---

## 18–20. Replay

| Field | Value |
|-------|--------|
| Replay method | identical CLI cutoffs (safe same-range rerun) |
| Run ID | `e54d457a-cef5-43ae-8e1e-dc326523a63c` |
| Status / verification | `completed` / `passed` |
| Exit code | **0** |
| discovered / inRange | 1 / 1 |
| inserted | **0** |
| updated | 0 |
| unchanged | **1** |
| failed | 0 |
| Post-replay destination rows | **1** |
| Canonical identity unchanged | **Yes** |

---

## 21–23. Post-replay integrity

| Check | Result |
|-------|--------|
| Matching destination rows | **1** |
| Duplicate canonical-ID groups | **0** |
| Cross-tenant rows | **0** |
| Duplicate association groups | N/A (no note association staging table; source note had no associations) |
| Active notes runs remaining | **0** |
| Unresolved failed checkpoint / started run | **0** |
| Non-notes watermarks created | **0** |
| Watermark post-replay | still `2026-07-16T03:20:00.000Z` (version 2; last_verified_run_id → replay run) |
| Watermark regression | **No** |

---

## 24. Production log review

Vercel runtime logs for deployment `dpl_53PuKDdGR7N1asvrzuC8wKU1k6z2`, query `hubspot`, levels error/fatal/warning, last 1h: **no matching hits**.

CLI path is local operator execution (not serverless). Material backup error was the documented Search dual-sort 400 on the first failed run only; repaired and re-run successfully.

---

## 25. Test-note disposition

**Retained** in HubSpot portal `21009770` as clearly labelled `FI OS BACKUP TEST — STAGE P2 — …`.

Not archived (archived-note Search remains an existing AMBER risk). Destination staging row and verification history retained. No staging delete.

---

## 26. Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| Dual-sort Search bug on previously deployed SHA | AMBER→fixed locally | Must deploy single-sort repair before scheduled P3 ops |
| Search API vs list property lag | AMBER | Did not block this proof; note was Search-visible |
| Archived notes outside Search path | AMBER | Unchanged; test note retained unarchived |
| Evolved CLI tenant defaults | AMBER | Explicit tenant/integration flags used |

---

## 27. Final P2 verdict

### **GREEN**

All Stage P2 GREEN rules met after documented fail-closed first attempt + single-sort repair + successful capture + idempotent replay.

---

## 28. Exact next gate

Implement Stage P3 scheduled incremental backup operations with concurrency protection, automatic verification, failure notification, operator runbook and one observed scheduled production run.

**Do not implement P3 in this evidence.** Deploy the single-sort Search repair before enabling any schedule.

---

## Validation checklist

- [x] Exactly one HubSpot note created
- [x] No real patient data used
- [x] No full-history backup run
- [x] No schedule added
- [x] No unrelated dataset backed up
- [x] No contact-association enrichment
- [x] No Stage P completion claimed
- [x] JSON evidence validated
- [x] Privacy scan: no note body, secrets, tokens, or PII in evidence
