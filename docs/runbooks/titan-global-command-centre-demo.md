# TITAN Global Command Centre — Demo Runbook

**Codename:** TITAN · Phase 1I  
**Purpose:** Demo-readiness QA for the IHRG Global Command Centre dashboard and presentation mode before sales, investor, or franchise partner conversations.

## Prerequisites

| Requirement | Notes |
|---|---|
| Supabase env | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or deployment env |
| Enterprise demo seed | `npm run seed:enterprise-demo` (idempotent; safe to re-run) |
| FI admin access | Platform admin or tenant admin session for `ihrg-global` |
| Production seed guard | Set `ALLOW_ENTERPRISE_DEMO_SEED=true` when `NODE_ENV=production` |

## Quick start (5 minutes)

```bash
# 1. Seed the IHRG franchise network (Phases 1A–1F)
npm run seed:enterprise-demo

# 2. Validate demo-readiness (Phase 1I)
npm run validate:titan-global-command-centre

# 3. Start the app
npm run dev
```

Log in as a user with access to the IHRG demo tenant, then open the friendly slug routes below.

## Routes

| Route | Behaviour |
|---|---|
| `/fi-admin/ihrg-global/global-command-centre` | Friendly slug → redirects to tenant UUID dashboard |
| `/fi-admin/ihrg-global/global-command-centre/presentation` | Friendly slug → redirects to presentation mode |
| `/fi-admin/{tenantId}/global-command-centre` | Dashboard (inside FI OS chrome) |
| `/fi-admin/{tenantId}/global-command-centre?presentation=true` | Redirects to presentation mode |
| `/fi-admin/{tenantId}/global-command-centre/presentation` | Full-screen presentation (no sidebar chrome) |

Presentation mode uses a dedicated layout shell — no `FiOsAppShell` sidebar — optimised for screen-share and boardroom demos.

## Demo script (recommended flow)

### 1. Dashboard — operational command view (~3 min)

1. Open `/fi-admin/ihrg-global/global-command-centre`.
2. Confirm header shows **TITAN · Global Command Centre** and tenant name **International Hair Restoration Group**.
3. Walk the **Network KPIs** row: 8 active clinics, surgical load, financial risk, imaging issues, graft survival, collected vs outstanding.
4. Open **Clinic risk matrix** — call out intentional anomalies:
   - **Dubai** — graft/invoice variance, elevated transection
   - **Bangkok** — overdue balances, missing follow-up imaging
   - **London** — refund exposure, quality flags
   - **Athens** — quote expiry leakage
   - **Sydney** — benchmark / within tolerance
5. Scroll **Network alerts** — five curated franchise alerts tied to anomaly clinics.
6. Show **SurgeryOS** and **AuditOS** snapshot panels (graft totals, reconciliation, audit approval counts).
7. Click **Presentation mode** in the header badge row.

### 2. Presentation mode — executive story (~5 min)

1. Confirm full-screen dark layout with no sidebar.
2. **Operator pain strip** — five franchise exposure cards (revenue variance, protocol drift, staff/training, quality-linked refunds, missing follow-up evidence).
3. Use the right-side **section dots** (desktop) to jump between five story sections:
   - Global network health
   - Franchise risk detection
   - Surgical quality intelligence
   - Financial leakage detection
   - Imaging / audit proof loop
4. Click **Exit presentation** to return to the dashboard.

## Automated validation

```bash
npm run validate:titan-global-command-centre
```

Optional: pin a specific tenant UUID:

```bash
TITAN_DEMO_TENANT_ID=<uuid> npm run validate:titan-global-command-centre
```

The validator checks:

- IHRG demo tenant resolves with `enterprise_simulation` metadata
- Global Command Centre payload loads without error
- 8 clinics, risk matrix rows, alert feed, surgical/outcome snapshots
- Seeded surgery and invoice counts (96 surgeries, 240+ consultation quotes)
- Demo image `storage_path` values use metadata-only `titan-demo/synthetic/` prefix

Exit code `1` when any **fail** severity check is present. **warn** checks are acceptable for partial seeds but should be resolved before a high-stakes demo.

## Empty states

If seed data is missing or partial:

| Panel | Empty-state behaviour |
|---|---|
| Clinic risk matrix | Dashed panel with seed command hint |
| Network alerts | Explains curated feed requires seeded clinic slugs |
| KPI tiles | Show `0` or `—` (no crash) |

Re-run `npm run seed:enterprise-demo` and validate again.

## Placeholder images

The Global Command Centre **does not render patient images**. Imaging data is aggregated from protocol sessions and outcome audits only.

Seeded demo images use metadata-only paths:

```
titan-demo/synthetic/{demo_image_key}.jpg
```

No Supabase Storage upload is required for command centre demos. Real image files are only needed if demoing ImagingOS gallery views elsewhere in FI OS.

## Manual QA checklist

| # | Check | Pass/Fail |
|---|---|---|
| 1 | Friendly slug dashboard loads after auth | |
| 2 | Friendly slug presentation loads after auth | |
| 3 | `?presentation=true` redirects correctly | |
| 4 | Presentation mode hides FI OS sidebar | |
| 5 | Exit presentation returns to dashboard | |
| 6 | Risk matrix shows 8 clinics when seeded | |
| 7 | At least 3 network alerts visible | |
| 8 | Dubai / Bangkok / London rows show anomaly labels | |
| 9 | Read-only banner visible on dashboard | |
| 10 | No console errors on dashboard or presentation | |
| 11 | `npm run validate:titan-global-command-centre` exits 0 | |
| 12 | `npm run typecheck` passes | |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 404 on friendly slug | Tenant not seeded | `npm run seed:enterprise-demo` |
| "could not load" error | Supabase env missing or project paused | Check env vars and Supabase dashboard |
| Empty risk matrix | Clinics missing `metadata.slug` | Re-run seed; check warnings in seed output |
| Zero graft totals | Surgery seed incomplete | Re-run seed; confirm 96 `enterprise_demo_surgery` rows |
| SSL / fetch errors in seed script | Local VPN or cert interception | Fix network or use local Supabase (`supabase start`) |
| Presentation 404 with `ihrg-global` in URL | Slug not redirected (fixed Phase 1I) | Use friendly routes or UUID paths |

## Related docs

- [Enterprise demo environment](../architecture/enterprise-demo-environment.md) — TITAN phase history and seed safety
- Seed command: `npm run seed:enterprise-demo`
- Unit tests: `npx tsx --test src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentre*.test.ts`
