# FI-HUBSPOT-BACKUP-1 — Phase O production gate evidence

**Date:** 2026-07-16  
**Evidence classification:** Privacy-safe operational metadata only  
**Production PASS:** NOT CLAIMED

---

## 1. Push — full recovery stack

| Field | Value |
|-------|-------|
| Feature branch | `codex/fi-hubspot-live-sync-recovery` |
| Feature tip pushed | `cfdf08c4067c1f3a80c95c4398efc9c42b9a7ce6` (`audit(hubspot): close Phase O with documented limitations`) |
| Production lineage | Merged to `main` via Git |
| Main head (intended production) | `8fe2a3924e644b78295017e07b304fc67f931a26` |
| Merge message | `Merge HubSpot recovery stack for Phase O production gate.` |
| `cfdf08c4` ancestor of main head | **Yes** |

Recovery commits included on main (non-exhaustive): engagement backup `ea6bc78f`, resume fix `18eab689`, Phase O closeout `cfdf08c4`, plus prior workspace recovery `c0f1c06a` already on lineage.

---

## 2. Deploy — Vercel Git integration

| Field | Value |
|-------|-------|
| Mechanism | Vercel Git integration on push to `main` (not CLI promote; local Vercel CLI unauthenticated) |
| Deployment ID | `dpl_BqzrpkMs8UPac5L9vELaitzJBHMc` |
| Target | `production` |
| readyState | **READY** |
| Deployed SHA | `8fe2a3924e644b78295017e07b304fc67f931a26` |
| Matches `origin/main` HEAD | **Yes** |
| Contains recovery tip `cfdf08c4` | **Yes** (ancestor) |
| Production aliases | `follicleintelligence.ai`, `www.follicleintelligence.ai` |
| Inspector | https://vercel.com/fi-ai-ef8ee84f/g-follicleintelligence/BqzrpkMs8UPac5L9vELaitzJBHMc |

Preview for feature tip (not production traffic): `dpl_BTDTFG7gDso8xUr94kFKtboTrJa1` READY at `cfdf08c4`.

---

## 3. Authenticated HubSpot workspace smoke

| Field | Value |
|-------|-------|
| Suite | `FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1` |
| Command | `npm run test:e2e:hubspot-production-smoke` |
| Target URL | `https://follicleintelligence.ai` |
| Suite commit (local HEAD) | `8fe2a3924e644b78295017e07b304fc67f931a26` |
| Summary artifact | `test-results/hubspot-production-smoke-summary.json` (local, not committed) |
| Machine verdict | **RED** |

### Why smoke is RED (not a deploy defect)

`FI_E2E_PRODUCTION_ADMIN_*` secrets are **not** present in local `.env.local`. Smoke was attempted by aliasing `FI_E2E_DEMO_ADMIN_*` → production-admin env vars.

Diagnostic (privacy-safe):

| Tab | Heading `HubSpot management` | Next.js not-found |
|-----|------------------------------|-------------------|
| `overview` | 0 | 1 |
| `import-review` | 1 | 0 |
| `configuration` | 0 | 1 |

This matches workspace capability gating: CRM-read sessions without Configuration hub access may only open Import Review; Overview/Configuration call `notFound()`. The authenticated suite starts on Overview and therefore fails with the DEMO admin role.

GitHub Actions workflow `HubSpot Production Smoke` has the correct secrets but could not be dispatched: `gh` is not authenticated in this environment.

**Blocker for Production PASS:** supply `FI_E2E_PRODUCTION_ADMIN_EMAIL` / `FI_E2E_PRODUCTION_ADMIN_PASSWORD` for a Configuration-hub-capable admin, **or** authenticate `gh` and `workflow_dispatch` `.github/workflows/hubspot-production-smoke.yml`.

---

## 4. Gate matrix

| Gate | Status |
|------|--------|
| Recovery stack pushed | PASS |
| Merged to `main` | PASS |
| Vercel production READY | PASS |
| Deployed SHA = `origin/main` HEAD | PASS |
| Deployed SHA contains Phase O closeout tip | PASS |
| Authenticated HubSpot production smoke | **FAIL / BLOCKED** (admin secrets / role) |
| Production PASS | **NOT CLAIMED** |

---

## 5. Exact next action

1. Provide Configuration-hub-capable `FI_E2E_PRODUCTION_ADMIN_*` locally, **or** run:

```bash
gh auth login
gh workflow run "HubSpot Production Smoke" --ref main
```

2. Re-run `npm run test:e2e:hubspot-production-smoke` against `https://follicleintelligence.ai`.
3. Only if the suite summary verdict is GREEN, update this evidence and declare Production PASS.
