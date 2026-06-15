# Next.js build troubleshooting (Windows / drive locks)

## `EPERM` on `.next/trace` or `.next/*`

If `next build` fails with `EPERM: operation not permitted` while opening or writing under `.next/`, another process is usually holding files open (for example `next dev`, `next build`, bundle analyzer, IDE file watchers, or antivirus scanning the output folder).

**What to do**

1. Stop dev servers and any in-flight `next build` / `npm run analyze` jobs.
2. Close tools that might lock `.next` (including some antivirus “real-time scan” settings for the repo path).
3. Delete the `.next` directory and run `npm run typecheck` then `npm run build` again.

We do **not** add repository workarounds for local filesystem locks; fixing the environment is the supported path.

## `ENOENT` on `.next/server/pages-manifest.json` (or similar) mid-build

Often indicates a **partial or corrupted** `.next` output (for example a build that was interrupted or overlapped with another process). Delete `.next` and rebuild.

## `npm run clean`

This repo defines `"clean": "node -e \"require('node:fs').rmSync('.next',{recursive:true,force:true})\""`, which removes `.next` using Node (sometimes succeeds when Explorer or PowerShell `Remove-Item` hits `EPERM` on individual files). Stop locking processes first, then run `npm run clean`.

## `analyze` script and `ANALYZE`

`package.json` defines `"analyze": "cross-env ANALYZE=true next build"`. `cross-env` is a devDependency so `ANALYZE=true` is set correctly on Windows, macOS, and Linux.

**Important**

- Turn on bundle analysis **only** via `npm run analyze` (or the same with your package manager). Do **not** leave `ANALYZE=true` in shell profiles, global environment variables, or CI defaults used for normal `next build` / `next dev`.
- If builds feel slow, spawn extra analyzer output, or behave oddly, **unset `ANALYZE`**, delete `.next`, then run `npm run typecheck` and `npm run build` again.
- To remove `.next` locally: `npm run clean` (see `package.json`) or delete the folder manually if the script is unavailable.

See also [`docs/package-manager.md`](./package-manager.md).
