# FI-TRICHOSCOPY-1A.1 — Live Staging Certification

**Status:** AMBER — harness and evidence template ready; live round-trip blocked pending staging credentials  
**Date opened:** 2026-08-04  
**Foundation commit:** `03e3ec8f` (`feat(trichoscopy): FI-TRICHOSCOPY-1A HLI foundation and entitlement controls`)  
**Evidence root:** `docs/fios/trichoscopy/evidence/`

## Objective

Prove a complete, authenticated FiOS→HLI→FiOS trichoscopy lifecycle using staging tenants, staging users, live credentials, and real persisted records. Stub transport must not be invoked during the certification run.

## Preflight (blocking)

Do **not** mark GREEN until all are true:

| # | Check | How |
|---|--------|-----|
| P1 | Staging FiOS base URL reachable | `FI_TRICHOSCOPY_CERT_BASE_URL` |
| P2 | Platform flag on | `FI_ENABLE_HLI_TRICHOSCOPY=1` on staging |
| P3 | Live HLI credentials present | `HLI_TRICHOSCOPY_API_BASE_URL`, `SERVICE_KEY`, `SIGNING_SECRET`, `WEBHOOK_SECRET` |
| P4 | Adapter not in stub mode | Harness prints `useStub=false` |
| P5 | Trichoscopy migrations applied on staging DB | `20261108120001`, `20261108120002` |
| P6 | Entitled staging tenant + negative-control tenant | IDs recorded in run manifest |
| P7 | Synthetic patient + authorised staff user | IDs recorded; no real PHI |

Run preflight only:

```bash
npm run certify:trichoscopy-1a1 -- --preflight
```

Execute mutable probes (invalid signature / cross-tenant / expired timestamp) against staging events endpoint when secrets are loaded:

```bash
npm run certify:trichoscopy-1a1 -- --execute-security-probes
```

Full clinical round-trip remains a supervised operator run (request creation + HLI lifecycle + UI confirmation). The harness writes a skeleton run folder; the operator completes the manifest.

## Required journey

1. Provision / select a staging tenant with an active trichoscopy subscription (`grantTrichoscopySubscription`).
2. Enable platform feature flag and tenant module configuration (`setTrichoscopyModuleConfiguration`).
3. Grant required user capabilities (role allow-list + module access).
4. Link a synthetic patient between FiOS and HLI (created via request / link persistence).
5. Submit a trichoscopy request from the FiOS patient workspace.
6. Confirm HLI receives and persists the request (`hli_request_id`, `hli_episode_id` on `fi_hli_trichoscopy_requests`).
7. Progress the HLI assessment through agreed lifecycle events (`session_created` → `session_captured` → `analysis_ready` → `observation_confirmed`).
8. Publish a versioned evidence pack; FiOS imports it.
9. Receive signed events in FiOS (`/api/integrations/hli/trichoscopy/events`).
10. Confirm patient timeline and action surfaces update.
11. Confirm the active evidence pack is visible to authorised staff.
12. Supersede the evidence pack; verify prior version retained as `superseded`.
13. Run reconciliation; confirm balanced result (no unexplained discrepancies).
14. Replay the same request and events; prove idempotency (no duplicate clinical / usage rows).
15. Attempt cross-tenant and invalid-signature access; confirm rejection.
16. Teardown or retention declaration for synthetic data.

## Acceptance criteria (all required for GREEN)

| ID | Criterion | Result |
|----|-----------|--------|
| A1 | One complete live staging round-trip passes | ☐ |
| A2 | No stub transport invoked (`stub: false` / `useStub=false` throughout) | ☐ |
| A3 | All messages authenticate successfully (outbound + inbound) | ☐ |
| A4 | Duplicate delivery causes no duplicate clinical or commercial records | ☐ |
| A5 | Reconciliation reports no unexplained differences | ☐ |
| A6 | Evidence-pack supersession preserves previous versions | ☐ |
| A7 | Cross-tenant access denied | ☐ |
| A8 | Invalid and expired signatures rejected | ☐ |
| A9 | FiOS UI accurately reflects HLI state | ☐ |
| A10 | Evidence committed under `docs/fios/trichoscopy/evidence/runs/` | ☐ |

## Minimum evidence pack contents

Populate `runs/<run-id>/manifest.json` from the template. Required fields:

- Staging tenant, synthetic patient, request and link identifiers
- FiOS request payload with sensitive values redacted
- HLI receipt and processing records
- Signature verification results (both directions)
- Event sequence and timestamps
- Evidence-pack version history
- FiOS timeline screenshots (paths under `attachments/`)
- Reconciliation output
- Usage-metering records showing no duplicate billing events
- Replay results
- Invalid-signature rejection
- Cross-tenant rejection
- Deployment and commit references
- Final teardown or retention declaration

## Manual operations (pilot vs general release)

Do **not** block controlled pilot solely because billing webhooks are unimplemented, provided every grant is explicitly authorised and audited. Block clinic self-service until subscription activation / suspension connect to billing or contract systems.

| Current manual operation | Recommended treatment | Pilot | Broad release |
|--------------------------|----------------------|-------|---------------|
| `activateTenantModule` | Keep as audited operations command for pilot tenants | Allowed (audited) | Remain ops-gated |
| `grantTrichoscopySubscription` | Connect to canonical commercial entitlement workflow before broad release | Allowed with `source: manual_grant` + audit actor | Must be billing/contract driven |
| `setTrichoscopyModuleConfiguration` | Expose via existing module settings UI, subject to subscription limits | UI available when entitled | Same; limits enforced by tier |

Reference settings surface: `/fi-admin/[tenantId]/settings/modules/trichoscopy`.

## Suggested sequence after 1A.1 GREEN

1. **FI-TRICHOSCOPY-1A.2** — Browser and failure-recovery E2E  
2. **FI-TRICHOSCOPY-1B** — Consultation integration  
3. **FI-TRICHOSCOPY-1C** — Treatment planning and longitudinal comparison  
4. **FI-TRICHOSCOPY-1D** — Commercial automation and usage billing  

Strategic goal: link trichoscopy findings to consultations, pathology, treatment decisions, procedures, repeat assessments, and outcomes (Hair Restoration Digital Twin) — not merely display a report in FiOS.

## Run record

| Field | Value |
|-------|-------|
| Verdict | **AMBER** |
| Blocking reason | Staging HLI/FiOS live credentials not provided for this session |
| Unit foundation | `npm run test:trichoscopy-1a` |
| Live run folder | _none yet_ |
| Sign-off | Pending successful `--execute` certification |

When credentials are available, re-open this workstream, run the journey, commit `runs/<run-id>/`, and flip verdict to GREEN only if A1–A10 all PASS.
