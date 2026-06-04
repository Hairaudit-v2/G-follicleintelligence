# FI Admin — local development without login

The FI Admin home page (`/fi-admin`) loads tenants from `GET /api/tenants`. In **production** (`NODE_ENV === 'production'`), you must be signed in with Supabase Auth and have at least one `fi_users` row (`auth_user_id` set to your auth user) so the API can return the tenants you belong to.

For **local development** when you have not configured login yet, you can opt in to a **read-only directory listing** of every row in `fi_tenants` using the service role on the server.

## Enable the dev fallback

In `.env.local` (or your shell environment for `next dev`):

```bash
FI_ENABLE_DEV_ADMIN_ACCESS=true
```

Requirements (all must hold):

- `NODE_ENV` is **not** `'production'` (e.g. `next dev` defaults to `development`). **`next start`** (and most production hosts) set `NODE_ENV=production`, so the tenant-list bypass is **disabled** there — you must sign in with Supabase Auth and have `fi_users` membership, or use `next dev` locally instead of `next start`.
- `FI_ENABLE_DEV_ADMIN_ACCESS` is exactly `true` (after trim). Any other value is treated as off.
- No authenticated Supabase user is resolved from the request — if you **are** logged in, the normal rule applies: only tenants linked via `fi_users` are returned.

## Security

- This flag is **ignored for the bypass path** when `NODE_ENV === 'production'`. Production always requires authentication for tenant listing.
- The bypass only affects **`GET /api/tenants`** (the FI Admin tenant picker). Tenant routes and CRM/booking APIs keep their existing gates.
- Do **not** set `FI_ENABLE_DEV_ADMIN_ACCESS=true` in production environments.

## UI

When the dev fallback is active, `/fi-admin` shows an amber banner:

**Development access: no authenticated FI user session.**

So it is obvious you are not using a real FI user session.
