# FI-HUBSPOT-IMPORT-1C — Owner-resolution workspace evidence

**Verdict:** GREEN (with residual operator UI smoke / screenshots)

**Date:** 2026-07-16  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Objective

Deliver a guided HubSpot owner-resolution workspace, persist operator decisions independently of apply, and expand mapping coverage only where explicitly approved. Do not force 31/31 coverage.

## Production position after 1C

| Metric | Value |
|--------|------:|
| Owners reviewed | 31 |
| Mappings proposed (DB) | 0 |
| Mappings applied (1C new) | 0 |
| Already applied (from 1B) | 2 |
| Archived source owner | 24 |
| Historical only | 0 |
| No matching staff | 5 |
| Unresolved | 0 |
| Conflicts | 0 |
| Wrong-tenant | 0 |
| `fi_staff_source_ids` (hubspot) | 2 (unchanged) |

### Exact source-owner → staff mappings (still 1B only)

| HubSpot owner | FI staff |
|---------------|----------|
| `120371232` | `f9e0bfdf-535a-4f0c-ab2f-3930b5ffc6c1` |
| `121916721` | `be01f2b8-5bd0-4e09-9c4d-5454f9cbc162` |

### Batch IDs

| Batch | Kind | Purpose |
|-------|------|---------|
| `c73c5fb8-4df2-42b4-93ac-ddefe25d4574` | 1B | Existing two mappings (rollback preview still isolates these 2 rows) |
| `3ad9738f-8d8d-4f7e-80d0-665fc4708e71` | 1C | Classification-only preview/apply (0 mappings; checksum empty-proposal) |

### Watermark

| When | Notes watermark |
|------|-----------------|
| Before / after 1C | `2026-07-16T03:45:02.366Z` (unchanged) |

## Workspace

- Route: `/fi-admin/[tenantId]/settings/integrations/hubspot?tab=owner-resolution`
- Access: Configuration hub roles only (`canViewTenantConfigurationHub`); mutate requires CRM write + hub caps
- States: mapped, proposed, unresolved, no_matching_staff, archived_source_owner, historical_only, conflict, excluded, already_applied
- Decisions table: `fi_hubspot_owner_resolution_decisions` (migration applied to production)
- Primary apply label: **Apply approved owner mappings**
- Suggestions never auto-apply; `proposed` only after explicit save

## Production execution

1. Deployed migration + workspace code paths
2. Classified 29 unresolved owners (`--classify-defaults`) — no auto-propose
3. Preview batch `3ad9738f-…` with 0 mappings; tables that change = `fi_import_batches` only
4. Applied empty approved batch (0 source-id inserts)
5. Replayed same batch (0 delta)
6. Confirmed 1B rollback preview still lists exactly the two 1B mapping row IDs
7. Confirmed watermark unchanged; staff source-id count remains 2

## Mutation summary

| Table | Change |
|-------|--------|
| `fi_hubspot_owner_resolution_decisions` | 29 active decision rows inserted (24 archived_source_owner, 5 no_matching_staff) |
| `fi_import_batches` | 1C preview/apply batch metadata |
| `fi_staff_source_ids` | **no change** |
| `fi_staff` / `fi_users` / leads / patients | **no change** |

## Tests

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | pass |
| `npm run test:hubspot-import` | 56 pass |
| `npm run test:hubspot-incremental` | 58 pass |
| Focused 1C guards (name-only, batch limit, checksum, allowlist, state derive) | pass |

## Permission / tenant isolation

- Tab gated by Configuration hub (ordinary CRM-read roles cannot open owner-resolution)
- Server actions re-check hub caps; mutate path uses write gate
- Staff selection rejects cross-tenant / inactive without override
- Unique one-owner-per-staff retained; conflicts quarantined

## Usability

- One-owner-at-a-time review with Previous/Next + arrow keys
- Filters + search
- Review / Preview / Apply separated; apply requires typing batch ID
- Plain-language conflict and coverage copy
- Audit details behind disclosure
- **Screenshots:** not captured in this agent session — operator should open the tab once in prod for visual confirmation

## Idempotency / rollback

- Empty 1C apply + replay: applied 0, delta 0, watermark stable
- 1B rollback preview still batch-scoped to the two mapping rows
- Production rollback not executed (mappings remain correct)

## Remaining risks

1. Contact/deal staging payloads currently lack owner properties → owned-record counts may show 0 until backup property coverage expands
2. Five active owners have no matching FI staff email — legitimately unresolved for mapping until operator proposes or staff exists
3. UI screenshots / live keyboard a11y pass by a human operator still recommended
4. One-owner-per-staff uniqueness retained; multi-owner historical identities stay quarantined pending identity-model approval

## Exact next gate

**FI-HUBSPOT-IMPORT-1D — Contact and lead migration pilot with patient-protection gate**

Must begin with a bounded, write-controlled lead cohort and must continue to prohibit automatic patient creation.
