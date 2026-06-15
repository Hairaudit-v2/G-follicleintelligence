# Package manager discipline

This repository currently contains **both** `package-lock.json` (npm) and `pnpm-lock.yaml` (pnpm). They are **not** interchangeable: mixing installs corrupts `node_modules` layout, causes subtle resolution bugs, and on Windows increases the risk of file locks under `.next/` and `node_modules/`.

## Supported workflow (canonical)

- **Use npm** at the repo root for day-to-day work: `npm install`, `npm ci` (CI), and `npm run <script>`.
- Treat **`package-lock.json` as the source of truth** for dependency versions when using npm.

## Do not

- Run **`npm install` and `pnpm install` on the same clone** (or alternate between them without a full wipe of `node_modules` and a single lockfile-driven reinstall).
- Commit lockfile changes from a different package manager than the one your team agreed to use for that branch.

## pnpm-lock.yaml

`pnpm-lock.yaml` may remain in the tree for historical or automation reasons. Unless your team explicitly standardises on pnpm for this repo, **prefer npm** and do not refresh `pnpm-lock.yaml` unless you are intentionally migrating to pnpm-only.

Some internal runbooks still show `pnpm run …` for historical reasons; the **npm** equivalent is `npm run …` with the same script name.

## Related

- [Next.js build troubleshooting](./next-build-troubleshooting.md) — `.next` corruption, `ANALYZE`, and `npm run clean`.
