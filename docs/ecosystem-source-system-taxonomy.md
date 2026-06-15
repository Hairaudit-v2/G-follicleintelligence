# Ecosystem source-system taxonomy

**Sprint:** Architecture Stabilization — Stage 10  
**Purpose:** Align legacy FI HTTP ingest identifiers (`source_system`, `event_type`) with the canonical `@follicle/intelligence-core` model without changing production ingress behavior.

---

## Legacy FI HTTP ingest (`FiEventEnvelope`)

| `source_system` (wire) | Meaning in product | Canonical intelligence `source` |
|------------------------|--------------------|-----------------------------------|
| `clinic` | FI OS / clinic-tenant operational telemetry (legacy string) | `fi_os` |
| `hli` | Hair Longevity Institute producers | `hli` |
| `hairaudit` | HairAudit producers | `hairaudit` |

**Note:** `FiSourceSystem` intentionally keeps `clinic` on the wire so existing producers and idempotency keys remain stable. Adapters map `clinic` → `fi_os` for cross-system envelopes.

---

## Intelligence-core (`IntelligenceSystemSource`)

| Canonical `source` | System |
|--------------------|--------|
| `fi_os` | Follicle Intelligence OS (clinic operating context) |
| `hli` | Hair Longevity Institute |
| `hairaudit` | HairAudit |
| `iiohr` | IIOHR competency / academy paths (**reserved**; no new ingestion wired in Stage 10) |
| `external` | Third-party or unknown producers |

---

## Event locality

- **Cross-system (ingest):** `FI_INGEST_CROSS_SYSTEM_EVENT_TYPES` in `lib/fi/events/schema.ts` — names that must appear on `INTELLIGENCE_EVENT_NAMES` (drift tests).
- **Local-only (ingest):** `clinic.ai.usage` — documented as FI-local telemetry; still allow-listed on the shared envelope union for adapter round-trips, but default export policy keeps emission off.

---

## Vocabulary vs ingest

`src/lib/fi/vocabulary.ts` lists additional **design / roadmap** event names. Any vocabulary entry not on the intelligence-core allowlist must be documented in `FI_VOCABULARY_OUTSIDE_INTELLIGENCE_CORE` until promoted.

---

## Migration path (forward)

1. **Parse legacy** — continue accepting `clinic`, `hli`, `hairaudit` on `/api/fi/events` unchanged.  
2. **Map canonical** — use `src/lib/fi/events/intelligenceCoreAdapter.ts` for envelopes, policy gates, and observability projections only.  
3. **Emit canonical later** — optional future step: new producers may emit `fi_os`-scoped names while the adapter continues to accept legacy strings for a deprecation window.

See also: [ecosystem-architecture-stabilization-audit.md](./ecosystem-architecture-stabilization-audit.md).
