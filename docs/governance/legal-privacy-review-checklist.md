# Legal / privacy review checklist (intelligence ecosystem)

**Purpose:** Structured review before cross-system dispatch, production persistence, or export automation is enabled.

**Pair with:** [Consent and data use policy](./consent-and-data-use-policy.md), [data retention policy](./data-retention-policy.md).

---

## 1. PHI / PII classification

- [ ] Inventory of fields in intelligence envelopes, logs, replay rows, and export DTOs completed.
- [ ] Each field tagged: **PHI**, **PII**, **professional pseudonymous**, **non-personal technical**, or **unknown** (unknown blocks release).
- [ ] **No raw clinical payloads** in `fi_intelligence_event_logs` verified at code + migration level.

---

## 2. Professional pseudonymous ID policy

- [ ] Global ID formats documented (`ProfessionalGlobalId`, etc.).
- [ ] Re-identification risk from graph + external datasets assessed.
- [ ] Staff notice / contract basis for use of professional identifiers in intelligence flows.

---

## 3. Patient consent

- [ ] Lawful basis identified (consent, contract, legitimate interest where permitted).
- [ ] Consent capture UX and versioning recorded.
- [ ] Withdrawal path documented (see consent policy).

---

## 4. Training / professional data consent (IIOHR)

- [ ] Competency evidence flows mapped.
- [ ] Academy vs employer HR boundaries clear.
- [ ] Export to FI or third parties gated until checklist complete.

---

## 5. International transfer considerations

- [ ] Data residency and transfer mechanisms (SCCs, UK IDTA, etc.) identified per tenant / region.
- [ ] Sub-processor list updated if new regions or vendors touch intelligence data.

---

## 6. HLI blood / lab data sensitivity

- [ ] Categories of lab markers in scope for any proposed export.
- [ ] Minimization: aggregates vs line-level results.
- [ ] Retention caps for any derived intelligence stores.

---

## 7. HairAudit procedural data sensitivity

- [ ] Audit narrative vs evidence summary separation documented.
- [ ] Independent audit integrity requirements satisfied.

---

## 8. IIOHR competency data sensitivity

- [ ] Which attestations may leave IIOHR boundary.
- [ ] Anti-fraud / integrity controls for credentials.

---

## 9. Audit trail expectations

- [ ] Append-only logs and replay run records meet regulatory / customer commitments.
- [ ] Clock sync and actor identity on approvals are trustworthy.

---

## Sign-off

| Reviewer | Area | Approved (Y/N) | Date |
|----------|------|----------------|------|
| Legal | | | |
| Privacy / DPO | | | |
| Security | | | |
| Product (FI) | | | |

**Until all required approvals are Y:** production dispatch and production intelligence log persistence remain **disabled** per Stage 16 governance posture.
