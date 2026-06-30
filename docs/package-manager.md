# Package manager discipline

This repository uses **npm** only. `package-lock.json` is the single lockfile. Do not add or refresh `pnpm-lock.yaml` unless the team explicitly migrates to pnpm-only.

## Supported workflow (canonical)

- **Use npm** at the repo root for day-to-day work: `npm install`, `npm ci` (CI), and `npm run <script>`.
- Treat **`package-lock.json` as the source of truth** for dependency versions when using npm.

## Do not

- Run **`npm install` and `pnpm install` on the same clone** (or alternate between them without a full wipe of `node_modules` and a single lockfile-driven reinstall).
- Commit lockfile changes from a different package manager than the one your team agreed to use for that branch.

Some internal runbooks still show `pnpm run …` for historical reasons; the **npm** equivalent is `npm run …` with the same script name.

## Related

- [Next.js build troubleshooting](./next-build-troubleshooting.md) — `.next` corruption, `ANALYZE`, and `npm run clean`.
