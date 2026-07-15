# FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1 - Closeout

Status: CLOSED  
Closed: 16 July 2026  
Environment: Production (`https://follicleintelligence.ai`)  
Tenant: `c2615b95-b707-4485-aa5f-be8f78ec868a`  
Canonical route: `/fi-admin/{tenant}/settings/integrations/hubspot`  
Evidence classification: Privacy-safe operational / access-control evidence only

## Final record

- Overall verdict: **GREEN**
- Canonical HubSpot workspace shipped and gated on production: **YES**
- Role-gating proven on production (Doctor native + Reception impersonation): **YES**
- Automated production smoke suite (A–K) landed for regression detection: **YES**
- Merge / production lineage: `main` @ `56248a61` (includes `49b63f2a` config-hub tighten + `e67bd4ec` impersonation cap fix)

## Access-control evidence (production, 16 July 2026)

| Axis | Result | Notes |
|---|---|---|
| Doctor native-role gating | **PASS** | Tenant `/configuration` and HubSpot `?tab=configuration` → 404; Import Review read-only |
| Reception impersonation gating | **PASS** | Same after impersonation-cap + CRM-operator config-hub fixes |
| Configuration access restriction | **PASS** | Config hub requires clinic/finance/admin settings caps only |
| Import Review read-only access | **PASS** | CRM-read sessions limited to Import Review tab |
| Mutation controls hidden | **PASS** | Approve / Reject / Sync / CSV upload hidden without mutate rights |
| Clinic settings isolation | **PASS** | Configuration / Integrations / Admin Users hidden for Reception |
| Cross-tenant protection | **PASS** | Covered by portal + smoke tenant-isolation axis (established) |

## Workspace consolidation checklist

| Surface | Consolidation status |
|---|---|
| Canonical workspace | Shipped (`settings/integrations/hubspot`) |
| Overview | Present; staged-only (no mutate) |
| Backup & Sync | Present; staged-only evidence + backup panel gated by `canMutate` |
| Import Review | Present; CRM-read allowed; mutations gated |
| Activity & Webhooks | Present |
| Configuration | Present; capability-gated (hub + HubSpot tab) |
| Audit & History | Present |
| Legacy redirects | Consolidated to canonical workspace |
| `batchId` handling | UUID-validated on Import Review |
| Tenant isolation | Fail-closed for non-member / wrong tenant |
| Role gating | Proven manually; automated case K in smoke suite |

## Automated regression harness

Suite: **FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1**

- Spec: `e2e/hubspot-production-smoke/hubspot-production-smoke.spec.ts`
- Command: `npm run test:e2e:hubspot-production-smoke`
- Workflow: `.github/workflows/hubspot-production-smoke.yml` (`workflow_dispatch`; optional post-CI via `FI_HUBSPOT_SMOKE_AFTER_CI`)
- Axes A–K: Canonical workspace through role gating
- Role-gating expectations align with production evidence above; future CI runs detect regressions

Credentials (CI / local only — never committed):

- `FI_E2E_BASE_URL` / production URL
- `FI_E2E_PRODUCTION_ADMIN_EMAIL` / `FI_E2E_PRODUCTION_ADMIN_PASSWORD`
- `FI_E2E_TENANT_ID`
- Optional: `FI_E2E_LOW_ROLE_EMAIL` / `FI_E2E_LOW_ROLE_PASSWORD` for axis K

## Safety confirmation

- HubSpot remains read-only from FI; staged records are not auto-promoted.
- Smoke suite is non-mutating (network + UI mutation guard).
- Credential values, customer review tables, and PHI are excluded from smoke screenshots and this closeout.
- Platform-admin impersonation no longer elevates tenant Configuration caps.
- CRM operators / operations-only roles no longer unlock Configuration hub via `manage_operations` alone.

## Closure decision

`FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1` is complete and closed with overall verdict **GREEN**.

Ongoing duty: run **FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1** after HubSpot workspace or capability-gate deploys to catch regressions. Further HubSpot product work must preserve the canonical workspace route, staged-only import boundary, capability-based Configuration gate, and non-mutating production smoke contract.
