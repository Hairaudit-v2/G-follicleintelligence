# Consent and data use policy (intelligence ecosystem)

**Document type:** Policy draft for governance review. **Not legally binding** until reviewed and adopted by the organization responsible for each product surface.

**Activation:** Cross-system movement of data described below is **not enabled** in production until this policy (or an approved successor) and the [legal / privacy review checklist](./legal-privacy-review-checklist.md) are satisfied and recorded.

---

## 1. Scope

This policy applies to **intelligence-layer** exchanges among:

- **FI OS** — clinic operating system and internal intelligence surfaces.
- **HairAudit** — independent audit / AuditOS-aligned evidence producers.
- **IIOHR** — academy, certification, competency evidence, and HR-adjacent sync.
- **HLI** — Hair Longevity Institute diagnostics and longitudinal pathways.

It complements clinic-level privacy notices and partner DPAs. It does **not** replace medical record policies or national health privacy regimes.

---

## 2. What may move between systems (when explicitly enabled and governed)

When a future approved integration is **explicitly turned on** with contracts, flags, and audit trails (none of which authorize production today by default):

| Category | May cross boundaries (when approved) | Typical form |
|----------|--------------------------------------|--------------|
| **Professional identity** | Pseudonymous or tenant-scoped professional identifiers tied to competency, audit attestations, or operational roles | Stable professional / staff pseudonymous IDs; **not** free-text names as primary routing keys in intelligence envelopes |
| **Operational intelligence metadata** | Event names, correlation IDs, delivery mode, privacy tier labels, processing status | Structured metadata in `IntelligenceEventEnvelope`-style contracts |
| **Sanitized summaries** | Non-clinical structural hints (e.g. key counts, allow-listed key names) for observability | `payload_summary` patterns; **never** raw clinical narrative |
| **Audit and competency attestations** | Signed completion of training, audit checklist outcomes at summary level | Summary DTOs under explicit export policy in `intelligence-core` |

Anything not listed here requires a **new data classification** and **legal review** before design.

---

## 3. What remains local (default posture)

Unless a reviewed export or sync contract explicitly allows otherwise:

- **Raw clinical payloads** — measurements, photos, imaging references, clinical notes, treatment plans, medication lists, and similar **stay in the originating clinical system** or approved clinical record stores.
- **Patient direct identifiers** — legal name, national ID, full address, email, phone, and similar **are not** intelligence-bus payload fields for cross-system routing in default contracts.
- **Operational PHI** used for day-to-day care inside FI OS **is not** replicated into intelligence event logs (see Stage 13 sanitizer rules).
- **HairAudit procedural detail** beyond evidence summaries — local to HairAudit / agreed export DTOs only.
- **HLI lab and blood marker detail** — highly sensitive; **local** unless a separate HLI-specific agreement and minimization pass exist.

---

## 4. Patient-identifiable vs pseudonymous professional data

| Type | Definition (operational) | Intelligence bus default |
|------|--------------------------|---------------------------|
| **Patient-identifiable** | Data that can identify a natural person patient in context | **Excluded** from cross-system intelligence envelopes unless a dedicated, approved clinical data contract exists (none today for intelligence dispatch). |
| **Pseudonymous professional** | Identifiers for staff / practitioners used for competency, audit, or routing without patient linkage in the payload | **Permitted only** as contract-defined IDs; never infer patient identity from professional graph nodes in exports. |

---

## 5. Clinical payload boundaries

- Intelligence **event logs** store **metadata + `payload_summary` only**; see `docs/stage13-persistent-intelligence-event-log.md`.
- **Replay** reconstructs **synthetic** stubs for dry-run / validation; it does **not** reload raw clinical payloads from the log table.
- **`dispatch_future`** is a **reserved planning mode** with **no execution path** and an **empty** dispatch allow-list until a future governed stage explicitly implements dispatch (see Stage 15 docs).

---

## 6. Consent requirements (conceptual)

- **Patient-facing care data:** consent or other lawful basis must exist for any replication or analytics that could re-identify patients across brands.
- **Professional competency / training evidence:** consent or employment / contractual basis as applicable in jurisdiction; IIOHR-specific rules apply.
- **Audit exports:** independent audit integrity requirements; HairAudit-side producer minimization.
- **HLI diagnostics:** explicit consent for research / longevity pathways where required.

---

## 7. Revocation and withdrawal

- **Withdrawal of consent** (where consent is the basis) must propagate to **export gates** and **downstream processors** per DPA and product design.
- **Technical expectation:** disable relevant **environment flags**, stop **replay runs** that target affected event classes, and **review** `fi_intelligence_replay_runs` and export audit tables for scope (see [incident rollback checklist](./incident-rollback-checklist.md)).

---

## 8. Not enabled until approved

**No production environment** may enable cross-system **dispatch**, broadened **allow-lists**, **production intelligence event log persistence**, or **governed dispatch execution** based solely on this markdown file. Activation requires:

- Completion of [environment activation checklist](./environment-activation-checklist.md),
- Legal / privacy sign-off per [legal / privacy review checklist](./legal-privacy-review-checklist.md),
- Operator readiness per [intelligence operator runbook](./intelligence-operator-runbook.md).

Until then, all such capabilities remain **off by default** or **blocked in code** as documented in Stage 13–15.
