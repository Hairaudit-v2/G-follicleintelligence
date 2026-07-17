# FI-UX-STRUCTURE-2C.1B — Settings information architecture

## Executive verdict

**GREEN** for navigation information architecture. The mounted Settings strip now presents the
approved six groups while preserving underlying pages, capability inputs, and HubSpot CRM-read
reachability. Broader 2B blockers remain outside this milestone.

Base commit: `22a603c3` (FI-UX-STRUCTURE-2C.1A).

## Exact changes

Visible Settings top-level groups, in order:

1. Clinic
2. Roles & permissions
3. Templates
4. Integrations
5. Billing
6. Security

### Mapping

| Current entry       | Target                         |
| ------------------- | ------------------------------ |
| Configuration       | Clinic                         |
| Services            | Clinic                         |
| Rooms               | Clinic                         |
| Clinic setup        | Clinic                         |
| Tax & Localisation  | Clinic                         |
| Clinic guide        | Clinic contextual submenu only |
| Templates           | Templates                      |
| Integrations        | Integrations                   |
| HairAudit discovery | Integrations                   |
| HubSpot import      | Integrations                   |
| Payments            | Billing                        |
| Roles & permissions | Roles & permissions            |
| Admin Users         | Security                       |

### Sub-navigation behaviour

- Multi-destination groups (Clinic, Integrations) use a keyboard-accessible dropdown submenu.
- Single-destination groups link directly to their existing canonical page.
- Active-state matching uses exact or nested pathname matching and ignores query strings for HubSpot
  import-review deep links.
- Capability gates are unchanged from the pre-2C.1B strip inputs.

## Preserved behaviour

- No Settings pages deleted.
- No permission, mutation, provider, or loader changes.
- HubSpot import remains available under Integrations with the same gate combination as before.
- HOLD routes remain untouched.
- Primary rail unchanged.

## Intentionally out of scope

- Team Access permission parity
- Admin Users identity redesign
- Academy routing
- Deployment Centre
- Google Calendar permission alignment
- HubSpot migration permission changes

## Rollback

Revert the isolated 2C.1B commit. Routes and gates do not require separate rollback.

## Recommended sequence after 2C.1B

1. 2C.2 — HubSpot canonical navigation parity
2. 2C.3 — Academy dead-link resolution
3. 2C.4 — Team Access parity
4. 2C.5 — Admin Users identity boundary
5. 2C.6 — Tenant Deployment foundation
