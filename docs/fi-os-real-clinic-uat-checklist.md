# FI OS Real Clinic UAT Checklist

Use this checklist on a **throwaway demo tenant** with `FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1`. Record pass/fail and notes in [fi-os-sprint7-uat-findings.md](./fi-os-sprint7-uat-findings.md).

## Preconditions

- [ ] Demo tenant UUID configured (`FI_SMOKE_TENANT_ID` / `EVOLVED_PERTH_TENANT_ID`)
- [ ] Supabase service role available locally for execute smoke
- [ ] `pnpm smoke:operational-day` passes (HTTP + loader tiers)
- [ ] Staff login or PIN session available for manual UAT

## Automated harness

```bash
# Read-only posture
pnpm smoke:operational-day

# Full clinic day (service role)
pnpm smoke:operational-day:execute

# Full clinic day + Procedure Day live workflow
pnpm smoke:operational-day:execute:procedure-day
```

## Reception Board

| # | Task | Expected | Clicks (target) |
|---|------|----------|-----------------|
| R1 | Open `/reception-board` | Loads today's board with metrics | 1 |
| R2 | Empty day | Shows "Open calendar" + "Find or add patient" CTAs | 0 |
| R3 | Check in scheduled patient | Button reads "Check in patient"; toast confirms | 1 |
| R4 | Advance consultation | "Start consultation" → "Complete visit" labels | 2 |
| R5 | Action alert | Links to calendar with "Resolve in calendar →" | 1 |
| R6 | Refresh | Live timestamp updates; no full-page flash | 1 |

## CalendarOS

| # | Task | Expected | Clicks (target) |
|---|------|----------|-----------------|
| C1 | Open `/calendar` | Skeleton while loading; grid hydrates | 1 |
| C2 | Today strip blockers | Blocker count chip filters at-risk appointments | 1–2 |
| C3 | Surgery booking | Creates booking; blockers clear when staff/room/deposit set | 4–6 |
| C4 | Operational feed | No heavy fields; blocker count visible on card | — |

## Surgery booking & financial

| # | Task | Expected |
|---|------|----------|
| S1 | Quote accepted on case | CRM activity logged |
| S2 | Deposit recorded | Payment flag satisfied on calendar |
| S3 | Surgery booked | Appears on reception board + calendar |

## Patient Journey

| # | Task | Expected |
|---|------|----------|
| J1 | Ribbon on patient record | Shows current state + "what to do next" link |
| J2 | Blockers | Tappable chips with fix links where configured |
| J3 | After procedure complete | State `procedure_completed` |

## Procedure Day (when `FI_PROCEDURE_DAY_ENABLED=true`)

| # | Task | Expected | Clicks (target) |
|---|------|----------|-----------------|
| P1 | Nav hidden when flag off | No procedure-day link in shell | — |
| P2 | Start session | Success message; stage timeline updates | 1 |
| P3 | Advance stages | "Next: {stage}" button; green success line | 6–8 |
| P4 | Complete procedure | Journey → `procedure_completed`; follow-up task | 2 |

## Security & tenancy

| # | Task | Expected |
|---|------|----------|
| X1 | Cross-tenant API | Admin key cannot read other tenant reception-board |
| X2 | Platform admin write | Requires impersonation (no god-key writes) |
| X3 | Unauthenticated routes | Reception + procedure-day redirect/deny |

## Performance budgets (local loader smoke)

| Surface | Target |
|---------|--------|
| Reception board load | < 15s (cold) / < 5s (warm) |
| Calendar operational feed | < 3s |
| Surgery booking mutation | < 2s |
| Procedure day stage advance | < 1s per step |

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Front desk | | | |
| Clinical lead | | | |
| Engineering | | | |