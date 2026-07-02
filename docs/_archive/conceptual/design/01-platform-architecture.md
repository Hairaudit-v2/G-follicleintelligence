# Follicle Intelligence — Platform Architecture

## Design rule

**Follicle Intelligence must not become the operational database for either Hair Longevity Institute (HLI) or HairAudit.**

FI is an **intelligence layer** that:

- Consumes **normalized signals** from source systems
- Computes **risk models** and **derived insights**
- Generates **recommendations**
- Powers **analytics dashboards**
- Enables **future AI interpretation**

Source systems remain the system of record for patients, cases, clinics, and transactions.

---

## System context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPERATIONAL SYSTEMS (SoR)                             │
├──────────────────────────────┬──────────────────────────────────────────────┤
│   Hair Longevity Institute   │              HairAudit                        │
│   • Patient portal           │   • Surgical audit platform                  │
│   • Trichology intake        │   • Transplant scoring                       │
│   • Blood test uploads       │   • Doctor/clinic benchmarking               │
│   • Scalp imaging            │   • Report generation                        │
│   • Longitudinal treatment   │   • Verification programs                    │
└──────────────┬───────────────┴──────────────────┬───────────────────────────┘
               │ events + signals                 │ events + signals
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FOLLICLE INTELLIGENCE (intelligence layer)                │
│  • Ingest events (idempotent)                                                │
│  • Resolve canonical entities (global_person_id, global_case_id, …)         │
│  • Normalize signals → shared vocabulary                                     │
│  • Run risk/insight models                                                   │
│  • Store derived insights, scorecards, recommendations                       │
│  • Expose analytics APIs & dashboards                                         │
│  • Feed AI-ready datasets                                                    │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONSUMERS                                                                   │
│  • HLI / HairAudit (recommendations, scores, benchmarks)                      │
│  • White-label enterprise products                                           │
│  • Internal analytics & BI                                                    │
│  • Future AI models (training & inference)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FI capabilities (what FI stores vs what it does not)

| FI does | FI does not |
|--------|-------------|
| Canonical entity registry (global IDs + source mappings) | Replace HLI/HairAudit user/patient DBs |
| Normalized event log (immutable, append-only) | Own appointment or booking data |
| Normalized signal store (risk/pattern vocabulary) | Own clinical notes or EMR |
| Derived insights, scorecards, model runs | Own surgery or treatment records |
| Recommendations and benchmarks | Own billing or scheduling |
| Analytics aggregates and dashboards | Be the primary UI for intake/audit |

---

## High-level data flow

1. **Ingest**  
   HLI and HairAudit emit **events** (e.g. `hli.intake.submitted`, `hairaudit.case.submitted`) to FI. Events carry **source identifiers** and optional **payloads**. FI does not pull from source DBs; it receives pushed events (webhook, queue, or API).

2. **Resolve**  
   FI resolves source IDs to **canonical entities** (global_person_id, global_case_id, global_provider_id, global_clinic_id, global_document_id) via mapping tables. New entities get a canonical ID; existing ones are linked.

3. **Normalize**  
   Events and payloads are translated into **normalized signals** using a **shared signal vocabulary** (e.g. `iron_risk`, `androgen_pattern`, `donor_depletion_risk`). Raw data can be retained for audit; the vocabulary drives models and analytics.

4. **Compute**  
   FI runs **risk models** and **derived insights** (e.g. scorecards, tiers, recommendations) keyed by canonical case/person. Results are stored in FI-only tables (e.g. fi_scorecards, fi_model_runs, fi_reports).

5. **Expose**  
   FI exposes **read-only** APIs and dashboards: scores, recommendations, benchmarks, aggregates. Source systems call FI to display insights or to drive workflows; FI never writes back into source operational tables.

---

## Multi-tenant and white-label

- **Tenants** (e.g. one per enterprise or brand) scope all FI data. `tenant_id` is required on canonical entities, events, and signals.
- **White-label**: per-tenant config (branding, feature flags, scorecard weights) is already supported; the same event/signal model supports multiple white-label products.
- **Benchmarking** and **aggregation** use tenant and/or global_clinic_id / global_provider_id with appropriate consent and anonymization (see AI strategy doc).

---

## Document map

- **02-canonical-entity-model.md** — Global IDs and mapping from source systems.
- **03-event-ingestion-design.md** — Event schema, transport, idempotency, and normalization triggers.
- **04-signal-normalization-model.md** — Shared signal vocabulary and storage.
- **05-ai-integration-strategy.md** — AI analysis, benchmarking, aggregation, and enterprise use.
