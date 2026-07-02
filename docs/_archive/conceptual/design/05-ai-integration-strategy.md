# Future AI Integration Strategy

Follicle Intelligence is designed so that normalized events and signals can power **AI analysis**, **benchmarking**, **large-scale aggregation**, and **white-label enterprise products** without FI becoming the operational database for any source system.

---

## AI analysis

### Data readiness

- **Structured inputs**: Normalized signals (vocabulary-based) and canonical entities provide consistent features for models (e.g. iron_risk, thyroid_risk, androgen_pattern, donor_depletion_risk).
- **Provenance**: Every normalized signal can reference `source_event_id` and `source_system`, so training data can be filtered by source, tenant, or time.
- **Labels**: Outcomes (e.g. “report released”, “audit completed”, treatment response) can be derived from events and joined to case/person-level feature vectors.

### Training pipelines

- **Offline**: FI can export **feature tables** (per global_case_id or global_person_id): normalized signal values + optional demographics + event-derived flags. Export is read-only, batch or streaming; no write back to source DBs.
- **Inference**: Trained models (internal or external) can run inside FI’s pipeline (e.g. new “AI insight” stage) or via an API that receives case/person IDs and returns scores or recommendations. FI stores only **derived outputs** (e.g. new signal types, risk tiers, recommendations); raw training data stays in FI’s event/signal store.
- **Feedback loop**: When source systems record outcomes (e.g. via events like `hli.treatment.recorded` or `hairaudit.verification.completed`), FI can join them to prior predictions for model evaluation and retraining.

### Governance

- **Consent and PII**: AI training exports must respect tenant and person-level consent; aggregation and anonymization policies apply (see “Large-scale data aggregation” below).
- **Explainability**: Existing scorecard explainability (e.g. section-level interpretations) can be extended to AI-derived signals; store “reason codes” or feature contributions in fi_scorecards or a dedicated AI_insights table.

---

## Benchmarking

- **Dimensions**: Benchmarks by **global_provider_id**, **global_clinic_id**, tenant, and (anonymized) geography or specialty.
- **Metrics**: Aggregate from normalized signals and derived scorecards (e.g. mean risk scores, distribution of risk tiers, rate of “surgical_readiness” above threshold). All computed inside FI from fi_signals_normalized, fi_scorecards, fi_events.
- **Visibility**: Per-tenant and per-clinic dashboards can show “you vs. peer” without exposing other tenants’ raw data. FI exposes read-only benchmark APIs; source systems (HLI, HairAudit) call FI to display benchmarks in their UIs.
- **No operational coupling**: Benchmark data is derived; no need for source systems to push benchmark results. FI computes on its own copy of normalized data.

---

## Large-scale data aggregation

- **Scope**: FI can aggregate over many tenants and many cases for population-level analytics, research, and model training. Canonical IDs (global_*_id) allow consistent joins across HLI and HairAudit data.
- **Anonymization**: For research or shared benchmarks, FI can:
  - Strip or hash identifiers (global_person_id, global_provider_id, global_clinic_id) according to policy.
  - Publish only aggregates (counts, distributions, model performance) or synthetic/perturbed statistics.
- **Tenant controls**: Tenants can opt in/out of “aggregate research” or “benchmark inclusion”; FI respects flags when building export or benchmark datasets.
- **Storage**: Aggregation is done over FI’s event and signal stores; no need to replicate source operational DBs. Large-scale runs can use batch jobs or a dedicated analytics DB that is fed from FI (read-only replica or ETL).

---

## White-label enterprise products

- **Same pipeline, different branding**: Event ingestion, canonical resolution, signal normalization, and risk models are shared. Per-tenant config (existing fi_tenant_config / scorecard_weights, branding) drives white-label behavior.
- **Product variants**: Different products can consume the same FI APIs and get different slices or labels (e.g. “Hair Longevity Report” vs. “Surgical Audit Scorecard”) from the same underlying scorecard and signals.
- **Enterprise isolation**: tenant_id segregates data; enterprise clients get their own tenant. FI never mixes data across tenants except where explicitly allowed (e.g. consented benchmarking).
- **AI as a product**: Future “AI interpretation” or “recommendation engine” can be a white-label module: same model, different copy and presentation per tenant.

---

## Summary: how FI exposes value back

| Consumer | How FI exposes |
|----------|-----------------|
| HLI | Read APIs: scorecard, recommendations, benchmarks; optional webhook when report/insight is ready. |
| HairAudit | Same: scores, benchmarks, verification-related insights via API. |
| White-label products | Same APIs + tenant-scoped config and branding. |
| Internal analytics | Dashboards and batch exports from FI’s DB (events, normalized signals, scorecards). |
| AI / research | Feature and outcome exports (anonymized/aggregated as needed); inference API for new insights. |

All exposure is **read-only** from FI’s side; no writing into HLI or HairAudit operational stores. This preserves the rule: **Follicle Intelligence is the intelligence layer only.**
