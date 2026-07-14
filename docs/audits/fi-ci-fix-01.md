# CI-FIX-01 — Optional E2E fixtures

**Status:** **DOCUMENTED — still MISSING** (2026-07-14)  
**Related:** [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md), [fi-ci-signal-hygiene-1.md](./fi-ci-signal-hygiene-1.md)

## Disposition

| Key | Kind | Local `.env.local` | GitHub Actions | Notes |
| --- | ---- | ------------------ | -------------- | ----- |
| `FI_E2E_UNLINKED_LEAD_ID` | secret | **not present** | **MISSING** | Do not invent; leave unset → negative spine skip |
| `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` | repo **variable** | **not present** | **MISSING** | Suggested `/crm` only if demo admin is Consultant |
| `FI_E2E_OTHER_TENANT_ID` | secret | **not present** | **MISSING** | Cross-tenant skip until real second demo tenant |

## Workflow wiring

`e2e-smoke.yml` authenticated job now passes:

- `secrets.FI_E2E_UNLINKED_LEAD_ID`
- `vars.FI_E2E_EXPECTED_LANDING_PATH_SUFFIX`

Empty values remain safe skips. Ops may set real values when ready; `gh` auth was unavailable in this agent session — no secrets were written.

## Commands (ops)

```bash
# Only when a real unlinked lead UUID exists on the demo tenant:
gh secret set FI_E2E_UNLINKED_LEAD_ID --repo Hairaudit-v2/G-follicleintelligence

# Only when demo admin role landing is known stable (Consultant example):
gh variable set FI_E2E_EXPECTED_LANDING_PATH_SUFFIX --body "/crm" --repo Hairaudit-v2/G-follicleintelligence
```
