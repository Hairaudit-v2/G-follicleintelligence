# `@follicle/intelligence-core`

Shared **boundary** layer for the Follicle Intelligence ecosystem:

- **FI OS** — clinic operating system and intelligence surfaces  
- **HairAudit** — independent audit / AuditOS-aligned evidence  
- **IIOHR** — academy, certification, competency ledger, HR sync touchpoints  
- **HLI** — Hair Longevity Institute diagnostics and longevity pathways  

This package is **types-first**: contracts, envelopes, policy decision shapes, and observability records. It intentionally has **no runtime dependencies**.

## Layout

| Path | Purpose |
|------|---------|
| `events/` | Cross-system event envelope, delivery mode, privacy tier, validation helpers |
| `identity/` | Global ID type aliases + pseudonymous ID **stubs** (do not replace IIOHR helpers until Stage 10 migration) |
| `contracts/` | Minimal versioned DTOs for exports and bus payloads (not full app models) |
| `policy/` | Export / graph / FI-send decision types and safe defaults |
| `observability/` | Log, export attempt, replay, and integration health shapes |

## Relationship to legacy `FiEventEnvelope`

Production ingestion today uses `FiEventEnvelope` in `src/types/fi-events.ts` with `source_system: "hli" | "hairaudit" | "clinic"`.

`IntelligenceSystemSource` introduces **`fi_os`** and **`iiohr`** for **new** producers and documentation alignment. Stage 10 adds a thin adapter between legacy envelopes and `IntelligenceEventEnvelope` without rewriting existing handlers.

## Usage (Stage 10+)

```ts
import type { IntelligenceEventEnvelope } from "@follicle/intelligence-core/events";
import { defaultIntelligenceExportPolicy } from "@follicle/intelligence-core/policy";
```

Until workspace path aliases are configured for package name resolution, import via relative paths from application code or add a TypeScript path mapping.

## Versioning

Contract files export `*_V1_VERSION` constants. Breaking changes require new `V2` interfaces and explicit migration notes.
