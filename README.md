# Follicle Intelligence (FiOS)

## Getting started

From the repository root:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Package manager:** use **npm** with package-lock.json. Do not alternate npm install and pnpm install on the same clone. See [docs/package-manager.md](./docs/package-manager.md).

**Build / cache issues:** see [docs/next-build-troubleshooting.md](./docs/next-build-troubleshooting.md) (including ANALYZE and npm run clean).

## Guided demos (FiOS)

Two preloaded demo packages for screen-share pitches:

| Package | Command | Docs |
|---------|---------|------|
| A — Enterprise (IHRG / TITAN) | `npm run seed:ihrg-showcase` | [docs/runbooks/fios-demo-day.md](./docs/runbooks/fios-demo-day.md) |
| B — Single clinic | `npm run seed:follicle-demo-clinic` | same runbook |

Also: `npm run validate:titan-global-command-centre`, `npm run seed:titan-demo-media-pack` (optional ImagingOS placeholders).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## Deploy on Vercel

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
