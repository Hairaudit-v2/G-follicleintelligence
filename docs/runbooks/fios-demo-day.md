# FiOS Demo Day Runbook (Phase 1)

Guided screen-share demos for two packages. Operators drive; guests watch.

| Package | Audience | Tenant | Seed |
|---------|----------|--------|------|
| **A — Enterprise / franchise** | Multi-site buyers, investors, franchise partners | `ihrg-global` (IHRG / TITAN) | `npm run seed:ihrg-showcase` |
| **B — Single clinic** | Clinic operators | `follicle-demo-clinic` | `npm run seed:follicle-demo-clinic` |

Canonical architecture: [enterprise-demo-environment.md](../architecture/enterprise-demo-environment.md)  
GCC detail: [titan-global-command-centre-demo.md](./titan-global-command-centre-demo.md)  
Reception commercial script: [reception-os-demo-readiness.md](../commercial/reception-os-demo-readiness.md)

---

## Demo Day checklist (before every external pitch)

- [ ] Supabase env present (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] **Never** seed against Evolved / production patient data without an explicit ops decision
- [ ] Production seed only with `ALLOW_ENTERPRISE_DEMO_SEED=true`
- [ ] Communications dry-run: leave `RECEPTION_OS_COMMUNICATION_DRY_RUN=true` (default)
- [ ] Do **not** enable live SMS/email for demos
- [ ] Optional: `RECEPTION_OS_DEMO_MODE=true` or open Reception with `?demo=1` (anonymises PHI on screen-share)
- [ ] Optional: `RECEPTION_OS_DEMO_MASK_AMOUNTS=true` if finances are sensitive in the room
- [ ] Reminders muted on the demo project (per staging hygiene)
- [ ] Package visible in tenant directory (`reactivate:*`) or open via known slug/UUID
- [ ] Rehearse once on the same environment you will screen-share

Hide after the event if the demo project is shared with a broader admin list:

```bash
npm run hide:ihrg-demo
npm run hide:follicle-demo-clinic
```

---

## Package A — Enterprise (TITAN / IHRG)

### Seed (canonical)

```bash
npm run seed:ihrg-showcase
npm run validate:titan-global-command-centre
# optional imaging polish:
npm run seed:titan-demo-media-pack
# ensure tenant shows in FI Admin directory:
npm run reactivate:ihrg-demo
```

`seed:ihrg-showcase` runs core Titus-style franchise seed + expansion + **Sydney Demo Day alignment** (operational today board for Reception deep-dives). Tenant calendar timezone is set to `Australia/Sydney` for Reception “today”.

Lighter profiles: `npm run seed:ihrg-demo` (`alive`) or `npm run seed:enterprise-demo` (core only, no Demo Day).

### Routes

| Route | Use |
|-------|-----|
| `/fi-admin/ihrg-global/global-command-centre` | Franchise command view |
| `/fi-admin/ihrg-global/global-command-centre/presentation` | Boardroom story (no sidebar) |
| `/fi-admin/{tenantId}/reception-os?demo=1` | Sydney morning board (after Demo Day seed) |
| Calendar / SurgeryOS for Sydney clinic | Operational “today” density |

### 15-minute guided script

1. **GCC dashboard (3 min)** — Network KPIs, clinic risk matrix (Dubai / Bangkok / London / Athens / Sydney), alerts.
2. **Presentation mode (5 min)** — Pain strip + five story sections; exit when done.
3. **Reception deep-dive, Sydney (5 min)** — Open Reception with `?demo=1`. Walk morning prep: today’s patients, outstanding deposit, open tasks.
4. **Close (2 min)** — Tie franchise risk → front-desk capture → why FI OS is one system.

### What Demo Day alignment adds

- Dedicated Sydney bookings on **today** (consults + surgeries) and one tomorrow hold
- One pending surgery deposit for the deposits widget
- Calendar events + reception tasks due within hours
- Does **not** rewrite historical TITAN surgery/financial narrative data

---

## Package B — Single clinic (Follicle Demo Clinic)

### Seed

```bash
npm run seed:follicle-demo-clinic
npm run reactivate:follicle-demo-clinic
```

Uses OnboardingOS `enterprise_demo` sandbox pack with **relative “today”** appointment dates so Reception and calendar are live on re-seed.

### Routes

| Route | Use |
|-------|-----|
| `/fi-admin/{tenantId}/reception-os?demo=1` | Primary clinic operator pitch |
| Calendar / patients / consultations | Day-in-the-life walkthrough |

Follow the commercial Reception script in [reception-os-demo-readiness.md](../commercial/reception-os-demo-readiness.md).

Slug: `follicle-demo-clinic` · Name: **Follicle Demo Clinic**.

---

## Optional media pack

GCC does not need real image blobs. For ImagingOS gallery clicks during Package A:

```bash
npm run seed:titan-demo-media-pack
# or
npm run seed:titan-demo-media-pack -- --limit=96
```

Uploads tiny placeholder JPEGs to existing `titan-demo/synthetic/` Storage paths.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty GCC risk matrix | `npm run seed:enterprise-demo` or full `seed:ihrg-showcase` |
| Reception “today” empty on IHRG | Re-run showcase (Demo Day alignment); confirm timezone Australia/Sydney |
| Tenant missing from directory | `reactivate:ihrg-demo` / `reactivate:follicle-demo-clinic` |
| Accidental live SMS | Confirm dry-run flags; disable send-enabled envs |
| Imaging 404s | Run media pack; or skip ImagingOS on this demo |

---

## Out of scope (Phase 2+)

- Shared guest logins / Auth users for TITAN staff
- Downloadable offline demo
- Inventory / pathology / patient-portal narrative wiring
