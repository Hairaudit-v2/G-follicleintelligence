import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { join } from "node:path";

function probePort(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function isPortInUse(host, port) {
  const hosts =
    host === "127.0.0.1" || host === "localhost" ? ["127.0.0.1", "::1", "localhost"] : [host];
  for (const candidate of hosts) {
    if (await probePort(candidate, port)) return true;
  }
  return false;
}

/**
 * Pick a listening port for `next start`. Falls back to nearby ports when the
 * preferred port is already bound (common when `next dev` is running).
 */
export async function resolveListeningPort(host, preferredPort, { allowFallback = true } = {}) {
  if (!(await isPortInUse(host, preferredPort))) {
    return preferredPort;
  }
  if (!allowFallback) {
    throw new Error(
      `Port ${preferredPort} is already in use. Stop the existing process or pass --port=<free-port>.`,
    );
  }
  for (let offset = 1; offset <= 20; offset++) {
    const candidate = preferredPort + offset;
    if (candidate > 65535) break;
    if (!(await isPortInUse(host, candidate))) {
      console.warn(`→ Port ${preferredPort} is in use; using ${candidate} instead.`);
      return candidate;
    }
  }
  throw new Error(`No free port found near ${preferredPort}.`);
}

/** Invoke the Next.js CLI directly so `-p` works reliably on Windows (npm drops it). */
export function startNextProductionServer({ root, port }) {
  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
  });

  const state = { serverExited: false, exitCode: null };
  server.on("exit", (code) => {
    state.serverExited = true;
    state.exitCode = code;
  });

  return { server, state };
}

export async function waitForProductionServer(host, port, serverState, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (serverState.serverExited) {
      throw new Error(
        `Production server exited before becoming ready (code ${serverState.exitCode ?? "unknown"}).`,
      );
    }
    if (await isPortInUse(host, port)) {
      try {
        const res = await fetch(`http://${host}:${port}/`, { redirect: "manual" });
        if (res.status >= 200 && res.status < 500) {
          if (serverState.serverExited) {
            throw new Error(
              `Port ${port} is already serving another process; production server exited (code ${serverState.exitCode ?? "unknown"}). Stop the existing server or pass --port=<free-port>.`,
            );
          }
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("already serving another process")) {
          throw err;
        }
        /* still booting */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for production server at http://${host}:${port}`);
}

export function shutdownProductionServer(server, shuttingDownRef) {
  shuttingDownRef.value = true;
  if (!server?.pid || server.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}
