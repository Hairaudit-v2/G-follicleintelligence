/**
 * Run public + security e2e smoke tests against a production Next.js server.
 *
 * Flow: build (optional) → `next start` → Playwright @smoke + @security → shutdown.
 *
 * Usage:
 *   node scripts/run-e2e-smoke-production.mjs
 *   node scripts/run-e2e-smoke-production.mjs --skip-build
 *   node scripts/run-e2e-smoke-production.mjs --browsers=chromium,firefox
 *
 * Env:
 *   FI_E2E_BASE_URL — defaults to http://127.0.0.1:<port>
 *   FI_E2E_BROWSERS — comma-separated project names (default: all five)
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
const browsersArg = args.find((a) => a.startsWith("--browsers="));
const preferredPort = portArg ? Number(portArg.split("=")[1]) : 3000;

if (!Number.isFinite(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
  console.error("Invalid --port value.");
  process.exit(1);
}

const browsers = browsersArg?.split("=")[1] ?? process.env.FI_E2E_BROWSERS;
const host = (process.env.FI_E2E_BASE_URL ?? "http://127.0.0.1").includes("127.0.0.1")
  ? "127.0.0.1"
  : "localhost";

function run(cmd, cmdArgs, opts = {}) {
  // Only npm needs shell on Windows (npm.cmd). spawn with shell:true breaks
  // Playwright --grep patterns containing | (cmd interprets as pipe).
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
  console.log("→ Server ready. Running Playwright smoke + security suite…");
  // Project grep in playwright.config.ts already limits to @security|@smoke|@a11y.
  // Invoke the Playwright CLI via node (npx + shell:false breaks on Windows).
  run(process.execPath, [playwrightCli, "test", "--workers=2"], {
    shell: false,
    env: {
      FI_E2E_BASE_URL: baseUrl,
      NODE_ENV: "production",
      ...(browsers ? { FI_E2E_BROWSERS: browsers } : {}),
    },
  });
  console.log("✓ E2E smoke suite passed.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  shutdown();
  process.exit(1);
} finally {
  shutdown();
}
