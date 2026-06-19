/**
 * FI-LAUNCH-035: Run unauthenticated security e2e against a production Next.js server.
 *
 * Flow: build (optional) → `next start` with NODE_ENV=production → Playwright security suite → shutdown.
 *
 * Usage:
 *   node scripts/run-e2e-security-production.mjs
 *   node scripts/run-e2e-security-production.mjs --skip-build   # reuse existing .next output
 *   node scripts/run-e2e-security-production.mjs --port 3001
 *
 * Env:
 *   FI_E2E_BASE_URL — defaults to http://127.0.0.1:<port>
 *   FI_E2E_TENANT_ID — optional tenant UUID for route construction
 *   SKIP_ENV_VALIDATION=1 — passed through to build when set
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const portArg = args.find((a) => a.startsWith("--port="));
const port = portArg ? Number(portArg.split("=")[1]) : 3000;

if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error("Invalid --port value.");
  process.exit(1);
}

const baseUrl = (process.env.FI_E2E_BASE_URL ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "production", ...opts.env },
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function waitForPort(host, targetPort, timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${host}:${targetPort}`));
        return;
      }
      const socket = createConnection({ host, port: targetPort });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        setTimeout(tick, 500);
      });
    };
    tick();
  });
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

console.log(`→ Starting production server at ${baseUrl} …`);
const server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
  },
});

let serverExited = false;
let shuttingDown = false;
server.on("exit", (code) => {
  serverExited = true;
  if (!shuttingDown && code && code !== 0) {
    console.error(`next start exited with code ${code}`);
  }
});

const shutdown = () => {
  shuttingDown = true;
  if (!serverExited && server.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  }
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

try {
  const host = baseUrl.includes("127.0.0.1") ? "127.0.0.1" : "localhost";
  await waitForPort(host, port);
  console.log("→ Server ready. Running Playwright security suite…");
  run("npx", ["playwright", "test", "e2e/security"], {
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