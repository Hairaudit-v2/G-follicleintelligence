# Follicle Intelligence — Design Docs

Design for FI as a **shared intelligence and analytics platform** alongside Hair Longevity Institute (HLI) and HairAudit, without FI becoming the operational database for either.

## Documents

| Doc | Content |
|-----|--------|
| [01-platform-architecture](./01-platform-architecture.md) | System context, data flow, FI-as-intelligence-layer rule. |
| [02-canonical-entity-model](./02-canonical-entity-model.md) | Global IDs: global_person_id, global_case_id, global_provider_id, global_clinic_id, global_document_id. |
| [03-event-ingestion-design](./03-event-ingestion-design.md) | Event schema, naming (e.g. hli.intake.submitted), ingest API, idempotency. |
| [04-signal-normalization-model](./04-signal-normalization-model.md) | Shared signal vocabulary and normalized signal storage. |
| [05-ai-integration-strategy](./05-ai-integration-strategy.md) | AI analysis, benchmarking, aggregation, white-label. |

## Design rule

**Follicle Intelligence must not become the operational database for HLI or HairAudit.** It consumes normalized signals, computes risk models and insights, and exposes analytics and recommendations back via read-only APIs.

## Code reference

- Event types and signal vocabulary are defined in `src/lib/fi/vocabulary.ts` for use in ingestion, validation, and pipelines.
