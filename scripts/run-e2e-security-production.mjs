/**
 * FI-LAUNCH-035: Run unauthenticated security e2e against a production Next.js server.
 *
 * Flow: build (optional) → `next start` with NODE_ENV=production → Playwright security suite → shutdown.
 *
 * Usage:
 *   node scripts/run-e2e-security-production.mjs
 *   node scripts/run-e2e-security-production.mjs --skip-build   # reuse existing .next output
 *   node scripts/run-e2e-security-production.mjs --port=3001
 *
 * Env:
 *   FI_E2E_BASE_URL — defaults to http://127.0.0.1:<port>
 *   FI_E2E_TENANT_ID — optional tenant UUID for route construction
 *   SKIP_ENV_VALIDATION=1 — passed through to build when set
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveListeningPort,
  shutdownProductionServer,
  startNextProductionServer,
  waitForProductionServer,
} from "./lib/e2e-production-server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const playwrightCli = join(root, "node_modules", "@playwright", "test", "cli.js");

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const portArg = args.find((a) => a.startsWith("--port="));
const preferredPort = portArg ? Number(portArg.split("=")[1]) : 3000;

if (!Number.isFinite(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
  console.error("Invalid --port value.");
  process.exit(1);
}

const host = (process.env.FI_E2E_BASE_URL ?? "http://127.0.0.1").includes("127.0.0.1")
  ? "127.0.0.1"
  : "localhost";

function run(cmd, cmdArgs, opts = {}) {
  const useShell = opts.shell ?? (process.platform === "win32" && cmd === "npm");
  const result = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: useShell,
    env: { ...process.env, NODE_ENV: "production", ...opts.env },
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!skipBuild) {
  if (!existsSync(join(root, ".next", "BUILD_ID"))) {
    console.log("→ Production build (.next/BUILD_ID missing)…");
  } else {
    console.log("→ Rebuilding production bundle…");
  }
  run("npm", ["run", "build"], { env: { NODE_ENV: "production" } });
} else if (!existsSync(join(root, ".next", "BUILD_ID"))) {
  console.error("--skip-build set but .next/BUILD_ID is missing. Run `npm run build` first.");
  process.exit(1);
}

const port = await resolveListeningPort(host, preferredPort);
const baseUrl = `http://${host}:${port}`.replace(/\/$/, "");

console.log(`→ Starting production server at ${baseUrl} …`);
const { server, state } = startNextProductionServer({ root, port });
const shuttingDown = { value: false };

server.on("exit", (code) => {
  if (!shuttingDown.value && code && code !== 0) {
    console.error(`next start exited with code ${code}`);
  }
});

const shutdown = () => shutdownProductionServer(server, shuttingDown);

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

try {
  await waitForProductionServer(host, port, state);
  console.log("→ Server ready. Running Playwright security suite…");
  run(process.execPath, [playwrightCli, "test", "e2e/security", "--workers=2"], {
    shell: false,
    env: {
      FI_E2E_BASE_URL: baseUrl,
      NODE_ENV: "production",
    },
  });
  console.log("✓ E2E security suite passed.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  shutdown();
  process.exit(1);
} finally {
  shutdown();
}
