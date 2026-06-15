# Ecosystem integration guardrails

**Audience:** Engineers working across **FI OS**, **HairAudit**, **IIOHR**, and **HLI**.  
**Related:** `docs/ecosystem-architecture-stabilization-audit.md`, `packages/intelligence-core/`.

These rules apply to **new** integrations and cross-system features. Legacy paths remain until migrated in Stage 10.

---

## 1. Read vs write paths

- **No read path should create writes** unless that path is explicitly documented as a mutation (e.g. “sync” or “materialize cache”), reviewed, and covered by tests.  
- **GET routes** and “loaders” must not enqueue side effects, insert audit rows, or call outbound webhooks unless the contract is named (e.g. explicit “touch” endpoint).  
- Prefer **separate** HTTP methods or server actions for mutations so routing and caching stay honest.

---

## 2. Exports and outbound data

- **All exports are disabled by default** (`exportMode: "disabled"` in `packages/intelligence-core/policy`). Promotion requires explicit configuration, review, and audit logging plan.  
- **Graph and analytics exports** must not include PHI/PII unless a dedicated, reviewed data contract and legal basis exist — default contracts in `intelligence-core/contracts` are **non-PHI** shapes.  
- **Competency and audit exports** require consent and tenant policy flags before `canExportCompetencyData` / `canExportAuditData` may become true.

---

## 3. Cross-system writes and latency

- **Cross-system writes must be non-blocking** for user-facing operations: enqueue, background job, or fire-and-forget with structured error logging — never hold a clinical UI request on an external HTTP round-trip.  
- **Retries** must be idempotent (`source_event_id`, idempotency keys, or dedupe tables).

---

## 4. Event architecture

- **Event chains should emit to a core bus (or internal queue abstraction)**, not call downstream systems synchronously from handlers. FI’s current ingest handlers are coupled to pipelines — new work should **not** extend that pattern; Stage 10 introduces a bus boundary.  
- **Unknown event types** are rejected at the edge with a clear 400 — no partial persistence of unrecognized envelopes.

---

## 5. Identity

- **Shared identity contracts** (`ProfessionalGlobalId`, `PatientGlobalId`, …) must be used **before** inventing new global ID string formats.  
- **Pseudonymous subject IDs** (`PseudonymousSubjectId`) are for analytics and graph nodes — never reverse-engineer into operational patient records from exports.

---

## 6. New integration checklist

Every new integration (inbound webhook, outbound partner, cron sync, or export API) requires:

1. **Environment gate** — feature flag or env var documented in runbooks.  
2. **Audit log** — append-only record of receipt, validation outcome, and side effects (`IntelligenceEventLogRecord` / `IntelligenceExportAttempt` patterns).  
3. **Replay / rollback plan** — how to reprocess from stored payload or how to compensate if partially applied.  
4. **Automated tests** — at least contract or parser tests; prefer golden fixtures for JSON envelopes.

---

## 7. Security and secrets

- **No secrets in client bundles**; webhook verification uses server-only modules.  
- **Timing-safe** comparison for static secrets (see existing HR sync and legacy FI API patterns).

---

## 8. Four-system coverage

| System | Guardrail emphasis |
|--------|--------------------|
| **FI OS** | Tenant isolation, foundation dual-write idempotency, CRM PHI boundaries |
| **HairAudit** | Evidence integrity, independent audit narrative, producer payload minimization for non-clinical exports |
| **IIOHR** | Competency evidence integrity, HR vs academy data separation, export consent |
| **HLI** | Lab and longitudinal health data sensitivity; diagnostics events are high-trust, low-retention in derived stores |

Violations of these guardrails should block merge until a documented exception is approved.
