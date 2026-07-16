# FI-HUBSPOT-CONTACT-ASSOCIATION-ENRICHMENT-1 — Backlog

**Status:** OPEN — NON-BLOCKING  
**Created:** 2026-07-16  
**Parent closeout:** `evidence-fi-hubspot-phase-o-closeout.md`  
**Blocks Phase O:** No  
**Programme handoff:** Listed in `fi-hubspot-backup-1-backlog-handoff.md`; parent programme closed GREEN — COMPLETE in `evidence-fi-hubspot-backup-1-final-closeout.md`

Privacy-safe milestone record only. Do not paste emails, names, form responses, or patient data into this file.

---

## Purpose

Optional post-Phase-O enrichment: stage deterministic Conversion ID ↔ Contact ID mappings that exist in the selected HubSpot CSV form-submission exports but were **not exposed by the live HubSpot submissions API** and therefore were not required for API-fidelity Phase O completion.

---

## In scope

- Ingest only deterministic Conversion ID ↔ Contact ID mappings from the selected CSV exports under `FI-HUBSPOT-BACKUP-1/record-exports/forms-and-submissions/submissions/**`
- Expected maximum currently evidenced: **3,107** rows with populated Contact ID (of 4,220 selected-export rows)
- Tenant-scoped validation against the Evolved Hair HubSpot integration tenant
- Exact canonical ID joins only (`Conversion ID` ↔ `hubspot_submission_id`; `Contact ID` ↔ HubSpot contact record ID)
- Idempotent upsert into association staging / `linked_contact_id` as designed by implementers
- Preserve unmatched submissions (blank Contact ID rows remain without contact edges)
- Separate reconciliation evidence (privacy-safe counts only)
- Must **not** alter the Phase O verdict (`GREEN WITH DOCUMENTED LIMITATIONS`)

---

## Explicitly out of scope / prohibited

- Email matching
- Fuzzy matching
- Probabilistic identity resolution
- Broad CRM search reconstruction of contacts from form field values
- Forms or form-submissions backup rerun
- Changing Phase O from GREEN WITH DOCUMENTED LIMITATIONS based on enrichment outcome alone
- File body download or promotion into clinical records

---

## Acceptance criteria (when implemented)

1. At most 3,107 deterministic associations staged from the selected CSV subset (or the then-current evidenced maximum after re-count).
2. Unmatched submissions remain staged; zero baseline Conversion IDs deleted.
3. Reconciliation evidence records exact join counts, blanks preserved, and zero email/fuzzy/probabilistic joins.
4. Phase O closeout files continue to classify contact associations as an accepted limitation of the API-fidelity backup; enrichment is additive.

---

## Related evidence

| Artifact | Role |
|----------|------|
| `evidence-fi-hubspot-phase-o-closeout.md` | Authoritative Phase O closeout |
| `evidence-fi-hubspot-engagement-residual-ambers.md` | Interim contact-link analysis |
| `evidence-fi-hubspot-form-submissions-reconciliation-66f72f09.md` | Submissions GREEN; contact edges 0 from API |
