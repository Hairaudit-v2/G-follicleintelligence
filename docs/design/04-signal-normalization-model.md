# Signal Normalization Model

Follicle Intelligence uses a **shared signal vocabulary** so that both Hair Longevity Institute (HLI) and HairAudit can emit the same kinds of risk/pattern signals. Models and analytics consume normalized signals, not raw payloads.

---

## Design principles

- **Vocabulary is shared**: same signal IDs across HLI and HairAudit (e.g. `iron_risk`, `donor_depletion_risk`).
- **Normalization in FI**: source systems send events with raw payloads; FI (or agreed adapters) maps payloads to vocabulary + scalar/structured values.
- **Stored per case/person**: normalized signals are stored keyed by `tenant_id` and `global_case_id` (and optionally `global_person_id` for longitudinal views).

---

## Shared signal vocabulary (canonical list)

Signals are **typed**: either a **risk** (numeric/ordinal) or a **pattern** (categorical or structured). Below is the canonical set both systems can emit or FI can derive.

### Laboratory / systemic (HLI-oriented, usable by HairAudit if data available)

| Signal ID | Type | Description |
|-----------|------|-------------|
| iron_risk | risk | Iron status / deficiency risk. |
| thyroid_risk | risk | Thyroid dysfunction risk. |
| androgen_pattern | pattern | Androgen-related pattern (e.g. AGA predisposition). |
| inflammatory_pattern | pattern | Inflammatory markers / scalp inflammation. |
| nutrition_markers | pattern | Vitamins, minerals, diet-related. |

### Scalp / trichology (HLI + HairAudit)

| Signal ID | Type | Description |
|-----------|------|-------------|
| seborrhoeic_pattern | pattern | Seborrhoeic dermatitis / oiliness. |
| cicatricial_pattern | pattern | Cicatricial / scarring alopecia. |
| fibrosis_risk | risk | Scalp fibrosis risk. |
| density_deficit_pattern | pattern | Density/miniaturization pattern. |

### Surgical / transplant (HairAudit-oriented)

| Signal ID | Type | Description |
|-----------|------|-------------|
| donor_depletion_risk | risk | Donor area depletion risk. |
| graft_trauma_risk | risk | Graft handling / trauma risk. |
| surgical_readiness | risk | Readiness for surgery (can align with existing scorecard section). |

### Extended (for future use)

- **progression_timeline**: pattern/risk for rate of progression.
- **hormonal_androgen**: risk (align with existing scorecard section).
- **image_miniaturization_density**: pattern/risk from images (align with existing pipeline).

---

## Normalized signal storage (FI)

FI stores **normalized** signal values per case (and optionally per person for longitudinal aggregation). Two complementary approaches:

### Option A: One row per (case, signal_type, optional time)

**fi_signals_normalized**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK. |
| tenant_id | uuid | FK fi_tenants. |
| global_case_id | uuid | FK fi_global_cases. |
| global_person_id | uuid | Optional; for person-level rollups. |
| signal_id | text | Vocabulary key (e.g. iron_risk, androgen_pattern). |
| value_type | text | `numeric` \| `ordinal` \| `categorical` \| `structured`. |
| value_numeric | numeric | When value_type is numeric/ordinal. |
| value_text | text | When value_type is categorical. |
| value_json | jsonb | When value_type is structured. |
| confidence | numeric | 0–1 optional. |
| source_event_id | uuid | FK fi_events (provenance). |
| source_system | text | hli \| hairaudit. |
| effective_at | timestamptz | When the signal applies. |
| created_at | timestamptz | When FI wrote the row. |

- Unique or overwrite policy: e.g. one active row per (tenant_id, global_case_id, signal_id) with “latest wins” or versioning by effective_at.

### Option B: Keep existing fi_signals_blood / fi_signals_image + vocabulary layer

- **Existing tables**: keep as raw or semi-structured extraction output (e.g. blood markers, image-derived fields).
- **Vocabulary layer**: a separate table or view that **maps** extraction outputs to the shared vocabulary (e.g. “from this blood result we derive iron_risk = 0.7”). That table has the same shape as fi_signals_normalized (case_id, signal_id, value_*, source_event_id, etc.) and is what risk models and analytics read.

Recommendation: introduce **fi_signals_normalized** (or equivalent) as the single store for vocabulary-based signals; existing blood/image tables feed into it via normalization jobs triggered by events (e.g. after document.uploaded and extraction).

---

## Mapping from events to signals

- **hli.intake.submitted**: From intake form (selections, demographics), FI or an adapter may set initial patterns (e.g. androgen_pattern from concern, age, sex).
- **hli.document.uploaded**: After blood extraction (existing pipeline), map markers to vocabulary (e.g. ferritin → iron_risk; TSH → thyroid_risk; DHT-related → androgen_pattern). After image extraction, map to density_deficit_pattern, fibrosis_risk, seborrhoeic_pattern, etc.
- **hairaudit.case.submitted** / **audit.completed**: From audit payload, map to donor_depletion_risk, graft_trauma_risk, density_deficit_pattern, surgical_readiness.

Mapping rules can live in FI config (per tenant) or in code; output is always rows in the normalized signal store with **signal_id** from the vocabulary.

---

## Relation to existing scorecard

Existing **fi_scorecards** and **FiScorecardSectionId** (e.g. hormonal_androgen, thyroid_iron, surgical_readiness) can be **consumers** of normalized signals:

- **thyroid_iron** section ← signals: iron_risk, thyroid_risk.
- **hormonal_androgen** ← androgen_pattern (and related).
- **inflammation** ← inflammatory_pattern.
- **image_miniaturization_density** ← density_deficit_pattern, fibrosis_risk.
- **surgical_readiness** ← surgical_readiness, donor_depletion_risk, graft_trauma_risk.

So: **vocabulary drives both cross-system analytics and the existing FI scorecard pipeline.**

---

## Versioning and governance

- **Vocabulary version**: signal_id set is versioned (e.g. v1). New signals (e.g. new pattern from AI) can be added with backward compatibility.
- **Deprecation**: mark signals as deprecated rather than delete; old rows remain queryable.
- **Tenant overrides**: allow tenants to disable certain signals or rename for white-label; underlying signal_id stays the same for aggregation.
