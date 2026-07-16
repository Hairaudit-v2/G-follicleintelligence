# Residual Phase O AMBER controls — contact links & CLI partial

**Run:** `66f72f09-d333-4bb0-9c39-5da7b912e964`  
**Date:** 2026-07-16  
**Forms inventory / form submissions:** GREEN (not active blockers)

> **Superseded for Phase O closeout (2026-07-16):** Authoritative verdict is now **GREEN WITH DOCUMENTED LIMITATIONS** in `evidence-fi-hubspot-phase-o-closeout.md`. Contact associations are an **ACCEPTED LIMITATION — NON-BLOCKING**. CLI `partial` is an **ACCEPTED OPERATOR OVERRIDE**. This file remains as interim residual analysis; do not treat its Overall Phase O AMBER row as current.

Privacy-safe only: no emails, names, field values, or clinical content.

---

## 1. Contact associations

### Live API path (Forms Submissions)

Sample GET `/form-integrations/v1/submissions/forms/{formId}?limit=1` (200):

| Observation | Result |
|-------------|--------|
| Top-level keys | `conversionId`, `pageUrl`, `submittedAt`, `values` |
| `contactId` present | **No** |
| Staged `linked_contact_id` populated | **0 / 5311** |
| Association edges submission→contact | **0** |
| Association edges submission→form | **5311 / 5311** |
| Canonical ID retained | `hubspot_submission_id` ← `conversionId` |

HubSpot’s Forms Submissions API does **not** return a contact association on these records. Nothing was discarded from the API payload; the engine only creates a contact edge when top-level `contactId` exists.

HubSpot community / docs guidance: join contacts via email (or similar) after the fact — **not** used here (no broad fuzzy matching).

### Parallel authoritative source (selected CSV exports)

All **13** selected-form CSV exports under `FI-HUBSPOT-BACKUP-1/.../submissions` include a **Contact ID** column:

| Metric | Count |
|--------|------:|
| CSV submission rows | 4220 |
| Contact ID populated | **3107** |
| Contact ID blank | 1113 |

Those Conversion ID ↔ Contact ID pairs were **not** ingested into `fi_external_hubspot_association_staging` / `linked_contact_id` during the live API backup.

### Classification

| Path | Verdict |
|------|---------|
| API backup fidelity | Associations **unavailable in source API**; payload + `conversionId` preserved |
| Overall contact-link control (interim) | **AMBER** at time of writing — deterministic Contact IDs exist in selected CSV exports for 3,107/4,220 rows and have not yet been staged as associations |
| Phase O closeout classification | **ACCEPTED LIMITATION** — not exposed by the live API and not staged from optional historical CSV enrichment (`evidence-fi-hubspot-phase-o-closeout.md`) |

**Not RED:** API associations were not discarded or mis-mapped.  
**Not a backup defect for API-fidelity scope:** live submissions API did not expose `contactId`.

**Follow-up (optional, separate milestone):** `FI-HUBSPOT-CONTACT-ASSOCIATION-ENRICHMENT-1` — ingest CSV `Conversion ID` + `Contact ID` into association staging for the selected subset only — no email matching. See `fi-hubspot-contact-association-enrichment-1-backlog.md`. Portal-wide API enrichment remains unavailable without a HubSpot product change or a different CRM association endpoint if one exists later.

---

## 2. CLI `partial` semantics

Finalize logic (`hubspotConnector.server.ts`):

```text
status = incomplete || missingScopeKinds.length || unexplained ? "partial" : "completed"
missingScopeKinds = missing capabilities with result === "MISSING_SCOPE" only
engagement_complete = !incomplete && missing.length === 0
  (missing = all kinds with granted === false, including UNSUPPORTED)
```

### Conditions that fired on run `66f72f09`

| Condition | Fired? | Detail |
|-----------|--------|--------|
| `incomplete` (failed>0 or !complete on granted kinds) | **No** | All granted kinds `complete: true`, `failed: 0` |
| `missingScopeKinds` (MISSING_SCOPE) | **No** | No missing-scope kinds |
| `unexplained` reconciliation | **Yes** | `form_submissions.reconciliationStatus = unexplained`, `exportDifference = +1091` vs baseline 4220 |
| Files listing capability | `UNSUPPORTED` HTTP **405** | `files.granted = false`, `result = UNSUPPORTED` |

**Sole cause of CLI `status: "partial"`:** engine still treated form_submissions vs selected-export baseline 4220 as `unexplained`. Operator reconcile later classified that delta **GREEN** (coverage), but finalize did not use that classification.

### Files 405 — what it is / is not

| Question | Answer |
|----------|--------|
| Documented unsupported operation? | **Yes** — probe of `GET /files/v3/files` returns **405**; classified `UNSUPPORTED`, not `MISSING_SCOPE` |
| Did 405 alone force `partial`? | **No** — UNSUPPORTED is excluded from `missingScopeKinds` |
| Incomplete backup coverage? | **No for milestone scope** — attachment-ref metadata inventory completed: **903** staged, `content_backed_up = 0`, recon `exact` |
| Skipped file body download? | **Yes, by design** this milestone |
| Effect on `engagement_complete`? | **Yes** — `files` is the only `granted: false` kind → `engagement_complete = false` even though metadata phase completed |

Files listing 405 is therefore a **documented unsupported listing endpoint** with **successful metadata inventory from engagement attachment references**, not a failed/unprocessed checkpoint and not the driver of `partial`.

### CLI partial decomposition (authoritative)

| Dataset | Attempted | Succeeded | Skipped | Failed | Reason | Recoverable | Follow-up |
|---------|-----------|-----------|---------|--------|--------|-------------|-----------|
| Notes…messages, forms | Yes | Yes | — | 0 | Exact/explained | — | None |
| Form submissions | Yes | Yes (5311) | — | 0 | Engine `unexplained` vs baseline 4220 → **caused `partial`** | Yes — update baseline semantics / accept operator GREEN | Optional finalize fix |
| Files listing | Yes (probe) | — | Listing **UNSUPPORTED 405** | 0 | Method not allowed on this endpoint | N/A | None |
| Files metadata inventory | Yes | Yes (903) | Body download | 0 | Milestone: metadata only | N/A | None |
| Contact links | Implicit | 0 from API | CSV Contact IDs not ingested | 0 | API has no `contactId` | Partial via CSV ingest | Optional enrichment |

---

## 3. Updated residual matrix

| Control | Verdict |
|---------|---------|
| Forms inventory | GREEN |
| Form submissions | GREEN |
| Submission uniqueness | GREEN |
| Submission parent-form integrity | GREEN |
| Submission tenant integrity | GREEN |
| Forms / form-submissions rerun | No |
| Contact associations | Interim AMBER analysis → closeout **ACCEPTED LIMITATION** (non-blocking) |
| CLI partial semantics | Understood; sole `partial` driver = submissions baseline flag → closeout **ACCEPTED OPERATOR OVERRIDE** (ENGINE PARTIAL / OPERATOR GREEN) |
| Files metadata milestone | GREEN (listing unsupported; bodies not in scope) |
| Overall Phase O (interim row) | **AMBER** at time of writing |
| Overall Phase O (authoritative) | **GREEN WITH DOCUMENTED LIMITATIONS** — `evidence-fi-hubspot-phase-o-closeout.md` |
| Production PASS | Not claimed |
